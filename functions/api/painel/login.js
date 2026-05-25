// POST /api/painel/login
// Body: { senha: "sucesso" }
// Se bater com env.PAINEL_SENHA, seta cookie `painel_auth` válido por 7 dias.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, 400);
  }

  const senhaEnviada = String(body.senha || '').trim();
  const senhaCorreta = (env.PAINEL_SENHA || 'sucesso').trim();

  if (!senhaEnviada || senhaEnviada !== senhaCorreta) {
    return json({ ok: false, error: 'Senha incorreta' }, 401);
  }

  // Senha OK → seta cookie com o próprio valor da senha (validado pelo middleware)
  const maxAge = 60 * 60 * 24 * 7; // 7 dias
  const cookie = `painel_auth=${senhaCorreta}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure; HttpOnly`;

  return new Response(JSON.stringify({ ok: true, redirect: '/painel' }), {
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
