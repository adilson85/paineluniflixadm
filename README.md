# Uniflix - Painel Administrativo

Painel administrativo para gestão de assinaturas IPTV da Uniflix.

## Funcionalidades

- 📊 Dashboard com métricas e analytics
- 👥 Gestão de clientes (online e offline)
- 💰 Controle de caixa e movimentações financeiras
- 📺 Gestão de painéis e credenciais
- 🎁 Sistema de promoções e descontos
- 💳 Integração com Mercado Pago
- 📈 Relatórios de créditos vendidos e comprados
- 🔄 Sistema de indicações e comissões
- 🧪 Controle de testes liberados

## Tecnologias

- React + TypeScript
- Vite
- TailwindCSS
- Supabase (Backend)
- Lucide Icons

## Configuração

1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   - Copie `.env.example` para `.env`
   - Preencha com suas credenciais do Supabase

4. Execute em desenvolvimento:
   ```bash
   npm run dev
   ```

5. Build para produção:
   ```bash
   npm run build
   ```

## Deploy

Este projeto está configurado para deploy no Netlify.

### Configurações do Netlify:

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 18 ou superior

### Variáveis de Ambiente (Netlify):

Configure as seguintes variáveis no painel do Netlify:

```
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
```

## Estrutura do Projeto

```
src/
├── components/     # Componentes reutilizáveis
├── contexts/       # Contextos React (Auth, etc)
├── lib/           # Configurações e utilitários
├── pages/         # Páginas da aplicação
├── types/         # TypeScript types
└── utils/         # Funções utilitárias
```

## Segurança

⚠️ **IMPORTANTE**:
- Nunca comite arquivos `.env` ou credenciais
- Os scripts de teste (`*.js` na raiz) contêm tokens sensíveis e não são versionados
- Configure as variáveis de ambiente no Netlify antes do deploy

## Licença

Propriedade privada - Todos os direitos reservados
