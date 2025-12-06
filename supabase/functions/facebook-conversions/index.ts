import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHash } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para hash SHA256 (Facebook exige dados do usuário hasheados)
function sha256(data: string): string {
  return createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    // Configuração do Facebook (via env vars)
    const FB_PIXEL_ID = Deno.env.get('FB_PIXEL_ID') ?? '';
    const FB_ACCESS_TOKEN = Deno.env.get('FB_ACCESS_TOKEN') ?? '';

    if (!FB_PIXEL_ID || !FB_ACCESS_TOKEN) {
      throw new Error('Configuração do Facebook incompleta');
    }

    // Receber dados do evento
    const {
      eventName,      // Purchase, Lead, Subscribe, CompleteRegistration
      eventId,        // ID único para deduplicação
      userId,         // ID do usuário
      email,          // Email do usuário
      phone,          // Telefone do usuário
      firstName,      // Nome
      lastName,       // Sobrenome
      value,          // Valor da conversão (em R$)
      currency,       // Moeda (BRL)
      contentName,    // Nome do produto/serviço
      eventSourceUrl, // URL de origem (opcional)
    } = await req.json();

    // Validações
    if (!eventName) {
      throw new Error('eventName é obrigatório');
    }

    console.log(`📤 Enviando evento ${eventName} ao Facebook...`);

    // Preparar dados do usuário (hasheados conforme exigência do Facebook)
    const userData: any = {};

    if (email) {
      userData.em = [sha256(email)];
    }

    if (phone) {
      // Remover caracteres não numéricos e adicionar código do país
      const cleanPhone = phone.replace(/\D/g, '');
      const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      userData.ph = [sha256(phoneWithCountry)];
    }

    if (firstName) {
      userData.fn = [sha256(firstName)];
    }

    if (lastName) {
      userData.ln = [sha256(lastName)];
    }

    // Timestamp em segundos (Unix timestamp)
    const eventTime = Math.floor(Date.now() / 1000);

    // Montar payload do evento
    const eventData: any = {
      event_name: eventName,
      event_time: eventTime,
      action_source: 'website',
      user_data: userData,
    };

    // Adicionar event_id para deduplicação (se fornecido)
    if (eventId) {
      eventData.event_id = eventId;
    }

    // Adicionar dados customizados (valor, moeda, etc)
    if (value !== undefined || contentName) {
      eventData.custom_data = {};

      if (value !== undefined) {
        eventData.custom_data.value = parseFloat(value);
        eventData.custom_data.currency = currency || 'BRL';
      }

      if (contentName) {
        eventData.custom_data.content_name = contentName;
      }
    }

    // Adicionar URL de origem se fornecida
    if (eventSourceUrl) {
      eventData.event_source_url = eventSourceUrl;
    }

    // Enviar para Facebook Conversions API
    const fbApiUrl = `https://graph.facebook.com/v18.0/${FB_PIXEL_ID}/events`;

    const payload = {
      data: [eventData],
      access_token: FB_ACCESS_TOKEN,
    };

    console.log('🔄 Enviando para Facebook API:', JSON.stringify(payload, null, 2));

    const response = await fetch(fbApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Erro na resposta do Facebook:', result);
      throw new Error(`Erro do Facebook: ${JSON.stringify(result)}`);
    }

    console.log('✅ Evento enviado com sucesso:', result);

    // Registrar evento enviado no banco (opcional, para auditoria)
    if (userId) {
      await supabaseAdmin
        .from('facebook_conversion_logs')
        .insert({
          user_id: userId,
          event_name: eventName,
          event_id: eventId || null,
          value: value || null,
          response: result,
          sent_at: new Date().toISOString(),
        })
        .catch((err) => {
          console.warn('⚠️ Erro ao registrar log (tabela pode não existir):', err);
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Evento enviado ao Facebook com sucesso',
        facebook_response: result,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao enviar evento ao Facebook:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
