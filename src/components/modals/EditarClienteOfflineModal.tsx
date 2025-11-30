import { X, Edit, Eye, EyeOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { OfflineClient } from '../../types';

interface EditarClienteOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client: OfflineClient | null;
}

export function EditarClienteOfflineModal({
  isOpen,
  onClose,
  onSuccess,
  client,
}: EditarClienteOfflineModalProps) {
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    cpf: '',
    email: '',
    id_botconversa: '',
    login_01: '',
    senha_01: '',
    painel_01: '',
    login_02: '',
    senha_02: '',
    painel_02: '',
    login_03: '',
    senha_03: '',
    painel_03: '',
    data_expiracao: '',
    valor_mensal: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    senha_01: false,
    senha_02: false,
    senha_03: false,
  });

  const [availablePanels, setAvailablePanels] = useState<Array<{ name: string; display_name: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar painéis disponíveis
  useEffect(() => {
    async function fetchPanels() {
      try {
        const { data, error } = await supabase
          .from('panels')
          .select('name, display_name')
          .eq('active', true)
          .order('name');

        if (error) throw error;

        setAvailablePanels((data || []).map(p => ({ name: p.name, display_name: p.display_name })));
      } catch (err) {
        console.error('Error fetching panels:', err);
        setAvailablePanels([
          { name: 'Unitv', display_name: 'Unitv' },
          { name: 'Warez', display_name: 'Warez' },
          { name: 'Elite', display_name: 'Elite' }
        ]);
      }
    }
    fetchPanels();
  }, []);

  // Preencher form quando modal abrir ou cliente mudar
  useEffect(() => {
    if (isOpen && client) {
      setFormData({
        nome: client.nome || '',
        telefone: client.telefone || '',
        cpf: client.cpf || '',
        email: client.email || '',
        id_botconversa: client.id_botconversa?.toString() || '',
        login_01: client.login_01 || '',
        senha_01: client.senha_01 || '',
        painel_01: client.painel_01 || '',
        login_02: client.login_02 || '',
        senha_02: client.senha_02 || '',
        painel_02: client.painel_02 || '',
        login_03: client.login_03 || '',
        senha_03: client.senha_03 || '',
        painel_03: client.painel_03 || '',
        data_expiracao: client.data_expiracao ? new Date(client.data_expiracao).toISOString().split('T')[0] : '',
        valor_mensal: client.valor_mensal?.toString() || '',
      });
      setError(null);
    }
  }, [isOpen, client]);

  const togglePasswordVisibility = (field: 'senha_01' | 'senha_02' | 'senha_03') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!client?.id) {
      setError('ID do cliente não encontrado');
      return;
    }

    // Validações
    if (!formData.nome.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    if (!formData.telefone.trim()) {
      setError('Telefone é obrigatório');
      return;
    }

    const hasLogin1 = formData.login_01.trim() && formData.senha_01.trim();
    const hasLogin2 = formData.login_02.trim() && formData.senha_02.trim();
    const hasLogin3 = formData.login_03.trim() && formData.senha_03.trim();

    if (!hasLogin1 && !hasLogin2 && !hasLogin3) {
      setError('É necessário fornecer pelo menos um login com senha');
      return;
    }

    try {
      setIsProcessing(true);

      // Atualizar diretamente na tabela
      const { error: updateError } = await supabase
        .from('offline_clients')
        .update({
          nome: formData.nome.trim(),
          telefone: formData.telefone.trim(),
          cpf: formData.cpf.trim() || null,
          email: formData.email.trim() || null,
          id_botconversa: formData.id_botconversa ? parseInt(formData.id_botconversa) : null,
          login_01: formData.login_01.trim() || null,
          senha_01: formData.senha_01.trim() || null,
          painel_01: formData.painel_01.trim() || null,
          login_02: formData.login_02.trim() || null,
          senha_02: formData.senha_02.trim() || null,
          painel_02: formData.painel_02.trim() || null,
          login_03: formData.login_03.trim() || null,
          senha_03: formData.senha_03.trim() || null,
          painel_03: formData.painel_03.trim() || null,
          data_expiracao: formData.data_expiracao || null,
          valor_mensal: formData.valor_mensal ? parseFloat(formData.valor_mensal) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', client.id);

      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao atualizar cliente offline:', err);
      setError(err.message || 'Erro ao atualizar cliente. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-900/30 rounded-lg border border-blue-700">
              <Edit className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-100">Editar Cliente Offline</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Erro */}
          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-start">
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Dados Básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Nome <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => handleChange('nome', e.target.value)}
                className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Telefone <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.telefone}
                onChange={(e) => handleChange('telefone', e.target.value)}
                className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">CPF</label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => handleChange('cpf', e.target.value)}
                className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">ID Botconversa</label>
              <input
                type="number"
                value={formData.id_botconversa}
                onChange={(e) => handleChange('id_botconversa', e.target.value)}
                className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Data de Expiração
              </label>
              <input
                type="date"
                value={formData.data_expiracao}
                onChange={(e) => handleChange('data_expiracao', e.target.value)}
                className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Valor Mensal</label>
              <input
                type="number"
                step="0.01"
                value={formData.valor_mensal}
                onChange={(e) => handleChange('valor_mensal', e.target.value)}
                className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Logins */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-200">Logins de Acesso</h3>

            {/* Login 01 */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-semibold text-slate-300 mb-4">Login 01</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Painel</label>
                  <select
                    value={formData.painel_01}
                    onChange={(e) => handleChange('painel_01', e.target.value)}
                    className="w-full px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Selecione...</option>
                    {availablePanels.map(panel => (
                      <option key={panel.name} value={panel.name}>{panel.display_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Usuário</label>
                  <input
                    type="text"
                    value={formData.login_01}
                    onChange={(e) => handleChange('login_01', e.target.value)}
                    className="w-full px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Senha</label>
                  <div className="relative">
                    <input
                      type={showPasswords.senha_01 ? 'text' : 'password'}
                      value={formData.senha_01}
                      onChange={(e) => handleChange('senha_01', e.target.value)}
                      className="w-full px-4 py-2 pr-10 rounded-md bg-slate-800 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('senha_01')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPasswords.senha_01 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Login 02 */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-semibold text-slate-300 mb-4">Login 02</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Painel</label>
                  <select
                    value={formData.painel_02}
                    onChange={(e) => handleChange('painel_02', e.target.value)}
                    className="w-full px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Selecione...</option>
                    {availablePanels.map(panel => (
                      <option key={panel.name} value={panel.name}>{panel.display_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Usuário</label>
                  <input
                    type="text"
                    value={formData.login_02}
                    onChange={(e) => handleChange('login_02', e.target.value)}
                    className="w-full px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Senha</label>
                  <div className="relative">
                    <input
                      type={showPasswords.senha_02 ? 'text' : 'password'}
                      value={formData.senha_02}
                      onChange={(e) => handleChange('senha_02', e.target.value)}
                      className="w-full px-4 py-2 pr-10 rounded-md bg-slate-800 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('senha_02')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPasswords.senha_02 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Login 03 */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-semibold text-slate-300 mb-4">Login 03</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Painel</label>
                  <select
                    value={formData.painel_03}
                    onChange={(e) => handleChange('painel_03', e.target.value)}
                    className="w-full px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Selecione...</option>
                    {availablePanels.map(panel => (
                      <option key={panel.name} value={panel.name}>{panel.display_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Usuário</label>
                  <input
                    type="text"
                    value={formData.login_03}
                    onChange={(e) => handleChange('login_03', e.target.value)}
                    className="w-full px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Senha</label>
                  <div className="relative">
                    <input
                      type={showPasswords.senha_03 ? 'text' : 'password'}
                      value={formData.senha_03}
                      onChange={(e) => handleChange('senha_03', e.target.value)}
                      className="w-full px-4 py-2 pr-10 rounded-md bg-slate-800 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('senha_03')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPasswords.senha_03 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}













