/**
 * Fetch promotion HTML from an externally configured source.
 *
 * Required:
 *   PROMOS_REMOTE_URL=https://example.com/promotions
 *
 * Run from server dir:
 *   npm run fetch-promos
 */

const TARGET = process.env.PROMOS_REMOTE_URL;
const OUT_HTML = 'promotions-all.html';
const OUT_JSON = 'promotions-data.json';

if (!TARGET) {
  console.error('PROMOS_REMOTE_URL is not configured. No remote promotion source will be fetched.');
  process.exit(1);
}

async function getRawHtmlWithFetch() {
  const res = await fetch(TARGET, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: new URL(TARGET).origin,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function cleanAndExtract(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(text);
  const doc = dom.window.document;

  ['[role="dialog"]', '.modal', '.fancybox-content', '.promo-modal', '.promo-popup', '.popup'].forEach((sel) => {
    doc.querySelectorAll(sel).forEach((n) => n.remove());
  });

  const cleanedHtml = doc.body.innerHTML;
  const baseUrl = new URL(TARGET).origin;
  const items = [];

  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const title = (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 200);
    if (!title) return;
    const full = href.startsWith('http') ? href : new URL(href, baseUrl).href;
    items.push({ href: full, title });
  });

  const uniqueItems = Array.from(
    new Map(items.map((it) => [it.title + it.href, it])).values()
  );
  return { cleanedHtml, links: uniqueItems };
}

async function getOutDir() {
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __filename = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(__filename), '..');
}

async function main() {
  console.log('Fetching remote promotions source...');
  const html = await getRawHtmlWithFetch();
  const { cleanedHtml, links } = await cleanAndExtract(html);

  const fs = await import('fs/promises');
  const path = await import('path');
  const outDir = await getOutDir();

  await fs.writeFile(path.join(outDir, OUT_HTML), cleanedHtml, 'utf8');
  await fs.writeFile(path.join(outDir, OUT_JSON), JSON.stringify(links, null, 2), 'utf8');

  console.log('Wrote', OUT_HTML, 'and', OUT_JSON);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
