import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const results: any = {};

    // 1. Verificar tabelas
    const { data: tables, error: tablesError } = await supabase.rpc('check_tables_exist', {
      table_names: ['caixa_movimentacoes', 'creditos_vendidos', 'promotions', 'promotion_uses', 'promotion_users']
    }).then(() => ({ data: null, error: 'RPC não existe, usando query direta' }));

    // Fallback: query direta via raw SQL
    const { data: tablesData, error: tablesQueryError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .in('tablename', ['caixa_movimentacoes', 'creditos_vendidos', 'promotions', 'promotion_uses', 'promotion_users']);

    results.tables = tablesData;

    // 2. Verificar estrutura de caixa_movimentacoes
    const { data: caixaCols } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'caixa_movimentacoes');

    results.caixa_columns = caixaCols;

    // 3. Verificar estrutura de creditos_vendidos
    const { data: creditosCols } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'creditos_vendidos');

    results.creditos_columns = creditosCols;

    // 4. Listar funções RPC de promoção
    const { data: functions } = await supabase
      .from('pg_proc')
      .select('proname')
      .like('proname', '%promotion%');

    results.promotion_functions = functions;

    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
