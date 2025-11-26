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

    const { data: isAdminResult } = await supabaseClient.rpc('is_admin');
    if (!isAdminResult) {
      throw new Error('Acesso negado. Apenas administradores podem criar clientes.');
    }

    // Obter dados da requisição
    const {
      testeId,
      planType,
      rechargeOptionId,
      valorPago,
      login1,
      senha1,
      painel1,
      login2,
      senha2,
      painel2,
      login3,
      senha3,
      painel3,
    } = await req.json();

    if (!testeId || !planType || !rechargeOptionId || !login1 || !senha1) {
      throw new Error('Parâmetros obrigatórios faltando');
    }

    console.log('🔄 Criando cliente a partir de teste:', testeId);

    // 1. Buscar dados do teste
    const { data: teste, error: testeError } = await supabaseAdmin
      .from('testes_liberados')
      .select('*')
      .eq('id', testeId)
      .single();

    if (testeError || !teste) {
      throw new Error('Teste não encontrado');
    }

    // 2. Buscar opção de recarga
    const { data: rechargeOption, error: rechargeError } = await supabaseAdmin
      .from('recharge_options')
      .select('*')
      .eq('id', rechargeOptionId)
      .single();

    if (rechargeError || !rechargeOption) {
      throw new Error('Opção de recarga não encontrada');
    }

    // 3. Buscar plano
    const { data: plan, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('plan_type', planType)
      .eq('active', true)
      .limit(1)
      .single();

    if (planError || !plan) {
      throw new Error('Plano não encontrado');
    }

    // 4. Verificar se usuário já existe (por email ou telefone)
    let userId: string | null = null;
    let tempPassword: string | null = null;
    let userExists = false;

    // Tentar por email
    if (teste.email) {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', teste.email)
        .single();

      if (existingUser) {
        userId = existingUser.id;
        userExists = true;
      }
    }

    // Se não encontrou por email, tentar por telefone
    if (!userId && teste.telefone) {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('phone', teste.telefone)
        .single();

      if (existingUser) {
        userId = existingUser.id;
        userExists = true;
      }
    }

    // 5. Se usuário não existe, criar novo
    if (!userId) {
      // Gerar senha temporária
      tempPassword = generatePassword();
      console.log('🔑 Senha temporária gerada');

      // Determinar email (usar do teste ou gerar temporário)
      let email = teste.email;
      if (!email) {
        // Gerar email temporário baseado no telefone
        email = `${teste.telefone.replace(/\D/g, '')}@uniflix.temp`;

        // Verificar se já existe
        const { data: existingAuth } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', email)
          .single();

        if (existingAuth) {
          // Adicionar timestamp para garantir unicidade
          email = `${teste.telefone.replace(/\D/g, '')}-${Date.now()}@uniflix.temp`;
        }
      }

      // Criar usuário usando Supabase Auth Admin API
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: teste.nome,
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

      userId = authData.user.id;
      console.log('✅ Usuário criado no Auth:', userId);

      // 6. Verificar se veio de indicação
      let referredBy: string | null = null;
      if (teste.referral_code) {
        const { data: referrer } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('referral_code', teste.referral_code)
          .single();

        if (referrer) {
          referredBy = referrer.id;
        }
      }

      // 7. Gerar código de indicação único
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

      // 8. Criar registro na tabela users
      const { error: userInsertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          full_name: teste.nome,
          email: email,
          phone: teste.telefone,
          referral_code: referralCode,
          referred_by: referredBy,
          id_botconversa: teste.id_botconversa,
        });

      if (userInsertError) {
        console.error('❌ Erro ao criar registro em users:', userInsertError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`Erro ao criar dados do usuário: ${userInsertError.message}`);
      }

      console.log('✅ Registro criado na tabela users');

      // 9. Criar registro de indicação se houver
      if (referredBy) {
        await supabaseAdmin
          .from('referrals')
          .insert({
            referrer_id: referredBy,
            referred_id: userId,
            total_commission_earned: 0.00,
            last_commission_date: null,
          })
          .then(() => console.log('✅ Indicação registrada'));
      }
    } else {
      console.log('✅ Usuário já existe:', userId);
      // Atualizar dados se necessário
      const { data: currentUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (currentUser) {
        const updates: any = {};
        if (!currentUser.full_name && teste.nome) updates.full_name = teste.nome;
        if (!currentUser.phone && teste.telefone) updates.phone = teste.telefone;
        if (!currentUser.email && teste.email) updates.email = teste.email;

        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();
          await supabaseAdmin
            .from('users')
            .update(updates)
            .eq('id', userId);
        }
      }
    }

    // 10. Calcular data de expiração
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + rechargeOption.duration_months);

    // 11. Criar subscriptions
    const subscriptionsToCreate = [];

    // Login 1 (sempre existe)
    subscriptionsToCreate.push({
      user_id: userId,
      plan_id: plan.id,
      status: 'active',
      app_username: login1,
      app_password: senha1,
      panel_name: painel1,
      expiration_date: expirationDate.toISOString(),
      monthly_value: plan.monthly_price || 0,
    });

    // Login 2 (se ponto duplo ou triplo)
    if (['ponto_duplo', 'ponto_triplo'].includes(planType) && login2 && senha2) {
      subscriptionsToCreate.push({
        user_id: userId,
        plan_id: plan.id,
        status: 'active',
        app_username: login2,
        app_password: senha2,
        panel_name: painel2 || painel1,
        expiration_date: expirationDate.toISOString(),
        monthly_value: plan.monthly_price || 0,
      });
    }

    // Login 3 (se ponto triplo)
    if (planType === 'ponto_triplo' && login3 && senha3) {
      subscriptionsToCreate.push({
        user_id: userId,
        plan_id: plan.id,
        status: 'active',
        app_username: login3,
        app_password: senha3,
        panel_name: painel3 || painel1,
        expiration_date: expirationDate.toISOString(),
        monthly_value: plan.monthly_price || 0,
      });
    }

    const { error: subsError } = await supabaseAdmin
      .from('subscriptions')
      .insert(subscriptionsToCreate);

    if (subsError) {
      console.error('❌ Erro ao criar subscriptions:', subsError);
      throw new Error(`Erro ao criar subscriptions: ${subsError.message}`);
    }

    console.log(`✅ ${subscriptionsToCreate.length} subscription(s) criada(s)`);

    // 12. Criar transação
    const { error: transError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'recharge',
        amount: valorPago || 0,
        payment_method: 'manual',
        status: 'completed',
        description: 'Recarga de assinatura a partir de teste liberado',
      });

    if (transError) {
      console.error('⚠️  Erro ao criar transação:', transError);
    }

    console.log('✅ Cliente criado com sucesso!');

    // Retornar resultado
    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        temp_password: tempPassword,
        message: userExists ? 'Cliente vinculado com sucesso' : 'Cliente criado com sucesso',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao criar cliente:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao criar cliente',
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
