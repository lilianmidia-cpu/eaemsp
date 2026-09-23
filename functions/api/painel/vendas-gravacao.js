// GET /api/painel/vendas-gravacao
// Número de vendas aprovadas da Gravação (produto Hotmart), direto de
// purchase_log — fonte única de verdade, sem risco de contagem duplicada
// como acontecia puxando do Meta/Google (ver relatorio-gastos/README.md,
// seção "Gravação: nova célula").

const HOTMART_PRODUCT_ID_GRAVACAO = '8500318';

export async function onRequestGet(context) {
  const { request, env } = context;

  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const expected = (env.PAINEL_SENHA || 'sucesso').trim();
  if (!cookies['painel_auth'] || cookies['painel_auth'] !== expected) {
    return json({ ok: false, error: 'Não autenticado' }, 401);
  }

  if (!env.DB) return json({ ok: true, data: { vendas: 0, total: 0 } });

  try {
    const r = await env.DB.prepare(`
      SELECT COUNT(*) AS vendas, COALESCE(SUM(value), 0) AS total
      FROM purchase_log
      WHERE product_id = ?
    `).bind(HOTMART_PRODUCT_ID_GRAVACAO).first();

    return json({ ok: true, data: { vendas: r?.vendas || 0, total: r?.total || 0 } });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

function parseCookies(h) {
  const o = {};
  h.split(';').forEach(c => { const [k, ...v] = c.trim().split('='); if (k) o[k.trim()] = v.join('='); });
  return o;
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
