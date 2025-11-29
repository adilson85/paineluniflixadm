/**
 * Edge Function do Supabase para receber webhooks do Mercado Pago
 *
 * 1. Valida headers de segurança (x-signature, x-request-id) com HMAC-SHA256
 * 2. Busca pagamento via API do Mercado Pago
 * 3. Atualiza transação preservando metadata original
 * 4. Se mudar para "completed" pela primeira vez:
 *    - Atualiza assinaturas
 *    - Registra no caixa
 *    - Registra créditos vendidos
 *    - Registra uso de promoção (individual ou geral)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  // CORS / preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    if (!MERCADOPAGO_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ============================================================
    // 1) Validação de headers de segurança
    // ============================================================
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');

    console.log('🔐 Headers de segurança:', {
      hasSignature: !!xSignature,
      hasRequestId: !!xRequestId,
      signature: xSignature ? xSignature.substring(0, 50) + '...' : 'null',
      requestId: xRequestId,
    });

    if (!xSignature || !xRequestId) {
      console.warn('⚠️ Webhook sem assinatura válida - rejeitado');
      return new Response(
        JSON.stringify({ error: 'Assinatura inválida ou ausente' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // ============================================================
    // 2) Lê body cru e valida HMAC-SHA256 (se SECRET configurado)
    // ============================================================
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    console.log('📥 Webhook recebido:', JSON.stringify(body, null, 2));

    const webhookSecret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET');

    if (webhookSecret) {
      try {
        const parts = xSignature.split(',');
        const tsMatch = parts.find((p) => p.startsWith('ts='));
        const v1Match = parts.find((p) => p.startsWith('v1='));

        if (!tsMatch || !v1Match) {
          console.warn('⚠️ Formato de x-signature inválido');
          return new Response(
            JSON.stringify({ error: 'Formato de assinatura inválido' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const timestamp = tsMatch.split('=')[1];
        const receivedHash = v1Match.split('=')[1];

        const dataId = body.data?.id;
        if (!dataId) {
          console.warn('⚠️ Webhook sem data.id');
          return new Response(
            JSON.stringify({ error: 'data.id ausente' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const manifest = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`;

        const encoder = new TextEncoder();
        const keyData = encoder.encode(webhookSecret);
        const messageData = encoder.encode(manifest);

        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        );

        const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
        const hashArray = Array.from(new Uint8Array(signature));
        const calculatedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

        if (calculatedHash.toLowerCase() !== receivedHash.toLowerCase()) {
          console.warn('⚠️ Assinatura HMAC inválida');
          console.warn(`   Manifest: ${manifest}`);
          console.warn(`   Calculado: ${calculatedHash}`);
          console.warn(`   Recebido:  ${receivedHash}`);
          return new Response(
            JSON.stringify({ error: 'Assinatura HMAC inválida' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          );
        }

        console.log('✅ Assinatura HMAC validada com sucesso');
      } catch (err) {
        console.error('❌ Erro ao validar HMAC:', err);
        return new Response(
          JSON.stringify({ error: 'Erro na validação de assinatura' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
    } else {
      console.warn('⚠️ MERCADO_PAGO_WEBHOOK_SECRET não configurado. Validação parcial.');
    }

    // ============================================================
    // 3) Processa somente eventos de pagamento
    // ============================================================
    if (body.type !== 'payment') {
      console.log('ℹ️ Tipo de evento não processado:', body.type);
      return new Response(
        JSON.stringify({ success: true, message: 'Evento não processado' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }

    const paymentId = body.data.id;

    // ============================================================
    // 4) Busca pagamento detalhado no Mercado Pago
    // ============================================================
    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        },
      },
    );

    if (!paymentResponse.ok) {
      throw new Error(`Erro ao buscar pagamento: ${paymentResponse.statusText}`);
    }

    const payment = await paymentResponse.json();
    console.log('💳 Pagamento:', {
      id: payment.id,
      status: payment.status,
      external_reference: payment.external_reference,
      transaction_amount: payment.transaction_amount,
    });

    const transactionId = payment.external_reference;
    if (!transactionId) {
      console.warn('⚠️ Pagamento sem external_reference');
      return new Response(
        JSON.stringify({ error: 'Pagamento sem referência externa' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ============================================================
    // 5) Busca transação existente (para idempotência + metadata)
    // ============================================================
    const { data: existingTransaction, error: txError } = await supabase
      .from('transactions')
      .select('id, status, user_id, metadata, amount, description')
      .eq('id', transactionId)
      .single();

    if (txError || !existingTransaction) {
      console.error('❌ Transação não encontrada:', transactionId);
      return new Response(
        JSON.stringify({ error: 'Transação não encontrada' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }

    const previousStatus = existingTransaction.status;
    const originalMetadata = existingTransaction.metadata || {};
    console.log('🔄 Status da transação:', previousStatus, '->', payment.status);

    // Mapeia status do MP para o sistema
    const statusMap: Record<string, 'pending' | 'completed' | 'failed' | 'cancelled'> = {
      pending: 'pending',
      approved: 'completed',
      authorized: 'completed',
      in_process: 'pending',
      in_mediation: 'pending',
      rejected: 'failed',
      cancelled: 'cancelled',
      refunded: 'cancelled',
      charged_back: 'failed',
    };

    const newStatus = statusMap[payment.status] || 'pending';

    // Info do Mercado Pago isolada no metadata.mercado_pago
    const mpInfo = {
      id: payment.id,
      status: payment.status,
      transaction_amount: payment.transaction_amount,
      payment_method_id: payment.payment_method_id,
      date_approved: payment.date_approved,
      date_created: payment.date_created,
      updated_at: new Date().toISOString(),
    };

    // ============================================================
    // 6) Atualiza transação preservando metadata original
    // ============================================================
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: newStatus,
        metadata: {
          ...originalMetadata,
          mercado_pago: mpInfo,
        },
      })
      .eq('id', transactionId);

    if (updateError) {
      console.error('❌ Erro ao atualizar transação:', updateError);
      throw updateError;
    }

    console.log('✅ Transação atualizada:', transactionId, '->', newStatus);

    // ============================================================
    // 7) Só processa efeitos colaterais se mudou para "completed"
    // ============================================================
    if (newStatus === 'completed' && previousStatus !== 'completed') {
      const transaction = existingTransaction;
      const userId = transaction.user_id;
      const metadata = originalMetadata;
      const durationDays = metadata.duration_days || 30;

      // ===== Usuário =====
      const { data: userRow } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();

      const userName = userRow?.full_name || 'Cliente';

      // ===== Assinaturas ativas =====
      const { data: subscriptions, error: subscriptionError } = await supabase
        .from('subscriptions')
        .select('id, expiration_date, panel_name')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (subscriptionError) {
        console.error('❌ Erro ao buscar assinaturas:', subscriptionError);
      } else if (subscriptions && subscriptions.length > 0) {
        const quantidadePontos = subscriptions.length;

        // Atualiza todas as assinaturas
        for (const subscription of subscriptions) {
          const hoje = new Date();
          const dataExpiracao = subscription.expiration_date
            ? new Date(subscription.expiration_date)
            : hoje;

          const currentExpiration = dataExpiracao > hoje ? dataExpiracao : hoje;
          const newExpiration = new Date(currentExpiration);
          newExpiration.setDate(newExpiration.getDate() + durationDays);

          const { error: updateSubError } = await supabase
            .from('subscriptions')
            .update({
              expiration_date: newExpiration.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscription.id);

          if (updateSubError) {
            console.error('❌ Erro ao atualizar assinatura:', updateSubError);
          } else {
            console.log('✅ Assinatura atualizada:', subscription.id, '->', newExpiration);
          }
        }

        // ===== Data (YYYY-MM-DD) em timezone Brasil =====
        const hojeStr = new Date()
          .toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
          .split('/')
          .reverse()
          .join('-');

        // ===== Caixa =====
        const { error: caixaError } = await supabase
          .from('caixa_movimentacoes')
          .insert({
            data: hojeStr,
            historico: `Pagamento Online - ${userName} (${transaction.description || 'Recarga'})`,
            entrada: transaction.amount,
            saida: 0,
          });

        if (caixaError) {
          console.error('❌ Erro ao registrar no caixa:', caixaError);
        } else {
          console.log('✅ Entrada registrada no caixa:', transaction.amount);
        }

        // ===== Créditos vendidos =====
        const quantidadeCreditos =
          quantidadePontos *
          (metadata.duration_months || Math.ceil(durationDays / 30));

        const painelPrincipal = subscriptions[0]?.panel_name || null;

        const { error: creditosError } = await supabase
          .from('creditos_vendidos')
          .insert({
            data: hojeStr,
            historico: `Pagamento Online - ${userName} (${quantidadePontos} ponto${
              quantidadePontos > 1 ? 's' : ''
            })`,
            painel: painelPrincipal,
            quantidade_creditos: quantidadeCreditos,
          });

        if (creditosError) {
          console.error('❌ Erro ao registrar créditos vendidos:', creditosError);
        } else {
          console.log('✅ Créditos vendidos registrados:', quantidadeCreditos);
        }

        // ===== Promoções (individual ou geral) =====
        if (metadata.promotion_id) {
          const promotionId = metadata.promotion_id;
          console.log('🎁 Processando promoção:', promotionId);

          // Usa a função record_promotion_use que faz tudo:
          // - Insere em promotion_uses
          // - Incrementa promotions.current_uses (para promoções gerais)
          // - Incrementa promotion_users.uses_count (para promoções individuais)
          const { data: useId, error: promoError } = await supabase.rpc(
            'record_promotion_use',
            {
              p_promotion_id: promotionId,
              p_user_id: userId,
              p_subscription_id: subscriptions[0]?.id || null,
              p_original_price: metadata.original_price || transaction.amount,
              p_discounted_price: transaction.amount,
            }
          );

          if (promoError) {
            console.error('❌ Erro ao registrar uso da promoção:', promoError);
          } else {
            console.log('✅ Uso da promoção registrado com sucesso:', useId);
          }
        }

        // Resposta detalhada para debug
        return new Response(
          JSON.stringify({
            success: true,
            transaction_id: transactionId,
            status: newStatus,
            debug: {
              userName,
              quantidadePontos,
              quantidadeCreditos,
              durationDays,
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          },
        );
      }
    } else if (newStatus === 'completed' && previousStatus === 'completed') {
      console.log(
        'ℹ️ Pagamento já processado anteriormente (idempotente). Nada a fazer.',
      );
    }

    // Caso não seja completed, ou já tenha sido processado, apenas confirma
    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transactionId,
        status: newStatus,
        debug: {
          message: 'Pagamento já processado ou status não é completed',
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  } catch (error: any) {
    console.error('❌ Erro no webhook:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao processar webhook',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
});
