/**
 * Request ID (Correlation ID) Plugin
 *
 * Her gelen isteğe benzersiz bir X-Request-Id atar.
 * İstemci kendi ID'sini gönderirse onu kullanır.
 * Tüm yanıtlara ve log'lara eklenir → uçtan uca takip.
 */
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';

export async function registerRequestId(app: FastifyInstance): Promise<void> {
  // Her isteğe unique ID ata
  app.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers['x-request-id'] as string | undefined;
    const requestId = incoming?.trim() || randomUUID();

    // Fastify'ın kendi id mekanizmasına bağla
    (request as any).requestId = requestId;

    // Yanıt header'ına ekle
    reply.header('X-Request-Id', requestId);
  });

  // Access log: her istek tamamlandığında
  app.addHook('onResponse', async (request, reply) => {
    const requestId = (request as any).requestId || '-';
    const { method, url } = request;
    const statusCode = reply.statusCode;
    const responseTime = reply.elapsedTime?.toFixed(1) ?? '?';

    request.log.info({
      requestId,
      method,
      url: url.split('?')[0], // Query string'i loglamayalım
      statusCode,
      responseTimeMs: responseTime,
    }, `${method} ${url.split('?')[0]} ${statusCode} ${responseTime}ms`);
  });
}
