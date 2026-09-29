// GET /api/painel/compradores-gravacao
// Aceita ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (fuso de Brasília), igual o
// resto do painel. O início nunca vai antes do go-live da Gravação.
//
// Lista cada compra da Gravação (Hotmart) com a origem da venda:
// purchase_log.trk → checkout_sessions (visita da compra) → sessions (visitante).
// Vendas reembolsadas/chargeback/canceladas aparecem na lista, mas ficam fora
// dos totais.
//
// De onde vem cada sinal (importa pra interpretar):
//   - UTMs de purchase_log: última visita com UTM nos últimos 90 dias (vêm do
//     sck da Hotmart ou do checkout_sessions).
//   - checkout_sessions.user_agent: navegador NO MOMENTO da compra.
//   - sessions.referrer / landing_url / created_at: PRIMEIRA visita desse
//     visitante (cookie de 400 dias, o upsert não sobrescreve), pode ser antiga.

const HOTMART_PRODUCT_ID_GRAVACAO = '8500318';
const GRAVACAO_GO_LIVE_TS = Math.floor(Date.UTC(2026, 8, 22, 14, 51, 22) / 1000); // 22/09/2026 11:51 (BRT)
const SITE_HOST_RE = /(^|\.)imersaoescritores\.com\.br$/i;

// Ordem = ordem de exibição no painel.
const ORIGENS = ['meta_ads', 'google_ads', 'email', 'instagram', 'facebook', 'whatsapp', 'busca', 'outros', 'direto'];

export async function onRequestGet(context) {
  const { request, env } = context;

  // Sem PAINEL_SENHA configurada, ninguém entra: esta rota devolve nome e
  // e-mail de comprador, então não pode cair em senha padrão do código.
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const expected = (env.PAINEL_SENHA || '').trim();
  if (!expected || !cookies['painel_auth'] || cookies['painel_auth'] !== expected) {
    return json({ ok: false, error: 'Não autenticado' }, 401);
  }

  if (!env.DB) return json({ ok: true, data: { resumo: resumoVazio(), compradores: [] } });

  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate');
  const endDate   = url.searchParams.get('endDate');
  const startTs = Math.max(startDate ? dateToEpoch(startDate, 0) : 0, GRAVACAO_GO_LIVE_TS);
  const endTs   = endDate ? dateToEpoch(endDate, 86399) : 4102444800; // 2100-01-01

  try {
    const { results } = await env.DB.prepare(`
      SELECT p.created_at, p.raw_name, p.raw_email, p.value, p.transaction_id,
             COALESCE(p.status, 'approved') AS status,
             p.utm_source, p.utm_medium, p.utm_campaign, p.utm_content,
             p.gclid, p.gbraid, p.wbraid,
             COALESCE(c.user_agent, p.client_user_agent) AS checkout_ua,
             s.fbclid, s.referrer, s.landing_url, s.city, s.region,
             s.created_at AS primeira_visita
      FROM purchase_log p
      LEFT JOIN checkout_sessions c ON c.trk = p.trk
      LEFT JOIN sessions s ON s.session_id = c.session_id
      WHERE p.product_id = ? AND p.created_at >= ? AND p.created_at <= ?
      ORDER BY p.created_at DESC
      LIMIT 1000
    `).bind(HOTMART_PRODUCT_ID_GRAVACAO, startTs, endTs).all();

    const compradores = (results || []).map(r => ({
      data: r.created_at,
      nome: r.raw_name || '',
      email: r.raw_email || '',
      valor: r.value || 0,
      transacao: r.transaction_id || '',
      status: r.status,
      ...classificarOrigem(r),
      aparelho: aparelho(r.checkout_ua),
      app: appDoNavegador(r.checkout_ua),
      primeira_visita: r.primeira_visita || null,
      primeira_pagina: pathOf(r.landing_url),
      utm_source: r.utm_source || '',
      utm_medium: r.utm_medium || '',
      utm_campaign: r.utm_campaign || '',
      utm_content: r.utm_content || '',
      cidade: [r.city, r.region].filter(Boolean).join(' / '),
    }));

    return json({ ok: true, data: { resumo: resumir(compradores), compradores } });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

// Primeira regra que bater vence.
//   1. Com UTM: a UTM manda (é o link que a equipe marcou).
//   2. Sem UTM: gclid → Google Ads; app no momento da compra (Instagram/
//      Facebook); site de onde veio na primeira visita; fbclid; senão direto.
// Meta Ads exige medium de anúncio (pago, paid_social, cpc...): link de Bio ou
// Stories com utm_source=instagram cai em Instagram orgânico, não em anúncio.
function classificarOrigem(r) {
  const src = (r.utm_source || '').trim().toLowerCase();
  const med = (r.utm_medium || '').trim().toLowerCase();
  const cmp = r.utm_campaign || '';
  const pago = /pago|paid|cpc|ppc|^ads?$|display/.test(med);

  if (src) {
    if (/^(meta|facebook|fb|instagram|ig)$/.test(src) && (pago || (src === 'meta' && !med))) {
      return { origem: 'meta_ads', detalhe: cmp };
    }
    if (/google|youtube/.test(src) && pago) return { origem: 'google_ads', detalhe: cmp };
    if (/e-?mail|newsletter|encharge/.test(src) || /e-?mail/.test(med)) return { origem: 'email', detalhe: cmp };
    if (/^(instagram|ig)$/.test(src)) return { origem: 'instagram', detalhe: juntar(rotuloMedium(med), cmp) };
    if (/^(facebook|fb)$/.test(src)) return { origem: 'facebook', detalhe: juntar(rotuloMedium(med), cmp) };
    if (/whats|wpp|zap/.test(src)) return { origem: 'whatsapp', detalhe: juntar(rotuloMedium(med), cmp) };
    if (src === 'google') return { origem: 'busca', detalhe: juntar('Google', cmp) };
    return { origem: 'outros', detalhe: juntar(r.utm_source, cmp) };
  }

  if (r.gclid || r.gbraid || r.wbraid) return { origem: 'google_ads', detalhe: 'clique de anúncio sem UTM' };

  const app = appDoNavegador(r.checkout_ua);
  if (app === 'Instagram') return { origem: 'instagram', detalhe: 'sem detalhe (comprou pelo app, link sem UTM)' };
  if (app === 'Facebook')  return { origem: 'facebook',  detalhe: 'sem detalhe (comprou pelo app, link sem UTM)' };

  const host = hostOf(r.referrer);
  if (host && !SITE_HOST_RE.test(host)) {
    const d = 'primeira visita veio de ' + host;
    if (/instagram\.com$/.test(host)) return { origem: 'instagram', detalhe: d };
    if (/facebook\.com$|fb\.com$/.test(host)) return { origem: 'facebook', detalhe: d };
    if (/whatsapp\.com$|wa\.me$/.test(host)) return { origem: 'whatsapp', detalhe: d };
    if (/(^|\.)google\.|bing\.com$|duckduckgo\.com$|search\.yahoo\.com$/.test(host)) return { origem: 'busca', detalhe: d };
    return { origem: 'outros', detalhe: d };
  }

  if (r.fbclid) return { origem: 'facebook', detalhe: 'link do Facebook/Instagram sem UTM' };
  return { origem: 'direto', detalhe: '' };
}

const MEDIUM_ROTULO = {
  bio: 'Bio', stories: 'Stories', story: 'Stories', direct: 'Direct', dm: 'Direct',
  reels: 'Reels', post: 'Post', feed: 'Post', organico: '', organic: '',
};
function rotuloMedium(med) {
  if (!med) return 'sem detalhe';
  if (med in MEDIUM_ROTULO) return MEDIUM_ROTULO[med];
  return med.charAt(0).toUpperCase() + med.slice(1);
}
function juntar(...partes) { return partes.filter(Boolean).join(' · '); }

function appDoNavegador(ua) {
  if (!ua) return '';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'Facebook';
  return '';
}
function aparelho(ua) {
  if (!ua) return '';
  return /Mobi|Android|iPhone|iPad/i.test(ua) ? 'Celular' : 'Computador';
}

function resumir(compradores) {
  const resumo = resumoVazio();
  for (const c of compradores) {
    if (c.status !== 'approved') { resumo.desfeitas += 1; continue; }
    resumo.vendas += 1;
    resumo.total += c.valor;
    const o = resumo.por_origem[c.origem];
    o.vendas += 1;
    o.total += c.valor;
  }
  return resumo;
}

function resumoVazio() {
  const por_origem = {};
  for (const k of ORIGENS) por_origem[k] = { vendas: 0, total: 0 };
  return { vendas: 0, total: 0, desfeitas: 0, por_origem };
}

function hostOf(u) {
  try { return u ? new URL(u).hostname.replace(/^(www|l|m|lm)\./, '') : ''; } catch { return ''; }
}
function pathOf(u) {
  try { return u ? new URL(u).pathname : ''; } catch { return ''; }
}
function dateToEpoch(ymd, offset) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d, 3, 0, 0) / 1000) + offset;
}
function parseCookies(h) {
  const o = {};
  h.split(';').forEach(c => { const [k, ...v] = c.trim().split('='); if (k) o[k.trim()] = v.join('='); });
  return o;
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
