# Edge Function: add-credits

## Descrição
Esta Edge Function permite adicionar créditos a clientes normais (com subscriptions) via chamada HTTP, ideal para integração com N8N ou outras automações.

## Deploy

```bash
cd "E:\Programas em desevolvimento\uniflix Adm"
npx supabase functions deploy add-credits --project-ref SEU_PROJECT_REF
```

## Endpoint

```
POST https://SEU_PROJECT_REF.supabase.co/functions/v1/add-credits
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
  - `telefone` (string) - Telefone do cliente (aceita com ou sem formatação)

- **Um dos dois para definir a duração:**
  - `rechargeOptionId` (string, UUID) - ID da opção de recarga (busca duration_months automaticamente)
  - `durationMonths` (number) - Quantidade de meses diretamente (ex: 1, 3, 6, 12)

### Opcionais:
- `valorPago` (number) - Valor pago pelo cliente (se não fornecido e usar rechargeOptionId, usa o preço da opção)
- `descontoTipo` (string) - Tipo de desconto: `'percentual'` ou `'fixo'`
- `descontoValor` (number) - Valor do desconto (percentual ou fixo)
- `historico` (string) - Descrição customizada para caixa e créditos

## Exemplo de Request Body

### Usando ID do cliente e opção de recarga:
```json
{
  "clientId": "11111111-1111-1111-1111-111111111111",
  "rechargeOptionId": "uuid-da-opcao-recarga",
  "valorPago": 75.00,
  "historico": "Recarga via N8N"
}
```

### Usando email e duração direta:
```json
{
  "email": "teste@uniflix.com",
  "durationMonths": 3,
  "valorPago": 150.00,
  "descontoTipo": "percentual",
  "descontoValor": 10
}
```

### Usando telefone e duração direta:
```json
{
  "telefone": "(11) 99999-9999",
  "durationMonths": 1,
  "valorPago": 0
}
```

### Com desconto fixo:
```json
{
  "email": "cliente@exemplo.com",
  "rechargeOptionId": "uuid-da-opcao",
  "descontoTipo": "fixo",
  "descontoValor": 10.00
}
```

## Resposta de Sucesso

```json
{
  "success": true,
  "message": "Créditos adicionados com sucesso",
  "client": {
    "id": "uuid",
    "nome": "Cliente Teste Elite",
    "email": "teste@uniflix.com",
    "telefone": "(11) 99999-9999",
    "quantidade_pontos": 3,
    "creditos_adicionados": 9,
    "duration_months": 3,
    "valor_pago": 225.00
  },
  "subscriptions": [
    {
      "id": "uuid-subscription-1",
      "old_expiration": "2025-12-10",
      "new_expiration": "2026-03-10"
    },
    {
      "id": "uuid-subscription-2",
      "old_expiration": "2025-12-10",
      "new_expiration": "2026-03-10"
    },
    {
      "id": "uuid-subscription-3",
      "old_expiration": "2025-12-10",
      "new_expiration": "2026-03-10"
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
2. Busca a opção de recarga (se fornecido `rechargeOptionId`)
3. Busca todas as subscriptions ativas do cliente
4. Calcula quantidade de créditos (pontos × meses)
5. Atualiza datas de expiração de todas as subscriptions
6. Registra entrada no caixa (se valor pago > 0)
7. Cria transação (para acionar trigger de comissão)
8. Registra créditos vendidos

## Integração com N8N

No N8N, use o nó **HTTP Request**:

- **Method**: POST
- **URL**: `https://SEU_PROJECT_REF.supabase.co/functions/v1/add-credits`
- **Headers**:
  - `Authorization`: `Bearer SUA_SERVICE_ROLE_KEY`
  - `Content-Type`: `application/json`
- **Body** (JSON):
```json
{
  "email": "{{ $json.email }}",
  "rechargeOptionId": "{{ $json.rechargeOptionId }}",
  "valorPago": {{ $json.valorPago }},
  "historico": "Recarga automática via N8N"
}
```








