import React, { useEffect, useState } from 'react';
import { Search, Filter, CalendarDays, Plus, X } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import type { TesteLiberado } from '../types';

export default function TestesLiberados() {
  const [testes, setTestes] = useState<TesteLiberado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [painelFilter, setPainelFilter] = useState('');
  const [mesFilter, setMesFilter] = useState('');
  const [paineis, setPaineis] = useState<string[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
  const [showNovoTesteModal, setShowNovoTesteModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [novoTesteForm, setNovoTesteForm] = useState({
    nome: '',
    telefone: '',
    email: '',
    usuario1: '',
    senha1: '',
    painel1: '',
    data_teste: new Date().toISOString().split('T')[0],
    aplicativo: '',
    quantidade_teste: 1,
  });

  useEffect(() => {
    fetchTestes();
  }, []);

  async function fetchTestes() {
    try {
      setError(null);
      const { data, error: supabaseError } = await supabase
        .from('testes_liberados')
        .select('*')
        .order('data_teste', { ascending: false });

      if (supabaseError) throw supabaseError;

      setTestes(data || []);
      
      // Extract unique paineis and meses for filters
      const uniquePaineis = [...new Set(data?.map(t => t.painel1) || [])];
      setPaineis(uniquePaineis);

      const uniqueMeses = [...new Set(data?.map(t => {
        const date = new Date(t.data_teste);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }) || [])];
      setMeses(uniqueMeses.sort().reverse());

    } catch (err) {
      console.error('Error fetching testes:', err);
      setError('Erro ao carregar os dados. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const filteredTestes = testes.filter(teste => {
    const matchesSearch = 
      teste.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (teste.telefone && teste.telefone.includes(searchTerm));
    
    const matchesPainel = !painelFilter || teste.painel1 === painelFilter;
    
    const date = new Date(teste.data_teste);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const matchesMes = !mesFilter || monthKey === mesFilter;

    return matchesSearch && matchesPainel && matchesMes;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center">
            <CalendarDays className="h-6 w-6 mr-2" />
            Testes Liberados
          </h1>
        </div>
        <button
          onClick={() => setShowNovoTesteModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Teste
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4 md:space-y-0 md:flex md:items-center md:space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            className="pl-10 pr-4 py-2 rounded-lg w-full bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-slate-400" />
          <select
            className="border border-slate-700 bg-slate-900 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={painelFilter}
            onChange={(e) => setPainelFilter(e.target.value)}
          >
            <option value="">Todos os Painéis</option>
            {paineis.map(painel => (
              <option key={painel} value={painel}>{painel}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <CalendarDays className="h-5 w-5 text-slate-400" />
          <select
            className="border border-slate-700 bg-slate-900 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={mesFilter}
            onChange={(e) => setMesFilter(e.target.value)}
          >
            <option value="">Todos os Meses</option>
            {meses.map(mes => (
              <option key={mes} value={mes}>
                {formatMonth(mes)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Telefone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuário
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Senha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Painel
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data Teste
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aplicativo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assinante
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Valor Pago
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Qtd. Teste
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Carregando...</span>
                  </div>
                </td>
              </tr>
            ) : filteredTestes.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-4 text-center">
                  Nenhum teste encontrado
                </td>
              </tr>
            ) : (
              filteredTestes.map((teste) => (
                <tr key={teste.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {teste.nome}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {teste.telefone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {teste.usuario1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {teste.senha1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {teste.painel1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(teste.data_teste)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {teste.aplicativo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      teste.assinante ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-slate-100'
                    }`}>
                      {teste.assinante ? 'Sim' : 'Não'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(teste.valor_pago)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {teste.quantidade_teste}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Novo Teste */}
      {showNovoTesteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-700 sticky top-0 bg-slate-800">
              <h3 className="text-xl font-bold text-slate-100">Novo Teste</h3>
              <button
                onClick={() => {
                  setShowNovoTesteModal(false);
                  setNovoTesteForm({
                    nome: '',
                    telefone: '',
                    email: '',
                    usuario1: '',
                    senha1: '',
                    painel1: '',
                    data_teste: new Date().toISOString().split('T')[0],
                    aplicativo: '',
                    quantidade_teste: 1,
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
                  const { error: insertError } = await supabase
                    .from('testes_liberados')
                    .insert([
                      {
                        nome: novoTesteForm.nome,
                        telefone: novoTesteForm.telefone || null,
                        email: novoTesteForm.email || null,
                        usuario1: novoTesteForm.usuario1 || null,
                        senha1: novoTesteForm.senha1 || null,
                        painel1: novoTesteForm.painel1 || null,
                        data_teste: novoTesteForm.data_teste,
                        aplicativo: novoTesteForm.aplicativo || null,
                        quantidade_teste: novoTesteForm.quantidade_teste || 1,
                        assinante: false,
                        valor_pago: 0,
                      },
                    ]);

                  if (insertError) throw insertError;

                  // Recarregar lista de testes
                  await fetchTestes();
                  
                  // Fechar modal e limpar formulário
                  setShowNovoTesteModal(false);
                  setNovoTesteForm({
                    nome: '',
                    telefone: '',
                    email: '',
                    usuario1: '',
                    senha1: '',
                    painel1: '',
                    data_teste: new Date().toISOString().split('T')[0],
                    aplicativo: '',
                    quantidade_teste: 1,
                  });
                } catch (err) {
                  console.error('Erro ao criar teste:', err);
                  setError('Erro ao criar teste. Por favor, tente novamente.');
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
                  value={novoTesteForm.nome}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, nome: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Digite o nome completo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={novoTesteForm.telefone}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, telefone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={novoTesteForm.email}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Usuário
                </label>
                <input
                  type="text"
                  value={novoTesteForm.usuario1}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, usuario1: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Usuário do teste"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Senha
                </label>
                <input
                  type="text"
                  value={novoTesteForm.senha1}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, senha1: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Senha do teste"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Painel
                </label>
                <input
                  type="text"
                  value={novoTesteForm.painel1}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, painel1: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Nome do painel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Data do Teste *
                </label>
                <input
                  type="date"
                  required
                  value={novoTesteForm.data_teste}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, data_teste: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Aplicativo
                </label>
                <input
                  type="text"
                  value={novoTesteForm.aplicativo}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, aplicativo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Nome do aplicativo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Quantidade de Testes
                </label>
                <input
                  type="number"
                  min="1"
                  value={novoTesteForm.quantidade_teste}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, quantidade_teste: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNovoTesteModal(false);
                    setNovoTesteForm({
                      nome: '',
                      telefone: '',
                      email: '',
                      usuario1: '',
                      senha1: '',
                      painel1: '',
                      data_teste: new Date().toISOString().split('T')[0],
                      aplicativo: '',
                      quantidade_teste: 1,
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

