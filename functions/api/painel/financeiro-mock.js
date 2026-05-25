// GET /api/painel/financeiro-mock
// Estrutura do financeiro com dados MOCK até o Meta ser conectado.
// Regra de imposto: 12,15% (ISS/PIS) a partir de 2026-01-01. Antes, imposto = 0.

const TAX_RATE = 0.1215;
const TAX_START = '2026-01-01';

export async function onRequestGet(context) {
  const { request, env } = context;

  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const expected = (env.PAINEL_SENHA || 'sucesso').trim();
  if (cookies['painel_auth'] !== expected) {
    return json({ ok: false, error: 'Não autenticado' }, 401);
  }

  const meta_connected = !!(env.META_ACCESS_TOKEN && env.META_AD_ACCOUNT_ID);

  // Lista de meses (Jan/2025 até hoje) — todos zerados enquanto não conecta Meta
  const months = [];
  const start = new Date('2025-01-01T00:00:00Z');
  const now = new Date();
  const cur = new Date(start);
  while (cur <= now) {
    const monthStart = cur.toISOString().slice(0, 10);
    const spend = 0;
    const tax = monthStart >= TAX_START ? +(spend / (1 - TAX_RATE) - spend).toFixed(2) : 0;
    months.push({
      monthStart,
      spend,
      tax,
      total: +(spend + tax).toFixed(2),
    });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }

  return json({
    ok: true,
    meta_connected,
    account: {
      name: meta_connected ? 'Conta Meta Conectada' : 'Meta Ads (não conectado)',
      accountId: env.META_AD_ACCOUNT_ID || '—',
      currency: 'BRL',
      timezone: 'America/Sao_Paulo',
    },
    months,
    updatedAt: new Date().toISOString(),
    note: meta_connected
      ? 'Substituir este endpoint pela leitura real do D1 após o sync.'
      : 'Conecte META_ACCESS_TOKEN e META_AD_ACCOUNT_ID nas envs do Cloudflare.',
  });
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
