import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  payment_method: string | null;
  status: string;
  description: string | null;
  created_at: string;
  metadata: any;
}

export interface RechargeOption {
  id: string;
  plan_type: string;
  period: string;
  duration_months: number;
  price: number;
  display_name: string;
}

export function useClientTransactions(userId: string | undefined) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchTransactions = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      setTransactions(data || []);
      setPendingCount((data || []).filter(t => t.status === 'pending').length);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Erro ao carregar transações');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addCredits = async (params: {
    clientId: string;
    clientName: string;
    rechargeOptionId: string;
    valorPago: number;
    descontoTipo: 'percentual' | 'fixo';
    descontoValor: number;
    rechargeOptions: RechargeOption[];
  }) => {
    try {
      setError(null);

      const selectedOption = params.rechargeOptions.find(opt => opt.id === params.rechargeOptionId);
      if (!selectedOption) {
        throw new Error('Opção de recarga não encontrada');
      }

      // Buscar subscriptions ativas
      const { data: subscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', params.clientId)
        .eq('status', 'active');

      if (subError) throw subError;
      if (!subscriptions || subscriptions.length === 0) {
        throw new Error('Cliente não possui assinaturas ativas');
      }

      const quantidadePontos = subscriptions.length;
      const quantidadeCreditos = quantidadePontos * selectedOption.duration_months;

      // Atualizar datas de expiração
      const updates = subscriptions.map(sub => {
        // Se a assinatura já expirou, soma a partir de hoje
        // Se ainda está ativa, soma a partir da data de expiração
        const hoje = new Date();
        const dataExpiracao = new Date(sub.expiration_date);
        const currentExpiration = dataExpiracao > hoje ? dataExpiracao : hoje;
        const newExpiration = new Date(currentExpiration);
        newExpiration.setMonth(newExpiration.getMonth() + selectedOption.duration_months);

        return supabase
          .from('subscriptions')
          .update({
            expiration_date: newExpiration.toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id);
      });

      await Promise.all(updates);

      // Registrar entrada no caixa
      if (params.valorPago > 0) {
        // Usar data do Brasil (America/Sao_Paulo) ao invés de UTC
        const hoje = new Date().toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).split('/').reverse().join('-'); // Converte de DD/MM/YYYY para YYYY-MM-DD

        await supabase
          .from('caixa_movimentacoes')
          .insert({
            data: hoje,
            historico: `Assinatura - ${params.clientName}`,
            entrada: params.valorPago,
            saida: 0,
          });

        // Criar transação para acionar trigger de comissão
        await supabase
          .from('transactions')
          .insert({
            user_id: params.clientId,
            type: 'recharge',
            amount: params.valorPago,
            payment_method: 'manual',
            status: 'completed',
            description: `Recarga de assinatura - ${selectedOption.display_name} (${quantidadePontos} ponto${quantidadePontos > 1 ? 's' : ''} × ${selectedOption.duration_months} ${selectedOption.duration_months === 1 ? 'mês' : 'meses'})`,
            metadata: {
              recharge_option_id: params.rechargeOptionId,
              quantidade_creditos: quantidadeCreditos,
              quantidade_pontos: quantidadePontos,
              duration_months: selectedOption.duration_months,
              desconto_tipo: params.descontoTipo,
              desconto_valor: params.descontoValor,
            },
          });
      }

      // Registrar créditos vendidos
      const painelPrincipal = subscriptions[0]?.panel_name || null;

      // Usar data do Brasil (America/Sao_Paulo) ao invés de UTC
      const hojeCreditosVendidos = new Date().toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).split('/').reverse().join('-'); // Converte de DD/MM/YYYY para YYYY-MM-DD

      await supabase
        .from('creditos_vendidos')
        .insert({
          data: hojeCreditosVendidos,
          historico: `Créditos adicionados manualmente - ${params.clientName} (${quantidadePontos} ponto${quantidadePontos > 1 ? 's' : ''} × ${selectedOption.duration_months} ${selectedOption.duration_months === 1 ? 'mês' : 'meses'})`,
          painel: painelPrincipal,
          quantidade_creditos: quantidadeCreditos,
        });

      return { success: true };
    } catch (err) {
      console.error('Error adding credits:', err);
      setError('Erro ao adicionar créditos');
      throw err;
    }
  };

  const processCommissionWithdrawal = async (params: {
    clientId: string;
    tipo: 'mensalidade' | 'pix';
    valor: number;
    rechargeOptionId?: string;
    rechargeOptions?: RechargeOption[];
    totalCommission: number;
  }) => {
    try {
      setError(null);

      // Validações
      if (params.tipo === 'mensalidade') {
        if (!params.rechargeOptionId || params.valor <= 0) {
          throw new Error('Selecione uma opção de crédito');
        }
        if (params.valor < 35) {
          throw new Error('O valor mínimo para créditos é de R$ 35,00');
        }
      } else {
        if (params.valor <= 0) {
          throw new Error('Informe um valor válido para resgate');
        }
        if (params.valor < 50) {
          throw new Error('O valor mínimo para PIX é de R$ 50,00');
        }
      }

      if (params.valor > params.totalCommission) {
        throw new Error('O valor solicitado excede o valor disponível');
      }

      let description = '';
      let metadata: any = { tipo_resgate: params.tipo };

      if (params.tipo === 'mensalidade') {
        const selectedOption = params.rechargeOptions?.find(opt => opt.id === params.rechargeOptionId);
        if (!selectedOption) {
          throw new Error('Opção de recarga não encontrada');
        }

        description = `Resgate de comissão (crédito) - ${selectedOption.display_name}`;
        metadata.recharge_option_id = params.rechargeOptionId;
        metadata.duration_months = selectedOption.duration_months;
      } else {
        description = `Resgate de comissão (PIX) - R$ ${params.valor.toFixed(2)}`;
      }

      // Criar transação de resgate
      await supabase
        .from('transactions')
        .insert({
          user_id: params.clientId,
          type: 'commission_withdrawal',
          amount: -params.valor,
          payment_method: params.tipo === 'pix' ? 'pix' : 'credit',
          status: 'completed',
          description,
          metadata,
        });

      // Atualizar saldo de comissão do usuário
      const { error: updateError } = await supabase
        .from('users')
        .update({
          total_commission: params.totalCommission - params.valor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.clientId);

      if (updateError) throw updateError;

      return { success: true };
    } catch (err: any) {
      console.error('Error processing commission withdrawal:', err);
      setError(err.message || 'Erro ao processar resgate');
      throw err;
    }
  };

  return {
    transactions,
    loading,
    error,
    pendingCount,
    fetchTransactions,
    addCredits,
    processCommissionWithdrawal,
  };
}
