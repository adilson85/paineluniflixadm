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
      clientId,      // ID do cliente (UUID) - obrigatório
      email,         // Email do cliente (opcional se usar clientId)
      telefone,      // Telefone do cliente (opcional se usar clientId)
      dryRun = false, // Se true, apenas retorna informações sem excluir
    } = await req.json();

    // Validar parâmetros
    if (!clientId && !email && !telefone) {
      throw new Error('clientId, email ou telefone é obrigatório');
    }

    console.log('🗑️ Iniciando exclusão de cliente...');

    // 1. Buscar cliente (user)
    let userQuery = supabaseAdmin.from('users').select('*');

    if (clientId) {
      userQuery = userQuery.eq('id', clientId);
    } else if (email) {
      userQuery = userQuery.eq('email', email);
    } else if (telefone) {
      const cleanPhone = telefone.replace(/\D/g, '');
      userQuery = userQuery.or(`phone.eq.${telefone},phone.eq.${cleanPhone}`);
    }

    const { data: users, error: userError } = await userQuery;

    if (userError) {
      console.error('❌ Erro ao buscar usuário:', userError);
      throw new Error(`Erro ao buscar usuário: ${userError.message}`);
    }

    if (!users || users.length === 0) {
      throw new Error('Cliente não encontrado');
    }

    const user = users[0];
    console.log('✅ Cliente encontrado:', user.full_name);

    // 2. Buscar dados relacionados para relatório
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, app_username, panel_name, status')
      .eq('user_id', user.id);

    if (subError) {
      console.error('⚠️ Erro ao buscar subscriptions:', subError);
    }

    // Buscar registros financeiros apenas para relatório (NÃO serão excluídos)
    const { data: transactions, error: transError } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('user_id', user.id);

    if (transError) {
      console.error('⚠️ Erro ao buscar transactions:', transError);
    }

    const { data: caixaMovimentacoes, error: caixaError } = await supabaseAdmin
      .from('caixa_movimentacoes')
      .select('id')
      .eq('user_id', user.id);

    if (caixaError) {
      console.error('⚠️ Erro ao buscar caixa_movimentacoes:', caixaError);
    }

    const { data: creditosVendidos, error: creditosError } = await supabaseAdmin
      .from('creditos_vendidos')
      .select('id')
      .eq('user_id', user.id);

    if (creditosError) {
      console.error('⚠️ Erro ao buscar creditos_vendidos:', creditosError);
    }

    // Preparar relatório
    const report = {
      client: {
        id: user.id,
        nome: user.full_name,
        email: user.email,
        telefone: user.phone,
      },
      subscriptions_count: subscriptions?.length || 0,
      // Registros financeiros mantidos (não excluídos)
      transactions_count: transactions?.length || 0,
      caixa_movimentacoes_count: caixaMovimentacoes?.length || 0,
      creditos_vendidos_count: creditosVendidos?.length || 0,
      subscriptions: subscriptions || [],
      financial_records_preserved: {
        transactions: transactions?.length || 0,
        caixa_movimentacoes: caixaMovimentacoes?.length || 0,
        creditos_vendidos: creditosVendidos?.length || 0,
      },
    };

    // Se for dry run, apenas retornar informações
    if (dryRun) {
      console.log('🔍 [DRY RUN] Cliente seria excluído com os seguintes dados:');
      console.log(JSON.stringify(report, null, 2));

      return new Response(
        JSON.stringify({
          success: true,
          message: '[DRY RUN] Cliente seria excluído com os seguintes dados relacionados',
          dry_run: true,
          ...report,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 3. Excluir apenas subscriptions (registros financeiros são mantidos)
    console.log('🗑️ Excluindo subscriptions...');
    if (subscriptions && subscriptions.length > 0) {
      const subIds = subscriptions.map(s => s.id);
      const { error: deleteSubsError } = await supabaseAdmin
        .from('subscriptions')
        .delete()
        .in('id', subIds);

      if (deleteSubsError) {
        console.error('⚠️ Erro ao excluir subscriptions:', deleteSubsError);
        throw new Error(`Erro ao excluir subscriptions: ${deleteSubsError.message}`);
      } else {
        console.log(`✅ ${subscriptions.length} subscription(s) excluída(s)`);
      }
    }

    // NOTA: Registros financeiros (transactions, caixa_movimentacoes, creditos_vendidos)
    // são MANTIDOS para fins de relatórios contábeis, mesmo após exclusão do cliente
    console.log('ℹ️ Registros financeiros mantidos para relatórios:');
    console.log(`   - ${transactions?.length || 0} transaction(s)`);
    console.log(`   - ${caixaMovimentacoes?.length || 0} movimentação(ões) de caixa`);
    console.log(`   - ${creditosVendidos?.length || 0} crédito(s) vendido(s)`);

    // Excluir o usuário (isso deve excluir em cascata outras dependências)
    console.log('🗑️ Excluindo cliente...');
    const { error: deleteUserError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user.id);

    if (deleteUserError) {
      console.error('❌ Erro ao excluir usuário:', deleteUserError);
      throw new Error(`Erro ao excluir cliente: ${deleteUserError.message}`);
    }

    console.log('✅ Cliente excluído com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cliente excluído com sucesso',
        deleted: report,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao excluir cliente:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao excluir cliente',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

