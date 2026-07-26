import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let initialized = false;
let lastError: string | null = null;

function flag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

export function isDatabaseConfigured(): boolean {
  return Boolean(String(process.env.DATABASE_URL || '').trim());
}

export function isDatabaseReady(): boolean {
  return initialized && pool !== null;
}

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;
  const connectionString = String(process.env.DATABASE_URL || '').trim();
  const required = flag('DATABASE_REQUIRED', process.env.NODE_ENV === 'production');

  if (!connectionString) {
    if (required) throw new Error('DATABASE_URL production ortamında zorunludur.');
    console.warn('[database] DATABASE_URL yok; development JSON fallback kullanılacak.');
    initialized = true;
    return;
  }

  const sslEnabled = flag('DATABASE_SSL', process.env.NODE_ENV === 'production');
  pool = new Pool({
    connectionString,
    max: Math.max(2, Number(process.env.DATABASE_POOL_MAX) || 10),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS) || 30_000,
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS) || 10_000,
    ssl: sslEnabled
      ? { rejectUnauthorized: flag('DATABASE_SSL_REJECT_UNAUTHORIZED', true) }
      : undefined,
  });

  pool.on('error', (error) => {
    lastError = error.message;
    console.error('[database] pool error:', error.message);
  });

  try {
    await pool.query('SELECT 1');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_documents (
        tenant_key TEXT NOT NULL,
        namespace TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        version BIGINT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (tenant_key, namespace)
      );

      CREATE INDEX IF NOT EXISTS app_documents_namespace_idx
        ON app_documents (namespace, updated_at DESC);

      CREATE TABLE IF NOT EXISTS audit_events (
        id BIGSERIAL PRIMARY KEY,
        tenant_key TEXT NOT NULL DEFAULT 'default',
        actor TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        request_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS audit_events_tenant_created_idx
        ON audit_events (tenant_key, created_at DESC);
    `);
    initialized = true;
    lastError = null;
    console.log('[database] PostgreSQL bağlantısı ve şema hazır.');
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    await pool.end().catch(() => undefined);
    pool = null;
    if (required) throw error;
    initialized = true;
    console.warn(`[database] PostgreSQL bağlanamadı; development fallback aktif: ${lastError}`);
  }
}

function requirePool(): pg.Pool {
  if (!pool) throw new Error('PostgreSQL bağlantısı hazır değil.');
  return pool;
}

export async function getDatabaseDocument<T>(tenantKey: string, namespace: string): Promise<T | undefined> {
  if (!isDatabaseReady()) return undefined;
  const result = await requirePool().query<{ payload: T }>(
    'SELECT payload FROM app_documents WHERE tenant_key = $1 AND namespace = $2',
    [tenantKey, namespace],
  );
  return result.rows[0]?.payload;
}

export async function putDatabaseDocument(tenantKey: string, namespace: string, payload: unknown): Promise<void> {
  if (!isDatabaseReady()) throw new Error('PostgreSQL bağlantısı hazır değil.');
  await requirePool().query(
    `INSERT INTO app_documents (tenant_key, namespace, payload)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (tenant_key, namespace)
     DO UPDATE SET payload = EXCLUDED.payload,
                   version = app_documents.version + 1,
                   updated_at = NOW()`,
    [tenantKey, namespace, JSON.stringify(payload ?? null)],
  );
}

export async function appendDatabaseAudit(event: {
  tenantKey?: string;
  actor: string;
  actorRole: string;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
}): Promise<void> {
  if (!isDatabaseReady()) return;
  await requirePool().query(
    `INSERT INTO audit_events
      (tenant_key, actor, actor_role, action, target, metadata, request_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      event.tenantKey || 'default',
      event.actor,
      event.actorRole,
      event.action,
      event.target || null,
      JSON.stringify(event.metadata || {}),
      event.requestId || null,
    ],
  );
}

export async function readDatabaseAudit(limit = 500): Promise<Array<{
  at: string;
  user: string;
  role: string;
  action: string;
  resource?: string;
  detail?: string;
}>> {
  if (!isDatabaseReady()) return [];
  const result = await requirePool().query<{
    created_at: Date;
    actor: string;
    actor_role: string;
    action: string;
    target: string | null;
    metadata: Record<string, unknown>;
  }>(
    `SELECT created_at, actor, actor_role, action, target, metadata
       FROM audit_events
      ORDER BY created_at DESC
      LIMIT $1`,
    [Math.max(1, Math.min(2000, limit))],
  );
  return result.rows.map((row) => ({
    at: row.created_at.toISOString(),
    user: row.actor,
    role: row.actor_role,
    action: row.action,
    resource: row.target || undefined,
    detail: typeof row.metadata?.detail === 'string' ? row.metadata.detail : undefined,
  }));
}
export function getDatabaseStatus() {
  return {
    configured: isDatabaseConfigured(),
    ready: isDatabaseReady(),
    driver: 'postgresql',
    lastError,
  };
}

export async function closeDatabase(): Promise<void> {
  const current = pool;
  pool = null;
  initialized = false;
  if (current) await current.end();
}