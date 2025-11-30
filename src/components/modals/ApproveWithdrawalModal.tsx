import { useState } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPhone } from '../../utils/clientHelpers';

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

interface ApproveWithdrawalModalProps {
  withdrawal: WithdrawalRequest;
  onClose: () => void;
}

export function ApproveWithdrawalModal({ withdrawal, onClose }: ApproveWithdrawalModalProps) {
  const [pixKey, setPixKey] = useState(withdrawal.metadata?.pix_key || '');
  const [adminNotes, setAdminNotes] = useState(withdrawal.metadata?.admin_notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isPending = withdrawal.status === 'pending';
  const isCompleted = withdrawal.status === 'completed';
  const isCancelled = withdrawal.status === 'cancelled';

  const handleApprove = async () => {
    if (!pixKey.trim()) {
      setError('Informe a chave PIX do cliente');
      return;
    }

    if (!confirm(`Confirmar aprovação do resgate de R$ ${withdrawal.amount.toFixed(2)}?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Atualiza a transação para completed
      // @ts-ignore - Supabase type issue
      const { error: transError } = await supabase
        .from('transactions')
        .update({
          status: 'completed',
          metadata: {
            ...withdrawal.metadata,
            pix_key: pixKey.trim(),
            admin_notes: adminNotes.trim() || null,
            approved_at: new Date().toISOString(),
          },
        })
        .eq('id', withdrawal.id);

      if (transError) {
        throw new Error(`Erro ao atualizar transação: ${transError.message}`);
      }

      // 2. Deduz o valor do saldo de comissões do usuário
      const newBalance = (withdrawal.users?.total_commission || 0) - withdrawal.amount;

      // @ts-ignore - Supabase type issue
      const { error: userError } = await supabase
        .from('users')
        .update({
          total_commission: newBalance,
        })
        .eq('id', withdrawal.user_id);

      if (userError) {
        throw new Error(`Erro ao atualizar saldo do usuário: ${userError.message}`);
      }

      // 3. Registra saída no caixa
      // @ts-ignore - Supabase type issue
      const { error: caixaError } = await supabase
        .from('caixa_movimentacao')
        .insert({
          data: new Date().toISOString(),
          historico: `Resgate PIX - ${withdrawal.users?.full_name} - Chave: ${pixKey.trim()}`,
          entrada: null,
          saida: withdrawal.amount,
        });

      if (caixaError) {
        console.error('Erro ao registrar no caixa:', caixaError);
        // Não falha a operação se o lançamento no caixa der erro
      }

      setSuccess('Resgate aprovado com sucesso!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao aprovar resgate');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!adminNotes.trim()) {
      setError('Informe o motivo do cancelamento');
      return;
    }

    if (!confirm(`Confirmar cancelamento do resgate de R$ ${withdrawal.amount.toFixed(2)}?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // @ts-ignore - Supabase type issue
      const { error: transError } = await supabase
        .from('transactions')
        .update({
          status: 'cancelled',
          metadata: {
            ...withdrawal.metadata,
            admin_notes: adminNotes.trim(),
            approved_at: new Date().toISOString(),
          },
        })
        .eq('id', withdrawal.id);

      if (transError) {
        throw transError;
      }

      setSuccess('Resgate cancelado com sucesso!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao cancelar resgate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div
          className={`p-6 rounded-t-2xl ${
            isPending
              ? 'bg-gradient-to-r from-yellow-600 to-yellow-700'
              : isCompleted
              ? 'bg-gradient-to-r from-green-600 to-green-700'
              : 'bg-gradient-to-r from-red-600 to-red-700'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                {isPending ? (
                  <AlertCircle className="w-6 h-6 text-white" />
                ) : isCompleted ? (
                  <CheckCircle className="w-6 h-6 text-white" />
                ) : (
                  <XCircle className="w-6 h-6 text-white" />
                )}
                <h2 className="text-2xl font-bold text-white">
                  {isPending ? 'Processar Resgate via PIX' : 'Detalhes do Resgate'}
                </h2>
              </div>
              <p className="text-white/90 text-sm">
                {isPending
                  ? 'Aprove ou cancele a solicitação de resgate'
                  : `Resgate ${isCompleted ? 'aprovado' : 'cancelado'}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Informações do Cliente */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Informações do Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-600">
                  <strong>Nome:</strong> {withdrawal.users?.full_name}
                </p>
                <p className="text-gray-600">
                  <strong>Telefone:</strong> {withdrawal.users?.phone ? formatPhone(withdrawal.users.phone) : 'Não informado'}
                </p>
              </div>
              <div>
                <p className="text-gray-600">
                  <strong>Email:</strong> {withdrawal.users?.email || 'Não informado'}
                </p>
                <p className="text-gray-600">
                  <strong>Saldo atual:</strong> R${' '}
                  {withdrawal.users?.total_commission.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Informações do Resgate */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Informações do Resgate</h3>
            <div className="space-y-2 text-sm">
              <p className="text-gray-900">
                <strong>Valor solicitado:</strong>{' '}
                <span className="text-2xl font-bold text-blue-600">
                  R$ {withdrawal.amount.toFixed(2)}
                </span>
              </p>
              <p className="text-gray-600">
                <strong>Solicitado em:</strong>{' '}
                {new Date(withdrawal.created_at).toLocaleString('pt-BR')}
              </p>
              <p className="text-gray-600">
                <strong>ID da transação:</strong> {withdrawal.id}
              </p>
            </div>
          </div>

          {/* Formulário */}
          {isPending && (
            <>
              <div>
                <label
                  htmlFor="pixKey"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Chave PIX do Cliente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="pixKey"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Digite a chave PIX (CPF, email, telefone ou chave aleatória)"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  disabled={!isPending}
                />
              </div>

              <div>
                <label
                  htmlFor="adminNotes"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Observações {!isPending && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={
                    isPending
                      ? 'Observações sobre o resgate (opcional)'
                      : 'Informe o motivo do cancelamento'
                  }
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                  disabled={!isPending}
                />
              </div>
            </>
          )}

          {/* Detalhes se já processado */}
          {!isPending && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Detalhes do Processamento</h3>
              <div className="space-y-2 text-sm">
                {withdrawal.metadata?.pix_key && (
                  <p className="text-gray-600">
                    <strong>Chave PIX:</strong> {withdrawal.metadata.pix_key}
                  </p>
                )}
                {withdrawal.metadata?.approved_at && (
                  <p className="text-gray-600">
                    <strong>{isCompleted ? 'Aprovado' : 'Cancelado'} em:</strong>{' '}
                    {new Date(withdrawal.metadata.approved_at).toLocaleString('pt-BR')}
                  </p>
                )}
                {withdrawal.metadata?.admin_notes && (
                  <p className="text-gray-600">
                    <strong>Observações:</strong> {withdrawal.metadata.admin_notes}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <p className="text-sm text-green-700 font-medium">{success}</p>
            </div>
          )}

          {/* Footer */}
          {isPending && (
            <div className="flex space-x-3 pt-4 border-t-2 border-gray-200">
              <button
                onClick={handleReject}
                disabled={loading}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-lg hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5" />
                    <span>Cancelar Resgate</span>
                  </>
                )}
              </button>
              <button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Aprovar e Transferir</span>
                  </>
                )}
              </button>
            </div>
          )}

          {!isPending && (
            <button
              onClick={onClose}
              className="w-full px-6 py-4 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-all shadow-lg hover:shadow-xl"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
