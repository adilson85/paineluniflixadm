import React, { useEffect, useState } from 'react';
import { DollarSign, Edit2, X, Check, Monitor, Plus, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import type { ResellerPricing } from '../types';

export default function PrecosRevendedores() {
  const [pricing, setPricing] = useState<ResellerPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPricing, setEditingPricing] = useState<ResellerPricing | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null);
  const [deletingPricing, setDeletingPricing] = useState<ResellerPricing | null>(null);
  const [deletingPanel, setDeletingPanel] = useState<{ name: string; display_name: string } | null>(null);
  const [newPricing, setNewPricing] = useState({
    panel_name: '',
    min_quantity: 10,
    max_quantity: null as number | null,
    price_per_credit: 0,
    active: true
  });

  const handleCreatePanel = async () => {
    if (!newPanel.name || !newPanel.display_name) {
      setError('Nome e Nome de Exibição são obrigatórios');
      return;
    }

    // Validar formato do nome (sem espaços, apenas letras e números)
    if (!/^[A-Za-z0-9_]+$/.test(newPanel.name)) {
      setError('Nome do painel deve conter apenas letras, números e underscore');
      return;
    }

    try {
      setError(null);
      const { error: insertError } = await supabase
        .from('panels')
        .insert({
          name: newPanel.name,
          display_name: newPanel.display_name,
          description: newPanel.description || null,
          active: newPanel.active
        });

      if (insertError) throw insertError;

      await fetchPanels();
      setShowAddPanelModal(false);
      setNewPanel({
        name: '',
        display_name: '',
        description: '',
        active: true
      });
    } catch (err: any) {
      console.error('Error creating panel:', err);
      if (err.code === '23505') {
        setError('Já existe um painel com este nome.');
      } else {
        setError('Erro ao criar painel. Por favor, tente novamente.');
      }
    }
  };

  useEffect(() => {
    fetchPricing();
    fetchPanels();
  }, []);

  async function fetchPanels() {
    try {
      const { data, error: panelsError } = await supabase
        .from('panels')
        .select('name, display_name')
        .eq('active', true)
        .order('name');

      if (panelsError) throw panelsError;

      setPanels((data || []).map(p => ({ name: p.name, display_name: p.display_name })));
    } catch (err) {
      console.error('Error fetching panels:', err);
      // Fallback para painéis hardcoded se a tabela não existir ainda
      setPanels([
        { name: 'Unitv', display_name: 'Unitv' },
        { name: 'Warez', display_name: 'Warez' },
        { name: 'Elite', display_name: 'Elite' }
      ]);
    }
  }

  async function fetchPricing() {
    try {
      setError(null);
      const { data, error: pricingError } = await supabase
        .from('reseller_pricing')
        .select('*')
        .order('panel_name, min_quantity');

      if (pricingError) throw pricingError;

      setPricing((data || []) as ResellerPricing[]);
    } catch (err) {
      console.error('Error fetching pricing:', err);
      setError('Erro ao carregar preços. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const handleUpdatePricing = async (pricingItem: ResellerPricing) => {
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('reseller_pricing')
        .update({
          min_quantity: pricingItem.min_quantity,
          max_quantity: pricingItem.max_quantity,
          price_per_credit: pricingItem.price_per_credit,
          active: pricingItem.active
        })
        .eq('id', pricingItem.id);

      if (updateError) throw updateError;

      await fetchPricing();
      setEditingPricing(null);
    } catch (err) {
      console.error('Error updating pricing:', err);
      setError('Erro ao atualizar preço. Por favor, tente novamente.');
    }
  };

  const handleDeletePricing = async (pricingItem: ResellerPricing) => {
    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from('reseller_pricing')
        .delete()
        .eq('id', pricingItem.id);

      if (deleteError) throw deleteError;

      await fetchPricing();
      setDeletingPricing(null);
    } catch (err) {
      console.error('Error deleting pricing:', err);
      setError('Erro ao excluir faixa de preço. Por favor, tente novamente.');
    }
  };

  const handleDeletePanel = async (panel: { name: string; display_name: string }) => {
    try {
      setError(null);

      // Primeiro, excluir todas as faixas de preço deste painel
      const { error: pricingDeleteError } = await supabase
        .from('reseller_pricing')
        .delete()
        .eq('panel_name', panel.name);

      if (pricingDeleteError) throw pricingDeleteError;

      // Depois, desativar ou excluir o painel
      const { error: panelDeleteError } = await supabase
        .from('panels')
        .delete()
        .eq('name', panel.name);

      if (panelDeleteError) throw panelDeleteError;

      await fetchPanels();
      await fetchPricing();
      setDeletingPanel(null);
    } catch (err) {
      console.error('Error deleting panel:', err);
      setError('Erro ao excluir painel. Por favor, tente novamente.');
    }
  };

  const handleCreatePricing = async () => {
    if (!newPricing.min_quantity || newPricing.min_quantity < 1) {
      setError('Quantidade mínima deve ser maior que 0');
      return;
    }

    if (!newPricing.price_per_credit || newPricing.price_per_credit <= 0) {
      setError('Preço por crédito deve ser maior que 0');
      return;
    }

    // Validar se não há sobreposição de faixas
    const existingPricing = pricing.filter(p => p.panel_name === newPricing.panel_name && p.active);
    const hasOverlap = existingPricing.some(p => {
      const newMin = newPricing.min_quantity;
      const newMax = newPricing.max_quantity;
      const existingMin = p.min_quantity;
      const existingMax = p.max_quantity;

      // Verifica sobreposição
      if (newMax === null) {
        // Nova faixa é "acima de X"
        return existingMin >= newMin || (existingMax === null && existingMin === newMin);
      } else if (existingMax === null) {
        // Faixa existente é "acima de X"
        return newMin >= existingMin;
      } else {
        // Ambas têm máximo definido
        return (newMin <= existingMax && newMax >= existingMin);
      }
    });

    if (hasOverlap) {
      setError('Esta faixa de quantidade sobrepõe uma faixa existente. Ajuste os valores.');
      return;
    }

    try {
      setError(null);
      const { error: insertError } = await supabase
        .from('reseller_pricing')
        .insert({
          panel_name: newPricing.panel_name,
          min_quantity: newPricing.min_quantity,
          max_quantity: newPricing.max_quantity,
          price_per_credit: newPricing.price_per_credit,
          active: newPricing.active
        });

      if (insertError) throw insertError;

      await fetchPricing();
      setShowAddModal(false);
      setSelectedPanel(null);
      setNewPricing({
        panel_name: 'Unitv',
        min_quantity: 10,
        max_quantity: null,
        price_per_credit: 0,
        active: true
      });
    } catch (err: any) {
      console.error('Error creating pricing:', err);
      if (err.code === '23505') {
        setError('Já existe uma faixa com esta quantidade mínima para este painel.');
      } else {
        setError('Erro ao criar faixa de preço. Por favor, tente novamente.');
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatQuantityRange = (min: number, max: number | null) => {
    if (max === null) {
      return `${min}+ créditos`;
    }
    if (min === max) {
      return `${min} créditos`;
    }
    return `${min} - ${max} créditos`;
  };

  const [panels, setPanels] = useState<{ name: string; display_name: string }[]>([]);
  const [showAddPanelModal, setShowAddPanelModal] = useState(false);
  const [newPanel, setNewPanel] = useState({
    name: '',
    display_name: '',
    description: '',
    active: true
  });

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center">
            <DollarSign className="h-6 w-6 mr-2" />
            Preços para Revendedores
          </h2>
          <p className="text-slate-400 text-sm">Gerencie a tabela de preços por painel e quantidade</p>
        </div>
        <button
          onClick={() => setShowAddPanelModal(true)}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Painel
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-400">Carregando...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {panels.map((panel) => {
            const panelPricing = pricing.filter(p => p.panel_name === panel.name);
            
            return (
              <div key={panel.name} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Monitor className="h-5 w-5 mr-2 text-blue-400" />
                    <h3 className="text-lg font-semibold text-slate-100">{panel.display_name}</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedPanel(panel.name);
                        setNewPricing({
                          panel_name: panel.name,
                          min_quantity: 10,
                          max_quantity: null,
                          price_per_credit: 0,
                          active: true
                        });
                        setShowAddModal(true);
                      }}
                      className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Faixa
                    </button>
                    <button
                      onClick={() => setDeletingPanel(panel)}
                      className="flex items-center px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      title="Excluir Painel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Quantidade</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Preço por Crédito</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-800 divide-y divide-slate-700">
                      {panelPricing.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                            Nenhum preço cadastrado
                          </td>
                        </tr>
                      ) : (
                        panelPricing.map((item) => (
                          <PricingRow
                            key={item.id}
                            item={item}
                            isEditing={editingPricing?.id === item.id}
                            onEdit={() => setEditingPricing(item)}
                            onCancel={() => setEditingPricing(null)}
                            onSave={handleUpdatePricing}
                            onDelete={() => setDeletingPricing(item)}
                            formatCurrency={formatCurrency}
                            formatQuantityRange={formatQuantityRange}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Adicionar Nova Faixa */}
      {showAddModal && selectedPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-semibold text-slate-100 mb-4">
              Adicionar Nova Faixa - {panels.find(p => p.name === selectedPanel)?.display_name || selectedPanel}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Quantidade Mínima *</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={newPricing.min_quantity}
                  onChange={(e) => setNewPricing({ ...newPricing, min_quantity: parseInt(e.target.value) || 1 })}
                  placeholder="Ex: 10"
                />
                <p className="text-xs text-slate-400 mt-1">Quantidade mínima de créditos para esta faixa</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Quantidade Máxima</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={newPricing.max_quantity || ''}
                  onChange={(e) => setNewPricing({ ...newPricing, max_quantity: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Deixe vazio para 'acima de'"
                />
                <p className="text-xs text-slate-400 mt-1">Deixe vazio para indicar "acima de X créditos"</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Preço por Crédito (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={newPricing.price_per_credit}
                  onChange={(e) => setNewPricing({ ...newPricing, price_per_credit: parseFloat(e.target.value) || 0 })}
                  placeholder="Ex: 13.00"
                />
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600"
                    checked={newPricing.active}
                    onChange={(e) => setNewPricing({ ...newPricing, active: e.target.checked })}
                  />
                  <span className="text-sm text-slate-300">Ativa</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedPanel(null);
                  setNewPricing({
                    panel_name: panels.length > 0 ? panels[0].name : '',
                    min_quantity: 10,
                    max_quantity: null,
                    price_per_credit: 0,
                    active: true
                  });
                  setError(null);
                }}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreatePricing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Criar Faixa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Novo Painel */}
      {showAddPanelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-semibold text-slate-100 mb-4">
              Criar Novo Painel
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nome do Painel *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={newPanel.name}
                  onChange={(e) => setNewPanel({ ...newPanel, name: e.target.value })}
                  placeholder="Ex: NovoPainel"
                />
                <p className="text-xs text-slate-400 mt-1">Apenas letras, números e underscore (sem espaços)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nome de Exibição *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={newPanel.display_name}
                  onChange={(e) => setNewPanel({ ...newPanel, display_name: e.target.value })}
                  placeholder="Ex: Novo Painel"
                />
                <p className="text-xs text-slate-400 mt-1">Nome que será exibido na interface</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Descrição</label>
                <textarea
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  rows={2}
                  value={newPanel.description}
                  onChange={(e) => setNewPanel({ ...newPanel, description: e.target.value })}
                  placeholder="Descrição opcional do painel"
                />
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600"
                    checked={newPanel.active}
                    onChange={(e) => setNewPanel({ ...newPanel, active: e.target.checked })}
                  />
                  <span className="text-sm text-slate-300">Ativo</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowAddPanelModal(false);
                  setNewPanel({
                    name: '',
                    display_name: '',
                    description: '',
                    active: true
                  });
                  setError(null);
                }}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreatePanel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Criar Painel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão de Faixa */}
      {deletingPricing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-semibold text-slate-100 mb-4">
              Confirmar Exclusão
            </h3>
            <p className="text-slate-300 mb-6">
              Tem certeza que deseja excluir a faixa de preço <strong>{formatQuantityRange(deletingPricing.min_quantity, deletingPricing.max_quantity)}</strong> do painel <strong>{panels.find(p => p.name === deletingPricing.panel_name)?.display_name || deletingPricing.panel_name}</strong>?
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setDeletingPricing(null)}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeletePricing(deletingPricing)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão de Painel */}
      {deletingPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700 border-red-500">
            <h3 className="text-xl font-semibold text-red-400 mb-4 flex items-center">
              <Trash2 className="h-6 w-6 mr-2" />
              Excluir Painel Completo
            </h3>
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-4">
              <p className="text-red-200 font-semibold mb-2">⚠️ Atenção: Esta ação é irreversível!</p>
              <p className="text-slate-300 text-sm">
                Ao excluir este painel, todas as faixas de preço associadas também serão excluídas permanentemente.
              </p>
            </div>
            <p className="text-slate-300 mb-6">
              Tem certeza que deseja excluir o painel <strong className="text-red-400">{deletingPanel.display_name}</strong> e todas as suas <strong>{pricing.filter(p => p.panel_name === deletingPanel.name).length} faixas de preço</strong>?
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setDeletingPanel(null)}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeletePanel(deletingPanel)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Painel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function PricingRow({
  item,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  formatCurrency,
  formatQuantityRange
}: {
  item: ResellerPricing;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (item: ResellerPricing) => void;
  onDelete: () => void;
  formatCurrency: (value: number) => string;
  formatQuantityRange: (min: number, max: number | null) => string;
}) {
  const [formData, setFormData] = useState({
    min_quantity: item.min_quantity,
    max_quantity: item.max_quantity,
    price_per_credit: item.price_per_credit,
    active: item.active
  });

  return (
    <tr>
      <td className="px-4 py-4 whitespace-nowrap">
        {isEditing ? (
          <div className="space-y-2">
            <input
              type="number"
              min="1"
              className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              value={formData.min_quantity}
              onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 1 })}
              placeholder="Mín"
            />
            <input
              type="number"
              min="1"
              className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              value={formData.max_quantity || ''}
              onChange={(e) => setFormData({ ...formData, max_quantity: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="Máx (ou vazio)"
            />
          </div>
        ) : (
          <span className="text-slate-200">{formatQuantityRange(item.min_quantity, item.max_quantity)}</span>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        {isEditing ? (
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-32 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
            value={formData.price_per_credit}
            onChange={(e) => setFormData({ ...formData, price_per_credit: parseFloat(e.target.value) || 0 })}
          />
        ) : (
          <span className="text-slate-200 font-semibold">{formatCurrency(item.price_per_credit)}</span>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        {isEditing ? (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
            />
            <span className="text-sm text-slate-300">{formData.active ? 'Ativo' : 'Inativo'}</span>
          </label>
        ) : (
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
            item.active ? 'bg-green-900/30 text-green-300' : 'bg-gray-900/30 text-gray-300'
          }`}>
            {item.active ? 'Ativo' : 'Inativo'}
          </span>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        {isEditing ? (
          <div className="flex space-x-2">
            <button
              onClick={() => onSave({ ...item, ...formData })}
              className="text-green-400 hover:text-green-300"
              title="Salvar"
            >
              <Check className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                onCancel();
                setFormData({
                  min_quantity: item.min_quantity,
                  max_quantity: item.max_quantity,
                  price_per_credit: item.price_per_credit,
                  active: item.active
                });
              }}
              className="text-red-400 hover:text-red-300"
              title="Cancelar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={onEdit}
              className="text-blue-400 hover:text-blue-300"
              title="Editar"
            >
              <Edit2 className="h-5 w-5" />
            </button>
            <button
              onClick={onDelete}
              className="text-red-400 hover:text-red-300"
              title="Excluir"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

