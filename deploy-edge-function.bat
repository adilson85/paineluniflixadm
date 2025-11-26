@echo off
echo ============================================
echo Deploy da Edge Function: migrate-offline-client
echo ============================================
echo.

echo Verificando se Supabase CLI esta instalado...
where supabase >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Supabase CLI nao encontrado!
    echo.
    echo Instale com: npm install -g supabase
    echo.
    pause
    exit /b 1
)

echo [OK] Supabase CLI encontrado
echo.

echo Fazendo deploy da Edge Function...
echo.

supabase functions deploy migrate-offline-client

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha no deploy da Edge Function
    echo.
    echo Certifique-se de:
    echo 1. Estar logado no Supabase: supabase login
    echo 2. Ter vinculado o projeto: supabase link --project-ref SEU_PROJECT_REF
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo [SUCESSO] Edge Function deployada!
echo ============================================
echo.
echo A funcao migrate-offline-client esta pronta para uso.
echo Agora as migracoes de clientes offline vao funcionar corretamente.
echo.
pause
