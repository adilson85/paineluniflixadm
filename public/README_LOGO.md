# Como adicionar a logo da Uniflix TV

## Instruções

1. Coloque o arquivo da logo na pasta `public/` com o nome `logo.png`
   - Formatos suportados: PNG, JPG, SVG
   - Nome do arquivo: `logo.png` (ou altere no código para `logo.jpg` ou `logo.svg`)

2. Tamanho recomendado:
   - Altura: aproximadamente 80px (ajustável via CSS)
   - Largura: proporcional (será ajustada automaticamente)
   - Formato: PNG com fundo transparente (recomendado)

3. A logo aparecerá automaticamente na página de login acima do título "Uniflix TV"

## Localização do arquivo

```
public/
  └── logo.png  ← Coloque sua logo aqui
```

## Personalização

Se quiser usar um nome diferente ou formato diferente, edite o arquivo:
- `src/pages/Login.tsx`
- Procure por: `src="/logo.png"`
- Altere para o nome do seu arquivo







