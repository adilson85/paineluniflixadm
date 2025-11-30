import { useEffect, useState } from 'react';
import { Search, Filter, ExternalLink, Users, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import type { Client, User, Subscription } from '../types';
import { transformUserToClient, getPlanType, formatPhone } from '../utils/clientHelpers';
import { formatDateBR } from '../utils/dateUtils';

export default function Clientes() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNovoClienteModal, setShowNovoClienteModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [availablePanels, setAvailablePanels] = useState<Array<{ name: string; display_name: string }>>([]);
  const [novoClienteForm, setNovoClienteForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    cpf: '',
    data_nascimento: '',
    // Logins de acesso
    login1: '',
    senha1: '',
    painel1: '',
    login2: '',
    senha2: '',
    painel2: '',
    login3: '',
    senha3: '',
    painel3: '',
    // Data de expiração e valor
    data_expiracao: '',
    valor_mensal: '',
  });

  useEffect(() => {
    fetchClients();
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

  // Função movida para utils/clientHelpers.ts

  async function fetchClients() {
    try {
      setError(null);

      // Buscar users com suas subscriptions
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(`
          *,
          subscriptions (*)
        `)
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Filtrar administradores usando função RPC
      // Se a função não existir, filtrar manualmente (fallback)
      let nonAdminUsers = usersData || [];
      
      try {
        const { data: adminIds } = await supabase.rpc('get_admin_user_ids');
        if (adminIds && Array.isArray(adminIds)) {
          nonAdminUsers = (usersData || []).filter(user => !adminIds.includes(user.id));
        }
      } catch (err) {
        // Se a função não existir, tentar filtrar de outra forma
        console.warn('Could not filter admins via RPC, including all users');
      }

      // Transformar dados usando função utilitária
      const processedClients: Client[] = nonAdminUsers.map((user: User & { subscriptions: Subscription[] }) =>
        transformUserToClient(user)
      );

      setClients(processedClients);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('Erro ao carregar os clientes. Por favor, verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = clients.filter(client => {
    const matchesSearch =
      client.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.telefone && client.telefone.includes(searchTerm));

    const matchesStatus =
      statusFilter === 'Todos' || client.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center">
            <Users className="h-6 w-6 mr-2" />
            Clientes
          </h2>
          <p className="text-slate-400 text-sm">Gerencie todos os clientes cadastrados</p>
        </div>
        <button
          onClick={() => setShowNovoClienteModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Cliente
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="mb-6 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              className="pl-10 pr-4 py-2 rounded-lg w-full md:w-96 bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
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
              <option value="Ativo">Ativo</option>
              <option value="Expirado">Expirado</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg shadow overflow-x-auto border border-slate-700">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Telefone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Plano</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Data de Expiração</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">E-mail</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">CPF</th>
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-slate-300">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Carregando...</span>
                  </div>
                </td>
              </tr>
            ) : filteredClients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-slate-300">
                  Nenhum cliente encontrado
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => {
                const planInfo = getPlanType(client);
                return (
                  <tr key={client.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/clientes/${client.id}`}
                        className="text-blue-400 hover:text-blue-300 flex items-center"
                      >
                        {client.nome}
                        <ExternalLink className="h-4 w-4 ml-1" />
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-300">{client.telefone ? formatPhone(client.telefone) : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          client.status === 'Ativo'
                            ? 'bg-green-900/30 text-green-300'
                            : 'bg-red-900/30 text-red-300'
                        }`}
                      >
                        {client.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {planInfo.type ? (
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            planInfo.type === 'ponto_unico'
                              ? 'bg-blue-900/30 text-blue-300 border border-blue-700'
                              : planInfo.type === 'ponto_duplo'
                              ? 'bg-purple-900/30 text-purple-300 border border-purple-700'
                              : 'bg-pink-900/30 text-pink-300 border border-pink-700'
                          }`}
                        >
                          {planInfo.label}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                      {client.data_expiracao ? formatDateBR(client.data_expiracao) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-300">{client.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-300">{client.cpf || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Novo Cliente */}
      {showNovoClienteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <h3 className="text-xl font-bold text-slate-100">Novo Cliente</h3>
              <button
                onClick={() => {
                  setShowNovoClienteModal(false);
                  setNovoClienteForm({
                    full_name: '',
                    email: '',
                    phone: '',
                    cpf: '',
                    data_nascimento: '',
                    login1: '',
                    senha1: '',
                    painel1: '',
                    login2: '',
                    senha2: '',
                    painel2: '',
                    login3: '',
                    senha3: '',
                    painel3: '',
                    data_expiracao: '',
                    valor_mensal: '',
                  });
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSaving(true);
                try {
                  // Usar função RPC para criar o cliente
                  const { data: userId, error: rpcError } = await supabase.rpc('create_client', {
                    p_full_name: novoClienteForm.full_name,
                    p_email: novoClienteForm.email || null,
                    p_phone: novoClienteForm.phone || null,
                    p_cpf: novoClienteForm.cpf || null,
                    p_data_nascimento: novoClienteForm.data_nascimento || null,
                  });

                  if (rpcError) throw rpcError;
                  if (!userId) throw new Error('ID do cliente não retornado');

                  // Criar subscriptions (logins) se fornecidos
                  const subscriptionsToCreate = [];
                  
                  if (novoClienteForm.login1 && novoClienteForm.senha1) {
                    subscriptionsToCreate.push({
                      user_id: userId,
                      app_username: novoClienteForm.login1,
                      app_password: novoClienteForm.senha1,
                      panel_name: novoClienteForm.painel1 || null,
                      expiration_date: novoClienteForm.data_expiracao || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias se não informado
                      monthly_value: novoClienteForm.valor_mensal ? parseFloat(novoClienteForm.valor_mensal) : null,
                      status: 'active',
                    });
                  }
                  
                  if (novoClienteForm.login2 && novoClienteForm.senha2) {
                    subscriptionsToCreate.push({
                      user_id: userId,
                      app_username: novoClienteForm.login2,
                      app_password: novoClienteForm.senha2,
                      panel_name: novoClienteForm.painel2 || null,
                      expiration_date: novoClienteForm.data_expiracao || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      monthly_value: novoClienteForm.valor_mensal ? parseFloat(novoClienteForm.valor_mensal) : null,
                      status: 'active',
                    });
                  }
                  
                  if (novoClienteForm.login3 && novoClienteForm.senha3) {
                    subscriptionsToCreate.push({
                      user_id: userId,
                      app_username: novoClienteForm.login3,
                      app_password: novoClienteForm.senha3,
                      panel_name: novoClienteForm.painel3 || null,
                      expiration_date: novoClienteForm.data_expiracao || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      monthly_value: novoClienteForm.valor_mensal ? parseFloat(novoClienteForm.valor_mensal) : null,
                      status: 'active',
                    });
                  }

                  // Inserir subscriptions se houver
                  if (subscriptionsToCreate.length > 0) {
                    const { error: subsError } = await supabase
                      .from('subscriptions')
                      .insert(subscriptionsToCreate);

                    if (subsError) throw subsError;
                  }

                  // Recarregar lista de clientes
                  await fetchClients();
                  
                  // Fechar modal e limpar formulário
                  setShowNovoClienteModal(false);
                  setNovoClienteForm({
                    full_name: '',
                    email: '',
                    phone: '',
                    cpf: '',
                    data_nascimento: '',
                    login1: '',
                    senha1: '',
                    painel1: '',
                    login2: '',
                    senha2: '',
                    painel2: '',
                    login3: '',
                    senha3: '',
                    painel3: '',
                    data_expiracao: '',
                    valor_mensal: '',
                  });
                } catch (err) {
                  console.error('Erro ao criar cliente:', err);
                  setError('Erro ao criar cliente. Por favor, tente novamente.');
                } finally {
                  setIsSaving(false);
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={novoClienteForm.full_name}
                  onChange={(e) => setNovoClienteForm({ ...novoClienteForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Digite o nome completo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={novoClienteForm.email}
                  onChange={(e) => setNovoClienteForm({ ...novoClienteForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={novoClienteForm.phone}
                  onChange={(e) => setNovoClienteForm({ ...novoClienteForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  CPF
                </label>
                <input
                  type="text"
                  value={novoClienteForm.cpf}
                  onChange={(e) => setNovoClienteForm({ ...novoClienteForm, cpf: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  value={novoClienteForm.data_nascimento}
                  onChange={(e) => setNovoClienteForm({ ...novoClienteForm, data_nascimento: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Separador - Logins de Acesso */}
              <div className="pt-4 border-t border-slate-700">
                <h4 className="text-lg font-semibold text-slate-200 mb-4">Logins de Acesso</h4>
                
                {/* Data de Expiração e Valor Mensal */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Data de Expiração
                    </label>
                    <input
                      type="date"
                      value={novoClienteForm.data_expiracao}
                      onChange={(e) => setNovoClienteForm({ ...novoClienteForm, data_expiracao: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Valor Mensal (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={novoClienteForm.valor_mensal}
                      onChange={(e) => setNovoClienteForm({ ...novoClienteForm, valor_mensal: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Login 1 */}
                <div className="mb-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <h5 className="text-sm font-medium text-slate-300 mb-3">Login 1 (Principal)</h5>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Usuário</label>
                      <input
                        type="text"
                        value={novoClienteForm.login1}
                        onChange={(e) => setNovoClienteForm({ ...novoClienteForm, login1: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Usuário"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Senha</label>
                      <input
                        type="text"
                        value={novoClienteForm.senha1}
                        onChange={(e) => setNovoClienteForm({ ...novoClienteForm, senha1: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Senha"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Painel</label>
                      <select
                        value={novoClienteForm.painel1}
                        onChange={(e) => setNovoClienteForm({ ...novoClienteForm, painel1: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">Selecione o painel</option>
                        {availablePanels.map((panel) => (
                          <option key={panel.name} value={panel.name}>
                            {panel.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Login 2 */}
                <div className="mb-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <h5 className="text-sm font-medium text-slate-300 mb-3">Login 2 (Opcional)</h5>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Usuário</label>
                      <input
                        type="text"
                        value={novoClienteForm.login2}
                        onChange={(e) => setNovoClienteForm({ ...novoClienteForm, login2: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Usuário"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Senha</label>
                      <input
                        type="text"
                        value={novoClienteForm.senha2}
                        onChange={(e) => setNovoClienteForm({ ...novoClienteForm, senha2: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Senha"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Painel</label>
                      <select
                        value={novoClienteForm.painel2}
                        onChange={(e) => setNovoClienteForm({ ...novoClienteForm, painel2: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">Selecione o painel</option>
                        {availablePanels.map((panel) => (
                          <option key={panel.name} value={panel.name}>
                            {panel.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Login 3 */}
                <div className="mb-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <h5 className="text-sm font-medium text-slate-300 mb-3">Login 3 (Opcional)</h5>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Usuário</label>
                      <input
                        type="text"
                        value={novoClienteForm.login3}
                        onChange={(e) => setNovoClienteForm({ ...novoClienteForm, login3: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Usuário"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Senha</label>
                      <input
                        type="text"
                        value={novoClienteForm.senha3}
                        onChange={(e) => setNovoClienteForm({ ...novoClienteForm, senha3: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Senha"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Painel</label>
                      <select
                        value={novoClienteForm.painel3}
                        onChange={(e) => setNovoClienteForm({ ...novoClienteForm, painel3: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">Selecione o painel</option>
                        {availablePanels.map((panel) => (
                          <option key={panel.name} value={panel.name}>
                            {panel.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNovoClienteModal(false);
                    setNovoClienteForm({
                      full_name: '',
                      email: '',
                      phone: '',
                      cpf: '',
                      data_nascimento: '',
                      login1: '',
                      senha1: '',
                      painel1: '',
                      login2: '',
                      senha2: '',
                      painel2: '',
                      login3: '',
                      senha3: '',
                      painel3: '',
                      data_expiracao: '',
                      valor_mensal: '',
                    });
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

