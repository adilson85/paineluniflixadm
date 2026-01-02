import React, { useEffect, useState, useMemo } from 'react';
import { Search, Filter, CreditCard, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import type { CompraCredito, CreditoMensal } from '../types';
import { formatDateBR } from '../utils/dateUtils';

export default function CreditosComprados() {
  const [compras, setCompras] = useState<CompraCredito[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [painelFilter, setPainelFilter] = useState('');
  const [mesFilter, setMesFilter] = useState('');
  const [paineis, setPaineis] = useState<string[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
  const [resumoMensal, setResumoMensal] = useState<CreditoMensal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [availablePanels, setAvailablePanels] = useState<Array<{ name: string; display_name: string }>>([]);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    painel: '',
    quantidade_creditos: 0,
    valor_total: 0,
  });

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    fetchCompras();
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

  async function fetchCompras() {
    try {
      setError(null);
      const { data, error: supabaseError } = await supabase
        .from('compras_creditos')
        .select('*')
        .order('data', { ascending: false });

      if (supabaseError) throw supabaseError;

      setCompras(data || []);

      const uniquePaineis = [...new Set(data?.map((c: any) => c.painel) || [])];
      setPaineis(uniquePaineis);

      const uniqueMeses = [...new Set((data || []).map((c: any) => {
        // Extrai apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
        const dateOnly = c.data.split('T')[0];
        const [year, month] = dateOnly.split('-');
        return `${year}-${month}`;
      }))];
      setMeses(uniqueMeses.sort().reverse());

      calculateResumoMensal(data || []);
    } catch (err) {
      console.error('Error fetching compras:', err);
      setError('Erro ao carregar os dados. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const calculateResumoMensal = (data: CompraCredito[]) => {
    const monthMap = new Map<string, CreditoMensal>();

    data.forEach((compra: any) => {
      // Extrai apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
      const dateOnly = compra.data.split('T')[0];
      const [year, month] = dateOnly.split('-');
      const monthKey = `${year}-${month}`;

      const current = monthMap.get(monthKey) || {
        mes: monthKey,
        total_creditos: 0,
        valor_total: 0,
        custo_medio: 0,
        paineis: [] as any[],
      };

      current.total_creditos += compra.quantidade_creditos;
      current.valor_total += compra.valor_total;
      current.custo_medio = current.valor_total / current.total_creditos;

      const painelIdx = current.paineis.findIndex((p: any) => p.painel === compra.painel);
      if (painelIdx === -1) {
        current.paineis.push({
          painel: compra.painel,
          creditos: compra.quantidade_creditos,
          valor_total: compra.valor_total,
          custo_medio: compra.valor_total / compra.quantidade_creditos,
        });
      } else {
        const painel = current.paineis[painelIdx];
        painel.creditos += compra.quantidade_creditos;
        painel.valor_total += compra.valor_total;
        painel.custo_medio = painel.valor_total / painel.creditos;
      }

      monthMap.set(monthKey, current);
    });

    const sortedMonths = Array.from(monthMap.values())
      .sort((a, b) => b.mes.localeCompare(a.mes))
      .slice(0, 3);

    setResumoMensal(sortedMonths);
  };

  const filteredCompras = useMemo(() => {
    return compras.filter(compra => {
    const matchesPainel = !painelFilter || compra.painel === painelFilter;
    // Extrai apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
    const dateOnly = compra.data.split('T')[0];
    const [year, month] = dateOnly.split('-');
    const monthKey = `${year}-${month}`;
    const matchesMes = !mesFilter || monthKey === mesFilter;
    return matchesPainel && matchesMes;
  });
  }, [compras, painelFilter, mesFilter]);

  // Cálculos de paginação
  const totalPages = Math.ceil(filteredCompras.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCompras = filteredCompras.slice(startIndex, endIndex);

  // Reset página ao mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [painelFilter, mesFilter]);

  // Resumo por painel (baseado no filtro de mês selecionado ou todos)
  const resumoPorPainel = useMemo(() => {
    const dataToAnalyze = mesFilter ? filteredCompras : compras;
    const painelMap = new Map<string, { painel: string; total_creditos: number; quantidade_compras: number; valor_total: number }>();

    dataToAnalyze.forEach(compra => {
      const painelName = compra.painel || 'Sem Painel';
      // Normalizar nome do painel (lowercase) para agrupar corretamente
      const normalizedName = painelName.trim().toLowerCase();

      const current = painelMap.get(normalizedName) || {
        painel: painelName.trim(), // Mantém o nome original (primeira ocorrência)
        total_creditos: 0,
        quantidade_compras: 0,
        valor_total: 0
      };

      current.total_creditos += compra.quantidade_creditos;
      current.quantidade_compras += 1;
      current.valor_total += compra.valor_total;
      painelMap.set(normalizedName, current);
    });

    return Array.from(painelMap.values()).sort((a, b) => b.total_creditos - a.total_creditos);
  }, [compras, filteredCompras, mesFilter]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (dateString: string) => formatDateBR(dateString);
  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.painel || formData.quantidade_creditos <= 0 || formData.valor_total <= 0) {
      setError('Preencha todos os campos obrigatórios com valores válidos');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Registrar compra de créditos
      const { error: compraError } = await supabase
        .from('compras_creditos')
        .insert([{
          data: formData.data,
          painel: formData.painel,
          quantidade_creditos: formData.quantidade_creditos,
          valor_total: formData.valor_total,
        }]);

      if (compraError) throw compraError;

      // Registrar saída no caixa
      const { error: caixaError } = await supabase
        .from('caixa_movimentacoes')
        .insert({
          data: formData.data,
          historico: `Compra de créditos - ${formData.painel} (${formData.quantidade_creditos} créditos)`,
          entrada: 0,
          saida: formData.valor_total,
        });

      if (caixaError) throw caixaError;

      // Limpar formulário e fechar modal
      setFormData({
        data: new Date().toISOString().split('T')[0],
        painel: '',
        quantidade_creditos: 0,
        valor_total: 0,
      });
      setShowForm(false);
      
      // Recarregar dados
      await fetchCompras();
    } catch (err) {
      console.error('Error saving compra:', err);
      setError('Erro ao salvar a compra. Por favor, tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center">
          <CreditCard className="h-6 w-6 mr-2" />
          Créditos Comprados
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Compra
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
                <p className="text-sm text-slate-400">Valor Total</p>
                <p className="text-lg font-medium text-slate-100">{formatCurrency(mes.valor_total)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Custo Médio</p>
                <p className="text-lg font-medium text-slate-100">{formatCurrency(mes.custo_medio)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Resumo por Painel */}
      {resumoPorPainel.length > 0 && (
        <div className="bg-slate-800 rounded-lg shadow p-6 border border-slate-700 mb-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            Créditos por Painel {mesFilter ? `(${formatMonth(mesFilter)})` : '(Total Geral)'}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {resumoPorPainel.map((painel, index) => {
              // Calcular porcentagem do total
              const totalGeral = resumoPorPainel.reduce((acc, p) => acc + p.total_creditos, 0);
              const percentual = totalGeral > 0 ? ((painel.total_creditos / totalGeral) * 100).toFixed(1) : '0';

              // Cores diferentes para destacar os top 3
              const bgColors = [
                'bg-gradient-to-br from-amber-600/20 to-amber-700/10 border-amber-600/50', // 1º lugar
                'bg-gradient-to-br from-slate-500/20 to-slate-600/10 border-slate-500/50', // 2º lugar
                'bg-gradient-to-br from-orange-700/20 to-orange-800/10 border-orange-700/50', // 3º lugar
              ];
              const bgColor = index < 3 ? bgColors[index] : 'bg-slate-900/50 border-slate-700';

              return (
                <div
                  key={painel.painel}
                  className={`rounded-lg p-4 border ${bgColor} transition-all hover:scale-105`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-300">{painel.painel}</span>
                    {index < 3 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                        #{index + 1}
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-slate-100">{painel.total_creditos}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400">{painel.quantidade_compras} compras</span>
                    <span className="text-xs font-medium text-blue-400">{percentual}%</span>
                  </div>
                  {/* Barra de progresso visual */}
                  <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-6 space-y-4 md:space-y-0 md:flex md:items-center md:space-x-4">
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
          <Filter className="h-5 w-5 text-slate-400" />
          <select
            className="border border-slate-700 bg-slate-900 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={mesFilter}
            onChange={(e) => setMesFilter(e.target.value)}
          >
            <option value="">Todos os Meses</option>
            {meses.map(mes => (
              <option key={mes} value={mes}>{formatMonth(mes)}</option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por painel..."
            className="pl-10 pr-4 py-2 rounded-lg w-full bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            value={painelFilter}
            onChange={(e) => setPainelFilter(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">{error}</div>
      )}

      {/* Tabela de compras */}
      <div className="bg-slate-800 rounded-lg shadow overflow-x-auto border border-slate-700">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Painel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Créditos</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Valor Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Custo Médio</th>
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
            ) : paginatedCompras.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-slate-300">Nenhuma compra encontrada</td>
              </tr>
            ) : (
              paginatedCompras.map((compra) => (
                <tr key={compra.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">{formatDate(compra.data)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{compra.painel}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{compra.quantidade_creditos}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{formatCurrency(compra.valor_total)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{formatCurrency(compra.valor_total / compra.quantidade_creditos)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {!loading && filteredCompras.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>
              Mostrando {startIndex + 1}-{Math.min(endIndex, filteredCompras.length)} de {filteredCompras.length} registros
            </span>
            <div className="flex items-center gap-2">
              <span>Por página:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ««
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1">
              {(() => {
                const pages = [];
                const maxVisiblePages = 5;
                let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

                if (endPage - startPage + 1 < maxVisiblePages) {
                  startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }

                if (startPage > 1) {
                  pages.push(
                    <button key={1} onClick={() => setCurrentPage(1)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors">1</button>
                  );
                  if (startPage > 2) pages.push(<span key="e1" className="px-2 text-slate-500">...</span>);
                }

                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${currentPage === i ? 'bg-blue-600 text-white border border-blue-600' : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {i}
                    </button>
                  );
                }

                if (endPage < totalPages) {
                  if (endPage < totalPages - 1) pages.push(<span key="e2" className="px-2 text-slate-500">...</span>);
                  pages.push(
                    <button key={totalPages} onClick={() => setCurrentPage(totalPages)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors">{totalPages}</button>
                  );
                }
                return pages;
              })()}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              »»
            </button>
          </div>
        </div>
      )}

      {/* Modal de Nova Compra */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-slate-100 flex items-center">
                  <Plus className="h-5 w-5 mr-2 text-blue-400" />
                  Nova Compra de Créditos
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setError(null);
                  }}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Data da Compra
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    disabled={isSaving}
                    className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Painel *
                  </label>
                  <select
                    required
                    value={formData.painel}
                    onChange={(e) => setFormData({ ...formData, painel: e.target.value })}
                    disabled={isSaving}
                    className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Selecione um painel</option>
                    {availablePanels.map((panel) => (
                      <option key={panel.name} value={panel.name}>
                        {panel.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Quantidade de Créditos *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    value={formData.quantidade_creditos || ''}
                    onChange={(e) => setFormData({ ...formData, quantidade_creditos: parseInt(e.target.value) || 0 })}
                    disabled={isSaving}
                    className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Ex: 100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Valor Total (R$) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={formData.valor_total || ''}
                    onChange={(e) => setFormData({ ...formData, valor_total: parseFloat(e.target.value) || 0 })}
                    disabled={isSaving}
                    className="w-full px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Ex: 500.00"
                  />
                  {formData.quantidade_creditos > 0 && formData.valor_total > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Custo médio por crédito: {formatCurrency(formData.valor_total / formData.quantidade_creditos)}
                    </p>
                  )}
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setError(null);
                    }}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Compra'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

