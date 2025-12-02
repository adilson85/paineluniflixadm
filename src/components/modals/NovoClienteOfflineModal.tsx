import { X, UserPlus, Eye, EyeOff, AlertCircle, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { OfflineClient } from '../../types';
import { toE164, isValidCPF, formatCPF } from '../../utils/clientHelpers';

interface NovoClienteOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NovoClienteOfflineModal({
  isOpen,
  onClose,
  onSuccess,
}: NovoClienteOfflineModalProps) {
  const navigate = useNavigate();

  const [phoneError, setPhoneError] = useState('');
  const [cpfError, setCpfError] = useState('');

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

  // Estados para validação de telefone
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [phoneExists, setPhoneExists] = useState(false);
  const [existingClient, setExistingClient] = useState<{
    id: string;
    name: string;
    type: 'online' | 'offline';
  } | null>(null);

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

  // Resetar form quando modal abrir/fechar
  useEffect(() => {
    if (!isOpen) {
      setFormData({
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
      setError(null);
      setPhoneError('');
      setCpfError('');
      setPhoneExists(false);
      setExistingClient(null);
    }
  }, [isOpen]);

  // Verificar se telefone já existe em clientes online ou offline (com debounce)
  useEffect(() => {
    const checkPhoneExists = async () => {
      const cleanPhone = formData.telefone.replace(/\D/g, '');

      // Só verificar se tiver pelo menos 10 dígitos (DDD + número)
      if (cleanPhone.length < 10) {
        setPhoneExists(false);
        setExistingClient(null);
        return;
      }

      try {
        setCheckingPhone(true);

        // Primeiro, buscar na tabela users (clientes online)
        const { data: onlineClient, error: onlineError } = await supabase
          .from('users')
          .select('id, full_name, phone')
          .ilike('phone', `%${cleanPhone}%`)
          .limit(1)
          .single();

        if (onlineError && onlineError.code !== 'PGRST116') {
          // PGRST116 = nenhum resultado encontrado, que é ok
          console.error('Erro ao verificar telefone em users:', onlineError);
        }

        if (onlineClient) {
          setPhoneExists(true);
          setExistingClient({
            id: onlineClient.id,
            name: onlineClient.full_name,
            type: 'online',
          });
          return;
        }

        // Se não encontrou em users, buscar na tabela offline_clients
        const { data: offlineClient, error: offlineError } = await supabase
          .from('offline_clients')
          .select('id, nome, telefone')
          .ilike('telefone', `%${cleanPhone}%`)
          .is('migrated_to_user_id', null) // Apenas clientes não migrados
          .limit(1)
          .single();

        if (offlineError && offlineError.code !== 'PGRST116') {
          console.error('Erro ao verificar telefone em offline_clients:', offlineError);
        }

        if (offlineClient) {
          setPhoneExists(true);
          setExistingClient({
            id: offlineClient.id,
            name: offlineClient.nome,
            type: 'offline',
          });
        } else {
          setPhoneExists(false);
          setExistingClient(null);
        }
      } catch (err) {
        console.error('Erro ao verificar telefone:', err);
      } finally {
        setCheckingPhone(false);
      }
    };

    // Debounce de 500ms
    const timer = setTimeout(() => {
      if (formData.telefone.trim()) {
        checkPhoneExists();
      } else {
        setPhoneExists(false);
        setExistingClient(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.telefone]);

  const togglePasswordVisibility = (field: 'senha_01' | 'senha_02' | 'senha_03') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Função para formatar telefone com máscara
  const handlePhoneChange = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');

    // Limita a 11 dígitos
    const limited = numbers.slice(0, 11);

    // Aplica máscara diferenciando fixo (10 dígitos) de celular (11 dígitos)
    let formatted = limited;
    if (limited.length <= 10) {
      // Telefone fixo: (DD) DDDD-DDDD
      if (limited.length > 2) {
        formatted = `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
      }
      if (limited.length > 6) {
        formatted = `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6, 10)}`;
      }
    } else {
      // Telefone celular: (DD) DDDDD-DDDD
      if (limited.length > 2) {
        formatted = `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
      }
      if (limited.length > 7) {
        formatted = `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7, 11)}`;
      }
    }

    setFormData(prev => ({ ...prev, telefone: formatted }));

    // Valida telefone
    if (limited.length > 0 && limited.length < 10) {
      setPhoneError('Telefone incompleto');
    } else if (limited.length === 10 || limited.length === 11) {
      // Verifica se é um número de celular (terceiro dígito é 6, 7, 8 ou 9)
      const thirdDigit = limited.length >= 3 ? limited[2] : '';
      const isCellPhone = ['6', '7', '8', '9'].includes(thirdDigit);

      // Se parece ser celular mas tem apenas 10 dígitos, está incompleto
      if (isCellPhone && limited.length === 10) {
        setPhoneError('Celular incompleto - falta o 9 na frente');
      } else {
        const phoneE164 = toE164(formatted);
        if (phoneE164) {
          setPhoneError('');
        } else {
          setPhoneError('Telefone inválido');
        }
      }
    } else {
      setPhoneError('');
    }
  };

  // Função para formatar CPF com máscara
  const handleCpfChange = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');

    // Limita a 11 dígitos
    const limited = numbers.slice(0, 11);

    // Aplica máscara: 000.000.000-00
    let formatted = limited;
    if (limited.length > 3) {
      formatted = `${limited.slice(0, 3)}.${limited.slice(3)}`;
    }
    if (limited.length > 6) {
      formatted = `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
    }
    if (limited.length > 9) {
      formatted = `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9, 11)}`;
    }

    setFormData(prev => ({ ...prev, cpf: formatted }));

    // Valida CPF
    if (limited.length > 0 && limited.length < 11) {
      setCpfError('CPF incompleto');
    } else if (limited.length === 11) {
      if (isValidCPF(formatted)) {
        setCpfError('');
      } else {
        setCpfError('CPF inválido');
      }
    } else {
      setCpfError('');
    }
  };

  const handleGoToExistingClient = () => {
    if (existingClient) {
      onClose();
      if (existingClient.type === 'online') {
        navigate(`/clientes/${existingClient.id}`);
      } else {
        navigate(`/clientes-offline/${existingClient.id}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações
    if (!formData.nome.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    if (!formData.telefone.trim()) {
      setError('Telefone é obrigatório');
      return;
    }

    // Validação de erros de formato
    if (phoneError) {
      setError('Por favor, corrija o telefone antes de salvar.');
      return;
    }

    if (cpfError) {
      setError('Por favor, corrija o CPF antes de salvar.');
      return;
    }

    // Verificar se telefone já existe
    if (phoneExists) {
      setError('Este telefone já está cadastrado. Use o botão abaixo para ir ao perfil do cliente.');
      return;
    }

    // Converter telefone para E.164
    const telefoneE164 = toE164(formData.telefone);
    if (!telefoneE164) {
      setError('Telefone inválido. Use o formato (DDD) 99999-9999');
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

      // Chamar função RPC
      const { data: newClientId, error: createError } = await supabase.rpc('create_offline_client', {
        p_nome: formData.nome.trim(),
        p_telefone: telefoneE164,
        p_cpf: formData.cpf.trim() || null,
        p_email: formData.email.trim() || null,
        p_id_botconversa: formData.id_botconversa ? parseInt(formData.id_botconversa) : null,
        p_login_01: formData.login_01.trim() || null,
        p_senha_01: formData.senha_01.trim() || null,
        p_painel_01: formData.painel_01.trim() || null,
        p_login_02: formData.login_02.trim() || null,
        p_senha_02: formData.senha_02.trim() || null,
        p_painel_02: formData.painel_02.trim() || null,
        p_login_03: formData.login_03.trim() || null,
        p_senha_03: formData.senha_03.trim() || null,
        p_painel_03: formData.painel_03.trim() || null,
        p_data_expiracao: formData.data_expiracao || null,
        p_valor_mensal: formData.valor_mensal ? parseFloat(formData.valor_mensal) : null,
      });

      if (createError) throw createError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao criar cliente offline:', err);
      setError(err.message || 'Erro ao criar cliente. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-900/30 rounded-lg border border-green-700">
              <UserPlus className="w-6 h-6 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-100">Novo Cliente Offline</h2>
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
            <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Dados Básicos */}
          <div>
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Dados Básicos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nome Completo <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => handleChange('nome', e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Digite o nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Telefone <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md bg-slate-900 border text-slate-200 placeholder-slate-500 shadow-sm transition-colors ${
                    phoneExists || phoneError
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : formData.telefone && !phoneError && !checkingPhone
                      ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                      : 'border-slate-700 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                  placeholder="(00) 00000-0000"
                />
                {checkingPhone && (
                  <p className="mt-1 text-xs text-slate-400">Verificando telefone...</p>
                )}
                {phoneError && !phoneExists && (
                  <p className="text-xs text-red-400 mt-1">{phoneError}</p>
                )}
                {formData.telefone && !phoneError && !checkingPhone && !phoneExists && (
                  <p className="text-xs text-green-400 mt-1">✓ Telefone válido</p>
                )}
                {phoneExists && existingClient && (
                  <div className="mt-2 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-yellow-300 font-medium mb-1">
                          Telefone já cadastrado!
                        </p>
                        <p className="text-xs text-yellow-400 mb-2">
                          {existingClient.type === 'online'
                            ? `Este telefone pertence ao cliente ${existingClient.name} que já possui acesso ao painel online.`
                            : `Este telefone já foi cadastrado em Clientes Offline com o nome ${existingClient.name}.`
                          }
                        </p>
                        <button
                          type="button"
                          onClick={handleGoToExistingClient}
                          className="flex items-center text-xs px-3 py-1 bg-yellow-700 text-yellow-100 rounded hover:bg-yellow-600 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Ver Perfil do Cliente
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  CPF
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  className={`w-full px-3 py-2 rounded-md bg-slate-900 border text-slate-200 placeholder-slate-500 shadow-sm transition-colors ${
                    cpfError
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : formData.cpf && !cpfError
                      ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                      : 'border-slate-700 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                  value={formData.cpf}
                  onChange={(e) => handleCpfChange(e.target.value)}
                />
                {cpfError && (
                  <p className="text-xs text-red-400 mt-1">{cpfError}</p>
                )}
                {formData.cpf && !cpfError && (
                  <p className="text-xs text-green-400 mt-1">✓ CPF válido</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  ID Botconversa
                </label>
                <input
                  type="number"
                  value={formData.id_botconversa}
                  onChange={(e) => handleChange('id_botconversa', e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="ID opcional"
                />
              </div>
            </div>
          </div>

          {/* Logins */}
          <div>
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              Logins de Acesso <span className="text-sm text-slate-400">(pelo menos um obrigatório)</span>
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Login 01 */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Login 01</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Painel</label>
                    <select
                      value={formData.painel_01}
                      onChange={(e) => handleChange('painel_01', e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Selecione</option>
                      {availablePanels.map((panel) => (
                        <option key={panel.name} value={panel.name}>
                          {panel.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Login</label>
                    <input
                      type="text"
                      value={formData.login_01}
                      onChange={(e) => handleChange('login_01', e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Usuário"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Senha</label>
                    <div className="relative">
                      <input
                        type={showPasswords.senha_01 ? 'text' : 'password'}
                        value={formData.senha_01}
                        onChange={(e) => handleChange('senha_01', e.target.value)}
                        className="w-full px-3 py-2 pr-10 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Senha"
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
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Login 02</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Painel</label>
                    <select
                      value={formData.painel_02}
                      onChange={(e) => handleChange('painel_02', e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Selecione</option>
                      {availablePanels.map((panel) => (
                        <option key={panel.name} value={panel.name}>
                          {panel.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Login</label>
                    <input
                      type="text"
                      value={formData.login_02}
                      onChange={(e) => handleChange('login_02', e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Usuário"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Senha</label>
                    <div className="relative">
                      <input
                        type={showPasswords.senha_02 ? 'text' : 'password'}
                        value={formData.senha_02}
                        onChange={(e) => handleChange('senha_02', e.target.value)}
                        className="w-full px-3 py-2 pr-10 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Senha"
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
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Login 03</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Painel</label>
                    <select
                      value={formData.painel_03}
                      onChange={(e) => handleChange('painel_03', e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Selecione</option>
                      {availablePanels.map((panel) => (
                        <option key={panel.name} value={panel.name}>
                          {panel.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Login</label>
                    <input
                      type="text"
                      value={formData.login_03}
                      onChange={(e) => handleChange('login_03', e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Usuário"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Senha</label>
                    <div className="relative">
                      <input
                        type={showPasswords.senha_03 ? 'text' : 'password'}
                        value={formData.senha_03}
                        onChange={(e) => handleChange('senha_03', e.target.value)}
                        className="w-full px-3 py-2 pr-10 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Senha"
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
          </div>

          {/* Financeiro */}
          <div>
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Informações Financeiras</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Data de Expiração
                </label>
                <input
                  type="date"
                  value={formData.data_expiracao}
                  onChange={(e) => handleChange('data_expiracao', e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-400">Deixe em branco para 30 dias a partir de hoje</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Valor Mensal (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.valor_mensal}
                  onChange={(e) => handleChange('valor_mensal', e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing || phoneExists || checkingPhone || phoneError !== '' || cpfError !== ''}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              title={phoneExists ? 'Telefone já cadastrado' : phoneError || cpfError ? 'Corrija os erros antes de salvar' : ''}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Criando...
                </>
              ) : checkingPhone ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verificando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Criar Cliente Offline
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
