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
      subscriptions,     // Array de subscriptions para atualizar
    } = await req.json();

    // Validar parâmetros
    if (!clientId && !email && !telefone) {
      throw new Error('clientId, email ou telefone é obrigatório');
    }

    if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
      throw new Error('subscriptions deve ser um array com pelo menos uma subscription');
    }

    console.log('🔄 Atualizando subscriptions do cliente...');

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

    // 2. Buscar subscriptions atuais do cliente
    const { data: existingSubscriptions, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (subError) {
      console.error('❌ Erro ao buscar subscriptions:', subError);
      throw new Error(`Erro ao buscar assinaturas: ${subError.message}`);
    }

    if (!existingSubscriptions || existingSubscriptions.length === 0) {
      throw new Error('Cliente não possui subscriptions');
    }

    console.log(`✅ Cliente tem ${existingSubscriptions.length} subscription(s)`);

    // 3. Processar atualizações
    const updatedSubscriptions = [];
    const errors = [];

    for (let i = 0; i < subscriptions.length; i++) {
      const subUpdate = subscriptions[i];
      const existingSub = existingSubscriptions[i];

      if (!existingSub) {
        errors.push(`Subscription ${i + 1} não encontrada (cliente tem apenas ${existingSubscriptions.length} subscription(s))`);
        continue;
      }

      try {
        // Preparar dados para atualização
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        // Campos opcionais que podem ser atualizados
        if (subUpdate.app_username !== undefined) {
          updateData.app_username = subUpdate.app_username;
        }
        if (subUpdate.app_password !== undefined) {
          updateData.app_password = subUpdate.app_password;
        }
        if (subUpdate.panel_name !== undefined) {
          updateData.panel_name = subUpdate.panel_name;
        }
        if (subUpdate.expiration_date !== undefined) {
          updateData.expiration_date = subUpdate.expiration_date;
        }
        if (subUpdate.status !== undefined) {
          updateData.status = subUpdate.status;
        }
        if (subUpdate.mac_address !== undefined) {
          updateData.mac_address = subUpdate.mac_address;
        }
        if (subUpdate.device_key !== undefined) {
          updateData.device_key = subUpdate.device_key;
        }
        if (subUpdate.monthly_value !== undefined) {
          updateData.monthly_value = subUpdate.monthly_value;
        }

        // Atualizar subscription
        const { data: updatedSub, error: updateError } = await supabaseAdmin
          .from('subscriptions')
          .update(updateData)
          .eq('id', existingSub.id)
          .select()
          .single();

        if (updateError) {
          console.error(`❌ Erro ao atualizar subscription ${i + 1}:`, updateError);
          errors.push(`Erro ao atualizar subscription ${i + 1}: ${updateError.message}`);
        } else {
          console.log(`✅ Subscription ${i + 1} atualizada`);
          updatedSubscriptions.push({
            index: i + 1,
            id: updatedSub.id,
            app_username: updatedSub.app_username,
            panel_name: updatedSub.panel_name,
            status: updatedSub.status,
          });
        }
      } catch (err: any) {
        console.error(`❌ Erro ao processar subscription ${i + 1}:`, err);
        errors.push(`Erro ao processar subscription ${i + 1}: ${err.message}`);
      }
    }

    // 4. Retornar resultado
    if (errors.length > 0 && updatedSubscriptions.length === 0) {
      // Todas falharam
      throw new Error(`Erros ao atualizar subscriptions: ${errors.join('; ')}`);
    }

    console.log(`✅ ${updatedSubscriptions.length} subscription(s) atualizada(s) com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${updatedSubscriptions.length} subscription(s) atualizada(s) com sucesso`,
        client: {
          id: user.id,
          nome: user.full_name,
          email: user.email,
          telefone: user.phone,
        },
        updated_subscriptions: updatedSubscriptions,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao atualizar subscriptions:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao atualizar subscriptions',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});










