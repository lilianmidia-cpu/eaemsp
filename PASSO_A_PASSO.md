# Passo a passo — colocar tudo no ar

Este documento explica **em linguagem simples** o que precisa ser feito manualmente
para o painel novo (com senha) e a página `/vendaspre` funcionarem.

Tudo que dá pra automatizar já foi feito no código. As partes abaixo precisam
ser feitas no **painel da Cloudflare** (no navegador) porque envolvem segredos
e bancos de dados — coisas que não devem morar no código.

---

## O que foi criado no projeto

| Lugar                              | Pra que serve                                                  |
| ---------------------------------- | -------------------------------------------------------------- |
| `/painel/login`                    | Tela de login (senha)                                          |
| `/painel`                          | Aba **Meta Ads** (com dados zerados até conectar o Facebook)   |
| `/painel/financeiro`               | Aba **Financeiro** (gasto + impostos 12,15% a partir de 2026)  |
| `/painel/acessos`                  | Aba **Acessos** — IP, país, cidade, navegador de quem entrou   |
| `/vendaspre`                       | Cópia da página de vendas com **formulário antes** do Sympla   |
| `functions/api/painel/*`           | Endpoints do dashboard (login, logout, acessos, mocks)         |
| `functions/api/lead-presell.js`    | Recebe o form da `/vendaspre`, grava + GHL + devolve URL Sympla |
| `functions/painel/_middleware.js`  | Bloqueia o `/painel` sem senha + registra cada acesso          |
| `migrations/0016_dash_access.sql`  | Tabela do **registro de acessos**                              |
| `migrations/0017_leads_presell.sql`| Tabela dos **leads** capturados em `/vendaspre`                |

---

## Parte 1 — Aplicar as 2 novas tabelas no banco D1

> **Por quê?** O painel de Acessos só funciona depois que a tabela `dash_access`
> existe. O formulário só salva os leads depois que a `leads_presell` existe.

### Pelo painel da Cloudflare (mais fácil)

1. Abra <https://dash.cloudflare.com>
2. Menu esquerdo → **Workers & Pages** → **D1** → clique em `imersao-escritores-db`
3. Aba **Console**
4. Cole o conteúdo de `migrations/0016_dash_access.sql` → **Execute**
5. Cole o conteúdo de `migrations/0017_leads_presell.sql` → **Execute**

> Pode aparecer `success — 0 rows affected`. Isso é normal, significa que a
> tabela foi criada.

### Ou, pela linha de comando (se preferir)

```bash
cd "/Users/ica/Pasta LC Agencia ISA/krob-tracking-stack"
npx wrangler d1 execute imersao-escritores-db --remote --file=./migrations/0016_dash_access.sql
npx wrangler d1 execute imersao-escritores-db --remote --file=./migrations/0017_leads_presell.sql
```

---

## Parte 2 — Variáveis de ambiente no Cloudflare

> **Por quê?** A senha do painel e a URL do GHL não podem ficar no código
> (regra de segurança). Elas ficam no painel da Cloudflare.

1. <https://dash.cloudflare.com> → **Workers & Pages** → **imersao-escritores**
2. Aba **Settings** → seção **Environment variables** → ambiente **Production**
3. Clique em **Add variable** para cada uma:

### Obrigatórias

| Nome              | Valor                                   | Tipo            |
| ----------------- | --------------------------------------- | --------------- |
| `PAINEL_SENHA`    | `sucesso`                               | 🔒 **Encrypt**  |

> Se quiser trocar a senha depois, é só mudar o valor aqui e salvar. Não precisa
> mexer no código.

### Opcionais (mas recomendadas para a `/vendaspre`)

| Nome                  | Valor (exemplo)                                                              | Pra quê                                       |
| --------------------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| `SYMPLA_URL_ALUNOS`   | `https://www.sympla.com.br/evento/imersao-escritores-admiraveis/3386056`     | URL Sympla pro botão "ingresso alunos"        |
| `SYMPLA_URL_PUBLICO`  | `https://www.sympla.com.br/evento/imersao-escritores-admiraveis/3386056`     | URL Sympla pro botão "ingresso público"       |
| `SYMPLA_URL_DEFAULT`  | mesma URL acima                                                              | Caso o botão não bata com nenhum dos dois     |
| `GHL_WEBHOOK_URL` 🔒  | URL que o GHL gera (ver Parte 3)                                             | Pra mandar lead direto pro CRM                |

### Não mexer agora (Meta Ads — pra depois)

| Nome                 | Quando configurar                                  |
| -------------------- | -------------------------------------------------- |
| `META_ACCESS_TOKEN`  | Quando for ligar o Meta Ads no dashboard (depois)  |
| `META_AD_ACCOUNT_ID` | Junto com o token                                  |

> **IMPORTANTE:** o Meta Access Token é um segredo gigante. **NUNCA cole em
> conversa, mensagem, email, prints, lugar nenhum.** Só cole aqui, no campo
> "Encrypt" do Cloudflare. Se aparecer em qualquer outro lugar, **gere outro
> imediatamente** no Meta Events Manager.

### Depois de salvar TODAS as variáveis

Vai em **Deployments** → no último deploy → **três pontinhos** → **Retry deployment**.
Isso faz o site pegar as variáveis novas.

---

## Parte 3 — Criar o webhook no GoHighLevel (GHL)

> **Por quê?** Quando alguém preenche o form da `/vendaspre`, o sistema manda os
> dados pro GHL automaticamente. Pra isso o GHL precisa te dar uma URL única.

1. Abra o GoHighLevel → menu **Automation** → **Workflows** → **Create Workflow** → **Start from Scratch**
2. Trigger: **Inbound Webhook** → copie a URL que ele gera (algo tipo `https://services.leadconnectorhq.com/hooks/.../webhook-trigger/...`)
3. Volte na **Parte 2** acima e cole essa URL na variável `GHL_WEBHOOK_URL` (marcando 🔒 Encrypt)
4. No GHL, adicione as ações que quiser:
   - **Create / Update Contact** (mapeie os campos `full_name`, `email`, `phone`)
   - **Add Tags** (use `vendaspre`, `imersao-escritores`, `ticket-{{ticket_choice}}`)
   - Mande pra pipeline / SMS / WhatsApp / o que precisar
5. **Publish** o workflow

### Campos que o GHL vai receber

```json
{
  "full_name": "Maria Silva",
  "first_name": "Maria",
  "last_name": "Silva",
  "email": "maria@email.com",
  "phone": "11999999999",
  "tags": ["vendaspre", "imersao-escritores", "ticket-alunos"],
  "source": "vendaspre",
  "ticket_choice": "alunos",
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "imersao-sp",
  "utm_content": "",
  "utm_term": "",
  "fbp": "fb.2.1716000000.123456789",
  "fbc": ""
}
```

> Se você ainda não configurou o GHL, **não tem problema** — o form continua
> funcionando: ele só salva o lead no banco D1 e manda o cliente pro Sympla.
> Você pode configurar o GHL depois e os próximos leads vão direto.

---

## Parte 4 — Deploy

Se você usa **GitHub conectado ao Cloudflare Pages**, basta:

```bash
cd "/Users/ica/Pasta LC Agencia ISA/krob-tracking-stack"
git add .
git commit -m "Painel com senha + /vendaspre com form pré-checkout"
git push
```

A Cloudflare detecta o push e deploya sozinha (uns 2-3 minutos).

---

## Parte 5 — Testar

Depois do deploy:

1. Abra `https://imersaoescritores.com.br/painel` (ou o domínio do .pages.dev)
2. Vai redirecionar pra `/painel/login`
3. Digite a senha **`sucesso`** → deve cair no dashboard Meta Ads (com valores zerados)
4. Clique em **Acessos** — você deve ver pelo menos o seu próprio acesso listado
5. Clique em **Financeiro** — meses de 2025 e 2026 com valores zerados
6. **Sair** (botão na sidebar) → volta pra tela de login

Depois teste a `/vendaspre`:

7. Abra `https://imersaoescritores.com.br/vendaspre`
8. Clique em qualquer botão "Garantir Vaga" → o modal abre
9. Preencha nome / email / telefone → clique em **Ir para o pagamento**
10. Você é redirecionado pro Sympla
11. Volta no `/painel/acessos` (não, esse é só do painel) — pra ver os leads, use
    o D1 Console no Cloudflare:
    ```sql
    SELECT created_at, name, email, phone, ticket_choice, ghl_status FROM leads_presell ORDER BY id DESC LIMIT 10;
    ```

---

## Parte 6 — Conectar o Meta Ads (futuro)

Quando você for ligar o Meta Ads:

1. Vá em <https://business.facebook.com> → **Configurações** → **Usuários do sistema** → gere um token long-lived com permissão **ads_read** sobre a conta de anúncios da Lilian
2. Pegue também o **ID da conta de anúncios** (formato `act_123456789`)
3. Cole nas envs do Cloudflare:
   - `META_ACCESS_TOKEN` 🔒
   - `META_AD_ACCOUNT_ID`
4. **Aí me chame** — eu crio:
   - Migrations para as tabelas `meta_account`, `meta_ad_metrics`, `meta_financeiro`
   - `functions/api/sync/meta-ads.js` (faz o pull da Meta e grava no D1)
   - Substituo `meta-mock.js` por `meta.js` (lê do D1)
   - Configuração do cron-job.org (3x ao dia) pra rodar o sync sozinho

> **NÃO me mande o token em mensagem.** Você cola direto no Cloudflare e me
> avisa "tá configurado". Eu sigo o trabalho a partir daí.

---

## Trocar a senha do painel

1. Cloudflare → **Settings** → **Environment variables**
2. Edite o valor de `PAINEL_SENHA` (ou apague e crie de novo)
3. **Retry deployment**
4. O cookie velho vira automaticamente inválido — todo mundo precisa logar de novo

---

## Problemas comuns

### "Não consigo entrar com a senha sucesso"
- Confirme que `PAINEL_SENHA=sucesso` está nas envs (sem espaços antes/depois)
- Fez **Retry deployment** depois de salvar a env?
- Olhe a aba **Functions logs** no painel da Cloudflare pra ver o erro real

### "A aba Acessos está vazia"
- A tabela `dash_access` foi criada? Rode a Parte 1 de novo
- Os acessos só são logados **depois** que a tabela existir

### "O form da /vendaspre dá erro ao enviar"
- A tabela `leads_presell` foi criada? Rode a Parte 1 de novo
- Olhe o D1 Console: `SELECT * FROM leads_presell ORDER BY id DESC LIMIT 5;`

### "O lead não chega no GHL"
- A `GHL_WEBHOOK_URL` está nas envs e marcada como Encrypt?
- O workflow do GHL está **Published** (não Draft)?
- No D1, veja `ghl_status` da linha do lead — se diz `failed`, veja `ghl_response`

### "O Cloudflare reclama que falta binding DB"
- Settings → **Functions** → **D1 database bindings** → variable name **DB** → database **imersao-escritores-db**
