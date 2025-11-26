# Edge Function: migrate-offline-client

## Descrição
Esta Edge Function migra um cliente offline para um usuário com acesso ao painel.

A função usa `supabase.auth.admin.createUser()` para criar o usuário de forma segura, garantindo que a senha funcione corretamente no login.

## Por que uma Edge Function?

O problema anterior era que a função PostgreSQL `migrate_offline_client_to_user` estava tentando criar usuários inserindo diretamente na tabela `auth.users` com `crypt()`, mas o Supabase Auth não aceita senhas criadas dessa forma.

A única forma segura de criar usuários é através da API do Supabase Auth Admin, que requer a `SERVICE_ROLE_KEY`. Por questões de segurança, essa chave não pode estar no frontend, por isso usamos uma Edge Function.

## Deploy

### Pré-requisitos
- Supabase CLI instalado: `npm install -g supabase`
- Estar logado no Supabase: `supabase login`
- Projeto vinculado: `supabase link --project-ref SEU_PROJECT_REF`

### Comandos de Deploy

```bash
# Na raiz do projeto (uniflix Adm)
cd "e:\Programas em desevolvimento\uniflix Adm"

# Deploy da Edge Function
supabase functions deploy migrate-offline-client

# Verificar se foi deployado
supabase functions list
```

### Variáveis de Ambiente

As seguintes variáveis são necessárias e já devem estar configuradas automaticamente no Supabase:

- `SUPABASE_URL` - URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço (admin)
- `SUPABASE_ANON_KEY` - Chave anônima

## Como Funciona

1. **Autenticação**: Verifica se o usuário que está chamando a função é um administrador
2. **Validação**: Verifica se o cliente offline existe e se o email não está em uso
3. **Criação do Usuário**: Usa `supabase.auth.admin.createUser()` para criar o usuário com senha temporária
4. **Dados do Usuário**: Cria registro na tabela `users` com informações do cliente
5. **Subscriptions**: Migra os logins (login_01, login_02, login_03) para subscriptions
6. **Marcação**: Marca o cliente offline como migrado

## Parâmetros

```typescript
{
  offlineClientId: string,  // ID do cliente offline
  email: string             // Email para login no painel
}
```

## Resposta

### Sucesso
```json
{
  "success": true,
  "user_id": "uuid",
  "temp_password": "senha-temp",
  "message": "Cliente migrado com sucesso"
}
```

### Erro
```json
{
  "success": false,
  "error": "Mensagem de erro"
}
```

## Testes

Para testar localmente antes de fazer deploy:

```bash
# Iniciar Edge Functions localmente
supabase functions serve migrate-offline-client

# Em outro terminal, testar com curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/migrate-offline-client' \
  --header 'Authorization: Bearer SEU_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{"offlineClientId": "uuid-do-cliente", "email": "teste@exemplo.com"}'
```

## Segurança

- ✅ Requer autenticação (token no header)
- ✅ Verifica se usuário é admin através de `is_admin()` RPC
- ✅ Service Role Key permanece segura no backend do Supabase
- ✅ Validações de dados antes de criar usuário
- ✅ CORS configurado para permitir chamadas do frontend

## Troubleshooting

### Erro: "Usuário não autenticado"
- Verifique se o token está sendo enviado no header Authorization
- Verifique se a sessão do usuário está ativa

### Erro: "Acesso negado. Apenas administradores..."
- Verifique se a função RPC `is_admin()` está funcionando
- Verifique se o usuário tem role de admin

### Erro: "Este email já está cadastrado"
- O email já existe na tabela `users`
- Use outro email ou verifique se há duplicação

### Senha não funciona no login
- **Este problema foi resolvido** com a Edge Function
- A Edge Function usa `supabase.auth.admin.createUser()` que cria a senha corretamente
- Antes, a função PostgreSQL usava `crypt()` que não funciona com Supabase Auth
