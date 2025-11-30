# Edge Function: delete-client

## Descrição
Esta Edge Function permite excluir completamente um cliente do sistema, removendo todas as dependências relacionadas (subscriptions, transactions, caixa_movimentacoes, creditos_vendidos, etc.).

## ⚠️ ATENÇÃO
Esta função **exclui permanentemente** o cliente e todos os seus dados relacionados. Use com cuidado!

## Deploy

```bash
cd "E:\Programas em desevolvimento\uniflix Adm"
npx supabase functions deploy delete-client --project-ref uilmijiiaqkhstoaifpj
```

## Endpoint

```
POST https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/delete-client
```

## Autenticação

Você precisa passar a `SUPABASE_ANON_KEY` ou `SERVICE_ROLE_KEY` no header:

```
Authorization: Bearer SUA_CHAVE_AQUI
```

## Parâmetros

### Obrigatórios (um dos três):
- `clientId` (string, UUID) - ID do cliente
- `email` (string) - Email do cliente
- `telefone` (string) - Telefone do cliente

### Opcionais:
- `dryRun` (boolean, padrão: false) - Se `true`, apenas retorna informações sem excluir

## O que é excluído:

1. **Subscriptions** - Todas as assinaturas/logins do cliente
2. **User** - O registro do usuário/cliente

## O que é mantido (para relatórios contábeis):

1. **Transactions** - Todas as transações financeiras são mantidas
2. **Caixa Movimentações** - Todas as movimentações de caixa são mantidas
3. **Créditos Vendidos** - Todos os registros de créditos vendidos são mantidos

**Nota**: Os registros financeiros são preservados mesmo após a exclusão do cliente para manter a integridade dos relatórios contábeis e histórico de pagamentos.

## Exemplo de Request Body

### Excluir cliente por ID:
```json
{
  "clientId": "11111111-1111-1111-1111-111111111111"
}
```

### Verificar antes de excluir (recomendado):
```json
{
  "email": "cliente@exemplo.com",
  "dryRun": true
}
```

### Excluir cliente por email:
```json
{
  "email": "cliente@exemplo.com"
}
```

### Excluir cliente por telefone:
```json
{
  "telefone": "(11) 99999-9999"
}
```

## Resposta de Sucesso

```json
{
  "success": true,
  "message": "Cliente excluído com sucesso",
  "deleted": {
    "client": {
      "id": "uuid",
      "nome": "Adilson Martins",
      "email": "adilson@exemplo.com",
      "telefone": "(47) 99758-3447"
    },
    "subscriptions_count": 3,
    "transactions_count": 15,
    "caixa_movimentacoes_count": 5,
    "creditos_vendidos_count": 10,
    "subscriptions": [
      {
        "id": "uuid-sub-1",
        "app_username": "teste554",
        "panel_name": "Elite",
        "status": "active"
      }
    ]
  }
}
```

## Resposta de Erro

```json
{
  "success": false,
  "error": "Cliente não encontrado"
}
```

## Resposta de Dry Run

```json
{
  "success": true,
  "message": "[DRY RUN] Cliente seria excluído com os seguintes dados relacionados",
  "dry_run": true,
  "client": {
    "id": "uuid",
    "nome": "Adilson Martins",
    "email": "adilson@exemplo.com",
    "telefone": "(47) 99758-3447"
  },
  "subscriptions_count": 3,
  "transactions_count": 15,
  "caixa_movimentacoes_count": 5,
  "creditos_vendidos_count": 10,
  "subscriptions": [...]
}
```

## Integração com N8N

No N8N, use o nó **HTTP Request**:

- **Method**: POST
- **URL**: `https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/delete-client`
- **Headers**:
  - `Authorization`: `Bearer SUA_SERVICE_ROLE_KEY`
  - `Content-Type`: `application/json`
- **Body** (JSON):
```json
{
  "email": "{{ $json.email }}"
}
```

## Notas Importantes:

1. **Exclusão permanente**: Esta operação não pode ser desfeita
2. **Cascata**: A exclusão do usuário remove automaticamente subscriptions (devido ao `ON DELETE CASCADE`)
3. **Dados relacionados**: Transactions, caixa_movimentacoes e creditos_vendidos são excluídos manualmente antes do usuário
4. **Dry Run**: Sempre use `dryRun: true` primeiro para verificar o que será excluído
5. **Backup**: Considere fazer backup antes de excluir clientes importantes

