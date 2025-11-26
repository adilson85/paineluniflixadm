# ============================================================
# Script de Importação de Dados - Supabase Cloud
# ============================================================

Write-Host "============================================================"
Write-Host "IMPORTANDO DADOS DO BANCO LOCAL PARA CLOUD"
Write-Host "============================================================"
Write-Host ""

# Verificar se o arquivo existe
if (-not (Test-Path "dados_local.sql")) {
    Write-Host "ERRO: Arquivo dados_local.sql nao encontrado!"
    Write-Host "Execute primeiro a exportacao dos dados."
    exit 1
}

Write-Host "Arquivo encontrado: dados_local.sql"
Write-Host ""

# Configurar senha
$env:PGPASSWORD = "?t8&eV!FkuNWz2j"

# Connection string
$connectionString = "postgresql://postgres@db.uilmijiiaqkhstoaifpj.supabase.co:5432/postgres"

Write-Host "Conectando ao banco cloud..."
Write-Host ""

# Importar dados
try {
    Get-Content "dados_local.sql" | & psql $connectionString
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "============================================================"
        Write-Host "SUCESSO! Dados importados com sucesso!"
        Write-Host "============================================================"
    } else {
        Write-Host ""
        Write-Host "AVISO: Verifique os erros acima."
        Write-Host "Alguns erros podem ser normais (ex: registros duplicados)"
    }
} catch {
    Write-Host ""
    Write-Host "ERRO ao importar: $_"
    Write-Host ""
    Write-Host "ALTERNATIVA:"
    Write-Host "1. Abra: https://supabase.com/dashboard/project/uilmijiiaqkhstoaifpj/sql/new"
    Write-Host "2. Abra o arquivo dados_local.sql"
    Write-Host "3. Copie TODO o conteudo"
    Write-Host "4. Cole no SQL Editor"
    Write-Host "5. Execute (Run)"
}

# Limpar senha da memória
Remove-Item Env:\PGPASSWORD


