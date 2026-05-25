// POST /api/painel/logout
// Limpa o cookie `painel_auth`.

export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true, redirect: '/painel/login' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'painel_auth=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly',
    },
  });
}
