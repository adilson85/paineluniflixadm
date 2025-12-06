import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase com SERVICE_ROLE_KEY
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Obter dados da requisição
    const {
      clientId,      // ID do cliente offline (UUID) - obrigatório
      email,         // Email do cliente (opcional se usar clientId)
      telefone,      // Telefone do cliente (opcional se usar clientId)
      dryRun = false, // Se true, apenas retorna informações sem excluir
    } = await req.json();

    // Validar parâmetros
    if (!clientId && !email && !telefone) {
      throw new Error('clientId, email ou telefone é obrigatório');
    }

    console.log('🗑️ Iniciando exclusão de cliente offline...');

    // 1. Buscar cliente offline
    let clientQuery = supabaseAdmin.from('offline_clients').select('*');

    if (clientId) {
      clientQuery = clientQuery.eq('id', clientId);
    } else if (email) {
      clientQuery = clientQuery.eq('email', email);
    } else if (telefone) {
      const cleanPhone = telefone.replace(/\D/g, '');
      clientQuery = clientQuery.or(`telefone.eq.${telefone},telefone.eq.${cleanPhone}`);
    }

    const { data: clients, error: clientError } = await clientQuery;

    if (clientError) {
      console.error('❌ Erro ao buscar cliente offline:', clientError);
      throw new Error(`Erro ao buscar cliente offline: ${clientError.message}`);
    }

    if (!clients || clients.length === 0) {
      throw new Error('Cliente offline não encontrado');
    }

    const client = clients[0];
    console.log('✅ Cliente offline encontrado:', client.nome);

    // 2. Buscar dados relacionados para relatório
    // Verificar se há registros financeiros relacionados (caixa_movimentacoes, creditos_vendidos)
    // que referenciam este cliente offline via user_id ou outros campos
    
    // Buscar movimentações de caixa relacionadas (se houver campo de referência)
    const { data: caixaMovimentacoes, error: caixaError } = await supabaseAdmin
      .from('caixa_movimentacoes')
      .select('id')
      .or(`historico.ilike.%${client.nome}%,historico.ilike.%${client.telefone}%`);

    if (caixaError) {
      console.error('⚠️ Erro ao buscar caixa_movimentacoes:', caixaError);
    }

    // Buscar créditos vendidos relacionados
    const { data: creditosVendidos, error: creditosError } = await supabaseAdmin
      .from('creditos_vendidos')
      .select('id')
      .or(`cliente_nome.ilike.%${client.nome}%,cliente_telefone.ilike.%${client.telefone}%`);

    if (creditosError) {
      console.error('⚠️ Erro ao buscar creditos_vendidos:', creditosError);
    }

    // Preparar relatório
    const report = {
      client: {
        id: client.id,
        nome: client.nome,
        email: client.email,
        telefone: client.telefone,
      },
      logins_count: [
        client.login_01,
        client.login_02,
        client.login_03,
      ].filter(login => login && login.trim() !== '').length,
      // Registros financeiros mantidos (não excluídos)
      caixa_movimentacoes_count: caixaMovimentacoes?.length || 0,
      creditos_vendidos_count: creditosVendidos?.length || 0,
      financial_records_preserved: {
        caixa_movimentacoes: caixaMovimentacoes?.length || 0,
        creditos_vendidos: creditosVendidos?.length || 0,
      },
    };

    // Se for dry run, apenas retornar informações
    if (dryRun) {
      console.log('🔍 [DRY RUN] Cliente offline seria excluído com os seguintes dados:');
      console.log(JSON.stringify(report, null, 2));

      return new Response(
        JSON.stringify({
          success: true,
          message: '[DRY RUN] Cliente offline seria excluído com os seguintes dados relacionados',
          dry_run: true,
          ...report,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 3. Excluir apenas o cliente offline (registros financeiros são mantidos)
    console.log('🗑️ Excluindo cliente offline...');
    
    const { error: deleteError } = await supabaseAdmin
      .from('offline_clients')
      .delete()
      .eq('id', client.id);

    if (deleteError) {
      console.error('❌ Erro ao excluir cliente offline:', deleteError);
      throw new Error(`Erro ao excluir cliente offline: ${deleteError.message}`);
    }

    // NOTA: Registros financeiros (caixa_movimentacoes, creditos_vendidos)
    // são MANTIDOS para fins de relatórios contábeis, mesmo após exclusão do cliente
    console.log('ℹ️ Registros financeiros mantidos para relatórios:');
    console.log(`   - ${caixaMovimentacoes?.length || 0} movimentação(ões) de caixa`);
    console.log(`   - ${creditosVendidos?.length || 0} crédito(s) vendido(s)`);

    console.log('✅ Cliente offline excluído com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cliente offline excluído com sucesso',
        deleted: report,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao excluir cliente offline:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao excluir cliente offline',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});














