import React, { useEffect, useState } from 'react';
import { DollarSign, Plus, Edit2, X, Check, Tag, Calendar, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import type { Promotion } from '../types';

interface Plan {
  id: string;
  name: string;
  plan_type: string;
  base_price: number;
  current_price: number;
  monthly_price: number;
  has_promotion: boolean;
}

interface RechargeOption {
  id: string;
  plan_type: string;
  period: 'mensal' | 'trimestral' | 'semestral' | 'anual';
  duration_months: number;
  price: number;
  display_name: string;
  active: boolean;
  created_at: string;
}

export default function PrecosPlanos() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [rechargeOptions, setRechargeOptions] = useState<RechargeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<Partial<Promotion> | null>(null);
  const [editingRecharge, setEditingRecharge] = useState<Partial<RechargeOption> | null>(null);
  const [selectedPlanType, setSelectedPlanType] = useState<string>('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; full_name: string; email: string | null }[]>([]);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [showDeletePromotionModal, setShowDeletePromotionModal] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState<Promotion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchData();
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const { data, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .order('full_name');

      if (usersError) throw usersError;

      setAvailableUsers((data || []).map(u => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email
      })));
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }

  async function fetchData() {
    try {
      setError(null);
      
      const [plansResult, promotionsResult, rechargeResult] = await Promise.all([
        supabase.from('subscription_plans').select('*').order('plan_type'),
        supabase.from('promotions').select(`
          *,
          promotion_users:promotion_users (
            id,
            user_id,
            uses_count,
            max_uses,
            active
          )
        `).order('created_at', { ascending: false }),
        supabase.from('recharge_options').select('*').order('plan_type, duration_months')
      ]);

      if (plansResult.error) throw plansResult.error;
      if (promotionsResult.error) throw promotionsResult.error;
      if (rechargeResult.error) throw rechargeResult.error;

      // Ordenar planos: ponto_unico (Básico), ponto_duplo (Padrão), ponto_triplo (Premium)
      const planOrder = ['ponto_unico', 'ponto_duplo', 'ponto_triplo'];
      const sortedPlans = (plansResult.data || []).sort((a, b) => {
        const indexA = planOrder.indexOf(a.plan_type);
        const indexB = planOrder.indexOf(b.plan_type);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

      setPlans(sortedPlans as Plan[]);
      setPromotions((promotionsResult.data || []) as Promotion[]);
      setRechargeOptions((rechargeResult.data || []) as RechargeOption[]);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Erro ao carregar dados. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const handleUpdatePlan = async (plan: Plan) => {
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('subscription_plans')
        .update({
          base_price: plan.base_price,
          current_price: plan.current_price,
          monthly_price: plan.current_price
        })
        .eq('id', plan.id);

      if (updateError) throw updateError;

      await fetchData();
      setEditingPlan(null);
    } catch (err) {
      console.error('Error updating plan:', err);
      setError('Erro ao atualizar preço. Por favor, tente novamente.');
    }
  };

  const handleSaveRechargeOption = async () => {
    if (!editingRecharge?.plan_type || !editingRecharge?.period || !editingRecharge?.price) {
      setError('Plano, período e preço são obrigatórios');
      return;
    }

    // Gerar display_name automaticamente se não fornecido
    const periodNames: Record<string, string> = {
      mensal: 'Mensal',
      trimestral: 'Trimestral',
      semestral: 'Semestral',
      anual: 'Anual'
    };
    
    const displayName = editingRecharge.display_name || 
      `Recarga ${periodNames[editingRecharge.period]} - ${formatCurrency(editingRecharge.price)}`;

    try {
      setError(null);
      if (editingRecharge.id) {
        // Atualizar
        const { error: updateError } = await supabase
          .from('recharge_options')
          .update({
            plan_type: editingRecharge.plan_type,
            period: editingRecharge.period,
            duration_months: editingRecharge.duration_months || 1,
            price: editingRecharge.price,
            display_name: displayName,
            active: editingRecharge.active !== undefined ? editingRecharge.active : true
          })
          .eq('id', editingRecharge.id);

        if (updateError) throw updateError;
      } else {
        // Criar
        const { error: insertError } = await supabase
          .from('recharge_options')
          .insert({
            plan_type: editingRecharge.plan_type,
            period: editingRecharge.period,
            duration_months: editingRecharge.duration_months || 1,
            price: editingRecharge.price,
            display_name: displayName,
            active: true
          });

        if (insertError) throw insertError;
      }

      await fetchData();
      setShowRechargeModal(false);
      setEditingRecharge(null);
      setSelectedPlanType('');
    } catch (err: any) {
      console.error('Error saving recharge option:', err);
      if (err.code === '23505') {
        setError('Já existe uma opção de recarga com este plano e período.');
      } else {
        setError('Erro ao salvar opção de recarga. Por favor, tente novamente.');
      }
    }
  };

  const handleSavePromotion = async () => {
    if (!editingPromotion?.name || !editingPromotion?.start_date) {
      setError('Nome e data de início são obrigatórios');
      return;
    }

    // Se é promoção individual, precisa ter pelo menos um cliente selecionado
    if (editingPromotion.is_individual && selectedUsers.length === 0) {
      setError('Promoção individual precisa ter pelo menos um cliente selecionado');
      return;
    }

    try {
      setError(null);
      let promotionId: string;

      // Preparar condições
      const conditions: any = {};
      if (editingPromotion.conditions?.keep_payments_current) {
        conditions.keep_payments_current = true;
      }
      if (editingPromotion.conditions?.max_recharges) {
        conditions.max_recharges = editingPromotion.conditions.max_recharges;
      }

      if (editingPromotion.id) {
        // Atualizar
        const { data: updatedPromotion, error: updateError } = await supabase
          .from('promotions')
          .update({
            name: editingPromotion.name,
            description: editingPromotion.description || null,
            promotion_type: editingPromotion.promotion_type,
            apply_to: editingPromotion.apply_to,
            apply_to_period: editingPromotion.apply_to_period || 'all_periods',
            plan_id: editingPromotion.plan_id || null,
            discount_percentage: editingPromotion.discount_percentage || null,
            discount_amount: editingPromotion.discount_amount || null,
            free_days: editingPromotion.free_days || null,
            bonus_credits: editingPromotion.bonus_credits || null,
            start_date: editingPromotion.start_date,
            end_date: editingPromotion.end_date || null,
            max_uses: editingPromotion.max_uses || null,
            is_individual: editingPromotion.is_individual || false,
            conditions: Object.keys(conditions).length > 0 ? conditions : null,
            active: editingPromotion.active !== undefined ? editingPromotion.active : true
          })
          .eq('id', editingPromotion.id)
          .select()
          .single();

        if (updateError) throw updateError;
        promotionId = updatedPromotion.id;
      } else {
        // Criar
        const { data: newPromotion, error: insertError } = await supabase
          .from('promotions')
          .insert({
            name: editingPromotion.name,
            description: editingPromotion.description || null,
            promotion_type: editingPromotion.promotion_type,
            apply_to: editingPromotion.apply_to,
            apply_to_period: editingPromotion.apply_to_period || 'all_periods',
            plan_id: editingPromotion.plan_id || null,
            discount_percentage: editingPromotion.discount_percentage || null,
            discount_amount: editingPromotion.discount_amount || null,
            free_days: editingPromotion.free_days || null,
            bonus_credits: editingPromotion.bonus_credits || null,
            start_date: editingPromotion.start_date,
            end_date: editingPromotion.end_date || null,
            max_uses: editingPromotion.max_uses || null,
            is_individual: editingPromotion.is_individual || false,
            conditions: Object.keys(conditions).length > 0 ? conditions : null,
            active: true
          })
          .select()
          .single();

        if (insertError) throw insertError;
        promotionId = newPromotion.id;
      }

      // Se é promoção individual, vincular clientes
      if (editingPromotion.is_individual && selectedUsers.length > 0) {
        // Remover vínculos antigos se estiver editando
        if (editingPromotion.id) {
          await supabase
            .from('promotion_users')
            .delete()
            .eq('promotion_id', promotionId);
        }

        // Criar novos vínculos
        const promotionUsers = selectedUsers.map(userId => ({
          promotion_id: promotionId,
          user_id: userId,
          max_uses: editingPromotion.max_uses || null,
          active: true
        }));

        const { error: usersError } = await supabase
          .from('promotion_users')
          .insert(promotionUsers);

        if (usersError) throw usersError;
      } else if (editingPromotion.id && !editingPromotion.is_individual) {
        // Se mudou de individual para geral, remover vínculos
        await supabase
          .from('promotion_users')
          .delete()
          .eq('promotion_id', promotionId);
      }

      await fetchData();
      setShowPromotionModal(false);
      setEditingPromotion(null);
      setSelectedUsers([]);
    } catch (err) {
      console.error('Error saving promotion:', err);
      setError('Erro ao salvar promoção. Por favor, tente novamente.');
    }
  };

  const handleDeletePromotion = async () => {
    if (!promotionToDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      // Se for promoção individual, os vínculos serão deletados automaticamente (ON DELETE CASCADE)
      const { error: deleteError } = await supabase
        .from('promotions')
        .delete()
        .eq('id', promotionToDelete.id);

      if (deleteError) throw deleteError;

      await fetchData();
      setShowDeletePromotionModal(false);
      setPromotionToDelete(null);
    } catch (err) {
      console.error('Error deleting promotion:', err);
      setError('Erro ao excluir promoção. Por favor, tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center">
            <DollarSign className="h-6 w-6 mr-2" />
            Preços dos Planos
          </h2>
          <p className="text-slate-400 text-sm">Gerencie preços e promoções dos planos</p>
        </div>
        <button
          onClick={() => {
            setEditingPromotion({
              promotion_type: 'percentage',
              apply_to: 'all_plans',
              apply_to_period: 'all_periods',
              is_individual: false,
              conditions: null,
              active: true
            });
            setSelectedUsers([]);
            setShowPromotionModal(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nova Promoção
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Planos */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Planos de Assinatura</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-3 text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                rechargeOptions={rechargeOptions.filter(opt => opt.plan_type === plan.plan_type).sort((a, b) => a.duration_months - b.duration_months)}
                isEditing={editingPlan?.id === plan.id}
                onEdit={() => setEditingPlan(plan)}
                onCancel={() => setEditingPlan(null)}
                onSave={handleUpdatePlan}
                onEditRecharge={(option) => {
                  setEditingRecharge(option);
                  setSelectedPlanType(plan.plan_type);
                  setShowRechargeModal(true);
                }}
                onAddRecharge={() => {
                  setEditingRecharge({
                    plan_type: plan.plan_type,
                    period: 'mensal',
                    duration_months: 1,
                    active: true
                  });
                  setSelectedPlanType(plan.plan_type);
                  setShowRechargeModal(true);
                }}
                formatCurrency={formatCurrency}
              />
            ))
          )}
        </div>
      </div>


      {/* Promoções */}
      <div>
        <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center">
          <Tag className="h-5 w-5 mr-2" />
          Promoções Ativas
        </h3>
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Aplicar a</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Período</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Usos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {promotions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-slate-400">
                    Nenhuma promoção cadastrada
                  </td>
                </tr>
              ) : (
                promotions.map((promotion) => (
                  <tr key={promotion.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-200">{promotion.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                      {promotion.promotion_type === 'percentage' && `${promotion.discount_percentage}%`}
                      {promotion.promotion_type === 'fixed_amount' && formatCurrency(promotion.discount_amount || 0)}
                      {promotion.promotion_type === 'free_period' && `${promotion.free_days} dias`}
                      {promotion.promotion_type === 'bonus_credits' && `${promotion.bonus_credits} créditos`}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      <div className="flex flex-col space-y-1">
                        <span>
                          {promotion.is_individual ? (
                            <span className="text-blue-400">Individual ({promotion.promotion_users?.length || 0} clientes)</span>
                          ) : (
                            promotion.apply_to === 'all_plans' ? 'Todos os Planos' :
                            promotion.apply_to === 'ponto_unico' ? 'Ponto Único' :
                            promotion.apply_to === 'ponto_duplo' ? 'Ponto Duplo' :
                            promotion.apply_to === 'ponto_triplo' ? 'Ponto Triplo' : 'Específico'
                          )}
                        </span>
                        {!promotion.is_individual && (
                          <span className="text-xs text-slate-400">
                            {!promotion.apply_to_period || promotion.apply_to_period === 'all_periods' ? 'Todos os períodos' :
                            promotion.apply_to_period === 'mensal' ? 'Apenas Mensal' :
                            promotion.apply_to_period === 'trimestral' ? 'Apenas Trimestral' :
                            promotion.apply_to_period === 'semestral' ? 'Apenas Semestral' :
                            promotion.apply_to_period === 'anual' ? 'Apenas Anual' : 'N/A'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-300 text-sm">
                      {new Date(promotion.start_date).toLocaleDateString('pt-BR')}
                      {promotion.end_date && ` - ${new Date(promotion.end_date).toLocaleDateString('pt-BR')}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                      {promotion.is_individual
                        ? // Para promoções individuais, soma uses_count de todos os clientes
                          (promotion.promotion_users?.reduce((sum, pu) => sum + (pu.uses_count || 0), 0) || 0)
                        : // Para promoções gerais, usa current_uses
                          promotion.current_uses
                      } / {
                        promotion.is_individual
                          ? // Para promoções individuais, pega o max_uses do primeiro promotion_user
                            (promotion.promotion_users?.[0]?.max_uses || '∞')
                          : // Para promoções gerais, usa max_uses da promotion
                            (promotion.max_uses || '∞')
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        promotion.active ? 'bg-green-900/30 text-green-300' : 'bg-gray-900/30 text-gray-300'
                      }`}>
                        {promotion.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                      <button
                        onClick={async () => {
                          setEditingPromotion(promotion);
                          
                          // Se for promoção individual, carregar clientes vinculados
                          if (promotion.is_individual) {
                            const { data: promotionUsers } = await supabase
                              .from('promotion_users')
                              .select('user_id')
                              .eq('promotion_id', promotion.id)
                              .eq('active', true);
                            
                            if (promotionUsers) {
                              setSelectedUsers(promotionUsers.map(pu => pu.user_id));
                            }
                          } else {
                            setSelectedUsers([]);
                          }
                          
                          setShowPromotionModal(true);
                        }}
                        className="text-blue-400 hover:text-blue-300"
                          title="Editar Promoção"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                        <button
                          onClick={() => {
                            setPromotionToDelete(promotion);
                            setShowDeletePromotionModal(true);
                          }}
                          className="text-red-400 hover:text-red-300"
                          title="Excluir Promoção"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Promoção */}
      {showPromotionModal && editingPromotion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-slate-100 mb-4">
              {editingPromotion.id ? 'Editar Promoção' : 'Nova Promoção'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nome *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editingPromotion.name || ''}
                  onChange={(e) => setEditingPromotion({ ...editingPromotion, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Descrição</label>
                <textarea
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  rows={2}
                  value={editingPromotion.description || ''}
                  onChange={(e) => setEditingPromotion({ ...editingPromotion, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Tipo *</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={editingPromotion.promotion_type || 'percentage'}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, promotion_type: e.target.value as any })}
                  >
                    <option value="percentage">Percentual</option>
                    <option value="fixed_amount">Valor Fixo</option>
                    <option value="free_period">Período Grátis</option>
                    <option value="bonus_credits">Créditos Bônus</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Aplicar a *</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={editingPromotion.apply_to || 'all_plans'}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, apply_to: e.target.value as any })}
                  >
                    <option value="all_plans">Todos os Planos</option>
                    <option value="ponto_unico">Ponto Único</option>
                    <option value="ponto_duplo">Ponto Duplo</option>
                    <option value="ponto_triplo">Ponto Triplo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Aplicar ao Período *</label>
                <select
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editingPromotion.apply_to_period || 'all_periods'}
                  onChange={(e) => setEditingPromotion({ ...editingPromotion, apply_to_period: e.target.value as any })}
                >
                  <option value="all_periods">Todos os Períodos</option>
                  <option value="mensal">Apenas Mensal</option>
                  <option value="trimestral">Apenas Trimestral</option>
                  <option value="semestral">Apenas Semestral</option>
                  <option value="anual">Apenas Anual</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Escolha em qual período de recarga a promoção será aplicada
                </p>
              </div>
              {editingPromotion.promotion_type === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Desconto (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={editingPromotion.discount_percentage || ''}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, discount_percentage: parseFloat(e.target.value) || null })}
                  />
                </div>
              )}
              {editingPromotion.promotion_type === 'fixed_amount' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Desconto (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={editingPromotion.discount_amount || ''}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, discount_amount: parseFloat(e.target.value) || null })}
                  />
                </div>
              )}
              {editingPromotion.promotion_type === 'free_period' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Dias Grátis</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={editingPromotion.free_days || ''}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, free_days: parseInt(e.target.value) || null })}
                  />
                </div>
              )}
              {editingPromotion.promotion_type === 'bonus_credits' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Créditos Bônus</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={editingPromotion.bonus_credits || ''}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, bonus_credits: parseInt(e.target.value) || null })}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Data Início *</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={editingPromotion.start_date || ''}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Data Fim</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={editingPromotion.end_date || ''}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, end_date: e.target.value || null })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Máximo de Usos (deixe vazio para ilimitado)</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editingPromotion.max_uses || ''}
                  onChange={(e) => setEditingPromotion({ ...editingPromotion, max_uses: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600"
                    checked={editingPromotion.is_individual || false}
                    onChange={(e) => {
                      const isIndividual = e.target.checked;
                      setEditingPromotion({ 
                        ...editingPromotion, 
                        is_individual: isIndividual 
                      });
                      if (!isIndividual) {
                        setSelectedUsers([]);
                      }
                    }}
                  />
                  <span className="text-sm text-slate-300">Promoção Individual (apenas para clientes específicos)</span>
                </label>
              </div>

              {/* Seleção de Clientes (se for promoção individual) */}
              {editingPromotion.is_individual && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Clientes Selecionados ({selectedUsers.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowUserSelector(true)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {selectedUsers.length === 0 
                        ? 'Selecionar Clientes...' 
                        : `${selectedUsers.length} cliente(s) selecionado(s)`}
                    </button>
                    {selectedUsers.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedUsers.map(userId => {
                          const user = availableUsers.find(u => u.id === userId);
                          return user ? (
                            <span
                              key={userId}
                              className="inline-flex items-center px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs"
                            >
                              {user.full_name}
                              <button
                                type="button"
                                onClick={() => setSelectedUsers(selectedUsers.filter(id => id !== userId))}
                                className="ml-2 text-blue-400 hover:text-blue-300"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Condições Especiais */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">Condições Especiais</label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600"
                        checked={editingPromotion.conditions?.keep_payments_current || false}
                        onChange={(e) => setEditingPromotion({
                          ...editingPromotion,
                          conditions: {
                            ...editingPromotion.conditions,
                            keep_payments_current: e.target.checked
                          }
                        })}
                      />
                      <span className="text-sm text-slate-300">Manter recargas em dia (cliente deve ter assinatura ativa)</span>
                    </label>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Número máximo de recargas com desconto</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        value={editingPromotion.conditions?.max_recharges || ''}
                        onChange={(e) => setEditingPromotion({
                          ...editingPromotion,
                          conditions: {
                            ...editingPromotion.conditions,
                            max_recharges: e.target.value ? parseInt(e.target.value) : undefined
                          }
                        })}
                        placeholder="Ex: 12 (deixe vazio para ilimitado)"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Exemplo: 12 recargas = desconto válido nas próximas 12 recargas se mantiver em dia
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600"
                    checked={editingPromotion.active !== false}
                    onChange={(e) => setEditingPromotion({ ...editingPromotion, active: e.target.checked })}
                  />
                  <span className="text-sm text-slate-300">Ativa</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowPromotionModal(false);
                  setEditingPromotion(null);
                  setSelectedUsers([]);
                }}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePromotion}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingPromotion.id ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Seleção de Clientes */}
      {showUserSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full border border-slate-700 max-h-[80vh] overflow-hidden flex flex-col">
            <h3 className="text-xl font-semibold text-slate-100 mb-4">
              Selecionar Clientes para Promoção
            </h3>
            <div className="flex-1 overflow-y-auto mb-4">
              <div className="space-y-2">
                {availableUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center space-x-3 p-3 bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600"
                      checked={selectedUsers.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers([...selectedUsers, user.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-slate-200 font-medium">{user.full_name}</p>
                      {user.email && (
                        <p className="text-slate-400 text-sm">{user.email}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-slate-700">
              <p className="text-sm text-slate-400">
                {selectedUsers.length} cliente(s) selecionado(s)
              </p>
              <button
                onClick={() => setShowUserSelector(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Opção de Recarga */}
      {showRechargeModal && editingRecharge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-semibold text-slate-100 mb-4">
              {editingRecharge.id ? 'Editar Opção de Recarga' : 'Nova Opção de Recarga'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Plano *</label>
                <select
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editingRecharge.plan_type || selectedPlanType}
                  onChange={(e) => setEditingRecharge({ ...editingRecharge, plan_type: e.target.value })}
                >
                  <option value="">Selecione um plano</option>
                  <option value="ponto_unico">Ponto Único</option>
                  <option value="ponto_duplo">Ponto Duplo</option>
                  <option value="ponto_triplo">Ponto Triplo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Período *</label>
                <select
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editingRecharge.period || 'mensal'}
                  onChange={(e) => {
                    const period = e.target.value as 'mensal' | 'trimestral' | 'semestral' | 'anual';
                    const durationMap: Record<string, number> = {
                      mensal: 1,
                      trimestral: 3,
                      semestral: 6,
                      anual: 12
                    };
                    setEditingRecharge({
                      ...editingRecharge,
                      period,
                      duration_months: durationMap[period]
                    });
                  }}
                >
                  <option value="mensal">Mensal (1 mês)</option>
                  <option value="trimestral">Trimestral (3 meses)</option>
                  <option value="semestral">Semestral (6 meses)</option>
                  <option value="anual">Anual (12 meses)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Preço Total (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editingRecharge.price || ''}
                  onChange={(e) => setEditingRecharge({ ...editingRecharge, price: parseFloat(e.target.value) || 0 })}
                  placeholder="Ex: 90.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nome de Exibição</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editingRecharge.display_name || ''}
                  onChange={(e) => setEditingRecharge({ ...editingRecharge, display_name: e.target.value })}
                  placeholder="Ex: Recarga Trimestral - R$ 90,00"
                />
                <p className="text-xs text-slate-400 mt-1">Deixe vazio para gerar automaticamente</p>
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600"
                    checked={editingRecharge.active !== false}
                    onChange={(e) => setEditingRecharge({ ...editingRecharge, active: e.target.checked })}
                  />
                  <span className="text-sm text-slate-300">Ativa</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowRechargeModal(false);
                  setEditingRecharge(null);
                  setSelectedPlanType('');
                  setError(null);
                }}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRechargeOption}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {editingRecharge.id ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão de Promoção */}
      {showDeletePromotionModal && promotionToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-semibold text-slate-100 mb-4">Confirmar Exclusão</h3>
            <p className="text-slate-300 mb-4">
              Tem certeza que deseja excluir a promoção <strong className="text-red-400">"{promotionToDelete.name}"</strong>?
            </p>
            {promotionToDelete.is_individual && (
              <p className="text-sm text-amber-400 mb-4">
                ⚠️ Esta é uma promoção individual. Todos os vínculos com clientes serão removidos.
              </p>
            )}
            {promotionToDelete.current_uses > 0 && (
              <p className="text-sm text-slate-400 mb-4">
                Esta promoção já foi utilizada {promotionToDelete.current_uses} vez(es).
              </p>
            )}
            <p className="text-sm text-slate-400 mb-6">
              Esta ação é irreversível.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeletePromotionModal(false);
                  setPromotionToDelete(null);
                }}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600"
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeletePromotion}
                disabled={isDeleting}
                className={`px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 ${
                  isDeleting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function RechargeOptionRow({
  option,
  onEdit,
  formatCurrency
}: {
  option: RechargeOption;
  onEdit: () => void;
  formatCurrency: (value: number) => string;
}) {
  const periodNames: Record<string, string> = {
    mensal: 'Mensal',
    trimestral: 'Trimestral',
    semestral: 'Semestral',
    anual: 'Anual'
  };

  const pricePerMonth = option.price / option.duration_months;

  return (
    <tr>
      <td className="px-4 py-4 whitespace-nowrap text-slate-200">{periodNames[option.period]}</td>
      <td className="px-4 py-4 whitespace-nowrap text-slate-300">{option.duration_months} {option.duration_months === 1 ? 'mês' : 'meses'}</td>
      <td className="px-4 py-4 whitespace-nowrap text-slate-200 font-semibold">{formatCurrency(option.price)}</td>
      <td className="px-4 py-4 whitespace-nowrap text-slate-300">{formatCurrency(pricePerMonth)}</td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
          option.active ? 'bg-green-900/30 text-green-300' : 'bg-gray-900/30 text-gray-300'
        }`}>
          {option.active ? 'Ativa' : 'Inativa'}
        </span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <button
          onClick={onEdit}
          className="text-blue-400 hover:text-blue-300"
        >
          <Edit2 className="h-5 w-5" />
        </button>
      </td>
    </tr>
  );
}

function PlanCard({
  plan,
  rechargeOptions,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onEditRecharge,
  onAddRecharge,
  formatCurrency
}: {
  plan: Plan;
  rechargeOptions: RechargeOption[];
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (plan: Plan) => void;
  onEditRecharge: (option: RechargeOption) => void;
  onAddRecharge: () => void;
  formatCurrency: (value: number) => string;
}) {
  const [formData, setFormData] = useState({
    base_price: plan.base_price || plan.monthly_price,
    current_price: plan.current_price || plan.monthly_price
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const planTypeNames: Record<string, string> = {
    ponto_unico: 'Ponto Único',
    ponto_duplo: 'Ponto Duplo',
    ponto_triplo: 'Ponto Triplo'
  };

  // Função para normalizar nomes com problemas de encoding
  const normalizePlanName = (name: string, planType: string): string => {
    if (!name) return '';
    
    // Mapeamento direto baseado no plan_type para garantir exibição correta
    const planNameMap: Record<string, string> = {
      'ponto_unico': 'Básico - 1 Login',
      'ponto_duplo': 'Padrão - 2 Logins',
      'ponto_triplo': 'Premium - 3 Logins'
    };
    
    // Usa o plan_type como fonte de verdade
    return planNameMap[planType] || name;
  };

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center">
            <h4 className="text-lg font-semibold text-slate-100">{normalizePlanName(plan.name, plan.plan_type)}</h4>
            <span className={`ml-2 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </div>
          <p className="text-sm text-slate-400">{planTypeNames[plan.plan_type]}</p>
        </div>
        {isEditing ? (
          <div className="flex space-x-1">
            <button
              onClick={() => onSave({ ...plan, ...formData })}
              className="text-green-400 hover:text-green-300"
            >
              <Check className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                onCancel();
                setFormData({
                  base_price: plan.base_price || plan.monthly_price,
                  current_price: plan.current_price || plan.monthly_price
                });
              }}
              className="text-red-400 hover:text-red-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-blue-400 hover:text-blue-300"
          >
            <Edit2 className="h-5 w-5" />
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Preço Base</label>
            <input
              type="number"
              step="0.01"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={formData.base_price}
              onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Preço Atual</label>
            <input
              type="number"
              step="0.01"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={formData.current_price}
              onChange={(e) => setFormData({ ...formData, current_price: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-slate-400">Preço Base</p>
            <p className="text-lg font-semibold text-slate-100">{formatCurrency(plan.base_price || plan.monthly_price)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Preço Atual</p>
            <p className="text-lg font-semibold text-blue-400">{formatCurrency(plan.current_price || plan.monthly_price)}</p>
          </div>
          {plan.has_promotion && (
            <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-900/30 text-green-300 rounded">
              Com Promoção
            </span>
          )}
        </div>
      )}

      {/* Opções de Recarga (Expansível) */}
      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-md font-semibold text-slate-200 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Opções de Recarga
            </h5>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddRecharge();
              }}
              className="flex items-center px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Nova Opção
            </button>
          </div>
          
          {rechargeOptions.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">
              Nenhuma opção de recarga cadastrada. Clique em "Nova Opção" para adicionar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Período</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Duração</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Preço Total</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Preço/Mês</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                  {rechargeOptions.map((option) => (
                    <RechargeOptionRow
                      key={option.id}
                      option={option}
                      onEdit={() => onEditRecharge(option)}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

