import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export interface Referral {
  id: string;
  referred_id: string | null;
  total_commission_earned: number;
  last_commission_date: string | null;
  created_at: string;
  referred_user: {
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  is_subscriber?: boolean;
  type?: 'user' | 'test_request';
}

// Função auxiliar para normalizar telefone (remove caracteres não numéricos)
const normalizePhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

// Função auxiliar para normalizar email (lowercase e trim)
const normalizeEmail = (email: string | null | undefined): string => {
  if (!email) return '';
  return email.toLowerCase().trim();
};

export function useClientReferrals(userId: string | undefined) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchReferrals() {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      // Buscar comissão total e referral_code do usuário
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('total_commission, referral_code')
        .eq('id', userId)
        .single();

      if (userError) throw userError;
      setTotalCommission(userData?.total_commission || 0);

      const referralCodeToSearch = (userData?.referral_code || '').trim().toUpperCase();

      // Buscar referrals com JOIN para pegar dados do usuário indicado
      const { data: referralsRawData, error: referralsError } = await supabase
        .from('referrals')
        .select(`
          *,
          referred_user:users!referred_id (
            full_name,
            email,
            phone
          )
        `)
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      if (referralsError) throw referralsError;

      // Buscar testes que usaram o código de indicação
      const { data: testRequestsData, error: testRequestsError } = await supabase
        .from('testes_liberados')
        .select('*')
        .ilike('referral_code', referralCodeToSearch)
        .order('created_at', { ascending: false });

      if (testRequestsError) {
        console.error('Error fetching test requests:', testRequestsError);
      }

      let referralsData: Referral[] = [];
      const processedUserIds = new Set<string>();
      const processedTestPhones = new Set<string>();

      // Processa referrals (pessoas que se cadastraram e viraram usuários)
      if (referralsRawData) {
        // Remove duplicatas baseado em referred_id
        const uniqueReferrals = referralsRawData.filter((ref, index, self) =>
          index === self.findIndex(r => r.referred_id === ref.referred_id)
        );

        for (const referral of uniqueReferrals) {
          if (processedUserIds.has(referral.referred_id)) continue;
          processedUserIds.add(referral.referred_id);

          // Verificar se é assinante checando testes_liberados
          let hasActiveSubscription = false;

          if (referral.referred_user) {
            const profileEmail = normalizeEmail(referral.referred_user.email);
            const profilePhone = normalizePhone(referral.referred_user.phone);

            const { data: subscriberTests } = await supabase
              .from('testes_liberados')
              .select('id, assinante, email, telefone')
              .eq('assinante', true);

            if (subscriberTests && subscriberTests.length > 0) {
              const matchingTest = subscriberTests.find(test => {
                const testEmail = normalizeEmail(test.email);
                const testPhone = normalizePhone(test.telefone);
                return (profileEmail && testEmail && profileEmail === testEmail) ||
                       (profilePhone && testPhone && profilePhone === testPhone);
              });

              if (matchingTest) {
                hasActiveSubscription = true;
              }
            }
          }

          referralsData.push({
            ...referral,
            is_subscriber: hasActiveSubscription,
            type: 'user',
          });
        }
      }

      // Processa solicitações de teste (pessoas que solicitaram teste mas ainda não se cadastraram)
      if (testRequestsData) {
        // Remove duplicatas baseado em telefone normalizado
        const uniqueTestRequests = testRequestsData.filter((test, index, self) => {
          const testPhone = normalizePhone(test.telefone);
          return index === self.findIndex(t => normalizePhone(t.telefone) === testPhone && testPhone !== '');
        });

        for (const testRequest of uniqueTestRequests) {
          const testPhoneNormalized = normalizePhone(testRequest.telefone);
          const testEmailNormalized = normalizeEmail(testRequest.email);

          // Evita processar o mesmo telefone duas vezes
          if (testPhoneNormalized && processedTestPhones.has(testPhoneNormalized)) {
            continue;
          }
          if (testPhoneNormalized) {
            processedTestPhones.add(testPhoneNormalized);
          }

          // Verifica se já virou usuário (já está em referrals)
          let alreadyInReferrals = false;

          for (const ref of referralsData) {
            const refPhoneNormalized = normalizePhone(ref.referred_user?.phone);
            const refEmailNormalized = normalizeEmail(ref.referred_user?.email);

            if ((testPhoneNormalized && refPhoneNormalized && testPhoneNormalized === refPhoneNormalized) ||
                (testEmailNormalized && refEmailNormalized && testEmailNormalized === refEmailNormalized)) {
              alreadyInReferrals = true;
              break;
            }
          }

          if (!alreadyInReferrals) {
            referralsData.push({
              id: testRequest.id,
              referred_id: null,
              total_commission_earned: 0,
              last_commission_date: null,
              created_at: testRequest.created_at,
              referred_user: {
                full_name: testRequest.nome,
                phone: testRequest.telefone,
                email: testRequest.email,
              },
              is_subscriber: testRequest.assinante || false,
              type: 'test_request',
            });
          }
        }
      }

      setReferrals(referralsData);
    } catch (err) {
      console.error('Error fetching referrals:', err);
      setError('Erro ao carregar indicações');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId) {
      fetchReferrals();
    }
  }, [userId]);

  const filterReferrals = (
    filter: 'all' | 'subscribers' | 'non_subscribers',
    searchTerm: string
  ) => {
    let filtered = [...referrals];

    // Filtro por tipo
    if (filter === 'subscribers') {
      filtered = filtered.filter(r => r.is_subscriber);
    } else if (filter === 'non_subscribers') {
      filtered = filtered.filter(r => !r.is_subscriber);
    }

    // Filtro por busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.referred_user?.full_name.toLowerCase().includes(term) ||
        r.referred_user?.email?.toLowerCase().includes(term) ||
        r.referred_user?.phone?.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  return {
    referrals,
    totalCommission,
    loading,
    error,
    refetch: fetchReferrals,
    filterReferrals,
  };
}
