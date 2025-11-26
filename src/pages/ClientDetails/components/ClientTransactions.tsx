import { History, ArrowUpCircle, CreditCard, Clock } from 'lucide-react';
import { formatDateBR } from '../../../utils/dateUtils';
import type { Transaction } from '../hooks/useClientTransactions';

interface ClientTransactionsProps {
  transactions: Transaction[];
  loading: boolean;
}

export function ClientTransactions({ transactions, loading }: ClientTransactionsProps) {
  const typeConfig: Record<string, { label: string; color: string; icon: typeof CreditCard }> = {
    subscription: { label: 'Assinatura', color: 'text-blue-400', icon: CreditCard },
    recharge: { label: 'Recarga', color: 'text-green-400', icon: ArrowUpCircle },
    commission: { label: 'Comissão', color: 'text-purple-400', icon: ArrowUpCircle },
    commission_withdrawal: { label: 'Resgate de Comissão', color: 'text-red-400', icon: ArrowUpCircle },
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pendente', color: 'text-yellow-300', bg: 'bg-yellow-900/30 border-yellow-700' },
    completed: { label: 'Concluído', color: 'text-green-300', bg: 'bg-green-900/30 border-green-700' },
    failed: { label: 'Falhou', color: 'text-red-300', bg: 'bg-red-900/30 border-red-700' },
    cancelled: { label: 'Cancelado', color: 'text-gray-300', bg: 'bg-gray-900/30 border-gray-700' },
  };

  const paymentMethodLabels: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
    manual: 'Manual',
    credit: 'Crédito',
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-700">
            <History className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-100">Histórico de Transações</h3>
            <p className="text-sm text-slate-400">Últimas movimentações</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-700">
          <History className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-100">Histórico de Transações</h3>
          <p className="text-sm text-slate-400">Últimas movimentações</p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 rounded-lg border border-slate-700">
          <History className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Nenhuma transação encontrada</p>
          <p className="text-sm text-slate-500 mt-1">
            As transações do cliente aparecerão aqui
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {transactions.map((transaction) => {
            const typeConf = typeConfig[transaction.type] || {
              label: transaction.type,
              color: 'text-slate-400',
              icon: History
            };
            const statusConf = statusConfig[transaction.status] || {
              label: transaction.status,
              color: 'text-slate-400',
              bg: 'bg-slate-900/30 border-slate-700'
            };
            const TypeIcon = typeConf.icon;

            const date = formatDateBR(transaction.created_at, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });

            return (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:bg-slate-900/70 transition"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className={`p-2 ${statusConf.bg} rounded-lg border`}>
                    <TypeIcon className={`w-5 h-5 ${typeConf.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-100">
                      {transaction.description || typeConf.label}
                    </p>
                    <div className="flex items-center space-x-3 mt-1">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span className="text-xs text-slate-400">{date}</span>
                      </div>
                      {transaction.payment_method && (
                        <span className="text-xs text-slate-500">
                          • {paymentMethodLabels[transaction.payment_method] || transaction.payment_method}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusConf.bg} ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className={`font-bold text-lg ${transaction.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {transaction.amount >= 0 ? '+' : ''}
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(transaction.amount)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
