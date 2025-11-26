import { useEffect, useState } from 'react';
import { Wallet, Search, CalendarDays, CreditCard as Edit2, X, Check } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import type { CaixaMovimentacao, MonthSummary } from '../types';
import { formatDateBR } from '../utils/dateUtils';

interface EditingTransaction {
  id: number;
  historico: string;
  entrada: number | null;
  saida: number | null;
}

type PeriodFilter = 'today' | 'yesterday' | 'last_5_days' | 'last_7_days' | 'current_month' | 'last_month' | 'custom' | 'all';

export default function Caixa() {
  const [movimentacoes, setMovimentacoes] = useState<CaixaMovimentacao[]>([]);
  const [monthSummaries, setMonthSummaries] = useState<MonthSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('current_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<EditingTransaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMovimentacoes();
  }, []);

  async function fetchMovimentacoes() {
    try {
      setError(null);
      const { data, error: supabaseError } = await supabase
        .from('caixa_movimentacoes')
        .select('*')
        .order('data', { ascending: false });

      if (supabaseError) throw supabaseError;

      setMovimentacoes(data || []);
      calculateMonthSummaries(data || []);
    } catch (err) {
      console.error('Error fetching movimentacoes:', err);
      setError('Erro ao carregar os dados financeiros. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const calculateMonthSummaries = (data: CaixaMovimentacao[]) => {
    // Calcula saldo do dia atual - usa timezone do Brasil
    const today = new Date();
    const todayKey = today.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).split('/').reverse().join('-'); // Converte DD/MM/YYYY para YYYY-MM-DD

    let todayEntrada = 0;
    let todaySaida = 0;

    data.forEach(mov => {
      // Extrai apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
      const dateKey = mov.data.split('T')[0];

      if (dateKey === todayKey) {
        todayEntrada += mov.entrada || 0;
        todaySaida += mov.saida || 0;
      }
    });

    const todaySummary: MonthSummary = {
      month: 'today',
      totalEntrada: todayEntrada,
      totalSaida: todaySaida,
      saldo: todayEntrada - todaySaida
    };

    // Calcula saldo dos últimos 2 meses (para ter 3 cards no total)
    const summariesMap = new Map<string, MonthSummary>();
    data.forEach(mov => {
      // Extrai apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
      const dateOnly = mov.data.split('T')[0];
      const [year, month] = dateOnly.split('-');
      const monthKey = `${year}-${month}`;
      const current = summariesMap.get(monthKey) || { month: monthKey, totalEntrada: 0, totalSaida: 0, saldo: 0 } as MonthSummary;
      current.totalEntrada += mov.entrada || 0;
      current.totalSaida += mov.saida || 0;
      current.saldo = current.totalEntrada - current.totalSaida;
      summariesMap.set(monthKey, current);
    });

    const sortedMonthSummaries = Array.from(summariesMap.values()).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 2);

    // Combina: Hoje + 2 últimos meses
    setMonthSummaries([todaySummary, ...sortedMonthSummaries]);
  };

  const startEditing = (transaction: CaixaMovimentacao) => {
    setEditingTransaction({ id: transaction.id, historico: transaction.historico || '', entrada: transaction.entrada, saida: transaction.saida });
  };

  const cancelEditing = () => setEditingTransaction(null);

  const saveTransaction = async () => {
    if (!editingTransaction || isSaving) return;
    try {
      setIsSaving(true);
      setError(null);
      const updateData = { historico: editingTransaction.historico, entrada: editingTransaction.entrada, saida: editingTransaction.saida };
      const { error } = await supabase.from('caixa_movimentacoes').update(updateData).eq('id', editingTransaction.id);
      if (error) throw error;
      await fetchMovimentacoes();
      setEditingTransaction(null);
    } catch (err) {
      console.error(err);
      setError('Não foi possível salvar a movimentação.');
    } finally {
      setIsSaving(false);
    }
  };

  const getDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start: Date | null = null;
    let end: Date | null = null;

    switch (periodFilter) {
      case 'today':
        start = new Date(today);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;

      case 'yesterday':
        start = new Date(today);
        start.setDate(start.getDate() - 1);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
        break;

      case 'last_5_days':
        start = new Date(today);
        start.setDate(start.getDate() - 4);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;

      case 'last_7_days':
        start = new Date(today);
        start.setDate(start.getDate() - 6);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;

      case 'current_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;

      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        break;

      case 'custom':
        if (startDate) start = new Date(startDate);
        if (endDate) {
          end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
        }
        break;

      case 'all':
      default:
        // Sem filtro de data
        break;
    }

    return { start, end };
  };

  const filteredMovimentacoes = movimentacoes.filter(mov => {
    const matchesSearch = mov.historico?.toLowerCase().includes(searchTerm.toLowerCase()) || false;

    // Filtro de período
    const { start, end } = getDateRange();
    let matchesPeriod = true;

    if (start && end) {
      // Extrai apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
      const dateOnly = mov.data.split('T')[0];
      const [year, month, day] = dateOnly.split('-').map(Number);
      const movDate = new Date(year, month - 1, day);
      matchesPeriod = movDate >= start && movDate <= end;
    }

    return matchesSearch && matchesPeriod;
  });

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const formatMonth = (monthKey: string) => {
    if (monthKey === 'today') {
      return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    }
    const [year, month] = monthKey.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center">
          <Wallet className="h-6 w-6 mr-2" />
          Caixa
        </h1>
      </div>

      {/* Cards de resumo (últimos 3 meses) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {monthSummaries.map((summary) => (
          <div key={summary.month} className="bg-slate-800 rounded-lg shadow p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">{formatMonth(summary.month)}</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-400">Entrada</p>
                <p className="text-lg font-medium text-blue-400">{formatCurrency(summary.totalEntrada)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Saída</p>
                <p className="text-lg font-medium text-red-400">{formatCurrency(summary.totalSaida)}</p>
              </div>
              <div className="pt-2 border-t border-slate-700">
                <p className="text-sm text-slate-400">Saldo</p>
                <p className="text-lg font-bold text-slate-100 bg-slate-900 p-2 rounded border border-slate-700">{formatCurrency(summary.saldo)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-6 space-y-4">
        <div className="md:flex md:items-center md:space-x-4">
          <div className="relative flex-1 mb-4 md:mb-0">
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
            <CalendarDays className="h-5 w-5 text-slate-400" />
            <select
              className="border border-slate-700 bg-slate-900 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
            >
              <option value="today">Hoje</option>
              <option value="yesterday">Ontem</option>
              <option value="last_5_days">Últimos 5 dias</option>
              <option value="last_7_days">Últimos 7 dias</option>
              <option value="current_month">Mês atual</option>
              <option value="last_month">Mês passado</option>
              <option value="custom">Período customizado</option>
              <option value="all">Todos os períodos</option>
            </select>
          </div>
        </div>

        {/* Campos de data customizada */}
        {periodFilter === 'custom' && (
          <div className="flex items-center space-x-4 bg-slate-900 border border-slate-700 rounded-lg p-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Data inicial
              </label>
              <input
                type="date"
                className="w-full border border-slate-700 bg-slate-800 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Data final
              </label>
              <input
                type="date"
                className="w-full border border-slate-700 bg-slate-800 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">{error}</div>
      )}

      {/* Tabela de movimentações */}
      <div className="bg-slate-800 rounded-lg shadow overflow-x-auto border border-slate-700">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Histórico</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Entrada</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Saída</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-slate-300">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Carregando...</span>
                  </div>
                </td>
              </tr>
            ) : filteredMovimentacoes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-slate-300">Nenhuma movimentação encontrada</td>
              </tr>
            ) : (
              filteredMovimentacoes.map((mov) => (
                <tr key={mov.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-100">{formatDateBR(mov.data)}</td>
                  <td className="px-6 py-4 text-slate-300">
                    {editingTransaction?.id === mov.id ? (
                      <input
                        type="text"
                        value={editingTransaction.historico}
                        onChange={(e) => setEditingTransaction({ ...editingTransaction, historico: e.target.value })}
                        className="w-full border border-slate-700 bg-slate-900 text-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-600"
                        disabled={isSaving}
                      />
                    ) : (
                      mov.historico
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-blue-400">
                    {editingTransaction?.id === mov.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editingTransaction.entrada ?? ''}
                        onChange={(e) => setEditingTransaction({ ...editingTransaction, entrada: e.target.value ? Number(e.target.value) : null })}
                        className="w-32 border border-slate-700 bg-slate-900 text-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-600"
                        disabled={isSaving}
                      />
                    ) : (
                      mov.entrada ? formatCurrency(mov.entrada) : '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-red-400">
                    {editingTransaction?.id === mov.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editingTransaction.saida ?? ''}
                        onChange={(e) => setEditingTransaction({ ...editingTransaction, saida: e.target.value ? Number(e.target.value) : null })}
                        className="w-32 border border-slate-700 bg-slate-900 text-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-600"
                        disabled={isSaving}
                      />
                    ) : (
                      mov.saida ? formatCurrency(mov.saida) : '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingTransaction?.id === mov.id ? (
                      <div className="flex space-x-2">
                        <button onClick={saveTransaction} disabled={isSaving} className={`text-green-400 hover:text-green-300 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          {isSaving ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-400"></div>
                          ) : (
                            <Check className="h-5 w-5" />
                          )}
                        </button>
                        <button onClick={cancelEditing} disabled={isSaving} className="text-red-400 hover:text-red-300">
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEditing(mov)} className="text-blue-400 hover:text-blue-300">
                        <Edit2 className="h-5 w-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

