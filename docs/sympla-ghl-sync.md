# Sympla → GHL tag sync

Tags automáticas no GHL a partir do status de venda do Sympla, pra alimentar
automações de recuperação de venda e confirmação de compra aprovada.

---

## O que o sync faz

```
external cron (a cada 1h)
     │
     ▼
POST /api/sync/sympla-ghl    ← guardado por x-sync-secret
     │
     ▼
Sympla API                   ← pedidos do evento, todos os status
     │
     ▼
GHL API                      ← upsert do contato (por e-mail) + tag do status
```

Só chama o GHL quando o **grupo de status** de um pedido muda (ex: pendente
→ aprovado). Um pedido que fica pendente por várias rodadas não gera
chamadas repetidas.

### Mapa de tags

| Status Sympla | Tag no GHL |
|---|---|
| `APPROVED` | `compra-aprovada-admiraveis-ipea-sp-2026` |
| `PENDING`, `UNPAID`, `NOT_APPROVED` | `recuperacao-admiraveis-ipea-sp-2026` |
| `CANCELLED`, `REFUNDED` | `cancelada-admiraveis-ipea-sp-2026` |

Quando o pedido muda de grupo, a tag antiga é removida do contato antes da
nova ser adicionada — o contato nunca acumula tag de status velho.

Evento monitorado: **"Imersão Escritores Admiráveis"** (resolvido pelo nome
direto na API do Sympla a cada rodada — não precisa configurar o ID).

---

## Testar o lado do Sympla antes do GHL estar pronto

Dá pra confirmar que o token do Sympla e o nome do evento estão certos
**sem precisar do GHL configurado ainda** — esse GET não escreve no banco
nem chama o GHL:

```bash
curl https://your-deployment.pages.dev/api/sync/sympla-ghl \
  -H "x-sync-secret: <SYNC_SECRET>"
```

Resposta esperada:

```json
{
  "ok": true,
  "event_id": "...",
  "event_name": "Imersão Escritores Admiráveis",
  "orders_page_1": 12,
  "by_status": { "APPROVED": 10, "PENDING": 2 }
}
```

---

## One-time configuration

### 1. Token do Sympla

Já configurado (`SYMPLA_TOKEN`) — gerado em **Sympla → Minha Conta →
Integrações**.

### 2. Private Integration Token do GHL

1. No GHL, dentro da sub-conta certa: **Configurações → Private
   Integrations → Create new integration**.
2. Marque os escopos **View Contacts** e **Edit Contacts** (mínimo
   necessário pra upsert + tags).
3. Gere e copie o token — só aparece uma vez.

### 3. Location ID do GHL

Com a sub-conta aberta, olhe a URL do navegador:
`app.gohighlevel.com/location/<LOCATION_ID>/...` — copie só o ID.

### 4. Variáveis no Cloudflare

Cloudflare dashboard → projeto do painel → **Settings → Environment
variables**, todas em **Production**:

| Nome | Valor | Encrypt? |
|---|---|---|
| `GHL_API_TOKEN` | token do passo 2 | 🔒 sim |
| `GHL_LOCATION_ID` | ID do passo 3 | não (não é segredo) |

`SYMPLA_TOKEN` e `SYNC_SECRET` já existem — são reaproveitados.

Redeploy depois de adicionar as envs (elas não entram em deployments já
publicados).

### 5. Teste manual

```bash
curl -X POST https://your-deployment.pages.dev/api/sync/sympla-ghl \
  -H "x-sync-secret: <SYNC_SECRET>" \
  -H "Content-Type: application/json"
```

Resposta esperada:

```json
{ "ok": true, "rows_upserted": 3, "duration_ms": 850 }
```

`skipped:true` significa que alguma env obrigatória ainda não foi
configurada. Confira no GHL se um contato de teste recebeu a tag certa.

### 6. Agendar o cron

Mesmo processo do `docs/ad-spend-sync.md` (cron-job.org, GitHub Actions ou
similar), apontando pra `/api/sync/sympla-ghl`, **a cada 1 hora**, com o
header `x-sync-secret`.

---

## Troubleshooting

**`skipped:true`** — falta `SYMPLA_TOKEN`, `GHL_API_TOKEN` ou
`GHL_LOCATION_ID` nas envs.

**Erro `Sympla API 401`** — token do Sympla inválido ou revogado; gere um
novo em Minha Conta → Integrações.

**Erro `GHL upsert 401`** — Private Integration Token inválido, expirado
ou sem os escopos de contato.

**Evento não encontrado** — o nome do evento no Sympla mudou; o sync
procura por `"Imersão Escritores Admiráveis"` exato (ignorando acentos e
maiúsculas). Se o nome do evento mudar, atualizar `EVENT_NAME` em
`functions/api/sync/sympla-ghl.js`.
