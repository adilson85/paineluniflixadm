import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { MigrarClienteOfflineModal } from '../../components/modals/MigrarClienteOfflineModal';
import { EditarClienteOfflineModal } from '../../components/modals/EditarClienteOfflineModal';
import { AddCreditsModal } from '../../pages/ClientDetails/components/AddCreditsModal';
import { useOfflineClientData } from './hooks/useOfflineClientData';
import { useOfflineClientMigration } from './hooks/useOfflineClientMigration';
import { useOfflineClientTransactions, type RechargeOption } from './hooks/useOfflineClientTransactions';
import { getOfflineClientPlanType, getDaysUntilExpiration, countOfflineClientLogins } from '../../utils/offlineClientHelpers';
import { formatCurrency, formatDate, formatCPF, formatPhone } from '../../utils/clientHelpers';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft,
  Monitor,
  ArrowRight,
  AlertCircle,
  MessageCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
  CheckCircle2,
  Edit,
  Plus,
} from 'lucide-react';

export default function ClienteOfflineDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { client, loading, error, refetch } = useOfflineClientData(id);
  const { migrateToUser, isProcessing: isMigrating } = useOfflineClientMigration();
  const { addCredits } = useOfflineClientTransactions(id);

  const [showMigrarModal, setShowMigrarModal] = useState(false);
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [isProcessingCredits, setIsProcessingCredits] = useState(false);
  const [rechargeOptions, setRechargeOptions] = useState<RechargeOption[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState({
    senha_01: false,
    senha_02: false,
    senha_03: false,
  });
  const [showCredenciaisModal, setShowCredenciaisModal] = useState(false);
  const [credenciaisGeradas, setCredenciaisGeradas] = useState<{
    email: string;
    senha: string;
    nomeCliente: string;
  } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const togglePasswordVisibility = (field: 'senha_01' | 'senha_02' | 'senha_03') => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleMigrarConfirm = async (email: string) => {
    if (!id || !client) return;

    const resultado = await migrateToUser(id, email);

    if (resultado) {
      // Fechar modal de migração
      setShowMigrarModal(false);

      // Se foi gerada uma senha temporária, mostrar ao admin
      if (resultado.tempPassword) {
        setCredenciaisGeradas({
          email,
          senha: resultado.tempPassword,
          nomeCliente: client.nome,
        });
        setShowCredenciaisModal(true);
        setPasswordCopied(false);

        // Após fechar o modal de credenciais, redirecionar
        // (O usuário precisa ver as credenciais primeiro)
      } else {
        // Se não tem senha (usuário já existia), redirecionar direto
        navigate(`/clientes/${resultado.userId}`);
      }
    }
  };

  const handleCopyPassword = async () => {
    if (credenciaisGeradas?.senha) {
      await navigator.clipboard.writeText(credenciaisGeradas.senha);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  const handleCloseCredenciaisModal = () => {
    setShowCredenciaisModal(false);

    // Redirecionar para o perfil do novo usuário
    if (client) {
      navigate(`/clientes-offline`);
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'Ativo':
        return 'bg-green-900/30 text-green-300 border border-green-700';
      case 'Expirado':
        return 'bg-red-900/30 text-red-300 border border-red-700';
      default:
        return 'bg-slate-700/50 text-slate-300 border border-slate-600';
    }
  };

  const getBotConversaLink = (telefone: string) => {
    const cleanPhone = telefone.replace(/\D/g, '');
    return `https://app.botconversa.com.br/24872/live-chat/all/+55${cleanPhone}`;
  };

  // Carregar opções de recarga
  useEffect(() => {
    async function loadRechargeOptions() {
      const { data } = await supabase
        .from('recharge_options')
        .select('*')
        .eq('active', true)
        .order('duration_months', { ascending: true });

      if (data) {
        setRechargeOptions(data);
      }
    }
    loadRechargeOptions();
  }, []);

  const handleAddCredits = async (data: {
    rechargeOptionId: string;
    valorPago: number;
    descontoTipo: 'percentual' | 'fixo';
    descontoValor: number;
  }) => {
    if (!client || !id) return;

    try {
      setIsProcessingCredits(true);
      setSaveError(null);

      const quantidadePontos = countOfflineClientLogins(client);
      const planInfo = getOfflineClientPlanType(client);

      await addCredits({
        clientId: id,
        clientName: client.nome,
        rechargeOptionId: data.rechargeOptionId,
        valorPago: data.valorPago,
        descontoTipo: data.descontoTipo,
        descontoValor: data.descontoValor,
        rechargeOptions,
        quantidadePontos,
      });

      // Recarregar dados do cliente
      await refetch();

      // Fechar modal
      setShowAddCreditsModal(false);
    } catch (err) {
      console.error('Erro ao adicionar créditos:', err);
      setSaveError('Erro ao adicionar créditos. Por favor, tente novamente.');
    } finally {
      setIsProcessingCredits(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  // Error state
  if (error || !client) {
    return (
      <Layout>
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 max-w-2xl mx-auto mt-8">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-300 mb-2">Erro ao Carregar Cliente</h3>
              <p className="text-red-400">{error || 'Cliente offline não encontrado'}</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const planInfo = getOfflineClientPlanType(client);
  const daysUntilExpiration = getDaysUntilExpiration(client.data_expiracao);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Erro ao salvar */}
        {saveError && (
          <div className="mb-6 bg-red-900/20 border border-red-700 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{saveError}</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-slate-800 rounded-lg shadow-lg p-6 mb-6 border border-slate-700">
          {/* Breadcrumb */}
          <div className="flex items-center justify-between mb-6">
            <Link
              to="/clientes-offline"
              className="flex items-center text-slate-400 hover:text-slate-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Clientes Offline
            </Link>

            <div className="flex items-center gap-3">
              {/* Botão Adicionar Créditos */}
              <button
                onClick={() => setShowAddCreditsModal(true)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Créditos
              </button>

              {/* Botão Editar */}
              <button
                onClick={() => setShowEditarModal(true)}
                className="flex items-center px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar Perfil
              </button>

              {/* Botão Migrar */}
              {!client.migrated_to_user_id && (
                <button
                  onClick={() => setShowMigrarModal(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Migrar para Cliente com Acesso
                </button>
              )}
            </div>
          </div>

          {/* Info do Cliente */}
          <div className="flex items-start">
            <div className="p-3 bg-blue-900/30 rounded-lg mr-4 border border-blue-700">
              <Monitor className="w-8 h-8 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-100">{client.nome}</h1>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
                    client.status
                  )}`}
                >
                  {client.status}
                </span>
                {client.migrated_to_user_id && (
                  <span className="px-3 py-1 rounded-full text-sm font-semibold bg-purple-900/30 text-purple-300 border border-purple-700">
                    Migrado
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                {client.telefone && (
                  <div>
                    <span className="text-slate-400">Telefone:</span>
                    <span className="ml-2 text-slate-200 font-medium">
                      {formatPhone(client.telefone)}
                    </span>
                    <a
                      href={getBotConversaLink(client.telefone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-400 hover:text-blue-300 inline-flex"
                      title="Abrir no BotConversa"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  </div>
                )}
                {client.email && (
                  <div>
                    <span className="text-slate-400">Email:</span>
                    <span className="ml-2 text-slate-200 font-medium">{client.email}</span>
                  </div>
                )}
                {client.cpf && (
                  <div>
                    <span className="text-slate-400">CPF:</span>
                    <span className="ml-2 text-slate-200 font-medium">{formatCPF(client.cpf)}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400">Expira em:</span>
                  <span className="ml-2 text-slate-200 font-medium">
                    {formatDate(client.data_expiracao)}
                  </span>
                  {client.status === 'Ativo' && (
                    <span
                      className={`ml-2 text-xs ${
                        daysUntilExpiration <= 7 ? 'text-yellow-400' : 'text-slate-400'
                      }`}
                    >
                      ({daysUntilExpiration > 0 ? `${daysUntilExpiration} dias` : 'Hoje'})
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400">Plano:</span>
                  <span className="ml-2 text-slate-200 font-medium">{planInfo.label}</span>
                </div>
                {client.valor_mensal && (
                  <div>
                    <span className="text-slate-400">Valor Mensal:</span>
                    <span className="ml-2 text-slate-200 font-medium">
                      {formatCurrency(client.valor_mensal)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Logins de Acesso */}
        <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700 mb-6">
          <h2 className="text-xl font-bold text-slate-100 mb-4">Logins de Acesso</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Login 01 */}
            {client.login_01 && client.senha_01 && (
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Login 01</h3>

                {client.painel_01 && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Painel
                    </label>
                    <p className="text-sm text-slate-200 font-medium">{client.painel_01}</p>
                  </div>
                )}

                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Usuário</label>
                  <p className="text-sm text-slate-200 font-mono font-medium">{client.login_01}</p>
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Senha</label>
                  <div className="relative">
                    <p className="text-sm text-slate-200 font-mono font-medium pr-8">
                      {showPasswords.senha_01 ? client.senha_01 : '••••••••'}
                    </p>
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('senha_01')}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPasswords.senha_01 ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700">
                  <span className="inline-block px-2 py-1 bg-green-900/30 text-green-300 border border-green-700 text-xs font-semibold rounded">
                    Ativo
                  </span>
                </div>
              </div>
            )}

            {/* Login 02 */}
            {client.login_02 && client.senha_02 && (
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Login 02</h3>

                {client.painel_02 && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Painel
                    </label>
                    <p className="text-sm text-slate-200 font-medium">{client.painel_02}</p>
                  </div>
                )}

                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Usuário</label>
                  <p className="text-sm text-slate-200 font-mono font-medium">{client.login_02}</p>
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Senha</label>
                  <div className="relative">
                    <p className="text-sm text-slate-200 font-mono font-medium pr-8">
                      {showPasswords.senha_02 ? client.senha_02 : '••••••••'}
                    </p>
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('senha_02')}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPasswords.senha_02 ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700">
                  <span className="inline-block px-2 py-1 bg-green-900/30 text-green-300 border border-green-700 text-xs font-semibold rounded">
                    Ativo
                  </span>
                </div>
              </div>
            )}

            {/* Login 03 */}
            {client.login_03 && client.senha_03 && (
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Login 03</h3>

                {client.painel_03 && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Painel
                    </label>
                    <p className="text-sm text-slate-200 font-medium">{client.painel_03}</p>
                  </div>
                )}

                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Usuário</label>
                  <p className="text-sm text-slate-200 font-mono font-medium">{client.login_03}</p>
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Senha</label>
                  <div className="relative">
                    <p className="text-sm text-slate-200 font-mono font-medium pr-8">
                      {showPasswords.senha_03 ? client.senha_03 : '••••••••'}
                    </p>
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('senha_03')}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPasswords.senha_03 ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700">
                  <span className="inline-block px-2 py-1 bg-green-900/30 text-green-300 border border-green-700 text-xs font-semibold rounded">
                    Ativo
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informações Adicionais */}
        <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-slate-100 mb-4">Informações Adicionais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Cadastrado em:</span>
              <span className="ml-2 text-slate-200 font-medium">
                {formatDate(client.created_at)}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Última atualização:</span>
              <span className="ml-2 text-slate-200 font-medium">
                {formatDate(client.updated_at)}
              </span>
            </div>
            {client.id_botconversa && (
              <div>
                <span className="text-slate-400">ID Botconversa:</span>
                <span className="ml-2 text-slate-200 font-medium">{client.id_botconversa}</span>
              </div>
            )}
            {client.migrated_at && (
              <div>
                <span className="text-slate-400">Migrado em:</span>
                <span className="ml-2 text-purple-300 font-medium">
                  {formatDate(client.migrated_at)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Adicionar Créditos */}
      <AddCreditsModal
        isOpen={showAddCreditsModal}
        onClose={() => setShowAddCreditsModal(false)}
        onSubmit={handleAddCredits}
        rechargeOptions={rechargeOptions}
        isProcessing={isProcessingCredits}
        planType={getOfflineClientPlanType(client).type}
        quantidadePontos={countOfflineClientLogins(client)}
      />

      {/* Modal de Edição */}
      <EditarClienteOfflineModal
        isOpen={showEditarModal}
        onClose={() => setShowEditarModal(false)}
        onSuccess={() => {
          refetch();
          setShowEditarModal(false);
        }}
        client={client}
      />

      {/* Modal de Migração */}
      <MigrarClienteOfflineModal
        isOpen={showMigrarModal}
        onClose={() => setShowMigrarModal(false)}
        onConfirm={handleMigrarConfirm}
        client={client}
        isProcessing={isMigrating}
      />

      {/* Modal de Credenciais Geradas */}
      {showCredenciaisModal && credenciaisGeradas && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-900/30 rounded-lg border border-green-700">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <h2 className="text-xl font-semibold text-slate-100">Cliente Migrado com Sucesso!</h2>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-300 mb-2">
                  <strong>Cliente:</strong> {credenciaisGeradas.nomeCliente}
                </p>
                <p className="text-xs text-blue-400">
                  As credenciais abaixo foram geradas automaticamente. Envie-as ao cliente para que ele possa acessar o painel.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Email de Acesso</label>
                <div className="px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg">
                  <p className="text-slate-200 font-mono text-sm break-all">{credenciaisGeradas.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Senha Temporária</label>
                <div className="px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-between">
                  <p className="text-slate-200 font-mono text-lg font-semibold">{credenciaisGeradas.senha}</p>
                  <button
                    onClick={handleCopyPassword}
                    className="ml-3 p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    title="Copiar senha"
                  >
                    {passwordCopied ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-slate-300" />
                    )}
                  </button>
                </div>
                {passwordCopied && (
                  <p className="mt-2 text-xs text-green-400">✓ Senha copiada para a área de transferência!</p>
                )}
              </div>

              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                <p className="text-xs text-yellow-300">
                  <strong>⚠️ Importante:</strong> Esta senha é temporária. Recomende ao cliente que a altere no primeiro acesso ao painel.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
              <button
                onClick={handleCloseCredenciaisModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
