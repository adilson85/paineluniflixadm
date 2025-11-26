import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Monitor, Edit2, X, Check, Users, DollarSign, Wallet, Search, Filter, Plus, History, AlertCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import type { Client, User, Subscription } from '../types';

interface LoginInfo {
  panelName: string;
  login: string;
  password: string;
  status: 'Ativado' | 'Expirado';
}

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
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingData, setEditingData] = useState<EditingClient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [referrals, setReferrals] = useState<Array<{
    id: string;
    referred_id: string;
    total_commission_earned: number;
    last_commission_date: string | null;
    created_at: string;
    referred_user: {
      full_name: string;
      email: string | null;
      phone: string | null;
    } | null;
    is_subscriber?: boolean;
  }>>([]);
  const [referralSearchTerm, setReferralSearchTerm] = useState('');
  const [referralFilter, setReferralFilter] = useState<'all' | 'subscribers' | 'non_subscribers'>('all');
  const [totalCommission, setTotalCommission] = useState<number>(0);
  const [showResgateModal, setShowResgateModal] = useState(false);
  const [resgateForm, setResgateForm] = useState({
    tipo: 'mensalidade' as 'mensalidade' | 'pix',
    valor: 0,
    recharge_option_id: '' as string,
    quantidade_creditos: 0,
  });
  const [isProcessingResgate, setIsProcessingResgate] = useState(false);
  const [rechargeOptions, setRechargeOptions] = useState<Array<{
    id: string;
    plan_type: string;
    period: string;
    duration_months: number;
    price: number;
    display_name: string;
  }>>([]);
  const [showAdicionarCreditosModal, setShowAdicionarCreditosModal] = useState(false);
  const [adicionarCreditosForm, setAdicionarCreditosForm] = useState({
    recharge_option_id: '' as string,
    valor_pago: 0,
    quantidade_creditos: 0,
    desconto_tipo: 'percentual' as 'percentual' | 'fixo',
    desconto_valor: 0,
  });
  const [isProcessingAdicionarCreditos, setIsProcessingAdicionarCreditos] = useState(false);
  const [showTransacoesModal, setShowTransacoesModal] = useState(false);
  const [transacoes, setTransacoes] = useState<Array<{
    id: string;
    type: string;
    amount: number;
    payment_method: string | null;
    status: string;
    description: string | null;
    created_at: string;
    metadata: any;
  }>>([]);
  const [loadingTransacoes, setLoadingTransacoes] = useState(false);
  const [clientSubscriptions, setClientSubscriptions] = useState<Array<Subscription & { subscription_plans?: { plan_type: string; name: string } | null }>>([]);
  const [pendingTransacoesCount, setPendingTransacoesCount] = useState(0);
  const [showBaixaModal, setShowBaixaModal] = useState(false);
  const [transacaoParaBaixa, setTransacaoParaBaixa] = useState<{
    id: string;
    type: string;
    amount: number;
    description: string | null;
  } | null>(null);
  const [isProcessingBaixa, setIsProcessingBaixa] = useState(false);

  useEffect(() => {
    if (id) {
      fetchClient();
    }
  }, [id]);

  const calculateStatus = (expirationDate: string | null): 'Ativado' | 'Expirado' => {
    if (!expirationDate) return 'Ativado';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiration = new Date(expirationDate);
    return expiration >= today ? 'Ativado' : 'Expirado';
  };

  async function fetchClient() {
    try {
      setError(null);
      if (!id) {
        throw new Error('ID do cliente não fornecido');
      }

      // Buscar user com suas subscriptions e planos
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
        .eq('id', id)
        .single();

      if (supabaseError) throw supabaseError;
      if (!userData) throw new Error('Cliente não encontrado');

      // Buscar total_commission do cliente
      setTotalCommission(userData.total_commission || 0);

      // Transformar para formato Client legado primeiro
      const user = userData as User & { subscriptions: Array<Subscription & { subscription_plans?: { plan_type: string; name: string } | null }> };
      const activeSubscription = user.subscriptions?.find(s => s.status === 'active');
      const mainSubscription = activeSubscription || user.subscriptions?.[0];
      
      // Armazenar subscriptions com planos para uso posterior
      setClientSubscriptions(user.subscriptions || []);

      const clientData: Client = {
        id: user.id,
        nome: user.full_name,
        telefone: user.phone || '',
        cpf: user.cpf || '',
        data_nascimento: user.data_nascimento || '',
        status: mainSubscription ? calculateStatus(mainSubscription.expiration_date) : 'Ativado',
        data_expiracao: mainSubscription?.expiration_date || '',
        email: user.email || '',
        valor: mainSubscription?.monthly_value || 0,
        total_creditos: 0,
        painel1_login: user.subscriptions?.[0]?.app_username || '',
        painel1_senha: user.subscriptions?.[0]?.app_password || '',
        painel1_nome: user.subscriptions?.[0]?.panel_name || '',
        painel2_login: user.subscriptions?.[1]?.app_username || '',
        painel2_senha: user.subscriptions?.[1]?.app_password || '',
        painel2_nome: user.subscriptions?.[1]?.panel_name || '',
        painel3_login: user.subscriptions?.[2]?.app_username || '',
        painel3_senha: user.subscriptions?.[2]?.app_password || '',
        painel3_nome: user.subscriptions?.[2]?.panel_name || '',
        created_at: user.created_at,
        updated_at: user.updated_at,
      };

      // Buscar opções de recarga baseadas no plano do cliente
      const planInfo = getPlanType(clientData, user.subscriptions);
      if (planInfo.type) {
        const { data: rechargeData } = await supabase
          .from('recharge_options')
          .select('*')
          .eq('plan_type', planInfo.type)
          .eq('active', true)
          .order('duration_months');

        if (rechargeData) {
          setRechargeOptions(rechargeData);
        }
      }

      // Buscar referrals (clientes indicados por este cliente)
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', id)
        .order('created_at', { ascending: false });

      if (referralsError) {
        console.error('Error fetching referrals:', referralsError);
      } else if (referralsData) {
        // Buscar dados dos usuários indicados e verificar se são assinantes
        const referralsWithUsers = await Promise.all(
          referralsData.map(async (referral) => {
            const { data: referredUser } = await supabase
              .from('users')
              .select('full_name, email, phone')
              .eq('id', referral.referred_id)
              .single();

            // Verificar se o usuário tem assinatura ativa
            const { data: subscription } = await supabase
              .from('subscriptions')
              .select('id')
              .eq('user_id', referral.referred_id)
              .eq('status', 'active')
              .limit(1)
              .maybeSingle();

            return {
              ...referral,
              referred_user: referredUser || null,
              is_subscriber: !!subscription,
            };
          })
        );
        setReferrals(referralsWithUsers);
      }

      setClient(clientData);
      setEditingData({
        data_expiracao: clientData.data_expiracao || '',
        painel1_login: clientData.painel1_login || '',
        painel1_senha: clientData.painel1_senha || '',
        painel1_nome: clientData.painel1_nome || '',
        painel2_login: clientData.painel2_login || '',
        painel2_senha: clientData.painel2_senha || '',
        painel2_nome: clientData.painel2_nome || '',
        painel3_login: clientData.painel3_login || '',
        painel3_senha: clientData.painel3_senha || '',
        painel3_nome: clientData.painel3_nome || ''
      });
    } catch (err) {
      console.error('Error fetching client:', err);
      setError('Erro ao carregar os dados do cliente. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const saveChanges = async () => {
    if (!editingData || !client || !id || isSaving) return;

    try {
      setIsSaving(true);
      setError(null);

      console.log('Updating client with ID:', id);
      console.log('Update data:', editingData);

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

      // Atualizar ou criar cada subscription
      for (const subData of subscriptionsData) {
        const existingSub = existingSubscriptions?.[subData.index];

        // Se tem dados (login preenchido)
        if (subData.login && subData.senha) {
          const subscriptionUpdate = {
            app_username: subData.login,
            app_password: subData.senha,
            panel_name: subData.nome || null,
            expiration_date: editingData.data_expiracao,
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
        } else if (existingSub) {
          // Se não tem dados mas existe subscription, limpar os campos
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              app_username: '',
              app_password: '',
              panel_name: null,
              expiration_date: editingData.data_expiracao,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingSub.id);

          if (updateError) throw updateError;
        }
      }

      console.log('Update successful');

      // Recarregar os dados atualizados
      await fetchClient();
      setIsEditing(false);

    } catch (err) {
      console.error('Error updating client:', err);
      setError('Erro ao atualizar os dados do cliente. Por favor, tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const getActiveLogins = (client: Client): LoginInfo[] => {
    const status = calculateStatus(client.data_expiracao);
    const logins: LoginInfo[] = [];

    if (client.painel1_login && client.painel1_senha && client.painel1_nome) {
      logins.push({
        panelName: client.painel1_nome,
        login: client.painel1_login,
        password: client.painel1_senha,
        status
      });
    }

    if (client.painel2_login && client.painel2_senha && client.painel2_nome) {
      logins.push({
        panelName: client.painel2_nome,
        login: client.painel2_login,
        password: client.painel2_senha,
        status
      });
    }

    if (client.painel3_login && client.painel3_senha && client.painel3_nome) {
      logins.push({
        panelName: client.painel3_nome,
        login: client.painel3_login,
        password: client.painel3_senha,
        status
      });
    }

    return logins;
  };

  const getPlanType = (client: Client, subscriptions?: Array<Subscription & { subscription_plans?: { plan_type: string; name: string } | null }>): { type: 'ponto_unico' | 'ponto_duplo' | 'ponto_triplo' | null; label: string } => {
    // Primeiro, tentar obter do plan_type das subscriptions
    if (subscriptions && subscriptions.length > 0) {
      const activeSub = subscriptions.find(s => s.status === 'active') || subscriptions[0];
      if (activeSub?.subscription_plans?.plan_type) {
        const planType = activeSub.subscription_plans.plan_type;
        const labels: { [key: string]: string } = {
          'ponto_unico': 'Ponto Único',
          'ponto_duplo': 'Ponto Duplo',
          'ponto_triplo': 'Ponto Triplo',
        };
        return { 
          type: planType as 'ponto_unico' | 'ponto_duplo' | 'ponto_triplo', 
          label: labels[planType] || planType 
        };
      }
    }

    // Fallback: calcular baseado nos logins ativos
    const activeLogins = getActiveLogins(client);
    const loginCount = activeLogins.length;

    if (loginCount === 1) {
      return { type: 'ponto_unico', label: 'Ponto Único' };
    } else if (loginCount === 2) {
      return { type: 'ponto_duplo', label: 'Ponto Duplo' };
    } else if (loginCount === 3) {
      return { type: 'ponto_triplo', label: 'Ponto Triplo' };
    }
    
    return { type: null, label: '-' };
  };

  const calculateFinalPrice = (optionPrice: number, descontoTipo: string, descontoValor: number): number => {
    if (!optionPrice || descontoValor <= 0) return optionPrice;
    
    if (descontoTipo === 'percentual') {
      return optionPrice * (1 - descontoValor / 100);
    } else {
      return Math.max(0, optionPrice - descontoValor);
    }
  };

  const fetchTransacoes = async () => {
    if (!id) return;
    
    try {
      setLoadingTransacoes(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransacoes(data || []);
      
      // Contar transações pendentes
      const pendingCount = (data || []).filter(t => t.status === 'pending').length;
      setPendingTransacoesCount(pendingCount);
    } catch (err) {
      console.error('Error fetching transacoes:', err);
      setError('Erro ao carregar as transações. Por favor, tente novamente.');
    } finally {
      setLoadingTransacoes(false);
    }
  };

  const handleShowTransacoes = () => {
    setShowTransacoesModal(true);
    fetchTransacoes();
  };

  const handleAdicionarCreditos = async () => {
    if (!id || !client || isProcessingAdicionarCreditos) return;

    // Validações
    if (!adicionarCreditosForm.recharge_option_id) {
      setError('Selecione uma opção de recarga');
      return;
    }

    try {
      setIsProcessingAdicionarCreditos(true);
      setError(null);

      const selectedOption = rechargeOptions.find(opt => opt.id === adicionarCreditosForm.recharge_option_id);
      if (!selectedOption) {
        throw new Error('Opção de recarga não encontrada');
      }

      // Buscar subscriptions ativas para calcular quantidade de pontos
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', id)
        .eq('status', 'active');

      if (!subscriptions || subscriptions.length === 0) {
        throw new Error('Cliente não possui assinaturas ativas');
      }

      // Calcular quantidade de créditos: número de pontos × duração em meses
      const quantidadePontos = subscriptions.length; // 1, 2 ou 3 logins
      const quantidadeCreditos = quantidadePontos * selectedOption.duration_months;

      // Atualizar data de expiração das subscriptions do cliente
      if (subscriptions.length > 0) {
        // Calcular nova data de expiração (adicionar meses)
        const updates = subscriptions.map(sub => {
          const currentExpiration = new Date(sub.expiration_date);
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
      }

      // Registrar entrada no caixa (se houver valor pago)
      if (adicionarCreditosForm.valor_pago > 0) {
        const hoje = new Date().toISOString().split('T')[0];
        const historico = `Assinatura - ${client.nome}`;
        
        // Registrar no caixa
        const { error: caixaError } = await supabase
          .from('caixa_movimentacoes')
          .insert({
            data: hoje,
            historico: historico,
            entrada: adicionarCreditosForm.valor_pago,
            saida: 0,
          });

        if (caixaError) throw caixaError;

        // Criar transação do tipo 'recharge' para acionar o trigger de comissão
        // O trigger process_referral_commission() irá calcular e distribuir a comissão automaticamente
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            user_id: id,
            type: 'recharge',
            amount: adicionarCreditosForm.valor_pago,
            payment_method: 'manual',
            status: 'completed',
            description: `Recarga de assinatura - ${selectedOption.display_name} (${quantidadePontos} ponto${quantidadePontos > 1 ? 's' : ''} × ${selectedOption.duration_months} ${selectedOption.duration_months === 1 ? 'mês' : 'meses'})`,
            metadata: {
              recharge_option_id: adicionarCreditosForm.recharge_option_id,
              quantidade_creditos: quantidadeCreditos,
              quantidade_pontos: quantidadePontos,
              duration_months: selectedOption.duration_months,
              desconto_tipo: adicionarCreditosForm.desconto_tipo,
              desconto_valor: adicionarCreditosForm.desconto_valor,
            },
          });

        if (transactionError) throw transactionError;
      }

      // Registrar créditos vendidos
      // Usar o painel principal (primeira subscription) como padrão
      const painelPrincipal = subscriptions[0]?.panel_name || null;
      const hoje = new Date().toISOString().split('T')[0];
      const historicoCreditos = `Créditos adicionados manualmente - ${client.nome} (${quantidadePontos} ponto${quantidadePontos > 1 ? 's' : ''} × ${selectedOption.duration_months} ${selectedOption.duration_months === 1 ? 'mês' : 'meses'})`;
      
      const { error: creditosError } = await supabase
        .from('creditos_vendidos')
        .insert({
          data: hoje,
          historico: historicoCreditos,
          painel: painelPrincipal,
          quantidade_creditos: quantidadeCreditos,
        });

      if (creditosError) throw creditosError;

      // Limpar formulário e fechar modal
      setShowAdicionarCreditosModal(false);
      setAdicionarCreditosForm({
        recharge_option_id: '',
        valor_pago: 0,
        quantidade_creditos: 0,
        desconto_tipo: 'percentual',
        desconto_valor: 0,
      });

      // Recarregar dados do cliente
      await fetchClient();

    } catch (err) {
      console.error('Error adicionando créditos:', err);
      setError('Erro ao adicionar créditos. Por favor, tente novamente.');
    } finally {
      setIsProcessingAdicionarCreditos(false);
    }
  };

  const handleResgateComissao = async () => {
    if (!id || !client || isProcessingResgate) return;

    // Validações
    if (resgateForm.tipo === 'mensalidade') {
      if (!resgateForm.recharge_option_id || resgateForm.valor <= 0) {
        setError('Selecione uma opção de crédito');
        return;
      }
      if (resgateForm.valor < 35) {
        setError('O valor mínimo para créditos é de R$ 35,00');
        return;
      }
    } else {
      if (resgateForm.valor <= 0) {
        setError('Informe um valor válido para resgate');
        return;
      }
      if (resgateForm.valor < 50) {
        setError('O valor mínimo para PIX é de R$ 50,00');
        return;
      }
    }

    if (resgateForm.valor > totalCommission) {
      setError('O valor solicitado excede o valor disponível');
      return;
    }

    try {
      setIsProcessingResgate(true);
      setError(null);

      let description = '';
      let metadata: any = { tipo_resgate: resgateForm.tipo };

      // Se for crédito, buscar dados da opção de recarga
      if (resgateForm.tipo === 'mensalidade' && resgateForm.recharge_option_id) {
        const selectedOption = rechargeOptions.find(opt => opt.id === resgateForm.recharge_option_id);
        if (!selectedOption) {
          throw new Error('Opção de recarga não encontrada');
        }

        // Buscar subscriptions ativas para calcular quantidade de pontos
        const { data: subscriptions } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', id)
          .eq('status', 'active');

        if (!subscriptions || subscriptions.length === 0) {
          throw new Error('Cliente não possui assinaturas ativas');
        }

        // Calcular quantidade de créditos: número de pontos × duração em meses
        const quantidadePontos = subscriptions.length; // 1, 2 ou 3 logins
        const quantidadeCreditos = quantidadePontos * selectedOption.duration_months;

        description = `Resgate de comissão: ${quantidadeCreditos} crédito(s) - ${selectedOption.display_name} (${quantidadePontos} ponto${quantidadePontos > 1 ? 's' : ''} × ${selectedOption.duration_months} ${selectedOption.duration_months === 1 ? 'mês' : 'meses'})`;
        metadata = {
          ...metadata,
          recharge_option_id: resgateForm.recharge_option_id,
          quantidade_creditos: quantidadeCreditos,
          quantidade_pontos: quantidadePontos,
          duration_months: selectedOption.duration_months,
        };

        // Atualizar data de expiração das subscriptions do cliente
        if (subscriptions.length > 0) {
          // Calcular nova data de expiração (adicionar meses)
          const updates = subscriptions.map(sub => {
            const currentExpiration = new Date(sub.expiration_date);
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
        }

        // Registrar créditos vendidos (resgatados)
        // Usar o painel principal (primeira subscription) como padrão
        const painelPrincipal = subscriptions[0]?.panel_name || null;
        const hoje = new Date().toISOString().split('T')[0];
        const historicoCreditos = `Resgate de comissão - ${client.nome} (${quantidadePontos} ponto${quantidadePontos > 1 ? 's' : ''} × ${selectedOption.duration_months} ${selectedOption.duration_months === 1 ? 'mês' : 'meses'})`;
        
        const { error: creditosError } = await supabase
          .from('creditos_vendidos')
          .insert({
            data: hoje,
            historico: historicoCreditos,
            painel: painelPrincipal,
            quantidade_creditos: quantidadeCreditos,
          });

        if (creditosError) throw creditosError;
      } else {
        // PIX - criar saída no caixa
        description = `Resgate de comissão via PIX`;
        
        const hoje = new Date().toISOString().split('T')[0];
        const { error: caixaError } = await supabase
          .from('caixa_movimentacoes')
          .insert({
            data: hoje,
            historico: `Resgate de comissão - ${client.nome}`,
            entrada: 0,
            saida: resgateForm.valor,
          });

        if (caixaError) throw caixaError;
      }

      // Criar transação de resgate (histórico)
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: id,
          type: 'commission_payout',
          amount: resgateForm.valor,
          payment_method: resgateForm.tipo === 'pix' ? 'pix' : 'manual',
          status: resgateForm.tipo === 'pix' ? 'pending' : 'completed',
          description: description,
          metadata: metadata,
        });

      if (transactionError) throw transactionError;

      // Atualizar total_commission do usuário (subtrair o valor resgatado)
      const { error: updateError } = await supabase
        .from('users')
        .update({
          total_commission: totalCommission - resgateForm.valor,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Atualizar estado local
      setTotalCommission(totalCommission - resgateForm.valor);
      setShowResgateModal(false);
      setResgateForm({ tipo: 'mensalidade', valor: 0, recharge_option_id: '', quantidade_creditos: 0 });

      // Recarregar dados do cliente
      await fetchClient();

    } catch (err) {
      console.error('Error processing resgate:', err);
      setError('Erro ao processar o resgate. Por favor, tente novamente.');
    } finally {
      setIsProcessingResgate(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (error || !client || !editingData) {
    return (
      <Layout>
        <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded">
          {error || 'Cliente não encontrado'}
        </div>
      </Layout>
    );
  }

  const activeLogins = getActiveLogins(client);
  const clientStatus = calculateStatus(client.data_expiracao);
  const planInfo = getPlanType(client, clientSubscriptions);

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <Link
          to="/clientes"
          className="inline-flex items-center text-blue-400 hover:text-blue-300"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para lista de clientes
        </Link>
        {!isEditing ? (
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setAdicionarCreditosForm({
                  recharge_option_id: '',
                  valor_pago: 0,
                  quantidade_creditos: 0,
                  desconto_tipo: 'percentual',
                  desconto_valor: 0,
                });
                setShowAdicionarCreditosModal(true);
              }}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Créditos
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Editar
            </button>
          </div>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={saveChanges}
              disabled={isSaving}
              className={`flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 ${
                isSaving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setError(null);
              }}
              disabled={isSaving}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="bg-slate-800 rounded-lg shadow-lg p-6 mb-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            Dados do Cliente
          </h2>
          <button
            onClick={handleShowTransacoes}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <History className="h-4 w-4 mr-2" />
            Ver Transações
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-slate-400">Nome</p>
            <p className="text-lg text-slate-100">{client.nome}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">CPF</p>
            <p className="text-lg text-slate-100">{client.cpf || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">E-mail</p>
            <p className="text-lg text-slate-100">{client.email || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Telefone</p>
            <p className="text-lg text-slate-100">{client.telefone || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Status</p>
            <span
              className={`px-2 py-1 inline-flex text-sm font-semibold rounded-full ${
                clientStatus === 'Ativado'
                  ? 'bg-green-900/30 text-green-300 border border-green-700'
                  : 'bg-red-900/30 text-red-300 border border-red-700'
              }`}
            >
              {clientStatus}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Plano</p>
            {planInfo.type ? (
              <span
                className={`px-2 py-1 inline-flex text-sm font-semibold rounded-full ${
                  planInfo.type === 'ponto_triplo'
                    ? 'bg-purple-900/30 text-purple-300 border border-purple-700'
                    : planInfo.type === 'ponto_duplo'
                    ? 'bg-blue-900/30 text-blue-300 border border-blue-700'
                    : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                }`}
              >
                {planInfo.label}
              </span>
            ) : (
              <p className="text-lg text-slate-100">-</p>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Data de Expiração</p>
            {isEditing ? (
              <input
                type="date"
                value={editingData.data_expiracao}
                onChange={(e) => setEditingData({
                  ...editingData,
                  data_expiracao: e.target.value
                })}
                disabled={isSaving}
                className="mt-1 block w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            ) : (
              <p className="text-lg text-slate-100">
                {client.data_expiracao
                  ? new Date(client.data_expiracao).toLocaleDateString('pt-BR')
                  : '-'}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Valor</p>
            <p className="text-lg text-slate-100">
              {client.valor
                ? new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(client.valor)
                : '-'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
        <h2 className="text-2xl font-semibold text-slate-100 mb-4">
          Logins Ativos
        </h2>
        {isEditing ? (
          <div className="space-y-6">
            {/* Painel 1 */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h3 className="font-medium text-slate-100 mb-3">Painel 1</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400">Nome do Painel</label>
                  <input
                    type="text"
                    value={editingData.painel1_nome}
                    onChange={(e) => setEditingData({
                      ...editingData,
                      painel1_nome: e.target.value
                    })}
                    disabled={isSaving}
                    className="mt-1 block w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400">Login</label>
                  <input
                    type="text"
                    value={editingData.painel1_login}
                    onChange={(e) => setEditingData({
                      ...editingData,
                      painel1_login: e.target.value
                    })}
                    disabled={isSaving}
                    className="mt-1 block w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400">Senha</label>
                  <input
                    type="text"
                    value={editingData.painel1_senha}
                    onChange={(e) => setEditingData({
                      ...editingData,
                      painel1_senha: e.target.value
                    })}
                    disabled={isSaving}
                    className="mt-1 block w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Painel 2 */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h3 className="font-medium text-slate-100 mb-3">Painel 2</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400">Nome do Painel</label>
                  <input
                    type="text"
                    value={editingData.painel2_nome}
                    onChange={(e) => setEditingData({
                      ...editingData,
                      painel2_nome: e.target.value
                    })}
                    disabled={isSaving}
                    className="mt-1 block w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400">Login</label>
                  <input
                    type="text"
                    value={editingData.painel2_login}
                    onChange={(e) => setEditingData({
                      ...editingData,
                      painel2_login: e.target.value
                    })}
                    disabled={isSaving}
                    className="mt-1 block w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400">Senha</label>
                  <input
                    type="text"
                    value={editingData.painel2_senha}
                    onChange={(e) => setEditingData({
                      ...editingData,
                      painel2_senha: e.target.value
                    })}
                    disabled={isSaving}
                    className="mt-1 block w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Painel 3 */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h3 className="font-medium text-slate-100 mb-3">Painel 3</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400">Nome do Painel</label>
                  <input
                    type="text"
                    value={editingData.painel3_nome}
                    onChange={(e) => setEditingData({
                      ...editingData,
                      painel3_nome: e.target.value
                    })}
                    disabled={isSaving}
                    className="mt-1 block w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400">Login</label>
                  <input
                    type="text"
                    value={editingData.painel3_login}
                    onChange={(e) => setEditingData({
                      ...editingData,
                      painel3_login: e.target.value
                    })}
                    disabled={isSaving}
                    className="mt-1 block w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400">Senha</label>
                  <input
                    type="text"
                    value={editingData.painel3_senha}
                    onChange={(e) => setEditingData({
                      ...editingData,
                      painel3_senha: e.target.value
                    })}
                    disabled={isSaving}
                    className="mt-1 block w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : activeLogins.length === 0 ? (
          <p className="text-slate-400">Nenhum login ativo encontrado.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeLogins.map((login, index) => (
              <div
                key={index}
                className="bg-slate-900/50 rounded-lg p-4 border border-slate-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Monitor className="h-5 w-5 text-blue-400 mr-2" />
                    <h3 className="font-medium text-slate-100">
                      {login.panelName}
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      login.status === 'Ativado'
                        ? 'bg-green-900/30 text-green-300 border border-green-700'
                        : 'bg-red-900/30 text-red-300 border border-red-700'
                    }`}
                  >
                    {login.status}
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-slate-400">Login</p>
                    <p className="text-slate-100">{login.login}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Senha</p>
                    <p className="text-slate-100">{login.password}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção de Indicações e Comissões */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
        <h2 className="text-2xl font-semibold text-slate-100 mb-4 flex items-center">
          <Users className="h-6 w-6 mr-2 text-blue-400" />
          Indicações e Comissões
        </h2>
        
        {/* Card de Comissão Total */}
        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-lg p-6 mb-6 border border-green-700/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-green-400 mb-1">Comissão Total Disponível</p>
              <p className="text-3xl font-bold text-green-300">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(totalCommission)}
              </p>
              <p className="text-xs text-green-400 mt-2">
                Valor disponível para resgate
              </p>
            </div>
            <DollarSign className="h-12 w-12 text-green-400 opacity-30" />
          </div>
          {totalCommission > 0 && (
            <button
              onClick={() => {
                setResgateForm({ 
                  tipo: 'mensalidade', 
                  valor: 0, 
                  recharge_option_id: '',
                  quantidade_creditos: 0,
                });
                setShowResgateModal(true);
              }}
              className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Resgatar Comissão
            </button>
          )}
        </div>

        {/* Lista de Indicados */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-100">
              Clientes Indicados ({referrals.length})
            </h3>
          </div>

          {/* Barra de pesquisa e filtro */}
          {referrals.length > 0 && (
            <div className="mb-4 flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, telefone ou email..."
                  value={referralSearchTerm}
                  onChange={(e) => setReferralSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  value={referralFilter}
                  onChange={(e) => setReferralFilter(e.target.value as 'all' | 'subscribers' | 'non_subscribers')}
                  className="pl-10 pr-8 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500 appearance-none"
                >
                  <option value="all">Todos</option>
                  <option value="subscribers">Apenas Assinantes</option>
                  <option value="non_subscribers">Não Assinantes</option>
                </select>
              </div>
            </div>
          )}

          {/* Filtrar e pesquisar referrals */}
          {(() => {
            const filteredReferrals = referrals.filter((referral) => {
              // Filtro de pesquisa
              const searchLower = referralSearchTerm.toLowerCase();
              const matchesSearch = 
                !referralSearchTerm ||
                referral.referred_user?.full_name?.toLowerCase().includes(searchLower) ||
                referral.referred_user?.phone?.toLowerCase().includes(searchLower) ||
                referral.referred_user?.email?.toLowerCase().includes(searchLower);

              // Filtro de assinante
              const matchesFilter = 
                referralFilter === 'all' ||
                (referralFilter === 'subscribers' && referral.is_subscriber) ||
                (referralFilter === 'non_subscribers' && !referral.is_subscriber);

              return matchesSearch && matchesFilter;
            });

            if (filteredReferrals.length === 0) {
              return (
                <p className="text-slate-400">
                  {referrals.length === 0 
                    ? 'Este cliente ainda não indicou nenhum cliente.'
                    : 'Nenhum cliente encontrado com os filtros aplicados.'}
                </p>
              );
            }

            return (
              <div className="space-y-4">
                {filteredReferrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="bg-slate-900/50 rounded-lg p-4 border border-slate-700"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-slate-400">Cliente Indicado</p>
                          {referral.is_subscriber && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-900/30 text-green-300 border border-green-700">
                              Assinante
                            </span>
                          )}
                          {!referral.is_subscriber && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-700/50 text-slate-400 border border-slate-600">
                              Não Assinante
                            </span>
                          )}
                        </div>
                        <p className="text-slate-100 font-semibold">
                          {referral.referred_user?.full_name || 'Nome não disponível'}
                        </p>
                        {referral.referred_user?.email && (
                          <p className="text-sm text-slate-400">{referral.referred_user.email}</p>
                        )}
                        {referral.referred_user?.phone && (
                          <p className="text-sm text-slate-400">{referral.referred_user.phone}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-400">Comissão Gerada</p>
                        <p className="text-lg font-semibold text-green-400">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(referral.total_commission_earned)}
                        </p>
                        {referral.last_commission_date && (
                          <p className="text-xs text-slate-500 mt-1">
                            Última comissão: {new Date(referral.last_commission_date).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-400">Data da Indicação</p>
                        <p className="text-slate-100">
                          {new Date(referral.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Modal de Resgate */}
      {showResgateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-slate-100 flex items-center">
                  <Wallet className="h-5 w-5 mr-2 text-green-400" />
                  Resgatar Comissão
                </h3>
                <button
                  onClick={() => setShowResgateModal(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Tipo de Resgate */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Tipo de Resgate
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setResgateForm({ ...resgateForm, tipo: 'mensalidade', valor: 0, recharge_option_id: '', quantidade_creditos: 0 });
                      }}
                      className={`px-4 py-3 rounded-md border transition-colors ${
                        resgateForm.tipo === 'mensalidade'
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <div className="text-sm font-medium">Créditos em Mensalidade</div>
                      <div className="text-xs mt-1 opacity-80">Mínimo: R$ 35,00</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResgateForm({ ...resgateForm, tipo: 'pix', valor: 0, recharge_option_id: '', quantidade_creditos: 0 });
                      }}
                      className={`px-4 py-3 rounded-md border transition-colors ${
                        resgateForm.tipo === 'pix'
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <div className="text-sm font-medium">PIX</div>
                      <div className="text-xs mt-1 opacity-80">Mínimo: R$ 50,00</div>
                    </button>
                  </div>
                </div>

                {/* Seleção de Créditos (quando for mensalidade) */}
                {resgateForm.tipo === 'mensalidade' && rechargeOptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Selecionar Créditos
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {rechargeOptions.map((option) => {
                        const maxCredits = Math.floor(totalCommission / option.price);
                        const canAfford = totalCommission >= option.price;
                        
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              if (canAfford) {
                                setResgateForm({
                                  ...resgateForm,
                                  recharge_option_id: option.id,
                                  valor: option.price,
                                  quantidade_creditos: 1,
                                });
                              }
                            }}
                            disabled={!canAfford}
                            className={`w-full text-left px-4 py-3 rounded-md border transition-colors ${
                              resgateForm.recharge_option_id === option.id
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : canAfford
                                ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                                : 'bg-slate-800 border-slate-700 text-slate-500 opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium">{option.display_name}</div>
                                <div className="text-xs mt-1 opacity-80">
                                  {option.duration_months} {option.duration_months === 1 ? 'mês' : 'meses'} de crédito
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">
                                  {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(option.price)}
                                </div>
                                {!canAfford && (
                                  <div className="text-xs text-red-400">Saldo insuficiente</div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {resgateForm.recharge_option_id && (
                      <div className="mt-3 bg-slate-900/50 rounded-md p-3 border border-slate-700">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Valor do crédito:</span>
                          <span className="text-slate-200 font-semibold">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(resgateForm.valor)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-slate-400">Quantidade:</span>
                          <span className="text-slate-200 font-semibold">
                            {resgateForm.quantidade_creditos} crédito{resgateForm.quantidade_creditos > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-slate-400">Saldo restante:</span>
                          <span className="text-green-400 font-semibold">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(totalCommission - resgateForm.valor)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Valor PIX (quando for PIX) */}
                {resgateForm.tipo === 'pix' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Valor do Resgate
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={50}
                      max={totalCommission}
                      value={resgateForm.valor || ''}
                      onChange={(e) => {
                        const valor = parseFloat(e.target.value) || 0;
                        setResgateForm({ ...resgateForm, valor });
                      }}
                      className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Mínimo: R$ 50,00"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Disponível: {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(totalCommission)}
                    </p>
                  </div>
                )}

                {/* Validação PIX */}
                {resgateForm.tipo === 'pix' && resgateForm.valor > 0 && (
                  <div className="bg-slate-900/50 rounded-md p-3 border border-slate-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Valor mínimo:</span>
                      <span className="text-slate-200 font-semibold">R$ 50,00</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-slate-400">Valor solicitado:</span>
                      <span className="text-slate-200 font-semibold">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(resgateForm.valor)}
                      </span>
                    </div>
                    {resgateForm.valor < 50 && (
                      <p className="text-red-400 text-xs mt-2">
                        O valor mínimo para PIX é de R$ 50,00
                      </p>
                    )}
                    {resgateForm.valor > totalCommission && (
                      <p className="text-red-400 text-xs mt-2">
                        O valor solicitado excede o valor disponível
                      </p>
                    )}
                  </div>
                )}

                {/* Botões */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowResgateModal(false)}
                    disabled={isProcessingResgate}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleResgateComissao}
                    disabled={
                      isProcessingResgate ||
                      (resgateForm.tipo === 'mensalidade' && !resgateForm.recharge_option_id) ||
                      (resgateForm.tipo === 'pix' && (resgateForm.valor <= 0 || resgateForm.valor < 50 || resgateForm.valor > totalCommission))
                    }
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessingResgate ? 'Processando...' : 'Confirmar Resgate'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Adicionar Créditos */}
      {showAdicionarCreditosModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-slate-100 flex items-center">
                  <Plus className="h-5 w-5 mr-2 text-green-400" />
                  Adicionar Créditos
                </h3>
                <button
                  onClick={() => setShowAdicionarCreditosModal(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Informações do Cliente */}
                <div className="bg-slate-900/50 rounded-md p-3 border border-slate-700">
                  <p className="text-sm text-slate-400">Cliente</p>
                  <p className="text-slate-100 font-semibold">{client.nome}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Plano: {planInfo.label} ({activeLogins.length} login{activeLogins.length > 1 ? 's' : ''})
                  </p>
                </div>

                {/* Seleção de Opção de Recarga */}
                {rechargeOptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Selecionar Opção de Recarga
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {rechargeOptions
                        .filter(opt => opt.plan_type === planInfo.type || !planInfo.type)
                        .map((option) => {
                          const quantidadePontos = activeLogins.length;
                          const quantidadeCreditos = quantidadePontos * option.duration_months;
                          
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                const finalPrice = calculateFinalPrice(
                                  option.price,
                                  adicionarCreditosForm.desconto_tipo,
                                  adicionarCreditosForm.desconto_valor
                                );
                                setAdicionarCreditosForm({
                                  ...adicionarCreditosForm,
                                  recharge_option_id: option.id,
                                  valor_pago: finalPrice,
                                  quantidade_creditos: quantidadeCreditos,
                                });
                              }}
                              className={`w-full text-left px-4 py-3 rounded-md border transition-colors ${
                                adicionarCreditosForm.recharge_option_id === option.id
                                  ? 'bg-blue-600 border-blue-500 text-white'
                                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium">{option.display_name}</div>
                                  <div className="text-xs mt-1 opacity-80">
                                    {quantidadePontos} ponto{quantidadePontos > 1 ? 's' : ''} × {option.duration_months} {option.duration_months === 1 ? 'mês' : 'meses'} = {quantidadeCreditos} crédito{quantidadeCreditos > 1 ? 's' : ''}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold">
                                    {new Intl.NumberFormat('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    }).format(option.price)}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                    {adicionarCreditosForm.recharge_option_id && (() => {
                      const selectedOption = rechargeOptions.find(opt => opt.id === adicionarCreditosForm.recharge_option_id);
                      const valorOriginal = selectedOption?.price || 0;
                      const desconto = adicionarCreditosForm.desconto_valor > 0 ? (
                        adicionarCreditosForm.desconto_tipo === 'percentual'
                          ? valorOriginal * (adicionarCreditosForm.desconto_valor / 100)
                          : adicionarCreditosForm.desconto_valor
                      ) : 0;
                      const valorFinal = valorOriginal - desconto;

                      return (
                        <div className="mt-3 bg-slate-900/50 rounded-md p-3 border border-slate-700">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Valor original:</span>
                            <span className="text-slate-200 font-semibold">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(valorOriginal)}
                            </span>
                          </div>
                          {desconto > 0 && (
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-slate-400">Desconto:</span>
                              <span className="text-red-400 font-semibold">
                                - {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                }).format(desconto)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-slate-400">Valor final:</span>
                            <span className="text-green-400 font-semibold">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(valorFinal)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-slate-400">Quantidade de créditos:</span>
                            <span className="text-slate-200 font-semibold">
                              {adicionarCreditosForm.quantidade_creditos} crédito{adicionarCreditosForm.quantidade_creditos > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Opções de Desconto */}
                {adicionarCreditosForm.recharge_option_id && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Desconto
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Tipo de Desconto</label>
                        <select
                          value={adicionarCreditosForm.desconto_tipo}
                          onChange={(e) => {
                            const tipo = e.target.value as 'percentual' | 'fixo';
                            const selectedOption = rechargeOptions.find(opt => opt.id === adicionarCreditosForm.recharge_option_id);
                            if (selectedOption) {
                              const finalPrice = calculateFinalPrice(selectedOption.price, tipo, adicionarCreditosForm.desconto_valor);
                              setAdicionarCreditosForm({
                                ...adicionarCreditosForm,
                                desconto_tipo: tipo,
                                valor_pago: finalPrice,
                              });
                            }
                          }}
                          className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                        >
                          <option value="percentual">Percentual (%)</option>
                          <option value="fixo">Valor Fixo (R$)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          {adicionarCreditosForm.desconto_tipo === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)'}
                        </label>
                        <input
                          type="number"
                          step={adicionarCreditosForm.desconto_tipo === 'percentual' ? '1' : '0.01'}
                          min="0"
                          max={adicionarCreditosForm.desconto_tipo === 'percentual' ? '100' : undefined}
                          value={adicionarCreditosForm.desconto_valor || ''}
                          onChange={(e) => {
                            const valor = parseFloat(e.target.value) || 0;
                            const selectedOption = rechargeOptions.find(opt => opt.id === adicionarCreditosForm.recharge_option_id);
                            if (selectedOption) {
                              const finalPrice = calculateFinalPrice(selectedOption.price, adicionarCreditosForm.desconto_tipo, valor);
                              setAdicionarCreditosForm({
                                ...adicionarCreditosForm,
                                desconto_valor: valor,
                                valor_pago: finalPrice,
                              });
                            }
                          }}
                          className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Campo de Valor Pago (opcional, pode ser diferente do valor da recarga) */}
                {adicionarCreditosForm.recharge_option_id && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Valor Pago (R$) <span className="text-slate-500 text-xs">(opcional, deixe 0 se não houve pagamento)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={adicionarCreditosForm.valor_pago || ''}
                      onChange={(e) => {
                        const valor = parseFloat(e.target.value) || 0;
                        setAdicionarCreditosForm({ ...adicionarCreditosForm, valor_pago: valor });
                      }}
                      className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Se informado, será registrado como entrada no caixa. Caso contrário, apenas os créditos serão adicionados.
                    </p>
                  </div>
                )}

                {/* Botões */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowAdicionarCreditosModal(false);
                      setAdicionarCreditosForm({
                        recharge_option_id: '',
                        valor_pago: 0,
                        quantidade_creditos: 0,
                        desconto_tipo: 'percentual',
                        desconto_valor: 0,
                      });
                    }}
                    disabled={isProcessingAdicionarCreditos}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAdicionarCreditos}
                    disabled={
                      isProcessingAdicionarCreditos ||
                      !adicionarCreditosForm.recharge_option_id
                    }
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessingAdicionarCreditos ? 'Processando...' : 'Adicionar Créditos'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Transações */}
      {showTransacoesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-slate-100 flex items-center">
                  <History className="h-5 w-5 mr-2 text-blue-400" />
                  Últimas Transações - {client.nome}
                  {pendingTransacoesCount > 0 && (
                    <span className="ml-3 px-2 py-1 text-xs font-semibold rounded-full bg-yellow-900/30 text-yellow-300 border border-yellow-700">
                      {pendingTransacoesCount} pendente{pendingTransacoesCount > 1 ? 's' : ''}
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  {pendingTransacoesCount > 0 && (
                    <button
                      onClick={() => setShowBaixaModal(true)}
                      className="flex items-center px-3 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 transition-colors"
                      title="Dar baixa em transações pendentes"
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Dar Baixa ({pendingTransacoesCount})
                    </button>
                  )}
                  <button
                    onClick={() => setShowTransacoesModal(false)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {loadingTransacoes ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-slate-300">Carregando transações...</span>
                </div>
              ) : transacoes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400">Nenhuma transação encontrada para este cliente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transacoes.map((transacao) => {
                    const getTypeLabel = (type: string) => {
                      const labels: { [key: string]: string } = {
                        'recharge': 'Recarga',
                        'subscription': 'Assinatura',
                        'commission': 'Comissão Recebida',
                        'commission_payout': 'Resgate de Comissão',
                        'entrada': 'Entrada',
                        'saida': 'Saída',
                      };
                      return labels[type] || type;
                    };

                    const getStatusColor = (status: string) => {
                      const colors: { [key: string]: string } = {
                        'completed': 'bg-green-900/30 text-green-300 border-green-700',
                        'pending': 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
                        'failed': 'bg-red-900/30 text-red-300 border-red-700',
                        'cancelled': 'bg-slate-700/50 text-slate-400 border-slate-600',
                      };
                      return colors[status] || 'bg-slate-700/50 text-slate-400 border-slate-600';
                    };

                    const getPaymentMethodLabel = (method: string | null) => {
                      if (!method) return '-';
                      const labels: { [key: string]: string } = {
                        'pix': 'PIX',
                        'credit_card': 'Cartão de Crédito',
                        'debit_card': 'Cartão de Débito',
                        'boleto': 'Boleto',
                        'manual': 'Manual',
                      };
                      return labels[method] || method;
                    };

                    const isPositive = ['recharge', 'subscription', 'commission', 'entrada'].includes(transacao.type);
                    const isNegative = ['commission_payout', 'saida'].includes(transacao.type);

                    return (
                      <div
                        key={transacao.id}
                        className="bg-slate-900/50 rounded-lg p-4 border border-slate-700"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-900/30 text-blue-300 border border-blue-700">
                                {getTypeLabel(transacao.type)}
                              </span>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(transacao.status)}`}>
                                {transacao.status === 'completed' ? 'Concluída' : 
                                 transacao.status === 'pending' ? 'Pendente' :
                                 transacao.status === 'failed' ? 'Falhou' : 'Cancelada'}
                              </span>
                            </div>
                            {transacao.description && (
                              <p className="text-sm text-slate-300 mb-1">{transacao.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                              <span>Método: {getPaymentMethodLabel(transacao.payment_method)}</span>
                              <span>
                                {new Date(transacao.created_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            {transacao.metadata && Object.keys(transacao.metadata).length > 0 && (
                              <details className="mt-2">
                                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                                  Ver detalhes
                                </summary>
                                <pre className="mt-2 text-xs text-slate-400 bg-slate-800 p-2 rounded overflow-x-auto">
                                  {JSON.stringify(transacao.metadata, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className={`text-lg font-semibold ${
                              isPositive ? 'text-green-400' : 
                              isNegative ? 'text-red-400' : 
                              'text-slate-300'
                            }`}>
                              {isNegative ? '-' : '+'}
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(transacao.amount)}
                            </p>
                            {transacao.status === 'pending' && (
                              <button
                                onClick={() => {
                                  setTransacaoParaBaixa({
                                    id: transacao.id,
                                    type: transacao.type,
                                    amount: transacao.amount,
                                    description: transacao.description,
                                  });
                                  setShowBaixaModal(true);
                                }}
                                className="mt-2 px-3 py-1 text-xs font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 transition-colors"
                              >
                                Dar Baixa
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowTransacoesModal(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-md hover:bg-slate-600"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Dar Baixa */}
      {showBaixaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-slate-100 flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2 text-yellow-400" />
                  Dar Baixa em Transação
                </h3>
                <button
                  onClick={() => {
                    setShowBaixaModal(false);
                    setTransacaoParaBaixa(null);
                  }}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {transacaoParaBaixa ? (
                <div className="space-y-4">
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-400">Tipo:</span>
                        <span className="text-sm text-slate-200 font-medium">
                          {transacaoParaBaixa.type === 'recharge' ? 'Recarga' :
                           transacaoParaBaixa.type === 'subscription' ? 'Assinatura' :
                           transacaoParaBaixa.type === 'commission' ? 'Comissão' :
                           transacaoParaBaixa.type === 'commission_payout' ? 'Resgate de Comissão' :
                           transacaoParaBaixa.type}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-400">Valor:</span>
                        <span className="text-sm text-slate-200 font-semibold">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(transacaoParaBaixa.amount)}
                        </span>
                      </div>
                      {transacaoParaBaixa.description && (
                        <div>
                          <span className="text-sm text-slate-400">Descrição:</span>
                          <p className="text-sm text-slate-200 mt-1">{transacaoParaBaixa.description}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                    <p className="text-sm text-yellow-300">
                      Ao confirmar, esta transação será marcada como <strong>Concluída</strong> e não poderá ser revertida.
                    </p>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={() => {
                        setShowBaixaModal(false);
                        setTransacaoParaBaixa(null);
                      }}
                      disabled={isProcessingBaixa}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        if (!transacaoParaBaixa) return;
                        
                        try {
                          setIsProcessingBaixa(true);
                          setError(null);

                          const { error: updateError } = await supabase
                            .from('transactions')
                            .update({ status: 'completed' })
                            .eq('id', transacaoParaBaixa.id);

                          if (updateError) throw updateError;

                          // Recarregar transações
                          await fetchTransacoes();
                          
                          // Fechar modal
                          setShowBaixaModal(false);
                          setTransacaoParaBaixa(null);
                        } catch (err) {
                          console.error('Error dando baixa:', err);
                          setError('Erro ao dar baixa na transação. Por favor, tente novamente.');
                        } finally {
                          setIsProcessingBaixa(false);
                        }
                      }}
                      disabled={isProcessingBaixa}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:opacity-50"
                    >
                      {isProcessingBaixa ? 'Processando...' : 'Confirmar Baixa'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-slate-300 mb-4">
                    Selecione uma transação pendente para dar baixa:
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {transacoes
                      .filter(t => t.status === 'pending')
                      .map((transacao) => {
                        const getTypeLabel = (type: string) => {
                          const labels: { [key: string]: string } = {
                            'recharge': 'Recarga',
                            'subscription': 'Assinatura',
                            'commission': 'Comissão Recebida',
                            'commission_payout': 'Resgate de Comissão',
                            'entrada': 'Entrada',
                            'saida': 'Saída',
                          };
                          return labels[type] || type;
                        };

                        return (
                          <button
                            key={transacao.id}
                            onClick={() => {
                              setTransacaoParaBaixa({
                                id: transacao.id,
                                type: transacao.type,
                                amount: transacao.amount,
                                description: transacao.description,
                              });
                            }}
                            className="w-full text-left bg-slate-900/50 rounded-lg p-4 border border-slate-700 hover:border-yellow-600 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-200">
                                  {getTypeLabel(transacao.type)}
                                </div>
                                {transacao.description && (
                                  <p className="text-xs text-slate-400 mt-1">{transacao.description}</p>
                                )}
                                <p className="text-xs text-slate-500 mt-1">
                                  {new Date(transacao.created_at).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-slate-200">
                                  {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(transacao.amount)}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                  {transacoes.filter(t => t.status === 'pending').length === 0 && (
                    <p className="text-center text-slate-400 py-4">
                      Nenhuma transação pendente encontrada.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}