import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { ClientHeader } from './components/ClientHeader';
import { ClientSubscriptions } from './components/ClientSubscriptions';
import { ClientReferrals } from './components/ClientReferrals';
import { ClientTransactions } from './components/ClientTransactions';
import { AddCreditsModal } from './components/AddCreditsModal';
import { EditClientProfileModal } from '../../components/modals/EditClientProfileModal';
import { DeleteClientModal } from '../../components/modals/DeleteClientModal';
import { useClientData } from './hooks/useClientData';
import { useClientReferrals } from './hooks/useClientReferrals';
import { useClientTransactions, type RechargeOption } from './hooks/useClientTransactions';
import { getPlanType } from '../../utils/clientHelpers';
import { supabase } from '../../lib/supabase';
import { AlertCircle } from 'lucide-react';

interface EditingClient {
  data_expiracao: string;
  painel1_login: string;
  painel1_senha: string;
  painel1_nome: string;
  painel2_login: string;
  painel2_senha: string;
  painel2_nome: string;
  painel3_login: string;
  painel3_senha: string;
  painel3_nome: string;
}

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Hooks customizados
  const { client, subscriptions, loading, error, refetch: refetchClient } = useClientData(id);
  const {
    referrals,
    totalCommission,
    loading: loadingReferrals,
    filterReferrals,
  } = useClientReferrals(id);
  const {
    transactions,
    loading: loadingTransactions,
    fetchTransactions,
    addCredits
  } = useClientTransactions(id);

  // Estado de edição
  const [isEditing, setIsEditing] = useState(false);
  const [editingData, setEditingData] = useState<EditingClient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Estado de adicionar créditos
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [isProcessingCredits, setIsProcessingCredits] = useState(false);
  const [rechargeOptions, setRechargeOptions] = useState<RechargeOption[]>([]);

  // Estado de modal de indicações
  const [showReferralsModal, setShowReferralsModal] = useState(false);

  // Estado de modal de edição de perfil
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  // Estado de modal de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Carregar transações quando o componente montar
  useEffect(() => {
    if (id) {
      fetchTransactions();
    }
  }, [id, fetchTransactions]);

  const handleEdit = () => {
    if (!client) return;

    setEditingData({
      data_expiracao: client.data_expiracao || new Date().toISOString().split('T')[0],
      painel1_login: client.painel1_login || '',
      painel1_senha: client.painel1_senha || '',
      painel1_nome: client.painel1_nome || '',
      painel2_login: client.painel2_login || '',
      painel2_senha: client.painel2_senha || '',
      painel2_nome: client.painel2_nome || '',
      painel3_login: client.painel3_login || '',
      painel3_senha: client.painel3_senha || '',
      painel3_nome: client.painel3_nome || '',
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingData(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editingData || !client || !id || isSaving) return;

    try {
      setIsSaving(true);
      setSaveError(null);

      // Buscar subscriptions existentes
      const { data: existingSubscriptions, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      // Preparar dados das subscriptions para atualizar/criar
      const subscriptionsData = [
        {
          index: 0,
          login: editingData.painel1_login,
          senha: editingData.painel1_senha,
          nome: editingData.painel1_nome,
        },
        {
          index: 1,
          login: editingData.painel2_login,
          senha: editingData.painel2_senha,
          nome: editingData.painel2_nome,
        },
        {
          index: 2,
          login: editingData.painel3_login,
          senha: editingData.painel3_senha,
          nome: editingData.painel3_nome,
        },
      ];

      // Determinar o tipo de plano baseado no número de logins preenchidos
      const loginCount = subscriptionsData.filter(sub => sub.login && sub.senha).length;
      let planType: string | null = null;

      if (loginCount === 1) {
        planType = 'ponto_unico';
      } else if (loginCount === 2) {
        planType = 'ponto_duplo';
      } else if (loginCount === 3) {
        planType = 'ponto_triplo';
      }

      // Buscar o plan_id correspondente ao tipo de plano
      let planId: string | null = null;
      if (planType) {
        const { data: planData } = await supabase
          .from('subscription_plans')
          .select('id')
          .eq('plan_type', planType)
          .eq('active', true)
          .limit(1)
          .maybeSingle();

        if (planData) {
          planId = planData.id;
        }
      }

      // Atualizar ou criar cada subscription
      for (const subData of subscriptionsData) {
        const existingSub = existingSubscriptions?.[subData.index];

        if (subData.login && subData.senha) {
          const subscriptionUpdate = {
            app_username: subData.login,
            app_password: subData.senha,
            panel_name: subData.nome || null,
            expiration_date: editingData.data_expiracao,
            plan_id: planId,
            updated_at: new Date().toISOString(),
          };

          if (existingSub) {
            // Atualizar subscription existente
            const { error: updateError } = await supabase
              .from('subscriptions')
              .update(subscriptionUpdate)
              .eq('id', existingSub.id);

            if (updateError) throw updateError;
          } else {
            // Criar nova subscription
            const { error: insertError } = await supabase
              .from('subscriptions')
              .insert({
                user_id: id,
                ...subscriptionUpdate,
                status: 'active',
              });

            if (insertError) throw insertError;
          }
        }
      }

      // Recarregar os dados atualizados
      await refetchClient();
      setIsEditing(false);
      setEditingData(null);
    } catch (err: any) {
      console.error('Error updating client:', err);
      setSaveError(err.message || 'Erro ao atualizar os dados do cliente. Por favor, tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleWithdrawCommission = () => {
    // TODO: Implementar modal de resgate de comissão
    alert('Modal de resgate de comissão será implementado');
  };

  const handleDeleteClient = async () => {
    if (!client || !id) return;

    try {
      setIsDeleting(true);
      setSaveError(null);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/delete-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          clientId: id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao excluir cliente');
      }

      // Redirecionar para a lista de clientes após exclusão bem-sucedida
      navigate('/');
    } catch (err: any) {
      console.error('Erro ao excluir cliente:', err);
      throw err; // Re-throw para o modal tratar
    } finally {
      setIsDeleting(false);
    }
  };

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

      await addCredits({
        clientId: id,
        clientName: client.nome,
        rechargeOptionId: data.rechargeOptionId,
        valorPago: data.valorPago,
        descontoTipo: data.descontoTipo,
        descontoValor: data.descontoValor,
        rechargeOptions,
      });

      // Recarregar dados do cliente e transações
      await refetchClient();
      await fetchTransactions();

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
              <h3 className="text-lg font-semibold text-red-300 mb-2">
                Erro ao Carregar Cliente
              </h3>
              <p className="text-red-400">{error || 'Cliente não encontrado'}</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

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
        <ClientHeader
          client={client}
          onAddCredits={() => setShowAddCreditsModal(true)}
          onEditProfile={() => setShowEditProfileModal(true)}
          onDelete={() => setShowDeleteModal(true)}
          totalCommission={totalCommission}
          totalReferrals={referrals.length}
          subscribersCount={referrals.filter(r => r.is_subscriber).length}
          onViewReferrals={() => setShowReferralsModal(true)}
        />

        {/* Subscriptions/Logins */}
        <ClientSubscriptions
          client={client}
          isEditing={isEditing}
          editingData={editingData}
          onEditingDataChange={setEditingData}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={isSaving}
        />

        {/* Histórico de Transações */}
        <ClientTransactions
          transactions={transactions}
          loading={loadingTransactions}
        />

        {/* Referrals Modal */}
        <ClientReferrals
          referrals={referrals}
          totalCommission={totalCommission}
          onWithdrawCommission={handleWithdrawCommission}
          filterReferrals={filterReferrals}
          isOpen={showReferralsModal}
          onClose={() => setShowReferralsModal(false)}
        />

        {/* Modal de Adicionar Créditos */}
        <AddCreditsModal
          isOpen={showAddCreditsModal}
          onClose={() => setShowAddCreditsModal(false)}
          onSubmit={handleAddCredits}
          rechargeOptions={rechargeOptions}
          isProcessing={isProcessingCredits}
          planType={getPlanType(client, subscriptions).type}
          quantidadePontos={subscriptions?.filter(s => s.status === 'active').length || 0}
        />

        {/* Modal de Editar Perfil do Cliente */}
        {showEditProfileModal && (
          <EditClientProfileModal
            client={client}
            onClose={() => setShowEditProfileModal(false)}
            onUpdate={() => {
              refetchClient();
              setShowEditProfileModal(false);
            }}
          />
        )}

        {/* Modal de Excluir Cliente */}
        <DeleteClientModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteClient}
          client={client}
        />
      </div>
    </Layout>
  );
}
