@echo off
REM ============================================================
REM Script de Limpeza - Remover Arquivos SQL de Teste
REM ============================================================
REM
REM Este script remove arquivos SQL de teste/validação que
REM não são necessários para a migração do banco de dados.
REM
REM IMPORTANTE: Este script NÃO remove migrations!
REM Todas as migrations em supabase/migrations/ são mantidas.
REM
REM ============================================================

echo.
echo ============================================================
echo LIMPEZA DE ARQUIVOS SQL DE TESTE
echo ============================================================
echo.
echo Este script vai remover os seguintes arquivos de teste:
echo.
echo   - test_client_data.sql
echo   - create_admin_user.sql
echo   - fix_test_client.sql
echo   - fix_admin_user.sql
echo   - recreate_all_data.sql
echo   - update_test_client_plan.sql
echo   - validate_recharge_options.sql
echo   - validate_test_data.sql
echo.
echo IMPORTANTE: As migrations em supabase/migrations/ serao mantidas!
echo.
pause

echo.
echo Removendo arquivos de teste...
echo.

if exist "test_client_data.sql" (
    del "test_client_data.sql"
    echo [OK] Removido: test_client_data.sql
) else (
    echo [SKIP] test_client_data.sql nao encontrado
)

if exist "create_admin_user.sql" (
    del "create_admin_user.sql"
    echo [OK] Removido: create_admin_user.sql
) else (
    echo [SKIP] create_admin_user.sql nao encontrado
)

if exist "fix_test_client.sql" (
    del "fix_test_client.sql"
    echo [OK] Removido: fix_test_client.sql
) else (
    echo [SKIP] fix_test_client.sql nao encontrado
)

if exist "fix_admin_user.sql" (
    del "fix_admin_user.sql"
    echo [OK] Removido: fix_admin_user.sql
) else (
    echo [SKIP] fix_admin_user.sql nao encontrado
)

if exist "recreate_all_data.sql" (
    del "recreate_all_data.sql"
    echo [OK] Removido: recreate_all_data.sql
) else (
    echo [SKIP] recreate_all_data.sql nao encontrado
)

if exist "update_test_client_plan.sql" (
    del "update_test_client_plan.sql"
    echo [OK] Removido: update_test_client_plan.sql
) else (
    echo [SKIP] update_test_client_plan.sql nao encontrado
)

if exist "validate_recharge_options.sql" (
    del "validate_recharge_options.sql"
    echo [OK] Removido: validate_recharge_options.sql
) else (
    echo [SKIP] validate_recharge_options.sql nao encontrado
)

if exist "validate_test_data.sql" (
    del "validate_test_data.sql"
    echo [OK] Removido: validate_test_data.sql
) else (
    echo [SKIP] validate_test_data.sql nao encontrado
)

echo.
echo ============================================================
echo Limpeza concluida!
echo ============================================================
echo.
echo As migrations em supabase/migrations/ foram mantidas.
echo Voce pode prosseguir com a migracao.
echo.
pause


