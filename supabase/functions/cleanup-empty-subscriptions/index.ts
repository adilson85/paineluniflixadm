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

    // Obter parâmetros da requisição
    const {
      clientId,      // ID do cliente específico (opcional)
      email,         // Email do cliente (opcional)
      telefone,      // Telefone do cliente (opcional)
      dryRun = false, // Se true, apenas retorna quais seriam excluídas sem excluir
    } = await req.json();

    console.log('🧹 Iniciando limpeza de subscriptions vazias...');

    let query = supabaseAdmin
      .from('subscriptions')
      .select('*, users!inner(id, full_name, email, phone)');

    // Se especificou cliente, filtrar apenas dele
    if (clientId) {
      query = query.eq('user_id', clientId);
    } else if (email) {
      query = query.eq('users.email', email);
    } else if (telefone) {
      const cleanPhone = telefone.replace(/\D/g, '');
      query = query.or(`users.phone.eq.${telefone},users.phone.eq.${cleanPhone}`);
    }

    // Buscar todas as subscriptions
    const { data: allSubscriptions, error: fetchError } = await query;

    if (fetchError) {
      console.error('❌ Erro ao buscar subscriptions:', fetchError);
      throw new Error(`Erro ao buscar subscriptions: ${fetchError.message}`);
    }

    if (!allSubscriptions || allSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma subscription encontrada',
          deleted_count: 0,
          deleted_subscriptions: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`✅ Encontradas ${allSubscriptions.length} subscription(s)`);

    // Filtrar subscriptions vazias (login OU senha vazios/null)
    const emptySubscriptions = allSubscriptions.filter((sub: any) => {
      const usernameEmpty = !sub.app_username || sub.app_username.trim() === '' || sub.app_username === 'EMPTY';
      const passwordEmpty = !sub.app_password || sub.app_password.trim() === '' || sub.app_password === 'EMPTY';
      
      return usernameEmpty || passwordEmpty;
    });

    console.log(`🔍 Encontradas ${emptySubscriptions.length} subscription(s) vazia(s)`);

    if (emptySubscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma subscription vazia encontrada',
          deleted_count: 0,
          deleted_subscriptions: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Se for dry run, apenas retornar quais seriam excluídas
    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `[DRY RUN] ${emptySubscriptions.length} subscription(s) seriam excluída(s)`,
          deleted_count: emptySubscriptions.length,
          deleted_subscriptions: emptySubscriptions.map((sub: any) => ({
            id: sub.id,
            user_id: sub.user_id,
            user_name: sub.users?.full_name || 'N/A',
            user_email: sub.users?.email || 'N/A',
            app_username: sub.app_username || '(vazio)',
            app_password: sub.app_password ? '***' : '(vazio)',
            panel_name: sub.panel_name || '(vazio)',
            status: sub.status,
          })),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Excluir subscriptions vazias
    const subscriptionIds = emptySubscriptions.map((sub: any) => sub.id);
    
    const { data: deletedData, error: deleteError } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .in('id', subscriptionIds)
      .select('id, user_id, app_username, app_password, panel_name, status');

    if (deleteError) {
      console.error('❌ Erro ao excluir subscriptions:', deleteError);
      throw new Error(`Erro ao excluir subscriptions: ${deleteError.message}`);
    }

    console.log(`✅ ${deletedData?.length || 0} subscription(s) excluída(s) com sucesso`);

    // Agrupar por cliente para resposta
    const deletedByClient = emptySubscriptions.reduce((acc: any, sub: any) => {
      const userId = sub.user_id;
      if (!acc[userId]) {
        acc[userId] = {
          user_id: userId,
          user_name: sub.users?.full_name || 'N/A',
          user_email: sub.users?.email || 'N/A',
          user_phone: sub.users?.phone || 'N/A',
          deleted_count: 0,
          subscriptions: [],
        };
      }
      acc[userId].deleted_count++;
      acc[userId].subscriptions.push({
        id: sub.id,
        app_username: sub.app_username || '(vazio)',
        panel_name: sub.panel_name || '(vazio)',
        status: sub.status,
      });
      return acc;
    }, {});

    return new Response(
      JSON.stringify({
        success: true,
        message: `${emptySubscriptions.length} subscription(s) vazia(s) excluída(s) com sucesso`,
        deleted_count: emptySubscriptions.length,
        deleted_by_client: Object.values(deletedByClient),
        deleted_subscriptions: emptySubscriptions.map((sub: any) => ({
          id: sub.id,
          user_id: sub.user_id,
          user_name: sub.users?.full_name || 'N/A',
          user_email: sub.users?.email || 'N/A',
          app_username: sub.app_username || '(vazio)',
          panel_name: sub.panel_name || '(vazio)',
          status: sub.status,
        })),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao limpar subscriptions vazias:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao limpar subscriptions vazias',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});








