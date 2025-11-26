#!/bin/bash
# ============================================================
# Script de Limpeza - Remover Arquivos SQL de Teste
# ============================================================
#
# Este script remove arquivos SQL de teste/validação que
# não são necessários para a migração do banco de dados.
#
# IMPORTANTE: Este script NÃO remove migrations!
# Todas as migrations em supabase/migrations/ são mantidas.
#
# ============================================================

echo ""
echo "============================================================"
echo "LIMPEZA DE ARQUIVOS SQL DE TESTE"
echo "============================================================"
echo ""
echo "Este script vai remover os seguintes arquivos de teste:"
echo ""
echo "  - test_client_data.sql"
echo "  - create_admin_user.sql"
echo "  - fix_test_client.sql"
echo "  - fix_admin_user.sql"
echo "  - recreate_all_data.sql"
echo "  - update_test_client_plan.sql"
echo "  - validate_recharge_options.sql"
echo "  - validate_test_data.sql"
echo ""
echo "IMPORTANTE: As migrations em supabase/migrations/ serão mantidas!"
echo ""
read -p "Pressione Enter para continuar ou Ctrl+C para cancelar..."

echo ""
echo "Removendo arquivos de teste..."
echo ""

# Lista de arquivos para remover
files=(
    "test_client_data.sql"
    "create_admin_user.sql"
    "fix_test_client.sql"
    "fix_admin_user.sql"
    "recreate_all_data.sql"
    "update_test_client_plan.sql"
    "validate_recharge_options.sql"
    "validate_test_data.sql"
)

# Remover cada arquivo
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "[OK] Removido: $file"
    else
        echo "[SKIP] $file não encontrado"
    fi
done

echo ""
echo "============================================================"
echo "Limpeza concluída!"
echo "============================================================"
echo ""
echo "As migrations em supabase/migrations/ foram mantidas."
echo "Você pode prosseguir com a migração."
echo ""


