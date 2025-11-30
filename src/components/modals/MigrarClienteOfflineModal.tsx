import { X, ArrowRight, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { OfflineClient } from '../../types';
import { canMigrateOfflineClient } from '../../utils/offlineClientHelpers';
import { formatPhone } from '../../utils/clientHelpers';

interface MigrarClienteOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string) => Promise<void>;
  client: OfflineClient | null;
  isProcessing: boolean;
}

export function MigrarClienteOfflineModal({
  isOpen,
  onClose,
  onConfirm,
  client,
  isProcessing,
}: MigrarClienteOfflineModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Resetar estado quando modal abrir/fechar
  useEffect(() => {
    if (isOpen && client) {
      setEmail(client.email || '');
      setError(null);
    } else {
      setEmail('');
      setError(null);
    }
  }, [isOpen, client]);

  const handleConfirm = async () => {
    setError(null);

    // Validar email
    if (!email.trim()) {
      setError('Email é obrigatório para a migração');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, insira um email válido');
      return;
    }

    await onConfirm(email.trim());
  };

  if (!isOpen || !client) return null;

  // Verificar se pode migrar
  const migrationCheck = canMigrateOfflineClient(client);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-2xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-900/30 rounded-lg border border-blue-700">
              <ArrowRight className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-100">Migrar para Cliente com Acesso ao Painel</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Erro se não puder migrar */}
          {!migrationCheck.canMigrate && (
            <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-300 font-medium">Não é possível migrar este cliente</p>
                <p className="text-sm text-red-400 mt-1">{migrationCheck.reason}</p>
              </div>
            </div>
          )}

          {/* Informações do Cliente */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Dados do Cliente</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">Nome:</span>
                <span className="ml-2 text-slate-200 font-medium">{client.nome}</span>
              </div>
              <div>
                <span className="text-slate-400">Telefone:</span>
                <span className="ml-2 text-slate-200 font-medium">{formatPhone(client.telefone)}</span>
              </div>
              {client.cpf && (
                <div>
                  <span className="text-slate-400">CPF:</span>
                  <span className="ml-2 text-slate-200 font-medium">{client.cpf}</span>
                </div>
              )}
              <div>
                <span className="text-slate-400">Status:</span>
                <span className={`ml-2 font-medium ${client.status === 'Ativo' ? 'text-green-400' : 'text-red-400'}`}>
                  {client.status}
                </span>
              </div>
            </div>
          </div>

          {/* Campo de Email */}
          {migrationCheck.canMigrate && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email para Acesso ao Painel <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                disabled={isProcessing}
                className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50"
                placeholder="email@exemplo.com"
              />
              <p className="mt-2 text-xs text-slate-400">
                Este email será usado para login no painel do cliente. Certifique-se de que está correto.
              </p>

              {error && (
                <div className="mt-3 p-3 bg-red-900/20 border border-red-700 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Aviso sobre migração */}
          {migrationCheck.canMigrate && (
            <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-yellow-400 mr-3 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-300">
                  <p className="font-medium mb-1">Atenção:</p>
                  <ul className="list-disc list-inside space-y-1 text-yellow-400">
                    <li>Esta ação é irreversível</li>
                    <li>O cliente passará a ter acesso ao painel com este email</li>
                    <li>Todos os logins e dados serão preservados</li>
                    <li>Uma senha temporária será gerada (o cliente pode alterar depois)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          {migrationCheck.canMigrate && (
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Migrando...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Confirmar Migração
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
