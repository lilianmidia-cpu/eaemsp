// GET /api/painel/visitas
// Visitas ao site (tabela sessions), excluindo bots e /painel.
// Aceita ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&limit=200

// Filtro anti-bot aplicado em todas as queries
const NO_BOT = `
  AND user_agent IS NOT NULL AND length(user_agent) > 15
  AND user_agent NOT LIKE '%bot%'
  AND user_agent NOT LIKE '%crawler%'
  AND user_agent NOT LIKE '%spider%'
  AND user_agent NOT LIKE '%scraper%'
  AND user_agent NOT LIKE '%headless%'
  AND user_agent NOT LIKE '%python%'
  AND user_agent NOT LIKE '%curl%'
  AND user_agent NOT LIKE '%wget%'
  AND user_agent NOT LIKE '%Go-http%'
  AND user_agent NOT LIKE '%okhttp%'
  AND user_agent NOT LIKE '%Java/%'
  AND user_agent NOT LIKE '%facebookexternalhit%'
  AND user_agent NOT LIKE '%Facebot%'
  AND user_agent NOT LIKE '%Twitterbot%'
  AND user_agent NOT LIKE '%LinkedInBot%'
  AND user_agent NOT LIKE '%Slackbot%'
`;

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const expected = (env.PAINEL_SENHA || 'sucesso').trim();
  if (!cookies['painel_auth'] || cookies['painel_auth'] !== expected) {
    return json({ ok: false, error: 'Não autenticado' }, 401);
  }

  const limit     = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 500);
  const startDate = url.searchParams.get('startDate') || null;
  const endDate   = url.searchParams.get('endDate')   || null;

  const startTs = startDate ? dateToEpoch(startDate, 0)   : 0;
  const endTs   = endDate   ? dateToEpoch(endDate, 86399) : 9999999999;

  if (!env.DB) return json({ ok: true, rows: [], summary: {}, daily: [] });

  const BASE = `landing_url NOT LIKE '/painel%' AND created_at >= ? AND created_at <= ? ${NO_BOT}`;
  const B    = [startTs, endTs];

  try {
    const { results: rows } = await env.DB.prepare(`
      SELECT created_at, landing_url, referrer, utm_source, utm_medium,
             utm_campaign, utm_content, utm_term, fbclid, gclid,
             country, city, region, device_type, ip_address, user_agent
      FROM sessions
      WHERE ${BASE}
      ORDER BY created_at DESC LIMIT ?
    `).bind(...B, limit).all();

    const summary = await env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        COUNT(DISTINCT ip_address) AS unique_visitors,
        SUM(CASE WHEN fbclid IS NOT NULL AND fbclid != ''
                  OR lower(utm_source) IN ('facebook','instagram','fb','meta') THEN 1 ELSE 0 END) AS from_meta,
        SUM(CASE WHEN gclid IS NOT NULL AND gclid != ''
                  OR lower(utm_source) IN ('google','google-ads','googleads') THEN 1 ELSE 0 END) AS from_google,
        SUM(CASE WHEN (fbclid IS NULL OR fbclid='') AND (gclid IS NULL OR gclid='')
                  AND (utm_source IS NULL OR utm_source='')
                  AND (referrer IS NULL OR referrer='') THEN 1 ELSE 0 END) AS direct
      FROM sessions WHERE ${BASE}
    `).bind(...B).first();

    const { results: daily } = await env.DB.prepare(`
      SELECT
        date(created_at, 'unixepoch', '-3 hours') AS day,
        COUNT(*) AS total,
        COUNT(DISTINCT ip_address) AS unique_visitors
      FROM sessions WHERE ${BASE}
      GROUP BY day ORDER BY day ASC
    `).bind(...B).all();

    return json({ ok: true, rows: rows || [], summary: summary || {}, daily: daily || [] });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

function dateToEpoch(ymd, offset) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d, 3, 0, 0) / 1000) + offset;
}
function parseCookies(header) {
  const out = {};
  header.split(';').forEach(c => { const [k,...v]=c.trim().split('='); if(k) out[k.trim()]=v.join('='); });
  return out;
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
