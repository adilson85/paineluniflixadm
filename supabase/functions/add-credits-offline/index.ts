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
      clientId,          // ID do cliente (opcional se usar telefone)
      telefone,          // Telefone do cliente (opcional se usar clientId)
      durationMonths,    // Duração em meses (ex: 1, 3, 6, 12)
      valorPago,         // Valor pago (opcional, padrão 0)
      painel,           // Nome do painel (opcional)
      historico,        // Descrição customizada (opcional)
    } = await req.json();

    // Validar parâmetros
    if (!clientId && !telefone) {
      throw new Error('clientId ou telefone é obrigatório');
    }

    if (!durationMonths || durationMonths <= 0) {
      throw new Error('durationMonths deve ser maior que 0');
    }

    console.log('🔄 Adicionando créditos ao cliente offline...');

    // 1. Buscar cliente offline
    let query = supabaseAdmin.from('offline_clients').select('*');

    if (clientId) {
      query = query.eq('id', clientId);
    } else {
      // Limpar telefone para busca
      const cleanPhone = telefone.replace(/\D/g, '');
      query = query.or(`telefone.eq.${telefone},telefone.eq.${cleanPhone}`);
    }

    const { data: clients, error: fetchError } = await query;

    if (fetchError) {
      console.error('❌ Erro ao buscar cliente:', fetchError);
      throw new Error(`Erro ao buscar cliente: ${fetchError.message}`);
    }

    if (!clients || clients.length === 0) {
      throw new Error('Cliente offline não encontrado');
    }

    const client = clients[0];
    console.log('✅ Cliente encontrado:', client.nome);

    // 2. Calcular nova data de expiração
    const currentExpiration = client.data_expiracao ? new Date(client.data_expiracao) : new Date();

    // Se já expirou, começar de hoje
    const baseDate = currentExpiration > new Date() ? currentExpiration : new Date();

    const newExpiration = new Date(baseDate);
    newExpiration.setMonth(newExpiration.getMonth() + durationMonths);

    // 3. Atualizar cliente offline
    const { error: updateError } = await supabaseAdmin
      .from('offline_clients')
      .update({
        data_expiracao: newExpiration.toISOString().split('T')[0],
        status: 'Ativo',
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar cliente:', updateError);
      throw new Error(`Erro ao atualizar data de expiração: ${updateError.message}`);
    }

    console.log('✅ Data de expiração atualizada:', newExpiration.toISOString().split('T')[0]);

    // 4. Registrar no caixa (se valorPago > 0)
    if (valorPago && valorPago > 0) {
      // Usar data do Brasil (America/Sao_Paulo) ao invés de UTC
      const hoje = new Date().toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).split('/').reverse().join('-'); // Converte de DD/MM/YYYY para YYYY-MM-DD

      const historicoCaixa = historico || `Recarga ${durationMonths} ${durationMonths === 1 ? 'mês' : 'meses'} - ${client.nome}`;

      const { error: caixaError } = await supabaseAdmin
        .from('caixa_movimentacoes')
        .insert({
          data: hoje,
          historico: historicoCaixa,
          entrada: valorPago,
          saida: 0,
        });

      if (caixaError) {
        console.error('⚠️  Erro ao registrar no caixa:', caixaError);
        // Não falha a operação se o caixa der erro
      } else {
        console.log('✅ Movimentação registrada no caixa');
      }
    }

    // 5. Registrar créditos vendidos
    // Contar quantos logins o cliente tem
    let quantidadeLogins = 0;
    if (client.login_01) quantidadeLogins++;
    if (client.login_02) quantidadeLogins++;
    if (client.login_03) quantidadeLogins++;

    const quantidadeCreditos = quantidadeLogins * durationMonths;
    const painelUsado = painel || client.painel_01 || 'Não informado';

    // Usar data do Brasil (America/Sao_Paulo) ao invés de UTC
    const hojeCreditosVendidos = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).split('/').reverse().join('-'); // Converte de DD/MM/YYYY para YYYY-MM-DD

    const historicoCreditosText = historico || `Recarga ${durationMonths} ${durationMonths === 1 ? 'mês' : 'meses'} - ${client.nome} (${quantidadeLogins} login${quantidadeLogins > 1 ? 's' : ''})`;

    const { error: creditosError } = await supabaseAdmin
      .from('creditos_vendidos')
      .insert({
        data: hojeCreditosVendidos,
        historico: historicoCreditosText,
        painel: painelUsado,
        quantidade_creditos: quantidadeCreditos,
      });

    if (creditosError) {
      console.error('⚠️  Erro ao registrar créditos vendidos:', creditosError);
      // Não falha a operação
    } else {
      console.log('✅ Créditos vendidos registrados');
    }

    console.log('✅ Créditos adicionados com sucesso!');

    // Retornar resultado
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Créditos adicionados com sucesso',
        client: {
          id: client.id,
          nome: client.nome,
          telefone: client.telefone,
          old_expiration: client.data_expiracao,
          new_expiration: newExpiration.toISOString().split('T')[0],
          quantidade_logins: quantidadeLogins,
          creditos_adicionados: quantidadeCreditos,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao adicionar créditos:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao adicionar créditos',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
