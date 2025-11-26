import React, { useEffect, useState } from 'react';
import { Search, Filter, CalendarDays, Plus } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import type { CreditoVendido } from '../types';
import { formatDateBR } from '../utils/dateUtils';

export default function CreditosVendidos() {
  const [creditos, setCreditos] = useState<CreditoVendido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mesFilter, setMesFilter] = useState('');
  const [meses, setMeses] = useState<string[]>([]);
  const [resumoMensal, setResumoMensal] = useState<Array<{
    mes: string;
    total_creditos: number;
    quantidade_vendas: number;
    media_creditos: number;
  }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [availablePanels, setAvailablePanels] = useState<Array<{ name: string; display_name: string }>>([]);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    historico: '',
    painel: '',
    quantidade_creditos: 0
  });

  useEffect(() => {
    fetchCreditos();
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

  async function fetchCreditos() {
    try {
      setError(null);
      const { data, error: supabaseError } = await supabase
        .from('creditos_vendidos')
        .select('*')
        .order('data', { ascending: false });

      if (supabaseError) throw supabaseError;

      setCreditos(data || []);

      const uniqueMeses = [...new Set((data || []).map(c => {
        // Extrai apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
        const dateOnly = c.data.split('T')[0];
        const [year, month] = dateOnly.split('-');
        return `${year}-${month}`;
      }))];
      setMeses(uniqueMeses.sort().reverse());

      calculateResumoMensal(data || []);

    } catch (err) {
      console.error('Error fetching creditos:', err);
      setError('Erro ao carregar os dados. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('creditos_vendidos')
        .insert([formData]);

      if (error) throw error;

      setShowForm(false);
      setFormData({
        data: new Date().toISOString().split('T')[0],
        historico: '',
        painel: '',
        quantidade_creditos: 0
      });
      fetchCreditos();
    } catch (err) {
      console.error('Error saving credito:', err);
      setError('Erro ao salvar os dados. Por favor, tente novamente.');
    }
  };

  const filteredCreditos = creditos.filter(credito => {
    const matchesSearch = credito.historico.toLowerCase().includes(searchTerm.toLowerCase());
    // Extrai apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
    const dateOnly = credito.data.split('T')[0];
    const [year, month] = dateOnly.split('-');
    const monthKey = `${year}-${month}`;
    const matchesMes = !mesFilter || monthKey === mesFilter;
    return matchesSearch && matchesMes;
  });

  const calculateResumoMensal = (data: CreditoVendido[]) => {
    const monthMap = new Map<string, {
      mes: string;
      total_creditos: number;
      quantidade_vendas: number;
      media_creditos: number;
    }>();

    data.forEach((credito: any) => {
      // Extrai apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
      const dateOnly = credito.data.split('T')[0];
      const [year, month] = dateOnly.split('-');
      const monthKey = `${year}-${month}`;

      const current = monthMap.get(monthKey) || {
        mes: monthKey,
        total_creditos: 0,
        quantidade_vendas: 0,
        media_creditos: 0,
      };

      current.total_creditos += credito.quantidade_creditos;
      current.quantidade_vendas += 1;
      current.media_creditos = current.total_creditos / current.quantidade_vendas;

      monthMap.set(monthKey, current);
    });

    const sortedMonths = Array.from(monthMap.values())
      .sort((a, b) => b.mes.localeCompare(a.mes))
      .slice(0, 3);

    setResumoMensal(sortedMonths);
  };

  const formatDate = (dateString: string) => formatDateBR(dateString);
  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center">
          <CalendarDays className="h-6 w-6 mr-2" />
          Créditos Vendidos
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Registro
        </button>
      </div>

      {/* Resumo mensal (últimos 3 meses) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {resumoMensal.map((mes) => (
          <div key={mes.mes} className="bg-slate-800 rounded-lg shadow p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">{formatMonth(mes.mes)}</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-400">Total de Créditos</p>
                <p className="text-lg font-medium text-slate-100">{mes.total_creditos}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Quantidade de Vendas</p>
                <p className="text-lg font-medium text-slate-100">{mes.quantidade_vendas}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Média por Venda</p>
                <p className="text-lg font-medium text-slate-100">{Math.round(mes.media_creditos)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="bg-slate-800 rounded-lg shadow p-6 mb-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Novo Registro de Créditos Vendidos</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300">Data</label>
              <input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                className="mt-1 block w-full rounded-md border-slate-700 bg-slate-900 text-slate-200 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Histórico</label>
              <input
                type="text"
                value={formData.historico}
                onChange={(e) => setFormData({ ...formData, historico: e.target.value })}
                className="mt-1 block w-full rounded-md border-slate-700 bg-slate-900 text-slate-200 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Painel</label>
              <select
                value={formData.painel}
                onChange={(e) => setFormData({ ...formData, painel: e.target.value })}
                className="mt-1 block w-full rounded-md border-slate-700 bg-slate-900 text-slate-200 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                required
              >
                <option value="">Selecione um painel</option>
                {availablePanels.map(panel => (
                  <option key={panel.name} value={panel.name}>
                    {panel.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Quantidade de Créditos</label>
              <input
                type="number"
                value={formData.quantidade_creditos}
                onChange={(e) => setFormData({ ...formData, quantidade_creditos: parseInt(e.target.value) })}
                className="mt-1 block w-full rounded-md border-slate-700 bg-slate-900 text-slate-200 shadow-sm focus:border-blue-600 focus:ring-blue-600"
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-200 bg-slate-700 rounded-md hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-6 space-y-4 md:space-y-0 md:flex md:items-center md:space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por histórico..."
            className="pl-10 pr-4 py-2 rounded-lg w-full bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-slate-400" />
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

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="bg-slate-800 rounded-lg shadow overflow-x-auto border border-slate-700">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Histórico</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Painel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Quantidade de Créditos</th>
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-slate-300">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Carregando...</span>
                  </div>
                </td>
              </tr>
            ) : filteredCreditos.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-slate-300">Nenhum registro encontrado</td>
              </tr>
            ) : (
              filteredCreditos.map((credito) => (
                <tr key={credito.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">{formatDate(credito.data)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{credito.historico}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{credito.painel || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{credito.quantidade_creditos}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

