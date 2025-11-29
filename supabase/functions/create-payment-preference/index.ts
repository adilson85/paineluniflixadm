import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    console.log('🚀 Iniciando create-payment-preference');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Variáveis SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY não configuradas');
    }

    // ============================================================
    // 1) Autenticação via JWT (cliente sempre autenticado)
    // ============================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autenticado - header Authorization ausente');
    }

    // Extrai o token JWT do header "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');

    // Cria cliente Supabase para validar o JWT
    const supabaseClient = createClient(supabaseUrl, anonKey);

    // Valida o JWT token diretamente (Edge Functions não têm sessão!)
    const {
      data: { user },
      error: userAuthError,
    } = await supabaseClient.auth.getUser(token);

    if (userAuthError || !user) {
      console.error('❌ Token JWT inválido:', userAuthError);
      throw new Error('Token inválido ou expirado');
    }

    const userId = user.id;
    console.log('✅ Usuário autenticado:', userId.substring(0, 8) + '...');

    // Cliente admin para ler dados privilegiados
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ============================================================
    // 2) Body da requisição (userId vem do JWT, não do body)
    // ============================================================
    const body = await req.json();
    console.log('📦 Body recebido:', {
      hasTransactionId: !!body.transactionId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
    });

    const { transactionId, amount, description, paymentMethod, metadata } = body;

    if (!transactionId || !amount || !description) {
      throw new Error('Parâmetros obrigatórios faltando (transactionId, amount, description)');
    }

    // ============================================================
    // 3) Token Mercado Pago
    // ============================================================
    const mercadoPagoAccessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!mercadoPagoAccessToken) {
      throw new Error('Token do Mercado Pago não configurado (MERCADO_PAGO_ACCESS_TOKEN)');
    }

    // ============================================================
    // 4) Dados do usuário (tabela users)
    // ============================================================
    const { data: userRow, error: userError } = await supabaseAdmin
      .from('users')
      .select('full_name, email, phone')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
    }

    // ============================================================
    // 5) URLs de retorno (front)
    // ============================================================
    const baseUrl = Deno.env.get('CLIENT_URL') || 'http://localhost:5173';

    const backUrls = {
      success: `${baseUrl}/payment/success?transaction_id=${transactionId}`,
      failure: `${baseUrl}/payment/failure?transaction_id=${transactionId}`,
      pending: `${baseUrl}/payment/success?transaction_id=${transactionId}`,
    };

    // ============================================================
    // 6) URL do webhook (Edge Function)
    //    Usa URL do projeto Supabase + /functions/v1/mercadopago-webhook
    // ============================================================
    const functionsWebhookUrl =
      `${supabaseUrl}/functions/v1/mercadopago-webhook`.replace(/\/+$/, '');

    // ============================================================
    // 7) Monta preferenceData
    // ============================================================
    const preferenceData: any = {
      items: [
        {
          id: transactionId,
          title: description,
          description,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: amount,
        },
      ],
      payer: {
        name: userRow?.full_name || '',
        email: userRow?.email || '',
        phone: {
          number: userRow?.phone || '',
        },
      },
      back_urls: backUrls,
      auto_return: 'approved',
      external_reference: transactionId,
      notification_url: functionsWebhookUrl,
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

    // Regras por método de pagamento
    if (paymentMethod === 'pix') {
      preferenceData.payment_methods.excluded_payment_types = [
        { id: 'credit_card' },
        { id: 'debit_card' },
        { id: 'ticket' },
      ];
    } else if (paymentMethod === 'credit_card') {
      preferenceData.payment_methods.excluded_payment_types = [{ id: 'ticket' }];
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

    // ============================================================
    // 8) Chamada à API do Mercado Pago
    // ============================================================
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mercadoPagoAccessToken}`,
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
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      },
    );
  } catch (error: any) {
    console.error('❌ Erro na Edge Function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message ?? 'Erro desconhecido',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      },
    );
  }
});
