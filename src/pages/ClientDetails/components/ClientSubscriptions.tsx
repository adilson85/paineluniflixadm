import { Eye, EyeOff, XCircle, Edit2, X, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Client } from '../../../types';
import { supabase } from '../../../lib/supabase';
import { formatDateBR } from '../../../utils/dateUtils';

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

interface ClientSubscriptionsProps {
  client: Client;
  isEditing: boolean;
  editingData: EditingClient | null;
  onEditingDataChange: (data: EditingClient) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function ClientSubscriptions({
  client,
  isEditing,
  editingData,
  onEditingDataChange,
  onEdit,
  onSave,
  onCancel,
  isSaving,
}: ClientSubscriptionsProps) {
  const [showPasswords, setShowPasswords] = useState<{
    painel1: boolean;
    painel2: boolean;
    painel3: boolean;
  }>({
    painel1: false,
    painel2: false,
    painel3: false,
  });
  const [availablePanels, setAvailablePanels] = useState<Array<{ name: string; display_name: string }>>([]);

  useEffect(() => {
    async function fetchPanels() {
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
    fetchPanels();
  }, []);

  const togglePasswordVisibility = (painel: 'painel1' | 'painel2' | 'painel3') => {
    setShowPasswords(prev => ({ ...prev, [painel]: !prev[painel] }));
  };

  const clearLogin = (panelKey: 'painel1' | 'painel2' | 'painel3') => {
    if (!editingData) return;

    onEditingDataChange({
      ...editingData,
      [`${panelKey}_login`]: '',
      [`${panelKey}_senha`]: '',
      [`${panelKey}_nome`]: '',
    });
  };

  const logins = [
    {
      key: 'painel1' as const,
      title: 'Login Principal',
      login: isEditing ? editingData?.painel1_login : client.painel1_login,
      senha: isEditing ? editingData?.painel1_senha : client.painel1_senha,
      nome: isEditing ? editingData?.painel1_nome : client.painel1_nome,
      canClear: false, // Login principal não pode ser limpo
    },
    {
      key: 'painel2' as const,
      title: 'Login 2',
      login: isEditing ? editingData?.painel2_login : client.painel2_login,
      senha: isEditing ? editingData?.painel2_senha : client.painel2_senha,
      nome: isEditing ? editingData?.painel2_nome : client.painel2_nome,
      canClear: true,
    },
    {
      key: 'painel3' as const,
      title: 'Login 3',
      login: isEditing ? editingData?.painel3_login : client.painel3_login,
      senha: isEditing ? editingData?.painel3_senha : client.painel3_senha,
      nome: isEditing ? editingData?.painel3_nome : client.painel3_nome,
      canClear: true,
    },
  ];

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700 mb-6">
      {/* Header com botões de ação */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-100">Logins de Acesso</h2>

        <div className="flex items-center space-x-2">
          {!isEditing ? (
            <button
              onClick={onEdit}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Editar Logins
            </button>
          ) : (
            <>
              <button
                onClick={onCancel}
                disabled={isSaving}
                className="flex items-center px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </button>
              <button
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4 mr-2" />
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {logins.map((item) => {
          // Não renderizar se não houver login
          if (!item.login && !isEditing) return null;

          return (
            <div key={item.key} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">{item.title}</h3>
                {isEditing && item.canClear && (item.login || item.senha || item.nome) && (
                  <button
                    type="button"
                    onClick={() => clearLogin(item.key)}
                    className="p-1 hover:bg-red-500/20 rounded-lg transition-colors group"
                    title="Limpar este login"
                  >
                    <XCircle className="w-5 h-5 text-red-400 group-hover:text-red-300" />
                  </button>
                )}
              </div>

              {/* Nome do Painel */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Nome do Painel
                </label>
                {isEditing && editingData ? (
                  <select
                    value={item.nome || ''}
                    onChange={(e) =>
                      onEditingDataChange({
                        ...editingData,
                        [`${item.key}_nome`]: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Selecione o painel</option>
                    {availablePanels.map((panel) => (
                      <option key={panel.name} value={panel.name}>
                        {panel.display_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-slate-200 font-medium">
                    {item.nome || '-'}
                  </p>
                )}
              </div>

              {/* Login */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Usuário
                </label>
                {isEditing && editingData ? (
                  <input
                    type="text"
                    value={item.login || ''}
                    onChange={(e) =>
                      onEditingDataChange({
                        ...editingData,
                        [`${item.key}_login`]: e.target.value,
                      })
                    }
                    placeholder="Login do usuário"
                    className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-slate-200 font-mono font-medium">
                    {item.login || '-'}
                  </p>
                )}
              </div>

              {/* Senha */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Senha
                </label>
                {isEditing && editingData ? (
                  <div className="relative">
                    <input
                      type={showPasswords[item.key] ? 'text' : 'password'}
                      value={item.senha || ''}
                      onChange={(e) =>
                        onEditingDataChange({
                          ...editingData,
                          [`${item.key}_senha`]: e.target.value,
                        })
                      }
                      placeholder="Senha"
                      className="w-full px-3 py-2 pr-10 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(item.key)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPasswords[item.key] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <p className="text-sm text-slate-200 font-mono font-medium pr-8">
                      {showPasswords[item.key] ? item.senha : '••••••••'}
                    </p>
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(item.key)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPasswords[item.key] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Status */}
              {!isEditing && item.login && (
                <div className="mt-4 pt-3 border-t border-slate-700">
                  <span className="inline-block px-2 py-1 bg-green-900/30 text-green-300 border border-green-700 text-xs font-semibold rounded">
                    Ativo
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Data de Expiração */}
      <div className="mt-6 pt-6 border-t border-slate-700">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Data de Expiração
        </label>
        {isEditing && editingData ? (
          <input
            type="date"
            value={editingData.data_expiracao}
            onChange={(e) =>
              onEditingDataChange({
                ...editingData,
                data_expiracao: e.target.value,
              })
            }
            className="px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        ) : (
          <p className="text-sm text-slate-200 font-medium">
            {client.data_expiracao
              ? formatDateBR(client.data_expiracao, {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })
              : 'Sem data definida'}
          </p>
        )}
      </div>
    </div>
  );
}
