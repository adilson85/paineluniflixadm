import React, { useEffect, useState } from 'react';
import { Users, Plus, Edit2, X, Check, CreditCard, Search, Filter, Monitor } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import type { Reseller, ResellerPanel, ResellerWithPanels, ResellerPricing } from '../types';
import { formatPhone } from '../utils/clientHelpers';

export default function Revendedores() {
  const [resellers, setResellers] = useState<ResellerWithPanels[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<ResellerWithPanels | null>(null);
  const [editingReseller, setEditingReseller] = useState<Partial<Reseller> | null>(null);
  const [rechargeData, setRechargeData] = useState({
    panel_name: '',
    quantity: 10,
    notes: ''
  });
  const [availablePanels, setAvailablePanels] = useState<{ name: string; display_name: string }[]>([]);
  const [newPanels, setNewPanels] = useState<{ [resellerId: string]: string[] }>({});
  const [pricingData, setPricingData] = useState<ResellerPricing[]>([]);
  const [calculatedPrice, setCalculatedPrice] = useState<{ pricePerCredit: number; totalAmount: number } | null>(null);
  const [minQuantity, setMinQuantity] = useState(10);

  useEffect(() => {
    fetchResellers();
    fetchAvailablePanels();
  }, []);

  async function fetchAvailablePanels() {
    try {
      const { data, error: panelsError } = await supabase
        .from('panels')
        .select('name, display_name')
        .eq('active', true)
        .order('name');

      if (panelsError) throw panelsError;

      setAvailablePanels((data || []).map(p => ({ name: p.name, display_name: p.display_name })));
    } catch (err) {
      console.error('Error fetching panels:', err);
      // Fallback
      setAvailablePanels([
        { name: 'Unitv', display_name: 'Unitv' },
        { name: 'Warez', display_name: 'Warez' },
        { name: 'Elite', display_name: 'Elite' }
      ]);
    }
  }

  async function fetchResellers() {
    try {
      setError(null);
      const { data: resellersData, error: resellersError } = await supabase
        .from('resellers')
        .select(`
          *,
          panels:reseller_panels (*)
        `)
        .order('created_at', { ascending: false });

      if (resellersError) throw resellersError;

      setResellers((resellersData || []) as ResellerWithPanels[]);
    } catch (err) {
      console.error('Error fetching resellers:', err);
      setError('Erro ao carregar os revendedores. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateReseller = async () => {
    if (!editingReseller?.name) {
      setError('Nome é obrigatório');
      return;
    }

    try {
      setError(null);
      const { data: newReseller, error: createError } = await supabase
        .from('resellers')
        .insert({
          name: editingReseller.name,
          email: editingReseller.email || null,
          phone: editingReseller.phone || null,
          cpf: editingReseller.cpf || null,
          status: editingReseller.status || 'active'
        })
        .select()
        .single();

      if (createError) throw createError;

      await fetchResellers();
      setShowModal(false);
      setEditingReseller(null);
    } catch (err) {
      console.error('Error creating reseller:', err);
      setError('Erro ao criar revendedor. Por favor, tente novamente.');
    }
  };

  const handleUpdateReseller = async () => {
    if (!editingReseller?.id || !editingReseller?.name) {
      setError('Nome é obrigatório');
      return;
    }

    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('resellers')
        .update({
          name: editingReseller.name,
          email: editingReseller.email || null,
          phone: editingReseller.phone || null,
          cpf: editingReseller.cpf || null,
          status: editingReseller.status || 'active'
        })
        .eq('id', editingReseller.id);

      if (updateError) throw updateError;

      await fetchResellers();
      setShowModal(false);
      setEditingReseller(null);
    } catch (err) {
      console.error('Error updating reseller:', err);
      setError('Erro ao atualizar revendedor. Por favor, tente novamente.');
    }
  };

  const handleSavePanel = async (resellerId: string, panel: Partial<ResellerPanel>) => {
    if (!panel.panel_name || !panel.panel_login || !panel.panel_password) {
      setError('Todos os campos do painel são obrigatórios');
      return;
    }

    try {
      setError(null);
      const { error: panelError } = await supabase
        .from('reseller_panels')
        .upsert({
          reseller_id: resellerId,
          panel_name: panel.panel_name,
          panel_login: panel.panel_login,
          panel_password: panel.panel_password,
          active: panel.active !== undefined ? panel.active : true
        }, {
          onConflict: 'reseller_id,panel_name'
        });

      if (panelError) throw panelError;

      // Remover o painel da lista de novos painéis se existir
      setNewPanels(prev => {
        const updated = { ...prev };
        if (updated[resellerId]) {
          updated[resellerId] = updated[resellerId].filter(p => p !== panel.panel_name);
          if (updated[resellerId].length === 0) {
            delete updated[resellerId];
          }
        }
        return updated;
      });

      await fetchResellers();
    } catch (err) {
      console.error('Error saving panel:', err);
      setError('Erro ao salvar painel. Por favor, tente novamente.');
    }
  };

  const handleCancelNewPanel = (resellerId: string, panelName: string) => {
    setNewPanels(prev => {
      const updated = { ...prev };
      if (updated[resellerId]) {
        updated[resellerId] = updated[resellerId].filter(p => p !== panelName);
        if (updated[resellerId].length === 0) {
          delete updated[resellerId];
        }
      }
      return updated;
    });
  };

  const fetchPricingForPanel = async (panelName: string) => {
    if (!panelName) {
      setPricingData([]);
      setCalculatedPrice(null);
      setMinQuantity(10);
      return;
    }

    try {
      const { data, error: pricingError } = await supabase
        .from('reseller_pricing')
        .select('*')
        .eq('panel_name', panelName)
        .eq('active', true)
        .order('min_quantity', { ascending: true });

      if (pricingError) throw pricingError;

      const pricing = (data || []) as ResellerPricing[];
      setPricingData(pricing);
      
      // Calcular quantidade mínima baseada no primeiro item da tabela
      const minQty = pricing.length > 0 ? pricing[0].min_quantity : 10;
      setMinQuantity(minQty);
      
      // Atualizar quantidade se for menor que a mínima do painel
      if (rechargeData.quantity < minQty) {
        setRechargeData(prev => ({ ...prev, quantity: minQty }));
      }
      
      calculatePrice(pricing);
    } catch (err) {
      console.error('Error fetching pricing:', err);
      setPricingData([]);
      setCalculatedPrice(null);
      setMinQuantity(10);
    }
  };

  const calculatePrice = (pricing: ResellerPricing[]) => {
    if (!rechargeData.panel_name || !rechargeData.quantity || pricing.length === 0) {
      setCalculatedPrice(null);
      return;
    }
    
    const minQty = pricing[0].min_quantity;
    if (rechargeData.quantity < minQty) {
      setCalculatedPrice(null);
      return;
    }

    // Encontrar a faixa correta (onde a quantidade está entre min e max, ou max é null)
    const matchingPricing = pricing.find(p => 
      rechargeData.quantity >= p.min_quantity &&
      (p.max_quantity === null || rechargeData.quantity <= p.max_quantity)
    );

    if (matchingPricing) {
      const pricePerCredit = matchingPricing.price_per_credit;
      const totalAmount = rechargeData.quantity * pricePerCredit;
      setCalculatedPrice({ pricePerCredit, totalAmount });
    } else {
      setCalculatedPrice(null);
    }
  };

  const handleRecharge = async () => {
    if (!selectedReseller || !rechargeData.quantity || rechargeData.quantity < minQuantity) {
      setError(`Quantidade mínima é ${minQuantity} créditos para este painel`);
      return;
    }

    if (!rechargeData.panel_name) {
      setError('Selecione um painel');
      return;
    }

    if (!calculatedPrice || calculatedPrice.pricePerCredit === 0) {
      setError('Não foi possível calcular o preço. Verifique se há preços configurados para este painel.');
      return;
    }

    try {
      setError(null);

      const pricePerCredit = calculatedPrice.pricePerCredit;
      const totalAmount = calculatedPrice.totalAmount;

      // Criar recarga
      const { error: rechargeError } = await supabase
        .from('reseller_recharges')
        .insert({
          reseller_id: selectedReseller.id,
          panel_name: rechargeData.panel_name,
          quantity: rechargeData.quantity,
          price_per_credit: pricePerCredit,
          total_amount: totalAmount,
          notes: rechargeData.notes || null,
          status: 'completed'
        });

      if (rechargeError) throw rechargeError;

      // Registrar entrada no caixa - usa timezone do Brasil
      const hoje = new Date().toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).split('/').reverse().join('-'); // Converte DD/MM/YYYY para YYYY-MM-DD
      const historicoCaixa = `Recarga Revendedor - ${selectedReseller.name} (${rechargeData.quantity} créditos - ${rechargeData.panel_name})`;
      
      const { error: caixaError } = await supabase
        .from('caixa_movimentacoes')
        .insert({
          data: hoje,
          historico: historicoCaixa,
          entrada: totalAmount,
          saida: 0,
        });

      if (caixaError) throw caixaError;

      // Registrar créditos vendidos
      const historicoCreditos = `Recarga Revendedor - ${selectedReseller.name} (${rechargeData.quantity} créditos)`;
      
      const { error: creditosError } = await supabase
        .from('creditos_vendidos')
        .insert({
          data: hoje,
          historico: historicoCreditos,
          painel: rechargeData.panel_name,
          quantidade_creditos: rechargeData.quantity,
        });

      if (creditosError) throw creditosError;

      // Atualizar saldo do revendedor
      const { error: updateError } = await supabase
        .from('resellers')
        .update({
          credit_balance: (selectedReseller.credit_balance || 0) + rechargeData.quantity
        })
        .eq('id', selectedReseller.id);

      if (updateError) throw updateError;

      await fetchResellers();
      setShowRechargeModal(false);
      setSelectedReseller(null);
      setRechargeData({ panel_name: '', quantity: 10, notes: '' });
      setPricingData([]);
      setCalculatedPrice(null);
    } catch (err) {
      console.error('Error processing recharge:', err);
      setError('Erro ao processar recarga. Por favor, tente novamente.');
    }
  };

  // Efeito para buscar preços quando o painel é selecionado
  useEffect(() => {
    if (showRechargeModal && rechargeData.panel_name) {
      fetchPricingForPanel(rechargeData.panel_name);
    } else if (!rechargeData.panel_name) {
      setPricingData([]);
      setCalculatedPrice(null);
    }
  }, [rechargeData.panel_name, showRechargeModal]);

  // Efeito para recalcular preço quando a quantidade ou painel muda
  useEffect(() => {
    if (pricingData.length > 0 && rechargeData.panel_name && rechargeData.quantity >= minQuantity) {
      calculatePrice(pricingData);
    } else {
      setCalculatedPrice(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rechargeData.quantity, rechargeData.panel_name, minQuantity]);

  const filteredResellers = resellers.filter(reseller => {
    const matchesSearch =
      reseller.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (reseller.email && reseller.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (reseller.phone && reseller.phone.includes(searchTerm));

    const matchesStatus =
      statusFilter === 'Todos' || reseller.status === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center">
            <Users className="h-6 w-6 mr-2" />
            Revendedores
          </h2>
          <p className="text-slate-400 text-sm">Gerencie revendedores e seus painéis</p>
        </div>
        <button
          onClick={() => {
            setEditingReseller({ status: 'active' });
            setShowModal(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Revendedor
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-6 space-y-4 md:space-y-0 md:flex md:items-center md:space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, email ou telefone..."
            className="pl-10 pr-4 py-2 rounded-lg w-full bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-slate-400" />
          <select
            className="border border-slate-700 bg-slate-900 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="Todos">Todos</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="suspended">Suspenso</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Lista de Revendedores */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-400">Carregando...</p>
          </div>
        ) : filteredResellers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            Nenhum revendedor encontrado
          </div>
        ) : (
          filteredResellers.map((reseller) => (
            <div key={reseller.id} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-100">{reseller.name}</h3>
                  <div className="mt-2 space-y-1 text-sm text-slate-400">
                    {reseller.email && <p>Email: {reseller.email}</p>}
                    {reseller.phone && <p>Telefone: {formatPhone(reseller.phone)}</p>}
                    {reseller.cpf && <p>CPF: {reseller.cpf}</p>}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    reseller.status === 'active' ? 'bg-green-900/30 text-green-300' :
                    reseller.status === 'inactive' ? 'bg-gray-900/30 text-gray-300' :
                    'bg-red-900/30 text-red-300'
                  }`}>
                    {reseller.status === 'active' ? 'Ativo' :
                     reseller.status === 'inactive' ? 'Inativo' : 'Suspenso'}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedReseller(reseller);
                      setRechargeData({ panel_name: '', quantity: 10, notes: '' });
                      setPricingData([]);
                      setCalculatedPrice(null);
                      setMinQuantity(10);
                      setShowRechargeModal(true);
                    }}
                    className="flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    <CreditCard className="h-4 w-4 mr-1" />
                    Recarregar
                  </button>
                  <button
                    onClick={() => {
                      setEditingReseller(reseller);
                      setShowModal(true);
                    }}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Painéis do Revendedor */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-300 flex items-center">
                    <Monitor className="h-4 w-4 mr-1" />
                    Painéis
                  </h4>
                  <button
                    onClick={() => {
                      // Adicionar novo painel temporário para edição
                      const availablePanelNames = availablePanels.map(p => p.name);
                      const existingPanelNames = reseller.panels?.map(p => p.panel_name) || [];
                      const currentNewPanels = newPanels[reseller.id] || [];
                      const newPanelName = availablePanelNames.find(
                        name => !existingPanelNames.includes(name) && !currentNewPanels.includes(name)
                      );
                      
                      if (newPanelName) {
                        setNewPanels(prev => ({
                          ...prev,
                          [reseller.id]: [...(prev[reseller.id] || []), newPanelName]
                        }));
                      } else {
                        setError('Todos os painéis disponíveis já estão configurados para este revendedor.');
                      }
                    }}
                    className="flex items-center px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                    disabled={
                      availablePanels.length === 
                      ((reseller.panels?.length || 0) + (newPanels[reseller.id]?.length || 0))
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar Painel
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {reseller.panels?.map((panel) => (
                    <PanelEditor
                      key={panel.id}
                      resellerId={reseller.id}
                      panelName={panel.panel_name}
                      panel={panel}
                      availablePanels={availablePanels}
                      onSave={handleSavePanel}
                    />
                  ))}
                  {newPanels[reseller.id]?.map((panelName) => (
                    <PanelEditor
                      key={`new-${panelName}`}
                      resellerId={reseller.id}
                      panelName={panelName}
                      panel={undefined}
                      availablePanels={availablePanels}
                      onSave={(resellerId, panel) => {
                        handleSavePanel(resellerId, panel);
                      }}
                      onCancel={() => handleCancelNewPanel(reseller.id, panelName)}
                    />
                  ))}
                  {(!reseller.panels || reseller.panels.length === 0) && 
                   (!newPanels[reseller.id] || newPanels[reseller.id].length === 0) && (
                    <p className="text-slate-400 text-sm col-span-3">Nenhum painel configurado. Clique em "Adicionar Painel" para começar.</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Criar/Editar Revendedor */}
      {showModal && editingReseller && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-semibold text-slate-100 mb-4">
              {editingReseller.id ? 'Editar Revendedor' : 'Novo Revendedor'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nome *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editingReseller.name || ''}
                  onChange={(e) => setEditingReseller({ ...editingReseller, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editingReseller.email || ''}
                  onChange={(e) => setEditingReseller({ ...editingReseller, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Telefone</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editingReseller.phone || ''}
                  onChange={(e) => setEditingReseller({ ...editingReseller, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">CPF</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editingReseller.cpf || ''}
                  onChange={(e) => setEditingReseller({ ...editingReseller, cpf: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                <select
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editingReseller.status || 'active'}
                  onChange={(e) => setEditingReseller({ ...editingReseller, status: e.target.value as any })}
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="suspended">Suspenso</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingReseller(null);
                }}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={editingReseller.id ? handleUpdateReseller : handleCreateReseller}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingReseller.id ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Recarga */}
      {showRechargeModal && selectedReseller && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full border border-slate-700 my-8">
            <h3 className="text-xl font-semibold text-slate-100 mb-4">
              Recarregar Créditos - {selectedReseller.name}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Painel</label>
                <select
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={rechargeData.panel_name}
                  onChange={(e) => setRechargeData({ ...rechargeData, panel_name: e.target.value })}
                >
                  <option value="">Selecione um painel</option>
                  {availablePanels.map((panel) => (
                    <option key={panel.name} value={panel.name}>
                      {panel.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tabela de Preços */}
              {rechargeData.panel_name && pricingData.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Tabela de Preços por Quantidade
                  </label>
                  <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-800">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-300">Quantidade</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-300">Preço por Crédito</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-slate-300">Exemplo (100 créditos)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {pricingData.map((pricing, index) => {
                          const isSelected = rechargeData.quantity >= pricing.min_quantity &&
                            (pricing.max_quantity === null || rechargeData.quantity <= pricing.max_quantity);
                          const exampleTotal = 100 * pricing.price_per_credit;
                          
                          return (
                            <tr
                              key={pricing.id}
                              className={isSelected ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''}
                            >
                              <td className="px-4 py-2 text-sm text-slate-200">
                                {pricing.min_quantity}
                                {pricing.max_quantity ? ` - ${pricing.max_quantity}` : '+'} créditos
                              </td>
                              <td className="px-4 py-2 text-sm text-slate-200 font-semibold">
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                }).format(pricing.price_per_credit)}
                              </td>
                              <td className="px-4 py-2 text-sm text-slate-400 text-right">
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                }).format(exampleTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {rechargeData.panel_name && pricingData.length === 0 && (
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                  <p className="text-sm text-yellow-300">
                    Nenhum preço configurado para este painel. Configure os preços em "Preços Revendedores".
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Quantidade de Créditos</label>
                <input
                  type="number"
                  min={minQuantity}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={rechargeData.quantity}
                  onChange={(e) => setRechargeData({ ...rechargeData, quantity: parseInt(e.target.value) || minQuantity })}
                />
                <p className="text-xs text-slate-400 mt-1">Mínimo: {minQuantity} créditos</p>
              </div>

              {/* Resumo do Cálculo */}
              {calculatedPrice && calculatedPrice.pricePerCredit > 0 && (
                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-300">Quantidade:</span>
                      <span className="text-sm font-semibold text-slate-200">{rechargeData.quantity} créditos</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-300">Preço por Crédito:</span>
                      <span className="text-sm font-semibold text-slate-200">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(calculatedPrice.pricePerCredit)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-blue-700">
                      <span className="text-base font-semibold text-slate-100">Total:</span>
                      <span className="text-lg font-bold text-blue-400">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(calculatedPrice.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Observações</label>
                <textarea
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  rows={3}
                  value={rechargeData.notes}
                  onChange={(e) => setRechargeData({ ...rechargeData, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowRechargeModal(false);
                  setSelectedReseller(null);
                  setRechargeData({ panel_name: '', quantity: 10, notes: '' });
                  setPricingData([]);
                  setCalculatedPrice(null);
                  setMinQuantity(10);
                }}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleRecharge}
                disabled={!calculatedPrice || calculatedPrice.pricePerCredit === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Recarga
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// Componente para editar painel
function PanelEditor({
  resellerId,
  panelName,
  panel,
  availablePanels,
  onSave,
  onCancel
}: {
  resellerId: string;
  panelName: string;
  panel?: ResellerPanel;
  availablePanels: { name: string; display_name: string }[];
  onSave: (resellerId: string, panel: Partial<ResellerPanel>) => void;
  onCancel?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(!panel); // Se não existe painel, já abre em modo edição
  const [formData, setFormData] = useState({
    panel_name: panelName,
    panel_login: panel?.panel_login || '',
    panel_password: panel?.panel_password || '',
    active: panel?.active !== false
  });

  const handleSave = () => {
    if (!formData.panel_name || !formData.panel_login || !formData.panel_password) {
      return; // Validação será feita no handleSavePanel
    }
    onSave(resellerId, {
      panel_name: formData.panel_name,
      panel_login: formData.panel_login,
      panel_password: formData.panel_password,
      active: formData.active
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      setIsEditing(false);
      setFormData({
        panel_name: panelName,
        panel_login: panel?.panel_login || '',
        panel_password: panel?.panel_password || '',
        active: panel?.active !== false
      });
    }
  };

  const panelDisplayName = availablePanels.find(p => p.name === formData.panel_name)?.display_name || formData.panel_name;

  return (
    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
      <div className="flex justify-between items-center mb-2">
        <h5 className="font-semibold text-slate-200">{panelDisplayName}</h5>
        {isEditing ? (
          <div className="flex space-x-1">
            <button
              onClick={handleSave}
              className="text-green-400 hover:text-green-300"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancel}
              className="text-red-400 hover:text-red-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-blue-400 hover:text-blue-300"
          >
            <Edit2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-2">
          {!panel && (
            <select
              className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              value={formData.panel_name}
              onChange={(e) => setFormData({ ...formData, panel_name: e.target.value })}
            >
              <option value="">Selecione um painel</option>
              {availablePanels.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.display_name}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            placeholder="Login"
            className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
            value={formData.panel_login}
            onChange={(e) => setFormData({ ...formData, panel_login: e.target.value })}
          />
          <input
            type="text"
            placeholder="Senha"
            className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
            value={formData.panel_password}
            onChange={(e) => setFormData({ ...formData, panel_password: e.target.value })}
          />
        </div>
      ) : (
        <div className="text-sm text-slate-400">
          {panel ? (
            <>
              <p>Login: {panel.panel_login}</p>
              <p>Senha: {panel.panel_password}</p>
              <p className={`mt-1 ${panel.active ? 'text-green-400' : 'text-red-400'}`}>
                {panel.active ? 'Ativo' : 'Inativo'}
              </p>
            </>
          ) : (
            <p className="text-slate-500">Não configurado</p>
          )}
        </div>
      )}
    </div>
  );
}

