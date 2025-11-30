import { useState } from 'react';
import { X, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import type { Client } from '../../types';

interface DeleteClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  client: Client | null;
}

export function DeleteClientModal({
  isOpen,
  onClose,
  onConfirm,
  client,
}: DeleteClientModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen || !client) return null;

  const handleConfirm = async () => {
    if (confirmText !== client.nome) {
      setError(`Digite "${client.nome}" para confirmar`);
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir cliente. Por favor, tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText('');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-900/30 rounded-lg border border-red-700">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-100">Excluir Cliente</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Warning */}
          <div className="flex items-start space-x-3 mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-semibold mb-2">Atenção: Esta ação é irreversível!</p>
              <p className="text-red-400 text-sm mb-2">
                Ao excluir este cliente, os seguintes dados serão permanentemente removidos:
              </p>
              <ul className="text-red-400 text-sm mb-3 list-disc list-inside space-y-1">
                <li>Todas as subscriptions (logins)</li>
                <li>Dados pessoais do cliente</li>
              </ul>
              <p className="text-yellow-300 text-sm font-semibold mb-1">⚠️ Registros mantidos para relatórios:</p>
              <ul className="text-yellow-400 text-sm list-disc list-inside space-y-1">
                <li>Transações financeiras (mantidas para histórico contábil)</li>
                <li>Movimentações de caixa (mantidas para histórico contábil)</li>
                <li>Registros de créditos vendidos (mantidos para histórico contábil)</li>
              </ul>
            </div>
          </div>

          {/* Client Info */}
          <div className="mb-6 p-4 bg-slate-900 rounded-lg border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">Cliente a ser excluído:</p>
            <p className="text-slate-100 font-semibold text-lg">{client.nome}</p>
            {client.email && (
              <p className="text-slate-400 text-sm mt-1">{client.email}</p>
            )}
            {client.telefone && (
              <p className="text-slate-400 text-sm">{client.telefone}</p>
            )}
          </div>

          {/* Confirmation Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Para confirmar, digite o nome do cliente: <span className="font-mono text-slate-400">"{client.nome}"</span>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setError(null);
              }}
              disabled={isDeleting}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder={client.nome}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isDeleting || confirmText !== client.nome}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir Cliente</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

