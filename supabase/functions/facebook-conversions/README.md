# Edge Function: facebook-conversions

Envia eventos de conversão para a API de Conversões do Facebook Ads automaticamente.

## Eventos Rastreados

- **Purchase** - Quando cliente faz recarga/assinatura
- **Lead** - Quando alguém solicita teste
- **Subscribe** - Nova assinatura ativa
- **CompleteRegistration** - Novo cliente cadastrado

## Configuração

### 1. Definir Variáveis de Ambiente no Supabase

```bash
npx supabase secrets set FB_PIXEL_ID=1151480982222742
npx supabase secrets set FB_ACCESS_TOKEN=SEU_TOKEN_AQUI
```

### 2. Deploy da Função

```bash
cd "E:\Programas em desevolvimento\uniflix Adm"
npx supabase functions deploy facebook-conversions
```

## Uso Manual

### Endpoint

```
POST https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/facebook-conversions
```

### Headers

```
Authorization: Bearer SUA_SERVICE_ROLE_KEY
Content-Type: application/json
```

### Body Exemplo - Purchase (Recarga)

```json
{
  "eventName": "Purchase",
  "eventId": "txn_123456789",
  "userId": "uuid-do-usuario",
  "email": "cliente@email.com",
  "phone": "47999999999",
  "firstName": "João",
  "lastName": "Silva",
  "value": 95.00,
  "currency": "BRL",
  "contentName": "Recarga 1 mês",
  "eventSourceUrl": "https://uniflix-adm.netlify.app"
}
```

### Body Exemplo - Lead (Teste Liberado)

```json
{
  "eventName": "Lead",
  "eventId": "lead_123456789",
  "email": "teste@email.com",
  "phone": "47988888888",
  "firstName": "Maria",
  "contentName": "Solicitação de Teste"
}
```

### Body Exemplo - Subscribe (Nova Assinatura)

```json
{
  "eventName": "Subscribe",
  "eventId": "sub_123456789",
  "userId": "uuid-do-usuario",
  "email": "novo@email.com",
  "phone": "47977777777",
  "firstName": "Pedro",
  "value": 95.00,
  "contentName": "Plano Ponto Único"
}
```

## Parâmetros

### Obrigatórios
- `eventName` (string) - Nome do evento: Purchase, Lead, Subscribe, CompleteRegistration

### Opcionais
- `eventId` (string) - ID único para deduplicação (recomendado)
- `userId` (string) - UUID do usuário no banco
- `email` (string) - Email do usuário (hasheado automaticamente)
- `phone` (string) - Telefone do usuário (hasheado automaticamente)
- `firstName` (string) - Primeiro nome (hasheado automaticamente)
- `lastName` (string) - Sobrenome (hasheado automaticamente)
- `value` (number) - Valor da conversão em R$
- `currency` (string) - Moeda (padrão: BRL)
- `contentName` (string) - Nome do produto/serviço
- `eventSourceUrl` (string) - URL de origem do evento

## Segurança

✅ **Dados Hasheados**: Email, telefone e nome são automaticamente hasheados com SHA256 antes de enviar ao Facebook (conforme exigência GDPR/LGPD)

✅ **Deduplicação**: Use `eventId` único para evitar eventos duplicados

✅ **Tokens Protegidos**: Access Token fica nas variáveis de ambiente do Supabase, nunca exposto

## Automação com Triggers

Para automatizar o envio de eventos, você pode criar triggers PostgreSQL que chamam esta função quando há:

1. INSERT na tabela `transactions` → Evento Purchase
2. INSERT na tabela `testes_liberados` → Evento Lead
3. INSERT na tabela `subscriptions` com status 'active' → Evento Subscribe

Exemplo de trigger PostgreSQL (executar no SQL Editor do Supabase):

```sql
-- Função que chama a Edge Function
CREATE OR REPLACE FUNCTION send_facebook_purchase_event()
RETURNS TRIGGER AS $$
DECLARE
  user_data RECORD;
  full_name_parts TEXT[];
BEGIN
  -- Buscar dados do usuário
  SELECT email, phone, full_name INTO user_data
  FROM users
  WHERE id = NEW.user_id;

  -- Separar nome completo em primeiro e último nome
  full_name_parts := string_to_array(user_data.full_name, ' ');

  -- Chamar Edge Function de forma assíncrona
  PERFORM
    net.http_post(
      url := 'https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/facebook-conversions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'eventName', 'Purchase',
        'eventId', 'txn_' || NEW.id,
        'userId', NEW.user_id,
        'email', user_data.email,
        'phone', user_data.phone,
        'firstName', full_name_parts[1],
        'lastName', full_name_parts[array_length(full_name_parts, 1)],
        'value', NEW.amount,
        'currency', 'BRL',
        'contentName', NEW.description
      )
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para transações
CREATE TRIGGER facebook_conversion_purchase
AFTER INSERT ON transactions
FOR EACH ROW
WHEN (NEW.type = 'recharge' AND NEW.status = 'completed')
EXECUTE FUNCTION send_facebook_purchase_event();
```

## Logs e Auditoria

A função tenta registrar eventos enviados na tabela `facebook_conversion_logs` (se existir).

Para criar a tabela de logs:

```sql
CREATE TABLE facebook_conversion_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  event_name TEXT NOT NULL,
  event_id TEXT,
  value NUMERIC,
  response JSONB,
  sent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fb_logs_user ON facebook_conversion_logs(user_id);
CREATE INDEX idx_fb_logs_event ON facebook_conversion_logs(event_name);
```

## Resposta de Sucesso

```json
{
  "success": true,
  "message": "Evento enviado ao Facebook com sucesso",
  "facebook_response": {
    "events_received": 1,
    "messages": [],
    "fbtrace_id": "..."
  }
}
```

## Resposta de Erro

```json
{
  "success": false,
  "error": "Descrição do erro"
}
```

## Testando

Use curl ou Postman para testar:

```bash
curl -X POST https://uilmijiiaqkhstoaifpj.supabase.co/functions/v1/facebook-conversions \
  -H "Authorization: Bearer SEU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "Purchase",
    "email": "teste@email.com",
    "value": 95.00,
    "contentName": "Teste de Conversão"
  }'
```

## Verificação no Facebook

1. Acesse **Gerenciador de Eventos** do Facebook
2. Selecione o Pixel ID **1151480982222742**
3. Vá em **Eventos de Teste** ou **Visão Geral**
4. Eventos devem aparecer em tempo real
