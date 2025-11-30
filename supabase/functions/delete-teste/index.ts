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
      testeId,      // ID do teste (UUID) - obrigatório
      dryRun = false, // Se true, apenas retorna informações sem excluir
    } = await req.json();

    // Validar parâmetros
    if (!testeId) {
      throw new Error('testeId é obrigatório');
    }

    console.log('🗑️ Iniciando exclusão de teste liberado...');

    // 1. Buscar teste liberado
    const { data: testes, error: testeError } = await supabaseAdmin
      .from('testes_liberados')
      .select('*')
      .eq('id', testeId)
      .maybeSingle();

    if (testeError) {
      console.error('❌ Erro ao buscar teste liberado:', testeError);
      throw new Error(`Erro ao buscar teste liberado: ${testeError.message}`);
    }

    if (!testes) {
      throw new Error('Teste liberado não encontrado');
    }

    const teste = testes;
    console.log('✅ Teste liberado encontrado:', teste.nome);

    // Validar se o teste não é assinante
    if (teste.assinante === true) {
      throw new Error('Não é possível excluir um teste que já é assinante. Converta-o em cliente offline ou cliente com acesso primeiro.');
    }

    // Preparar relatório
    const report = {
      teste: {
        id: teste.id,
        nome: teste.nome,
        telefone: teste.telefone,
        email: teste.email,
        data_teste: teste.data_teste,
        aplicativo: teste.aplicativo,
        assinante: teste.assinante,
      },
    };

    // Se for dry run, apenas retornar informações
    if (dryRun) {
      console.log('🔍 [DRY RUN] Teste liberado seria excluído:');
      console.log(JSON.stringify(report, null, 2));

      return new Response(
        JSON.stringify({
          success: true,
          message: '[DRY RUN] Teste liberado seria excluído',
          dry_run: true,
          ...report,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 2. Excluir o teste liberado
    console.log('🗑️ Excluindo teste liberado...');
    
    const { error: deleteError } = await supabaseAdmin
      .from('testes_liberados')
      .delete()
      .eq('id', teste.id);

    if (deleteError) {
      console.error('❌ Erro ao excluir teste liberado:', deleteError);
      throw new Error(`Erro ao excluir teste liberado: ${deleteError.message}`);
    }

    console.log('✅ Teste liberado excluído com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Teste liberado excluído com sucesso',
        deleted: report,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao excluir teste liberado:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao excluir teste liberado',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

