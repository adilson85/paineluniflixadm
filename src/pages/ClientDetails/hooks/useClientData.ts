import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Client, User, Subscription } from '../../../types';

export interface ClientSubscription extends Subscription {
  subscription_plans?: {
    plan_type: string;
    name: string;
  } | null;
}

export function useClientData(clientId: string | undefined) {
  const [client, setClient] = useState<Client | null>(null);
  const [subscriptions, setSubscriptions] = useState<ClientSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateStatus = (expirationDate: string | null): 'Ativo' | 'Expirado' => {
    if (!expirationDate) return 'Ativo';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiration = new Date(expirationDate);
    return expiration >= today ? 'Ativo' : 'Expirado';
  };

  async function fetchClient() {
    try {
      setError(null);
      if (!clientId) {
        throw new Error('ID do cliente não fornecido');
      }

      // Buscar user com suas subscriptions
      const { data: userData, error: supabaseError } = await supabase
        .from('users')
        .select(`
          *,
          subscriptions (
            *,
            subscription_plans (
              plan_type,
              name
            )
          )
        `)
        .eq('id', clientId)
        .single();

      if (supabaseError) throw supabaseError;
      if (!userData) throw new Error('Cliente não encontrado');

      // Transformar para formato Client legado
      const user = userData as User & { subscriptions: ClientSubscription[] };
      const activeSubscription = user.subscriptions?.find(s => s.status === 'active');
      const mainSubscription = activeSubscription || user.subscriptions?.[0];

      const clientData: Client = {
        id: user.id,
        nome: user.full_name,
        telefone: user.phone || '',
        cpf: user.cpf || '',
        email: user.email || '',
        data_nascimento: user.data_nascimento || '',
        data_expiracao: mainSubscription?.expiration_date || '',
        status: mainSubscription ? calculateStatus(mainSubscription.expiration_date) : 'Ativo',
        painel1_login: user.subscriptions?.[0]?.app_username || '',
        painel1_senha: user.subscriptions?.[0]?.app_password || '',
        painel1_nome: user.subscriptions?.[0]?.panel_name || '',
        painel2_login: user.subscriptions?.[1]?.app_username || '',
        painel2_senha: user.subscriptions?.[1]?.app_password || '',
        painel2_nome: user.subscriptions?.[1]?.panel_name || '',
        painel3_login: user.subscriptions?.[2]?.app_username || '',
        painel3_senha: user.subscriptions?.[2]?.app_password || '',
        painel3_nome: user.subscriptions?.[2]?.panel_name || '',
        mac_address: mainSubscription?.mac_address || '',
        device_key: mainSubscription?.device_key || '',
        codigo_referencia: user.referral_code || '',
        indicado_por: user.referred_by || '',
        total_comissao: user.total_commission || 0,
        id_botconversa: user.id_botconversa?.toString() || '',
        teste: 'Não',
        data_criacao: user.created_at || new Date().toISOString(),
        ultima_atualizacao: user.updated_at || new Date().toISOString(),
        // Campos de endereço
        cep: user.cep || '',
        logradouro: user.logradouro || '',
        numero: user.numero || '',
        complemento: user.complemento || '',
        bairro: user.bairro || '',
        cidade: user.cidade || '',
        estado: user.estado || '',
      };

      setClient(clientData);
      setSubscriptions(user.subscriptions || []);
    } catch (err) {
      console.error('Error fetching client:', err);
      setError('Erro ao carregar os dados do cliente. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (clientId) {
      fetchClient();
    }
  }, [clientId]);

  return {
    client,
    subscriptions,
    loading,
    error,
    refetch: fetchClient,
    calculateStatus,
  };
}
