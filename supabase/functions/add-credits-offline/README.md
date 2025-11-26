# Edge Function: add-credits-offline

## Descrição
Esta Edge Function permite adicionar créditos a clientes offline via chamada HTTP, ideal para integração com N8N ou outras automações.

## Deploy

```bash
cd "e:\Programas em desevolvimento\uniflix Adm"
npx supabase functions deploy add-credits-offline --project-ref uilmijiiaqkhstoaifpj
```

## Endpoint

```
POST https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/add-credits-offline
```

## Autenticação

Você precisa passar a `SUPABASE_ANON_KEY` ou `SERVICE_ROLE_KEY` no header:

```
Authorization: Bearer SUA_CHAVE_AQUI
```

## Parâmetros

### Obrigatórios:
- **Um dos dois:**
  - `clientId` (string) - ID do cliente offline
  - `telefone` (string) - Telefone do cliente (aceita com ou sem formatação)

- `durationMonths` (number) - Quantidade de meses a adicionar (ex: 1, 3, 6, 12)

### Opcionais:
- `valorPago` (number) - Valor pago pelo cliente (registra no caixa se > 0)
- `painel` (string) - Nome do painel (default: painel do cliente)
- `historico` (string) - Descrição customizada para caixa e créditos

## Exemplo de Request Body

### Usando ID do cliente:
```json
{
  "clientId": "uuid-do-cliente",
  "durationMonths": 3,
  "valorPago": 79.90,
  "historico": "Recarga trimestral via N8N"
}
```

### Usando telefone:
```json
{
  "telefone": "(47) 99999-9999",
  "durationMonths": 1,
  "valorPago": 29.90
}
```

### Adicionar sem pagamento (renovação gratuita):
```json
{
  "telefone": "47999999999",
  "durationMonths": 1,
  "valorPago": 0
}
```

## Resposta de Sucesso

```json
{
  "success": true,
  "message": "Créditos adicionados com sucesso",
  "client": {
    "id": "uuid",
    "nome": "João Silva",
    "telefone": "(47) 99999-9999",
    "old_expiration": "2024-01-15",
    "new_expiration": "2024-04-15",
    "quantidade_logins": 2,
    "creditos_adicionados": 6
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

## O que a função faz automaticamente:

1. ✅ Busca o cliente por ID ou telefone
2. ✅ Calcula nova data de expiração (soma meses à data atual ou expiração anterior)
3. ✅ Atualiza status para "Ativo"
4. ✅ Registra movimentação no **Caixa** (se valorPago > 0)
5. ✅ Registra em **Créditos Vendidos**
6. ✅ Calcula quantidade de créditos (logins × meses)

## Integração com N8N

### 1. Node HTTP Request

**URL:**
```
https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/add-credits-offline
```

**Method:** `POST`

**Authentication:** Header Auth
- Name: `Authorization`
- Value: `Bearer SUA_ANON_KEY` ou `Bearer SUA_SERVICE_ROLE_KEY`

**Body (JSON):**
```json
{
  "telefone": "{{$json.telefone}}",
  "durationMonths": 1,
  "valorPago": 29.90
}
```

### 2. Exemplo de Fluxo N8N

```
[Webhook/Trigger]
    ↓
[Processar dados]
    ↓
[HTTP Request - add-credits-offline]
    ↓
[Send WhatsApp notification]
```

### 3. Exemplo Completo N8N

**Node 1: Webhook**
- Recebe pedido de renovação

**Node 2: HTTP Request**
- URL: `https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/add-credits-offline`
- Headers: `Authorization: Bearer CHAVE`
- Body:
```json
{
  "telefone": "{{$json.telefone}}",
  "durationMonths": {{$json.meses}},
  "valorPago": {{$json.valor}},
  "historico": "Renovação automática via N8N - Pix aprovado"
}
```

**Node 3: WhatsApp (opcional)**
- Envia confirmação ao cliente

## Exemplos de Curl

### Adicionar 1 mês por telefone:
```bash
curl -X POST https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/add-credits-offline \
  -H "Authorization: Bearer SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "telefone": "(47) 99999-9999",
    "durationMonths": 1,
    "valorPago": 29.90
  }'
```

### Adicionar 3 meses por ID:
```bash
curl -X POST https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/add-credits-offline \
  -H "Authorization: Bearer SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "uuid-do-cliente",
    "durationMonths": 3,
    "valorPago": 79.90,
    "historico": "Recarga trimestral"
  }'
```

### Renovação gratuita (cortesia):
```bash
curl -X POST https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/add-credits-offline \
  -H "Authorization: Bearer SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "telefone": "47999999999",
    "durationMonths": 1,
    "valorPago": 0,
    "historico": "Cortesia - cliente fidelizado"
  }'
```

## Segurança

- ✅ Requer autenticação (ANON_KEY ou SERVICE_ROLE_KEY)
- ✅ Aceita busca por telefone (facilita integração)
- ✅ Validações de dados
- ✅ Logs detalhados para debug
- ✅ CORS configurado

## Casos de Uso

1. **Renovação automática via Pix:**
   - N8N detecta pagamento aprovado
   - Chama a função para adicionar créditos
   - Envia confirmação ao cliente

2. **Cortesias e promoções:**
   - Admin marca cliente para ganhar 1 mês grátis
   - N8N executa e adiciona os créditos

3. **Integração com CRM:**
   - CRM detecta venda
   - Chama função para ativar cliente

4. **WhatsApp Bot:**
   - Cliente pede renovação pelo WhatsApp
   - Bot valida pagamento
   - Chama função e confirma

## Troubleshooting

### Erro: "Cliente offline não encontrado"
- Verifique se o telefone está correto
- Verifique se o ID é válido
- A função aceita telefone com ou sem formatação

### Erro: "durationMonths deve ser maior que 0"
- Informe um valor positivo para meses (1, 3, 6, 12, etc)

### Erro: "Não autorizado"
- Verifique se está passando o header Authorization
- Confirme que a chave (ANON_KEY ou SERVICE_ROLE_KEY) está correta

## Logs

Para ver os logs da função:
```bash
npx supabase functions logs add-credits-offline --project-ref uilmijiiaqkhstoaifpj
```

Ou no Dashboard:
https://supabase.com/dashboard/project/uilmijiiaqkhstoaifpj/functions/add-credits-offline
