import React, { useEffect, useState } from 'react';
import { Settings, Plus, Edit2, X, Check, UserPlus, Shield } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatPhone } from '../utils/clientHelpers';

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  user_metadata: {
    role?: string;
  } | null;
}

export default function Configuracoes() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Partial<AdminUser> | null>(null);
  const [newAdmin, setNewAdmin] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: ''
  });

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function fetchAdmins() {
    try {
      setError(null);
      
      // Usar função RPC para buscar administradores
      const { data: adminsData, error: adminsError } = await supabase
        .rpc('get_admin_users');

      if (adminsError) {
        console.error('Error fetching admins - Full error:', adminsError);
        console.error('Error code:', adminsError.code);
        console.error('Error message:', adminsError.message);
        console.error('Error details:', adminsError.details);
        console.error('Error hint:', adminsError.hint);
        
        // Tratar diferentes tipos de erro
        if (adminsError.code === '42883' || adminsError.message?.includes('does not exist')) {
          setError('Função RPC não encontrada. Execute a migração SQL: 20251111080002_create_admin_management_functions.sql');
          setAdmins([]);
          return;
        }
        
        if (adminsError.code === '42501' || adminsError.message?.includes('permission denied') || adminsError.message?.includes('Acesso negado')) {
          setError('Acesso negado. Verifique se você tem permissão de administrador.');
          setAdmins([]);
          return;
        }
        
        // Outros erros - mostrar mensagem detalhada
        const errorMsg = adminsError.message || 'Erro desconhecido';
        setError(`Erro ao carregar administradores: ${errorMsg}. Código: ${adminsError.code || 'N/A'}`);
        setAdmins([]);
        return;
      }

      if (!adminsData) {
        setAdmins([]);
        return;
      }

      const mappedAdmins = (adminsData || []).map((admin: any) => ({
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        phone: admin.phone,
        created_at: admin.created_at,
        user_metadata: admin.user_metadata || {}
      }));

      console.log('Admins loaded:', mappedAdmins.length);
      setAdmins(mappedAdmins);
    } catch (err: any) {
      console.error('Error fetching admins:', err);
      const errorMessage = err.message || err.toString() || 'Erro desconhecido';
      setError(`Erro ao carregar administradores: ${errorMessage}. Verifique o console para mais detalhes.`);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateAdmin = async () => {
    if (!newAdmin.email || !newAdmin.password || !newAdmin.full_name) {
      setError('Email, senha e nome são obrigatórios');
      return;
    }

    try {
      setError(null);

      // Obter sessão atual
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      // Criar administrador via Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: newAdmin.email,
            password: newAdmin.password,
            full_name: newAdmin.full_name,
            phone: newAdmin.phone || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar administrador');
      }

      // Sucesso!
      console.log('Admin criado com sucesso:', result.user_id);

      // Fechar modal e limpar formulário
      setShowAddModal(false);
      setNewAdmin({ email: '', password: '', full_name: '', phone: '' });

      // Recarregar lista de administradores
      await fetchAdmins();

    } catch (err: any) {
      console.error('Error creating admin:', err);
      if (err.message?.includes('já está cadastrado') || err.message?.includes('already registered') || err.message?.includes('duplicate')) {
        setError('Este email já está cadastrado.');
      } else if (err.message?.includes('Acesso negado')) {
        setError('Acesso negado. Apenas administradores podem criar outros administradores.');
      } else {
        setError(err.message || 'Erro ao criar administrador. Verifique os dados e tente novamente.');
      }
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!confirm('Tem certeza que deseja remover este administrador?')) {
      return;
    }

    // Não permitir deletar a si mesmo
    if (adminId === user?.id) {
      setError('Você não pode remover seu próprio acesso.');
      return;
    }

    try {
      setError(null);

      // Validar via RPC
      const { error: validateError } = await supabase
        .rpc('remove_admin_role', {
          p_user_id: adminId
        });

      if (validateError) {
        console.warn('RPC validation failed');
      }

      // Nota: A remoção real deve ser feita via Supabase Dashboard ou API server-side
      setError('Para remover um administrador, use o Supabase Dashboard ou execute SQL manualmente para atualizar o user_metadata.');
      
      // TODO: Implementar remoção via API server-side quando disponível
      
    } catch (err) {
      console.error('Error removing admin:', err);
      setError('Erro ao remover administrador. Use o Supabase Dashboard para remover o role admin.');
    }
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center">
            <Settings className="h-6 w-6 mr-2" />
            Configurações
          </h2>
          <p className="text-slate-400 text-sm">Gerencie administradores do sistema</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Novo Administrador
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Administradores Ativos
          </h3>
        </div>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-400">Carregando...</p>
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">Nenhum administrador cadastrado</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Telefone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Data de Cadastro</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-200">
                    {admin.full_name || '-'}
                    {admin.id === user?.id && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-blue-900/30 text-blue-300 rounded">
                        Você
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">{admin.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">{admin.phone ? formatPhone(admin.phone) : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {new Date(admin.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {admin.id !== user?.id && (
                      <button
                        onClick={() => handleDeleteAdmin(admin.id)}
                        className="text-red-400 hover:text-red-300"
                        title="Remover administrador"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Adicionar Administrador */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-semibold text-slate-100 mb-4">
              Novo Administrador
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={newAdmin.full_name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, full_name: e.target.value })}
                  placeholder="Ex: João Silva"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  placeholder="Ex: admin@uniflix.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Senha *</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Telefone</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={newAdmin.phone}
                  onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                  placeholder="Ex: (47) 99999-9999"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewAdmin({ email: '', password: '', full_name: '', phone: '' });
                  setError(null);
                }}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateAdmin}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Criar Administrador
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

