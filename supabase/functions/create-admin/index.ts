/**
 * Edge Function para criar novos administradores
 * Requer autenticação de um admin existente
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

serve(async (req) => {
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
    // Validar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autenticado');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Token inválido');
    }

    // Verificar se é admin usando a função RPC is_admin
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Criar cliente com o token do usuário para usar is_admin()
    const supabaseWithAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: isAdmin, error: adminCheckError } = await supabaseWithAuth
      .rpc('is_admin');

    if (adminCheckError || !isAdmin) {
      console.error('Admin check failed:', adminCheckError, 'isAdmin:', isAdmin);
      throw new Error('Acesso negado. Apenas administradores podem criar outros administradores.');
    }

    // Obter dados do body
    const { email, password, full_name, phone } = await req.json();

    if (!email || !password || !full_name) {
      throw new Error('Email, senha e nome são obrigatórios');
    }

    // Criar usuário via Admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        full_name,
        phone: phone || null,
      },
    });

    if (createError) {
      console.error('Erro ao criar usuário:', createError);
      throw createError;
    }

    if (!newUser.user) {
      throw new Error('Erro ao criar usuário');
    }

    const newUserId = newUser.user.id;

    // Inserir na tabela users
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUserId,
        email,
        full_name,
        phone: phone || null,
      });

    if (insertError) {
      console.error('Erro ao inserir na tabela users:', insertError);
      // Tentar deletar o usuário criado no auth
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw insertError;
    }

    console.log('✅ Admin criado com sucesso:', newUserId);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUserId,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('❌ Erro:', error);

    let statusCode = 500;
    let message = error?.message || 'Erro ao criar administrador';

    if (message.includes('Acesso negado') || message.includes('Token inválido')) {
      statusCode = 403;
    } else if (message.includes('obrigatórios')) {
      statusCode = 400;
    } else if (message.includes('já está cadastrado') || message.includes('duplicate')) {
      statusCode = 409;
      message = 'Este email já está cadastrado';
    }

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
