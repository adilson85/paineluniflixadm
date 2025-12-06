import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

export interface RechargeOption {
  id: string;
  plan_type: string;
  period: string;
  duration_months: number;
  price: number;
  display_name: string;
}

export function useOfflineClientTransactions(offlineClientId: string | undefined) {
  const [error, setError] = useState<string | null>(null);

  const addCredits = async (params: {
    clientId: string;
    clientName: string;
    rechargeOptionId: string;
    valorPago: number;
    descontoTipo: 'percentual' | 'fixo';
    descontoValor: number;
    rechargeOptions: RechargeOption[];
    quantidadePontos: number;
  }) => {
    try {
      setError(null);

      const selectedOption = params.rechargeOptions.find(opt => opt.id === params.rechargeOptionId);
      if (!selectedOption) {
        throw new Error('Opção de recarga não encontrada');
      }

      // Buscar cliente offline
      const { data: client, error: clientError } = await supabase
        .from('offline_clients')
        .select('*')
        .eq('id', params.clientId)
        .single();

      if (clientError) throw clientError;
      if (!client) {
        throw new Error('Cliente offline não encontrado');
      }

      const quantidadeCreditos = params.quantidadePontos * selectedOption.duration_months;

      // Atualizar data de expiração
      // Se a assinatura já expirou, soma a partir de hoje
      // Se ainda está ativa, soma a partir da data de expiração
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0); // Normalizar para meia-noite

      // Extrair data sem conversão de timezone
      const dateStr = typeof client.data_expiracao === 'string'
        ? client.data_expiracao.split('T')[0]
        : client.data_expiracao;

      // Parse manual da data para evitar timezone
      const [year, month, day] = dateStr.split('-').map(Number);
      const dataExpiracao = new Date(year, month - 1, day);
      dataExpiracao.setHours(0, 0, 0, 0);

      const currentExpiration = dataExpiracao > hoje ? dataExpiracao : hoje;
      const newExpiration = new Date(currentExpiration);
      newExpiration.setMonth(newExpiration.getMonth() + selectedOption.duration_months);

      // Formatar data manualmente para evitar timezone
      const newYear = newExpiration.getFullYear();
      const newMonth = String(newExpiration.getMonth() + 1).padStart(2, '0');
      const newDay = String(newExpiration.getDate()).padStart(2, '0');
      const newExpirationStr = `${newYear}-${newMonth}-${newDay}`;

      const { error: updateError } = await supabase
        .from('offline_clients')
        .update({
          data_expiracao: newExpirationStr,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.clientId);

      if (updateError) throw updateError;

      // Registrar entrada no caixa
      if (params.valorPago > 0) {
        // Usar data do Brasil (America/Sao_Paulo) ao invés de UTC
        const hojeCaixa = new Date().toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).split('/').reverse().join('-');

        await supabase
          .from('caixa_movimentacoes')
          .insert({
            data: hojeCaixa,
            historico: `Assinatura Offline - ${params.clientName}`,
            entrada: params.valorPago,
            saida: 0,
          });

        // Criar transação (se necessário para histórico)
        // Nota: clientes offline não têm user_id, então não criamos transaction
        // Mas podemos criar um registro em uma tabela de histórico se necessário
      }

      // Registrar créditos vendidos
      const painelPrincipal = client.painel_01 || client.painel_02 || client.painel_03 || null;

      // Usar data do Brasil (America/Sao_Paulo) ao invés de UTC
      const hojeCreditos = new Date().toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).split('/').reverse().join('-');

      await supabase
        .from('creditos_vendidos')
        .insert({
          data: hojeCreditos,
          historico: `Créditos adicionados manualmente (Offline) - ${params.clientName} (${params.quantidadePontos} ponto${params.quantidadePontos > 1 ? 's' : ''} × ${selectedOption.duration_months} ${selectedOption.duration_months === 1 ? 'mês' : 'meses'})`,
          painel: painelPrincipal,
          quantidade_creditos: quantidadeCreditos,
        });

      return { success: true };
    } catch (err) {
      console.error('Error adding credits to offline client:', err);
      setError('Erro ao adicionar créditos');
      throw err;
    }
  };

  return {
    error,
    addCredits,
  };
}


























