/**
 * Edge Function do Supabase para receber webhooks do Mercado Pago
 * 
 * Esta função:
 * 1. Recebe notificações de pagamento do Mercado Pago
 * 2. Valida a assinatura (opcional, mas recomendado)
 * 3. Atualiza o status da transação no banco
 * 4. Atualiza a assinatura do usuário se o pagamento for aprovado
 */ import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
serve(async (req)=>{
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }
  try {
    // Verifica se as variáveis de ambiente estão configuradas
    if (!MERCADOPAGO_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Variáveis de ambiente não configuradas');
      return new Response(JSON.stringify({
        error: 'Configuração do servidor incompleta'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Cria cliente Supabase com service role (bypassa RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ============================================================
    // VALIDAÇÃO DE ASSINATURA MERCADO PAGO
    // ============================================================
    // Extrai headers de segurança conforme documentação oficial:
    // https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');

    // Log dos headers recebidos (para debug)
    console.log('🔐 Headers de segurança:', {
      hasSignature: !!xSignature,
      hasRequestId: !!xRequestId,
      signature: xSignature ? xSignature.substring(0, 50) + '...' : 'null',
      requestId: xRequestId
    });

    // Verifica se os headers obrigatórios estão presentes
    if (!xSignature || !xRequestId) {
      console.warn('⚠️ Webhook sem assinatura válida - rejeitado');
      console.warn('   x-signature:', xSignature ? 'presente' : 'ausente');
      console.warn('   x-request-id:', xRequestId ? 'presente' : 'ausente');

      return new Response(JSON.stringify({
        error: 'Assinatura inválida ou ausente'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // ============================================================
    // VALIDAÇÃO HMAC-SHA256 (Mercado Pago Webhook Signature)
    // ============================================================
    // Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks

    // Lê o body como texto primeiro (necessário para validação HMAC)
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    console.log('📥 Webhook recebido:', JSON.stringify(body, null, 2));

    const webhookSecret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET');

    if (webhookSecret) {
      try {
        // Extrai timestamp (ts) e hash (v1) do header x-signature
        // Formato esperado: "ts=1234567890,v1=abc123..."
        const parts = xSignature.split(',');
        const tsMatch = parts.find(p => p.startsWith('ts='));
        const v1Match = parts.find(p => p.startsWith('v1='));

        if (!tsMatch || !v1Match) {
          console.warn('⚠️ Formato de x-signature inválido');
          return new Response(JSON.stringify({ error: 'Formato de assinatura inválido' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const timestamp = tsMatch.split('=')[1];
        const receivedHash = v1Match.split('=')[1];
        const dataId = body.data?.id;

        if (!dataId) {
          console.warn('⚠️ Webhook sem data.id');
          return new Response(JSON.stringify({ error: 'data.id ausente' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Constrói manifest: "id:{data.id};request-id:{x-request-id};ts:{timestamp};"
        const manifest = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`;

        // Gera HMAC-SHA256
        const encoder = new TextEncoder();
        const keyData = encoder.encode(webhookSecret);
        const messageData = encoder.encode(manifest);

        const cryptoKey = await crypto.subtle.importKey(
          'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
        const hashArray = Array.from(new Uint8Array(signature));
        const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Compara hashes (case-insensitive)
        if (calculatedHash.toLowerCase() !== receivedHash.toLowerCase()) {
          console.warn('⚠️ Assinatura HMAC inválida');
          console.warn(`   Manifest: ${manifest}`);
          console.warn(`   Calculado: ${calculatedHash}`);
          console.warn(`   Recebido:  ${receivedHash}`);
          return new Response(JSON.stringify({ error: 'Assinatura HMAC inválida' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        console.log('✅ Assinatura HMAC validada com sucesso');

      } catch (error) {
        console.error('❌ Erro ao validar HMAC:', error);
        return new Response(JSON.stringify({ error: 'Erro na validação de assinatura' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      console.warn('⚠️ MERCADO_PAGO_WEBHOOK_SECRET não configurado');
      console.warn('   Usando apenas validação de headers + verificação via API MP');
      console.warn('   Configure MERCADO_PAGO_WEBHOOK_SECRET para segurança completa');
    }
    // Mercado Pago envia diferentes tipos de notificações
    // https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
    if (body.type === 'payment') {
      const paymentId = body.data.id;
      // Busca informações do pagamento no Mercado Pago
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`
        }
      });
      if (!paymentResponse.ok) {
        throw new Error(`Erro ao buscar pagamento: ${paymentResponse.statusText}`);
      }
      const payment = await paymentResponse.json();
      console.log('💳 Pagamento:', {
        id: payment.id,
        status: payment.status,
        external_reference: payment.external_reference,
        transaction_amount: payment.transaction_amount
      });
      // external_reference contém o transaction_id do nosso banco
      const transactionId = payment.external_reference;
      if (!transactionId) {
        console.warn('⚠️ Pagamento sem external_reference');
        return new Response(JSON.stringify({
          error: 'Pagamento sem referência externa'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      // Mapeia status do Mercado Pago para nosso sistema
      const statusMap = {
        pending: 'pending',
        approved: 'completed',
        authorized: 'completed',
        in_process: 'pending',
        in_mediation: 'pending',
        rejected: 'failed',
        cancelled: 'cancelled',
        refunded: 'cancelled',
        charged_back: 'failed'
      };
      const newStatus = statusMap[payment.status] || 'pending';

      // ============================================================
      // PRESERVAÇÃO DE METADATA (CRÍTICO!)
      // ============================================================
      // Busca metadata EXISTENTE da transação para não sobrescrever
      // promotion_id, duration_days, etc.
      const { data: existingTransaction } = await supabase
        .from('transactions')
        .select('metadata')
        .eq('id', transactionId)
        .single();

      const originalMetadata = existingTransaction?.metadata || {};

      // Atualiza a transação PRESERVANDO metadata original
      const { error: updateError } = await supabase.from('transactions').update({
        status: newStatus,
        metadata: {
          ...originalMetadata,  // Preserva promotion_id, duration_days, etc.
          mercado_pago: {       // Dados do MP em objeto separado
            id: payment.id,
            status: payment.status,
            transaction_amount: payment.transaction_amount,
            payment_method_id: payment.payment_method_id,
            date_approved: payment.date_approved,
            date_created: payment.date_created,
            updated_at: new Date().toISOString()
          }
        }
      }).eq('id', transactionId);
      if (updateError) {
        console.error('❌ Erro ao atualizar transação:', updateError);
        throw updateError;
      }
      console.log('✅ Transação atualizada:', transactionId, '->', newStatus);
      // Se o pagamento foi aprovado, atualiza a assinatura do usuário
      if (newStatus === 'completed') {
        // Busca a transação para pegar o user_id e metadata
        const { data: transaction, error: transactionError } = await supabase.from('transactions').select('user_id, metadata').eq('id', transactionId).single();
        if (transactionError || !transaction) {
          console.error('❌ Erro ao buscar transação:', transactionError);
        } else {
          const userId = transaction.user_id;
          const metadata = transaction.metadata || {};
          const durationDays = metadata.duration_days || 30;
          // Busca a assinatura ativa do usuário
          const { data: subscription, error: subscriptionError } = await supabase.from('subscriptions').select('id, expiration_date').eq('user_id', userId).eq('status', 'active').order('created_at', {
            ascending: false
          }).limit(1).maybeSingle();
          if (subscriptionError) {
            console.error('❌ Erro ao buscar assinatura:', subscriptionError);
          } else if (subscription) {
            // Calcula nova data de expiração
            const currentExpiration = subscription.expiration_date ? new Date(subscription.expiration_date) : new Date();
            const newExpiration = new Date(currentExpiration);
            newExpiration.setDate(newExpiration.getDate() + durationDays);
            // Atualiza a assinatura
            const { error: updateSubError } = await supabase.from('subscriptions').update({
              expiration_date: newExpiration.toISOString(),
              updated_at: new Date().toISOString()
            }).eq('id', subscription.id);
            if (updateSubError) {
              console.error('❌ Erro ao atualizar assinatura:', updateSubError);
            } else {
              console.log('✅ Assinatura atualizada:', subscription.id, '->', newExpiration);
            }
          }
        }
      }
      return new Response(JSON.stringify({
        success: true,
        transaction_id: transactionId,
        status: newStatus
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    // Se não for um evento de pagamento, retorna sucesso mas não faz nada
    console.log('ℹ️ Tipo de evento não processado:', body.type);
    return new Response(JSON.stringify({
      success: true,
      message: 'Evento não processado'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Erro ao processar webhook'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});
