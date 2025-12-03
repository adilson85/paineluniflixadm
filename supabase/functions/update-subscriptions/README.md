# Edge Function: update-subscriptions

## Descrição
Esta Edge Function permite atualizar subscriptions (logins) de clientes via chamada HTTP, ideal para integração com N8N ou outras automações.

## Deploy

```bash
cd "E:\Programas em desevolvimento\uniflix Adm"
npx supabase functions deploy update-subscriptions --project-ref uilmijiiaqkhstoaifpj
```

## Endpoint

```
POST https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/update-subscriptions
```

## Autenticação

Você precisa passar a `SUPABASE_ANON_KEY` ou `SERVICE_ROLE_KEY` no header:

```
Authorization: Bearer SUA_CHAVE_AQUI
```

## Parâmetros

### Obrigatórios:
- **Um dos três para identificar o cliente:**
  - `clientId` (string, UUID) - ID do cliente
  - `email` (string) - Email do cliente
  - `telefone` (string) - Telefone do cliente

- `subscriptions` (array) - Array de objetos com as atualizações

### Estrutura do array `subscriptions`:

Cada objeto no array representa uma subscription (por ordem: 1ª, 2ª, 3ª).

**Campos opcionais (atualiza apenas os campos fornecidos):**
- `app_username` (string) - Novo login
- `app_password` (string) - Nova senha
- `panel_name` (string) - Nome do painel
- `expiration_date` (string, formato YYYY-MM-DD) - Nova data de expiração
- `status` (string) - Novo status: 'active', 'expired', 'cancelled', 'suspended'
- `mac_address` (string) - Novo MAC address
- `device_key` (string) - Nova device key
- `monthly_value` (number) - Novo valor mensal

## Exemplo de Request Body

### Atualizar senhas de todos os 3 logins:
```json
{
  "email": "teste@uniflix.com",
  "subscriptions": [
    {
      "app_password": "nova_senha_01"
    },
    {
      "app_password": "nova_senha_02"
    },
    {
      "app_password": "nova_senha_03"
    }
  ]
}
```

### Atualizar login e senha de todos os 3 logins:
```json
{
  "telefone": "(11) 99999-9999",
  "subscriptions": [
    {
      "app_username": "novo_login_01",
      "app_password": "nova_senha_01"
    },
    {
      "app_username": "novo_login_02",
      "app_password": "nova_senha_02"
    },
    {
      "app_username": "novo_login_03",
      "app_password": "nova_senha_03"
    }
  ]
}
```

### Atualizar apenas o primeiro login:
```json
{
  "clientId": "11111111-1111-1111-1111-111111111111",
  "subscriptions": [
    {
      "app_username": "login_atualizado",
      "app_password": "senha_atualizada",
      "panel_name": "Elite"
    }
  ]
}
```

### Atualizar senhas e datas de expiração:
```json
{
  "email": "cliente@exemplo.com",
  "subscriptions": [
    {
      "app_password": "senha_segura_01",
      "expiration_date": "2026-12-31"
    },
    {
      "app_password": "senha_segura_02",
      "expiration_date": "2026-12-31"
    },
    {
      "app_password": "senha_segura_03",
      "expiration_date": "2026-12-31"
    }
  ]
}
```

### Atualizar MAC address e device key:
```json
{
  "email": "cliente@exemplo.com",
  "subscriptions": [
    {
      "mac_address": "AA:BB:CC:DD:EE:01",
      "device_key": "NOVA-KEY-001"
    },
    {
      "mac_address": "AA:BB:CC:DD:EE:02",
      "device_key": "NOVA-KEY-002"
    },
    {
      "mac_address": "AA:BB:CC:DD:EE:03",
      "device_key": "NOVA-KEY-003"
    }
  ]
}
```

## Resposta de Sucesso

```json
{
  "success": true,
  "message": "3 subscription(s) atualizada(s) com sucesso",
  "client": {
    "id": "uuid",
    "nome": "Cliente Teste Elite",
    "email": "teste@uniflix.com",
    "telefone": "(11) 99999-9999"
  },
  "updated_subscriptions": [
    {
      "index": 1,
      "id": "uuid-sub-1",
      "app_username": "novo_login_01",
      "panel_name": "Elite",
      "status": "active"
    },
    {
      "index": 2,
      "id": "uuid-sub-2",
      "app_username": "novo_login_02",
      "panel_name": "Elite",
      "status": "active"
    },
    {
      "index": 3,
      "id": "uuid-sub-3",
      "app_username": "novo_login_03",
      "panel_name": "Elite",
      "status": "active"
    }
  ]
}
```

## Resposta de Erro

```json
{
  "success": false,
  "error": "Cliente não encontrado"
}
```

## O que a função faz:

1. Busca o cliente (user) por ID, email ou telefone
2. Busca todas as subscriptions ativas do cliente (ordenadas por data de criação)
3. Atualiza cada subscription conforme o array fornecido (por índice)
4. Retorna quais subscriptions foram atualizadas com sucesso

## Integração com N8N

No N8N, use o nó **HTTP Request**:

- **Method**: POST
- **URL**: `https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/update-subscriptions`
- **Headers**:
  - `Authorization`: `Bearer SUA_SERVICE_ROLE_KEY`
  - `Content-Type`: `application/json`
- **Body** (JSON):
```json
{
  "email": "{{ $json.email }}",
  "subscriptions": [
    {
      "app_password": "{{ $json.nova_senha_1 }}"
    },
    {
      "app_password": "{{ $json.nova_senha_2 }}"
    },
    {
      "app_password": "{{ $json.nova_senha_3 }}"
    }
  ]
}
```

## Notas Importantes:

1. **Ordem importa**: O primeiro objeto do array atualiza a primeira subscription, o segundo atualiza a segunda, etc.
2. **Campos opcionais**: Apenas os campos fornecidos serão atualizados. Campos não fornecidos permanecem inalterados.
3. **Validação**: Se o cliente tiver menos subscriptions do que o array fornecido, as extras serão ignoradas com erro.
4. **Atualização parcial**: Você pode atualizar apenas 1, 2 ou 3 subscriptions conforme necessário.










