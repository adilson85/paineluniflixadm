import { useState, useEffect } from 'react';
import { DollarSign, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ApproveWithdrawalModal } from './modals/ApproveWithdrawalModal';
import { formatPhone } from '../utils/clientHelpers';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  payment_method: string;
  description: string;
  created_at: string;
  metadata: {
    redeem_type: string;
    requested_at: string;
    pix_key?: string | null;
    admin_notes?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
  };
  users?: {
    full_name: string;
    phone: string | null;
    email: string | null;
    total_commission: number;
  };
}

export function PendingWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          users (
            full_name,
            phone,
            email,
            total_commission
          )
        `)
        .eq('type', 'commission_payout')
        .eq('payment_method', 'pix')
        .in('status', ['pending', 'completed', 'cancelled'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar solicitações:', error);
      } else {
        setWithdrawals(data as WithdrawalRequest[]);
      }
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedWithdrawal(null);
    loadWithdrawals(); // Recarrega a lista após fechar o modal
  };

  const pendingCount = withdrawals.filter(w => w.status === 'pending').length;

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">Solicitações de Resgate via PIX</h3>
                <p className="text-sm text-slate-400">
                  {pendingCount} {pendingCount === 1 ? 'solicitação pendente' : 'solicitações pendentes'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {withdrawals.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Nenhuma solicitação de resgate</p>
            </div>
          ) : (
            <div className="space-y-4">
              {withdrawals.map((withdrawal) => {
                const isPending = withdrawal.status === 'pending';
                const isCompleted = withdrawal.status === 'completed';
                const isCancelled = withdrawal.status === 'cancelled';

                return (
                  <div
                    key={withdrawal.id}
                    className={`p-4 rounded-lg border-2 ${
                      isPending
                        ? 'border-yellow-500/30 bg-yellow-500/10'
                        : isCompleted
                        ? 'border-green-500/30 bg-green-500/10'
                        : 'border-red-500/30 bg-red-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-semibold text-slate-100">
                            {withdrawal.users?.full_name || 'Nome não disponível'}
                          </h4>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              isPending
                                ? 'bg-yellow-500/20 text-yellow-300'
                                : isCompleted
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {isPending ? (
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>Pendente</span>
                              </span>
                            ) : isCompleted ? (
                              <span className="flex items-center space-x-1">
                                <CheckCircle className="w-3 h-3" />
                                <span>Aprovado</span>
                              </span>
                            ) : (
                              <span className="flex items-center space-x-1">
                                <XCircle className="w-3 h-3" />
                                <span>Cancelado</span>
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-slate-300">
                              <strong>Valor:</strong>{' '}
                              <span className="text-lg font-bold text-slate-100">
                                R$ {withdrawal.amount.toFixed(2)}
                              </span>
                            </p>
                            <p className="text-slate-300">
                              <strong>Saldo atual:</strong> R${' '}
                              {withdrawal.users?.total_commission.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            {withdrawal.users?.phone && (
                              <p className="text-slate-300">
                                <strong>Telefone:</strong> {formatPhone(withdrawal.users.phone)}
                              </p>
                            )}
                            {withdrawal.users?.email && (
                              <p className="text-slate-300">
                                <strong>Email:</strong> {withdrawal.users.email}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-slate-400">
                          <p>
                            Solicitado em:{' '}
                            {new Date(withdrawal.created_at).toLocaleString('pt-BR')}
                          </p>
                          {withdrawal.metadata?.approved_at && (
                            <p>
                              {isCompleted ? 'Aprovado' : 'Cancelado'} em:{' '}
                              {new Date(withdrawal.metadata.approved_at).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleViewDetails(withdrawal)}
                        className={`ml-4 px-4 py-2 rounded-lg font-semibold transition flex items-center space-x-2 ${
                          isPending
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            : 'bg-slate-600 hover:bg-slate-700 text-white'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        <span>{isPending ? 'Processar' : 'Ver Detalhes'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && selectedWithdrawal && (
        <ApproveWithdrawalModal
          withdrawal={selectedWithdrawal}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
