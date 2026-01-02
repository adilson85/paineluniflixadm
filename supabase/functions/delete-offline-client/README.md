# Edge Function: delete-offline-client

## Descrição
Esta Edge Function permite excluir completamente um cliente offline do sistema, mantendo os registros financeiros para relatórios contábeis.

## ⚠️ ATENÇÃO
Esta função **exclui permanentemente** o cliente offline e seus dados pessoais. Use com cuidado!

## Deploy

```bash
cd "E:\Programas em desevolvimento\uniflix Adm"
npx supabase functions deploy delete-offline-client --project-ref uilmijiiaqkhstoaifpj
```

## Endpoint

```
POST https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/delete-offline-client
```

## Autenticação

Você precisa passar a `SUPABASE_ANON_KEY` ou `SERVICE_ROLE_KEY` no header:

```
Authorization: Bearer SUA_CHAVE_AQUI
```

## Parâmetros

### Obrigatórios (um dos três):
- `clientId` (string, UUID) - ID do cliente offline
- `email` (string) - Email do cliente offline
- `telefone` (string) - Telefone do cliente offline

### Opcionais:
- `dryRun` (boolean, padrão: false) - Se `true`, apenas retorna informações sem excluir

## O que é excluído:

1. **Cliente Offline** - O registro completo do cliente offline (nome, telefone, logins, etc.)

## O que é mantido (para relatórios contábeis):

1. **Caixa Movimentações** - Todas as movimentações de caixa são mantidas
2. **Créditos Vendidos** - Todos os registros de créditos vendidos são mantidos

**Nota**: Os registros financeiros são preservados mesmo após a exclusão do cliente para manter a integridade dos relatórios contábeis e histórico de pagamentos.

## Exemplo de Request Body

### Excluir cliente offline por ID:
```json
{
  "clientId": "11111111-1111-1111-1111-111111111111"
}
```

### Verificar antes de excluir (recomendado):
```json
{
  "telefone": "(11) 99999-9999",
  "dryRun": true
}
```

### Excluir cliente offline por email:
```json
{
  "email": "cliente@exemplo.com"
}
```

### Excluir cliente offline por telefone:
```json
{
  "telefone": "(11) 99999-9999"
}
```

## Resposta de Sucesso

```json
{
  "success": true,
  "message": "Cliente offline excluído com sucesso",
  "deleted": {
    "client": {
      "id": "uuid",
      "nome": "Cliente Offline",
      "email": "cliente@exemplo.com",
      "telefone": "(11) 99999-9999"
    },
    "logins_count": 3,
    "caixa_movimentacoes_count": 5,
    "creditos_vendidos_count": 10,
    "financial_records_preserved": {
      "caixa_movimentacoes": 5,
      "creditos_vendidos": 10
    }
  }
}
```

## Resposta de Erro

```json
{
  "success": false,
  "error": "Cliente offline não encontrado"
}
```

## Resposta de Dry Run

```json
{
  "success": true,
  "message": "[DRY RUN] Cliente offline seria excluído com os seguintes dados relacionados",
  "dry_run": true,
  "client": {
    "id": "uuid",
    "nome": "Cliente Offline",
    "email": "cliente@exemplo.com",
    "telefone": "(11) 99999-9999"
  },
  "logins_count": 3,
  "caixa_movimentacoes_count": 5,
  "creditos_vendidos_count": 10,
  "financial_records_preserved": {
    "caixa_movimentacoes": 5,
    "creditos_vendidos": 10
  }
}
```

## Integração com N8N

No N8N, use o nó **HTTP Request**:

- **Method**: POST
- **URL**: `https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/delete-offline-client`
- **Headers**:
  - `Authorization`: `Bearer SUA_SERVICE_ROLE_KEY`
  - `Content-Type`: `application/json`
- **Body** (JSON):
```json
{
  "telefone": "{{ $json.telefone }}"
}
```

## Notas Importantes:

1. **Exclusão permanente**: Esta operação não pode ser desfeita
2. **Registros financeiros**: Transactions, caixa_movimentacoes e creditos_vendidos são mantidos para relatórios
3. **Dry Run**: Sempre use `dryRun: true` primeiro para verificar o que será excluído
4. **Backup**: Considere fazer backup antes de excluir clientes importantes


















