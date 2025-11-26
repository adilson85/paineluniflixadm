import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando create-payment-preference');

    // Inicializa o cliente Supabase com o SERVICE_ROLE_KEY
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Pega o body da requisição
    const body = await req.json();
    console.log('📦 Body recebido:', {
      hasTransactionId: !!body.transactionId,
      hasUserId: !!body.userId,
      amount: body.amount,
      paymentMethod: body.paymentMethod
    });

    const { transactionId, userId, amount, description, paymentMethod, metadata } = body;

    if (!transactionId || !userId || !amount || !description) {
      throw new Error('Parâmetros obrigatórios faltando');
    }

    // Obtém o Access Token do Mercado Pago das variáveis de ambiente
    const mercadoPagoAccessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!mercadoPagoAccessToken) {
      throw new Error('Token do Mercado Pago não configurado');
    }

    // Obtém dados do usuário para enviar no pagamento
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('full_name, email, phone')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
    }

    // URLs de retorno
    const baseUrl = Deno.env.get('CLIENT_URL') || 'http://localhost:5173';
    const backUrls = {
      success: `${baseUrl}/payment-success?transaction_id=${transactionId}`,
      failure: `${baseUrl}/payment-failure?transaction_id=${transactionId}`,
      pending: `${baseUrl}/payment-success?transaction_id=${transactionId}`,
    };

    // Cria a preferência no Mercado Pago
    const preferenceData = {
      items: [
        {
          id: transactionId,
          title: description,
          description: description,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: amount,
        },
      ],
      payer: {
        name: user?.full_name || '',
        email: user?.email || '',
        phone: {
          number: user?.phone || '',
        },
      },
      back_urls: backUrls,
      auto_return: 'approved',
      external_reference: transactionId,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      metadata: {
        transaction_id: transactionId,
        user_id: userId,
        payment_method: paymentMethod,
        ...metadata,
      },
      payment_methods: {
        excluded_payment_types: [],
        installments: paymentMethod === 'credit_card' ? 12 : 1,
      },
    };

    // Ajusta métodos de pagamento baseado na escolha do usuário
    if (paymentMethod === 'pix') {
      preferenceData.payment_methods.excluded_payment_types = [
        { id: 'credit_card' },
        { id: 'debit_card' },
        { id: 'ticket' },
      ];
    } else if (paymentMethod === 'credit_card') {
      preferenceData.payment_methods.excluded_payment_types = [
        { id: 'ticket' },
      ];
    } else if (paymentMethod === 'boleto') {
      preferenceData.payment_methods.excluded_payment_types = [
        { id: 'credit_card' },
        { id: 'debit_card' },
      ];
    }

    console.log('📦 Criando preferência no Mercado Pago:', {
      transactionId,
      amount,
      paymentMethod,
    });

    // Faz a requisição para a API do Mercado Pago
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mercadoPagoAccessToken}`,
      },
      body: JSON.stringify(preferenceData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro do Mercado Pago:', errorText);
      throw new Error(`Erro ao criar preferência no Mercado Pago: ${response.status}`);
    }

    const preference = await response.json();

    console.log('✅ Preferência criada com sucesso:', {
      id: preference.id,
      has_init_point: !!preference.init_point,
      has_sandbox_init_point: !!preference.sandbox_init_point,
    });

    return new Response(
      JSON.stringify({
        success: true,
        preference: {
          id: preference.id,
          init_point: preference.init_point,
          sandbox_init_point: preference.sandbox_init_point,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Erro na Edge Function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
