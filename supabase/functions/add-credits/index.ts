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
      clientId,          // ID do cliente (UUID) - opcional se usar email/telefone
      email,             // Email do cliente (opcional se usar clientId)
      telefone,          // Telefone do cliente (opcional se usar clientId)
      rechargeOptionId,  // ID da opção de recarga (opcional se usar durationMonths)
      durationMonths,    // Duração em meses diretamente (ex: 1, 3, 6, 12) - opcional se usar rechargeOptionId
      valorPago,         // Valor pago (opcional, padrão 0)
      descontoTipo,      // Tipo de desconto: 'percentual' ou 'fixo' (opcional)
      descontoValor,     // Valor do desconto (opcional)
      historico,         // Descrição customizada (opcional)
    } = await req.json();

    // Validar parâmetros
    if (!clientId && !email && !telefone) {
      throw new Error('clientId, email ou telefone é obrigatório');
    }

    if (!rechargeOptionId && !durationMonths) {
      throw new Error('rechargeOptionId ou durationMonths é obrigatório');
    }

    if (durationMonths && (durationMonths <= 0 || !Number.isInteger(durationMonths))) {
      throw new Error('durationMonths deve ser um número inteiro maior que 0');
    }

    console.log('🔄 Adicionando créditos ao cliente...');

    // 1. Buscar cliente (user)
    let userQuery = supabaseAdmin.from('users').select('*');

    if (clientId) {
      userQuery = userQuery.eq('id', clientId);
    } else if (email) {
      userQuery = userQuery.eq('email', email);
    } else if (telefone) {
      // Limpar telefone para busca
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

    // 2. Buscar opção de recarga (se fornecido rechargeOptionId)
    let selectedOption = null;
    let finalDurationMonths = durationMonths;

    if (rechargeOptionId) {
      const { data: options, error: optionError } = await supabaseAdmin
        .from('recharge_options')
        .select('*')
        .eq('id', rechargeOptionId)
        .eq('active', true)
        .single();

      if (optionError) {
        console.error('❌ Erro ao buscar opção de recarga:', optionError);
        throw new Error(`Opção de recarga não encontrada: ${optionError.message}`);
      }

      selectedOption = options;
      finalDurationMonths = selectedOption.duration_months;
      console.log('✅ Opção de recarga encontrada:', selectedOption.display_name);
    } else {
      console.log(`✅ Usando duração direta: ${finalDurationMonths} meses`);
    }

    // 3. Buscar subscriptions ativas
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (subError) {
      console.error('❌ Erro ao buscar subscriptions:', subError);
      throw new Error(`Erro ao buscar assinaturas: ${subError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      throw new Error('Cliente não possui assinaturas ativas');
    }

    const quantidadePontos = subscriptions.length;
    const quantidadeCreditos = quantidadePontos * finalDurationMonths;

    console.log(`✅ Cliente tem ${quantidadePontos} ponto(s) ativo(s)`);
    console.log(`✅ Adicionando ${quantidadeCreditos} crédito(s) (${quantidadePontos} × ${finalDurationMonths} meses)`);

    // 4. Atualizar datas de expiração das subscriptions
    const updates = subscriptions.map(sub => {
      const hoje = new Date();
      const dataExpiracao = new Date(sub.expiration_date);
      const currentExpiration = dataExpiracao > hoje ? dataExpiracao : hoje;
      const newExpiration = new Date(currentExpiration);
      newExpiration.setMonth(newExpiration.getMonth() + finalDurationMonths);

      return supabaseAdmin
        .from('subscriptions')
        .update({
          expiration_date: newExpiration.toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id);
    });

    const updateResults = await Promise.all(updates);
    
    // Verificar se algum update falhou
    for (const result of updateResults) {
      if (result.error) {
        console.error('❌ Erro ao atualizar subscription:', result.error);
        throw new Error(`Erro ao atualizar assinatura: ${result.error.message}`);
      }
    }

    console.log('✅ Datas de expiração atualizadas');

    // 5. Calcular valor final (com desconto se fornecido)
    let valorFinal = valorPago || 0;
    if (selectedOption && valorPago === undefined) {
      valorFinal = selectedOption.price;
    }

    if (descontoTipo && descontoValor && descontoValor > 0) {
      if (descontoTipo === 'percentual') {
        valorFinal = valorFinal * (1 - descontoValor / 100);
      } else {
        valorFinal = Math.max(0, valorFinal - descontoValor);
      }
      console.log(`✅ Desconto aplicado: ${descontoTipo === 'percentual' ? descontoValor + '%' : 'R$ ' + descontoValor}`);
    }

    // 6. Registrar entrada no caixa (se valorFinal > 0)
    if (valorFinal > 0) {
      const hoje = new Date().toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).split('/').reverse().join('-');

      const historicoCaixa = historico || `Assinatura - ${user.full_name}`;

      const { error: caixaError } = await supabaseAdmin
        .from('caixa_movimentacoes')
        .insert({
          data: hoje,
          historico: historicoCaixa,
          entrada: valorFinal,
          saida: 0,
        });

      if (caixaError) {
        console.error('⚠️  Erro ao registrar no caixa:', caixaError);
      } else {
        console.log('✅ Movimentação registrada no caixa');
      }

      // 7. Criar transação para acionar trigger de comissão
      const description = selectedOption
        ? `Recarga de assinatura - ${selectedOption.display_name} (${quantidadePontos} ponto${quantidadePontos > 1 ? 's' : ''} × ${finalDurationMonths} ${finalDurationMonths === 1 ? 'mês' : 'meses'})`
        : `Recarga de assinatura - ${quantidadePontos} ponto${quantidadePontos > 1 ? 's' : ''} × ${finalDurationMonths} ${finalDurationMonths === 1 ? 'mês' : 'meses'}`;

      const { error: transactionError } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'recharge',
          amount: valorFinal,
          payment_method: 'manual',
          status: 'completed',
          description,
          metadata: {
            recharge_option_id: rechargeOptionId || null,
            quantidade_creditos: quantidadeCreditos,
            quantidade_pontos: quantidadePontos,
            duration_months: finalDurationMonths,
            desconto_tipo: descontoTipo || null,
            desconto_valor: descontoValor || 0,
          },
        });

      if (transactionError) {
        console.error('⚠️  Erro ao criar transação:', transactionError);
      } else {
        console.log('✅ Transação criada');
      }
    }

    // 8. Registrar créditos vendidos
    const painelPrincipal = subscriptions[0]?.panel_name || null;
    const hojeCreditosVendidos = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).split('/').reverse().join('-');

    const historicoCreditosText = historico || 
      `Créditos adicionados manualmente - ${user.full_name} (${quantidadePontos} ponto${quantidadePontos > 1 ? 's' : ''} × ${finalDurationMonths} ${finalDurationMonths === 1 ? 'mês' : 'meses'})`;

    const { error: creditosError } = await supabaseAdmin
      .from('creditos_vendidos')
      .insert({
        data: hojeCreditosVendidos,
        historico: historicoCreditosText,
        painel: painelPrincipal,
        quantidade_creditos: quantidadeCreditos,
      });

    if (creditosError) {
      console.error('⚠️  Erro ao registrar créditos vendidos:', creditosError);
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
          id: user.id,
          nome: user.full_name,
          email: user.email,
          telefone: user.phone,
          quantidade_pontos: quantidadePontos,
          creditos_adicionados: quantidadeCreditos,
          duration_months: finalDurationMonths,
          valor_pago: valorFinal,
        },
        subscriptions: subscriptions.map(sub => ({
          id: sub.id,
          old_expiration: sub.expiration_date,
          new_expiration: (() => {
            const hoje = new Date();
            const dataExpiracao = new Date(sub.expiration_date);
            const currentExpiration = dataExpiracao > hoje ? dataExpiracao : hoje;
            const newExpiration = new Date(currentExpiration);
            newExpiration.setMonth(newExpiration.getMonth() + finalDurationMonths);
            return newExpiration.toISOString().split('T')[0];
          })(),
        })),
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







