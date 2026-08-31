// GET /api/visitors?key=...&days=30&page=/vendas2
// Returns: sessions, unique_visitors, countries, devices, traffic sources

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!env.DASH_KEY || key !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const days  = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const page  = url.searchParams.get('page') || '';
  const since = Math.floor(Date.now() / 1000) - days * 86400;

  const where  = page ? `created_at >= ? AND landing_url LIKE ?` : `created_at >= ?`;
  const params = page ? [since, `%${page}%`] : [since];

  try {
    const totals = await env.DB.prepare(
      `SELECT COUNT(*) as sessions, COUNT(DISTINCT external_id) as unique_visitors FROM sessions WHERE ${where}`
    ).bind(...params).first();

    const countries = await env.DB.prepare(
      `SELECT country, region, COUNT(*) as visits FROM sessions WHERE ${where} AND country != ''
       GROUP BY country, region ORDER BY visits DESC LIMIT 15`
    ).bind(...params).all();

    const devices = await env.DB.prepare(
      `SELECT device_type, COUNT(*) as visits FROM sessions WHERE ${where} AND device_type != ''
       GROUP BY device_type ORDER BY visits DESC`
    ).bind(...params).all();

    const sources = await env.DB.prepare(
      `SELECT
         CASE
           WHEN fbclid != '' THEN 'Meta (pago)'
           WHEN gclid != ''  THEN 'Google (pago)'
           WHEN utm_medium LIKE '%cpc%' OR utm_medium LIKE '%paid%' THEN 'Pago - ' || COALESCE(NULLIF(utm_source,''), 'outro')
           WHEN utm_source != '' THEN utm_source
           WHEN referrer != ''   THEN 'Referral'
           ELSE 'Direto'
         END as source,
         COUNT(*) as visits
       FROM sessions WHERE ${where}
       GROUP BY source ORDER BY visits DESC LIMIT 10`
    ).bind(...params).all();

    const allDevices = devices.results || [];
    const totalSessions = Number(totals?.sessions || 0);
    const mobileVisits  = allDevices.find(d => d.device_type === 'mobile')?.visits || 0;
    const mobilePercent = totalSessions > 0 ? Math.round((mobileVisits / totalSessions) * 100) : 0;

    return json({
      days,
      sessions:        totalSessions,
      unique_visitors: Number(totals?.unique_visitors || 0),
      top_country:     countries.results?.[0]?.country || null,
      mobile_percent:  mobilePercent,
      countries:       countries.results || [],
      devices:         allDevices,
      sources:         sources.results || [],
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw || '', 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
