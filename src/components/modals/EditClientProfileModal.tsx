import { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Client } from '../../types';

interface EditClientProfileModalProps {
  client: Client;
  onClose: () => void;
  onUpdate: () => void;
}

interface AddressData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export function EditClientProfileModal({
  client,
  onClose,
  onUpdate,
}: EditClientProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [fullName, setFullName] = useState(client.nome || '');
  const [email, setEmail] = useState(client.email || '');
  const [phone, setPhone] = useState(client.telefone || '');
  const [cpf, setCpf] = useState(client.cpf || '');

  // Address fields
  const [cep, setCep] = useState(client.cep || '');
  const [logradouro, setLogradouro] = useState(client.logradouro || '');
  const [numero, setNumero] = useState(client.numero || '');
  const [complemento, setComplemento] = useState(client.complemento || '');
  const [bairro, setBairro] = useState(client.bairro || '');
  const [cidade, setCidade] = useState(client.cidade || '');
  const [estado, setEstado] = useState(client.estado || '');

  // Validação de CPF
  const validateCPF = (cpfValue: string): boolean => {
    const cleanCpf = cpfValue.replace(/\D/g, '');
    if (cleanCpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleanCpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleanCpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleanCpf.charAt(10))) return false;

    return true;
  };

  // Formatação de CPF
  const formatCPF = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return value;
  };

  // Validação de WhatsApp Brasil
  const VALID_DDDS = new Set([
    '11','12','13','14','15','16','17','18','19','21','22','24','27','28',
    '31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49',
    '51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74',
    '75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94',
    '95','96','97','98','99'
  ]);

  const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");

  const stripBR = (raw: string) => {
    let d = onlyDigits(raw);
    if (d.startsWith("55")) d = d.slice(2);
    return d;
  };

  const isObviousFake = (d: string) =>
    /^(\d)\1{10}$/.test(d) || /(012345|123456|2334567|345678|456789|987654|876543)/.test(d);

  const isValidWhatsappBR = (raw: string): boolean => {
    const d = stripBR(raw);
    if (d.length !== 11) return false;
    if (!VALID_DDDS.has(d.slice(0,2))) return false;
    if (d[2] !== '9') return false;
    if (isObviousFake(d)) return false;
    return true;
  };

  // Formatação de telefone
  const formatPhone = (value: string): string => {
    const numbers = onlyDigits(value);
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  // Validação de email
  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  // Formatação de CEP
  const formatCEP = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 8) {
      return numbers.replace(/(\d{5})(\d{3})/, '$1-$2');
    }
    return value;
  };

  // Buscar endereço via CEP
  const fetchAddressByCEP = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setLoadingCep(true);
    setError(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data: AddressData = await response.json();

      if (data.erro) {
        setError('CEP não encontrado');
        setLoadingCep(false);
        return;
      }

      setLogradouro(data.logradouro || '');
      setBairro(data.bairro || '');
      setCidade(data.localidade || '');
      setEstado(data.uf || '');
      setComplemento(data.complemento || '');
    } catch (err) {
      setError('Erro ao buscar CEP. Tente novamente.');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validações
    if (!fullName.trim()) {
      setError('Nome completo é obrigatório');
      return;
    }

    if (cpf && !validateCPF(cpf)) {
      setError('CPF inválido');
      return;
    }

    if (email && !validateEmail(email)) {
      setError('E-mail inválido');
      return;
    }

    if (phone && !isValidWhatsappBR(phone)) {
      setError('Telefone inválido. Digite um número de WhatsApp válido (DDD + 9 dígitos)');
      return;
    }

    setLoading(true);

    try {
      // Preparar dados para atualização
      const updateData: Record<string, any> = {
        full_name: fullName.trim(),
        updated_at: new Date().toISOString(),
      };

      // Admins podem atualizar email diretamente (sem processo de confirmação)
      if (email && email.trim()) {
        updateData.email = email.trim();
      }

      if (phone) {
        updateData.phone = onlyDigits(phone);
      }

      if (cpf) {
        updateData.cpf = cpf.replace(/\D/g, '');
      }

      // Campos de endereço
      if (cep) {
        updateData.cep = cep.replace(/\D/g, '');
      }
      if (logradouro) {
        updateData.logradouro = logradouro.trim();
      }
      if (numero) {
        updateData.numero = numero.trim();
      }
      if (complemento) {
        updateData.complemento = complemento.trim();
      }
      if (bairro) {
        updateData.bairro = bairro.trim();
      }
      if (cidade) {
        updateData.cidade = cidade.trim();
      }
      if (estado) {
        updateData.estado = estado.trim().toUpperCase();
      }

      // Atualizar tabela users (incluindo email, se foi alterado)
      const { error: updateError } = await supabase
        .from('users')
        // @ts-ignore - Supabase type issue with dynamic updates
        .update(updateData)
        .eq('id', client.id);

      if (updateError) {
        throw updateError;
      }

      setSuccess('Dados do cliente atualizados com sucesso!');

      setTimeout(() => {
        onUpdate();
        onClose();
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar dados do cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Editar Dados do Cliente</h2>
            <p className="text-sm text-slate-400 mt-1">Editando: {client.nome}</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nome Completo */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-slate-300 mb-2">
              Nome Completo <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* E-mail */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              E-mail
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Telefone/WhatsApp */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">
              Telefone/WhatsApp
            </label>
            <input
              type="text"
              id="phone"
              value={phone}
              onChange={(e) => {
                const formatted = formatPhone(e.target.value);
                setPhone(formatted);
              }}
              placeholder="(00) 00000-0000"
              className={`w-full px-4 py-2 rounded-lg bg-slate-900 border shadow-sm focus:ring-2 focus:ring-blue-500 ${
                phone && !isValidWhatsappBR(phone)
                  ? 'border-red-700 bg-red-900/20'
                  : 'border-slate-700'
              }`}
            />
            {phone && !isValidWhatsappBR(phone) && (
              <p className="text-xs text-red-400 mt-1">
                Digite um número de WhatsApp válido (DDD + 9 dígitos)
              </p>
            )}
            {phone && isValidWhatsappBR(phone) && (
              <p className="text-xs text-green-400 mt-1">
                ✓ Número válido
              </p>
            )}
          </div>

          {/* CPF */}
          <div>
            <label htmlFor="cpf" className="block text-sm font-medium text-slate-300 mb-2">
              CPF
            </label>
            <input
              type="text"
              id="cpf"
              value={cpf}
              onChange={(e) => {
                const formatted = formatCPF(e.target.value);
                setCpf(formatted);
              }}
              maxLength={14}
              placeholder="000.000.000-00"
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Divider */}
          <div className="pt-4 border-t border-slate-700">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Endereço</h3>
          </div>

          {/* CEP */}
          <div>
            <label htmlFor="cep" className="block text-sm font-medium text-slate-300 mb-2">
              CEP
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                id="cep"
                value={cep}
                onChange={(e) => {
                  const formatted = formatCEP(e.target.value);
                  setCep(formatted);
                }}
                onBlur={(e) => {
                  const cleanCep = e.target.value.replace(/\D/g, '');
                  if (cleanCep.length === 8) {
                    fetchAddressByCEP(cleanCep);
                  }
                }}
                maxLength={9}
                placeholder="00000-000"
                className="flex-1 px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              {loadingCep && (
                <div className="flex items-center px-4">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Logradouro */}
          <div>
            <label htmlFor="logradouro" className="block text-sm font-medium text-slate-300 mb-2">
              Logradouro
            </label>
            <input
              type="text"
              id="logradouro"
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
              placeholder="Rua, Avenida, etc."
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Número e Complemento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="numero" className="block text-sm font-medium text-slate-300 mb-2">
                Número
              </label>
              <input
                type="text"
                id="numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="complemento" className="block text-sm font-medium text-slate-300 mb-2">
                Complemento
              </label>
              <input
                type="text"
                id="complemento"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                placeholder="Apto, Bloco, etc."
                className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Bairro */}
          <div>
            <label htmlFor="bairro" className="block text-sm font-medium text-slate-300 mb-2">
              Bairro
            </label>
            <input
              type="text"
              id="bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Cidade e Estado */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cidade" className="block text-sm font-medium text-slate-300 mb-2">
                Cidade
              </label>
              <input
                type="text"
                id="cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="estado" className="block text-sm font-medium text-slate-300 mb-2">
                Estado (UF)
              </label>
              <input
                type="text"
                id="estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="SC"
                className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-900/20 border border-green-700 rounded-lg">
              <p className="text-sm text-green-300 whitespace-pre-line">{success}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
