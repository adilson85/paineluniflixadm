# Edge Function: delete-teste

## Descrição
Esta Edge Function permite excluir um teste liberado do sistema.

## ⚠️ ATENÇÃO
Esta função **exclui permanentemente** o teste liberado. Use com cuidado!

## Deploy

```bash
cd "E:\Programas em desevolvimento\uniflix Adm"
npx supabase functions deploy delete-teste --project-ref uilmijiiaqkhstoaifpj
```

## Endpoint

```
POST https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/delete-teste
```

## Autenticação

Você precisa passar a `SUPABASE_ANON_KEY` ou `SERVICE_ROLE_KEY` no header:

```
Authorization: Bearer SUA_CHAVE_AQUI
```

## Parâmetros

### Obrigatórios:
- `testeId` (string, UUID) - ID do teste liberado

### Opcionais:
- `dryRun` (boolean, padrão: false) - Se `true`, apenas retorna informações sem excluir

## Exemplo de Request Body

### Excluir teste liberado:
```json
{
  "testeId": "11111111-1111-1111-1111-111111111111"
}
```

### Verificar antes de excluir (recomendado):
```json
{
  "testeId": "11111111-1111-1111-1111-111111111111",
  "dryRun": true
}
```

## Resposta de Sucesso

```json
{
  "success": true,
  "message": "Teste liberado excluído com sucesso",
  "deleted": {
    "teste": {
      "id": "uuid",
      "nome": "Felipe Pedro Alves Ribeiro",
      "telefone": "+5577988041398",
      "email": "teste@exemplo.com",
      "data_teste": "2025-11-30",
      "aplicativo": "Quick Player",
      "assinante": false
    }
  }
}
```

## Resposta de Erro

```json
{
  "success": false,
  "error": "Teste liberado não encontrado"
}
```

## Integração com N8N

No N8N, use o nó **HTTP Request**:

- **Method**: POST
- **URL**: `https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/delete-teste`
- **Headers**:
  - `Authorization`: `Bearer SUA_SERVICE_ROLE_KEY`
  - `Content-Type`: `application/json`
- **Body** (JSON):
```json
{
  "testeId": "{{ $json.teste_id }}"
}
```

## Notas Importantes:

1. **Exclusão permanente**: Esta operação não pode ser desfeita
2. **Dry Run**: Sempre use `dryRun: true` primeiro para verificar o que será excluído
3. **Backup**: Considere fazer backup antes de excluir testes importantes














