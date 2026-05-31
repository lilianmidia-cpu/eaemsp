export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key  = url.searchParams.get('key')  || '';
  const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10), 365);

  if (!env.DASH_KEY || key !== env.DASH_KEY) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const since = Math.floor(Date.now() / 1000) - days * 86400;

  try {
    const { results } = await env.DB.prepare(`
      SELECT event_name, COUNT(*) as clicks
      FROM event_log
      WHERE event_name LIKE 'btn_%'
        AND timestamp >= ?
        AND is_bot = 0
      GROUP BY event_name
      ORDER BY clicks DESC
    `).bind(since).all();

    return new Response(JSON.stringify({ buttons: results, days }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
