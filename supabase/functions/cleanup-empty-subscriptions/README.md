# Edge Function: cleanup-empty-subscriptions

## Descrição
Esta Edge Function remove subscriptions (logins) que possuem login ou senha vazios da tabela `subscriptions`, evitando erros futuros no sistema.

## Deploy

```bash
cd "E:\Programas em desevolvimento\uniflix Adm"
npx supabase functions deploy cleanup-empty-subscriptions --project-ref uilmijiiaqkhstoaifpj
```

## Endpoint

```
POST https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/cleanup-empty-subscriptions
```

## Autenticação

Você precisa passar a `SUPABASE_ANON_KEY` ou `SERVICE_ROLE_KEY` no header:

```
Authorization: Bearer SUA_CHAVE_AQUI
```

## Parâmetros

Todos os parâmetros são **opcionais**:

- `clientId` (string, UUID) - Limpar apenas subscriptions de um cliente específico
- `email` (string) - Limpar apenas subscriptions de um cliente por email
- `telefone` (string) - Limpar apenas subscriptions de um cliente por telefone
- `dryRun` (boolean, padrão: false) - Se `true`, apenas retorna quais seriam excluídas sem excluir de fato

**Se nenhum parâmetro for fornecido, limpa TODAS as subscriptions vazias do sistema.**

## Critérios de Exclusão

Uma subscription será excluída se:
- `app_username` estiver vazio, null, ou for a string "EMPTY"
- **OU** `app_password` estiver vazio, null, ou for a string "EMPTY"

## Exemplo de Request Body

### Limpar todas as subscriptions vazias do sistema:
```json
{}
```

### Verificar quais seriam excluídas (sem excluir):
```json
{
  "dryRun": true
}
```

### Limpar subscriptions vazias de um cliente específico:
```json
{
  "email": "cliente@exemplo.com"
}
```

### Limpar subscriptions vazias de um cliente por telefone:
```json
{
  "telefone": "(11) 99999-9999"
}
```

### Limpar subscriptions vazias de um cliente por ID:
```json
{
  "clientId": "11111111-1111-1111-1111-111111111111"
}
```

### Verificar quais seriam excluídas de um cliente específico:
```json
{
  "email": "cliente@exemplo.com",
  "dryRun": true
}
```

## Resposta de Sucesso

```json
{
  "success": true,
  "message": "3 subscription(s) vazia(s) excluída(s) com sucesso",
  "deleted_count": 3,
  "deleted_by_client": [
    {
      "user_id": "uuid-cliente-1",
      "user_name": "Adilson Martins",
      "user_email": "adilson@exemplo.com",
      "user_phone": "(47) 99758-3447",
      "deleted_count": 2,
      "subscriptions": [
        {
          "id": "uuid-sub-1",
          "app_username": "(vazio)",
          "panel_name": "(vazio)",
          "status": "active"
        },
        {
          "id": "uuid-sub-2",
          "app_username": "(vazio)",
          "panel_name": "Elite",
          "status": "active"
        }
      ]
    },
    {
      "user_id": "uuid-cliente-2",
      "user_name": "Outro Cliente",
      "user_email": "outro@exemplo.com",
      "user_phone": "(11) 88888-8888",
      "deleted_count": 1,
      "subscriptions": [
        {
          "id": "uuid-sub-3",
          "app_username": "teste",
          "panel_name": "(vazio)",
          "status": "active"
        }
      ]
    }
  ],
  "deleted_subscriptions": [
    {
      "id": "uuid-sub-1",
      "user_id": "uuid-cliente-1",
      "user_name": "Adilson Martins",
      "user_email": "adilson@exemplo.com",
      "app_username": "(vazio)",
      "panel_name": "(vazio)",
      "status": "active"
    }
  ]
}
```

## Resposta de Erro

```json
{
  "success": false,
  "error": "Erro ao buscar subscriptions: ..."
}
```

## Resposta quando não há subscriptions vazias

```json
{
  "success": true,
  "message": "Nenhuma subscription vazia encontrada",
  "deleted_count": 0,
  "deleted_subscriptions": []
}
```

## Integração com N8N

### Exemplo 1: Limpar todas as subscriptions vazias

No N8N, use o nó **HTTP Request**:

- **Method**: POST
- **URL**: `https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/cleanup-empty-subscriptions`
- **Headers**:
  - `Authorization`: `Bearer SUA_SERVICE_ROLE_KEY`
  - `Content-Type`: `application/json`
- **Body** (JSON):
```json
{}
```

### Exemplo 2: Verificar antes de excluir

1. Primeiro, faça uma chamada com `dryRun: true`:
```json
{
  "dryRun": true
}
```

2. Analise a resposta para ver quais seriam excluídas
3. Se estiver tudo certo, faça outra chamada sem `dryRun` para excluir de fato

### Exemplo 3: Limpar subscriptions vazias de um cliente específico

```json
{
  "email": "{{ $json.email }}"
}
```

## Agendamento Automático

Você pode configurar no N8N para executar esta função periodicamente (ex: diariamente) para manter o banco limpo automaticamente.

### Workflow N8N Sugerido:

1. **Schedule Trigger** - Executa diariamente às 2h da manhã
2. **HTTP Request** - Chama a função `cleanup-empty-subscriptions`
3. **IF** - Verifica se `deleted_count > 0`
4. **Send Email/Notification** - Notifica se houve exclusões (opcional)

## Notas Importantes:

1. **Atenção**: Esta função **exclui permanentemente** as subscriptions. Use `dryRun: true` primeiro para verificar.
2. **Critério**: Exclui se login **OU** senha estiver vazio (não precisa estar ambos vazios).
3. **Segurança**: A função usa `SERVICE_ROLE_KEY`, então tenha cuidado ao expor em workflows públicos.
4. **Performance**: Para grandes volumes, considere executar por cliente específico em vez de todos de uma vez.

## Casos de Uso:

- **Limpeza periódica**: Executar diariamente/semanalmente para manter o banco limpo
- **Pós-migração**: Após migrar dados, limpar subscriptions vazias que sobraram
- **Correção manual**: Quando identificar subscriptions vazias manualmente, usar para limpar
- **Manutenção preventiva**: Evitar erros futuros no sistema

