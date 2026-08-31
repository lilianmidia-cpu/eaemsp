// POST /api/estrutura/login
// Seta cookie `estrutura_auth` — separado do painel_auth.
// Usa a mesma senha (env PAINEL_SENHA), mas cookie independente.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, 400);
  }

  const senhaEnviada  = String(body.senha || '').trim();
  const senhaCorreta  = (env.ESTRUTURA_SENHA || 'VEJA').trim();

  if (!senhaEnviada || senhaEnviada !== senhaCorreta) {
    return json({ ok: false, error: 'Senha incorreta' }, 401);
  }

  const maxAge = 60 * 60 * 24 * 7; // 7 dias
  const cookie = `estrutura_auth=${senhaCorreta}; Path=/estrutura; Max-Age=${maxAge}; SameSite=Lax; Secure; HttpOnly`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
