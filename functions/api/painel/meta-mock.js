// GET /api/painel/meta-mock
// Dados MOCK do Meta Ads enquanto o token não foi conectado.
// Quando a Isabella conectar o Meta, este endpoint vira /api/painel/meta.js
// puxando do D1 (tabela meta_ad_metrics — a criar quando o sync entrar).
//
// Aceita ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&type=kpis|timeseries|campaigns|ads

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Auth
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const expected = (env.PAINEL_SENHA || 'sucesso').trim();
  if (cookies['painel_auth'] !== expected) {
    return json({ ok: false, error: 'Não autenticado' }, 401);
  }

  const type = url.searchParams.get('type') || 'kpis';
  const startDate = url.searchParams.get('startDate') || daysAgo(30);
  const endDate = url.searchParams.get('endDate') || today();

  const meta_connected = !!(env.META_ACCESS_TOKEN && env.META_AD_ACCOUNT_ID);

  // Estrutura igual à final, só com dados zerados / exemplo
  if (type === 'kpis') {
    return json({
      ok: true,
      meta_connected,
      data: {
        valorUsado: 0,
        alcance: 0,
        ctr: 0,
        cpm: 0,
        frequencia: 0,
      },
      note: meta_connected
        ? 'Meta conectado — substituir este endpoint pela leitura real.'
        : 'Meta Ads ainda não conectado. Configure META_ACCESS_TOKEN e META_AD_ACCOUNT_ID.',
    });
  }

  if (type === 'timeseries') {
    return json({ ok: true, meta_connected, data: emptyTimeseries(startDate, endDate) });
  }

  if (type === 'campaigns') {
    return json({ ok: true, meta_connected, data: [] });
  }

  if (type === 'ads') {
    return json({ ok: true, meta_connected, data: [] });
  }

  return json({ ok: false, error: 'type inválido' }, 400);
}

function emptyTimeseries(start, end) {
  const out = [];
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push({ date: d.toISOString().slice(0, 10), valorUsado: 0 });
  }
  return out;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function parseCookies(header) {
  const out = {};
  header.split(';').forEach((c) => {
    const [k, ...rest] = c.trim().split('=');
    if (k) out[k.trim()] = rest.join('=');
  });
  return out;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
