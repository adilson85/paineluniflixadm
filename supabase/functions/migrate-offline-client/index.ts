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

    // Verificar autenticação do usuário que está fazendo a requisição
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    // Criar cliente com token do usuário para verificar se é admin
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verificar se o usuário é admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Verificar se é admin
    const { data: isAdminResult } = await supabaseClient.rpc('is_admin');
    if (!isAdminResult) {
      throw new Error('Acesso negado. Apenas administradores podem migrar clientes.');
    }

    // Obter dados da requisição
    const { offlineClientId, email } = await req.json();

    if (!offlineClientId || !email) {
      throw new Error('offlineClientId e email são obrigatórios');
    }

    console.log('🔄 Iniciando migração do cliente offline:', offlineClientId);

    // 1. Buscar cliente offline
    const { data: offlineClient, error: fetchError } = await supabaseAdmin
      .from('offline_clients')
      .select('*')
      .eq('id', offlineClientId)
      .single();

    if (fetchError || !offlineClient) {
      throw new Error('Cliente offline não encontrado');
    }

    // Verificar se já foi migrado
    if (offlineClient.migrated_to_user_id) {
      throw new Error(`Este cliente já foi migrado anteriormente para o usuário ID: ${offlineClient.migrated_to_user_id}`);
    }

    // Verificar se email já existe
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new Error('Este email já está cadastrado no sistema');
    }

    // 2. Gerar senha temporária (8 caracteres alfanuméricos)
    const tempPassword = generatePassword();
    console.log('🔑 Senha temporária gerada');

    // 3. Criar usuário usando Supabase Auth Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true, // Confirma email automaticamente
      user_metadata: {
        full_name: offlineClient.nome,
        role: 'user',
      },
    });

    if (authError) {
      console.error('❌ Erro ao criar usuário no Auth:', authError);
      throw new Error(`Erro ao criar usuário: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('Usuário não foi criado');
    }

    const newUserId = authData.user.id;
    console.log('✅ Usuário criado no Auth:', newUserId);

    // 4. Gerar código de indicação único
    let referralCode: string;
    let attempts = 0;
    do {
      referralCode = generateReferralCode();
      const { data } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('referral_code', referralCode)
        .single();
      if (!data) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new Error('Não foi possível gerar código de indicação único');
    }

    // 5. Criar registro na tabela users
    const { error: userInsertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUserId,
        full_name: offlineClient.nome,
        email: email,
        phone: offlineClient.telefone,
        cpf: offlineClient.cpf,
        referral_code: referralCode,
        id_botconversa: offlineClient.id_botconversa,
        created_at: offlineClient.created_at,
      });

    if (userInsertError) {
      console.error('❌ Erro ao criar registro em users:', userInsertError);
      // Tentar deletar o usuário do Auth se falhar
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(`Erro ao criar dados do usuário: ${userInsertError.message}`);
    }

    console.log('✅ Registro criado na tabela users');

    // 6. Criar subscriptions para os logins
    const subscriptionsToCreate = [];

    if (offlineClient.login_01 && offlineClient.senha_01) {
      subscriptionsToCreate.push({
        user_id: newUserId,
        app_username: offlineClient.login_01,
        app_password: offlineClient.senha_01,
        panel_name: offlineClient.painel_01,
        expiration_date: offlineClient.data_expiracao,
        monthly_value: offlineClient.valor_mensal,
        status: offlineClient.data_expiracao >= new Date().toISOString().split('T')[0] ? 'active' : 'expired',
        created_at: offlineClient.created_at,
      });
    }

    if (offlineClient.login_02 && offlineClient.senha_02) {
      subscriptionsToCreate.push({
        user_id: newUserId,
        app_username: offlineClient.login_02,
        app_password: offlineClient.senha_02,
        panel_name: offlineClient.painel_02 || offlineClient.painel_01,
        expiration_date: offlineClient.data_expiracao,
        monthly_value: offlineClient.valor_mensal,
        status: offlineClient.data_expiracao >= new Date().toISOString().split('T')[0] ? 'active' : 'expired',
        created_at: offlineClient.created_at,
      });
    }

    if (offlineClient.login_03 && offlineClient.senha_03) {
      subscriptionsToCreate.push({
        user_id: newUserId,
        app_username: offlineClient.login_03,
        app_password: offlineClient.senha_03,
        panel_name: offlineClient.painel_03 || offlineClient.painel_01,
        expiration_date: offlineClient.data_expiracao,
        monthly_value: offlineClient.valor_mensal,
        status: offlineClient.data_expiracao >= new Date().toISOString().split('T')[0] ? 'active' : 'expired',
        created_at: offlineClient.created_at,
      });
    }

    if (subscriptionsToCreate.length > 0) {
      const { error: subsError } = await supabaseAdmin
        .from('subscriptions')
        .insert(subscriptionsToCreate);

      if (subsError) {
        console.error('⚠️  Erro ao criar subscriptions:', subsError);
        // Não falha a operação se subscriptions der erro
      } else {
        console.log(`✅ ${subscriptionsToCreate.length} subscription(s) criada(s)`);
      }
    }

    // 7. Marcar cliente offline como migrado
    const { error: updateError } = await supabaseAdmin
      .from('offline_clients')
      .update({
        migrated_to_user_id: newUserId,
        migrated_at: new Date().toISOString(),
      })
      .eq('id', offlineClientId);

    if (updateError) {
      console.error('⚠️  Erro ao atualizar cliente offline:', updateError);
    }

    console.log('✅ Migração concluída com sucesso!');

    // Retornar resultado
    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUserId,
        temp_password: tempPassword,
        message: 'Cliente migrado com sucesso',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Erro na migração:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao migrar cliente',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

// Função para gerar senha temporária (8 caracteres alfanuméricos)
function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';

  // Garantir ao menos uma letra maiúscula, uma minúscula e um número
  password += chars.charAt(Math.floor(Math.random() * 26)); // Maiúscula
  password += chars.charAt(26 + Math.floor(Math.random() * 26)); // Minúscula
  password += chars.charAt(52 + Math.floor(Math.random() * 10)); // Número

  // Completar com caracteres aleatórios
  for (let i = 3; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Embaralhar
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Função para gerar código de indicação (8 caracteres alfanuméricos maiúsculos)
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
