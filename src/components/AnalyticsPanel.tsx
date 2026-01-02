import React, { useEffect, useState } from 'react';
import { Client } from '../types';
import { supabase } from '../lib/supabase';

interface PanelSummary {
  panelName: string;
  activeLogins: number;
  totalClients: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  expiredClients: number;
  expirationRate: number;
  creditosVendidos: number;
  creditosComprados: number;
}

interface AnalyticsPanelProps {
  clients: Client[];
  periodFilter: 'current_month' | 'last_month' | 'custom';
  startDate: string;
  endDate: string;
}

interface CreditoCusto {
  painel: string;
  custo_medio: number;
}

export default function AnalyticsPanel({ clients, periodFilter, startDate, endDate }: AnalyticsPanelProps) {
  const [creditoCustos, setCreditoCustos] = useState<Map<string, number>>(new Map());
  const [entradasPorPainel, setEntradasPorPainel] = useState<Map<string, number>>(new Map());
  const [creditosVendidosPorPainel, setCreditosVendidosPorPainel] = useState<Map<string, number>>(new Map());
  const [creditosCompradosPorPainel, setCreditosCompradosPorPainel] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    fetchCreditoCustos();
    fetchEntradasPorPainel();
    fetchCreditosPorPainel();
  }, [clients, periodFilter, startDate, endDate]);

  async function fetchCreditoCustos() {
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const { data, error } = await supabase
        .from('compras_creditos')
        .select('painel, quantidade_creditos, valor_total')
        .gte('data', threeMonthsAgo.toISOString());

      if (error) throw error;

      const custosPorPainel = new Map<string, any>();
      
      (data || []).forEach((compra: any) => {
        if (!compra.painel) return;
        
        // Normalizar nome do painel para agrupar corretamente
        const normalizedName = compra.painel.trim().toLowerCase();
        const current = custosPorPainel.get(normalizedName) || {
          painel: normalizedName,
          total_creditos: 0,
          valor_total: 0,
          custo_medio: 0
        };

        current.total_creditos += compra.quantidade_creditos;
        current.valor_total += compra.valor_total;
        current.custo_medio = current.valor_total / current.total_creditos;

        custosPorPainel.set(normalizedName, current);
      });

      const custoMedioPorPainel = new Map<string, number>();
      custosPorPainel.forEach((value: any, key: string) => {
        custoMedioPorPainel.set(key, value.custo_medio);
      });

      setCreditoCustos(custoMedioPorPainel);
    } catch (err) {
      console.error('Error fetching credit costs:', err);
    }
  }

  // Função helper para obter range de datas baseado no filtro
  const getDateRange = (): { startDate: Date; endDate: Date } => {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (periodFilter === 'current_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (periodFilter === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else {
      // custom
      if (startDate && endDate) {
        const [yearStart, monthStart, dayStart] = startDate.split('-').map(Number);
        const [yearEnd, monthEnd, dayEnd] = endDate.split('-').map(Number);
        start = new Date(yearStart, monthStart - 1, dayStart, 0, 0, 0);
        end = new Date(yearEnd, monthEnd - 1, dayEnd, 23, 59, 59);
      } else {
        // Fallback para mês atual
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }
    }

    return { startDate: start, endDate: end };
  };

  async function fetchCreditosPorPainel() {
    try {
      const { startDate: dateStart, endDate: dateEnd } = getDateRange();

      // Buscar créditos vendidos
      const { data: creditosVendidos, error: vendidosError } = await supabase
        .from('creditos_vendidos')
        .select('*')
        .not('painel', 'is', null)
        .gte('data', dateStart.toISOString())
        .lte('data', dateEnd.toISOString());

      const vendidosMap = new Map<string, number>();
      if (!vendidosError && creditosVendidos) {
        creditosVendidos.forEach(credito => {
          if (!credito.painel) return;
          const normalizedName = credito.painel.trim().toLowerCase();
          const current = vendidosMap.get(normalizedName) || 0;
          vendidosMap.set(normalizedName, current + (credito.quantidade_creditos || 0));
        });
      }

      // Buscar créditos comprados
      const { data: creditosComprados, error: compradosError } = await supabase
        .from('compras_creditos')
        .select('*')
        .not('painel', 'is', null)
        .gte('data', dateStart.toISOString())
        .lte('data', dateEnd.toISOString());

      const compradosMap = new Map<string, number>();
      if (!compradosError && creditosComprados) {
        creditosComprados.forEach(compra => {
          if (!compra.painel) return;
          const normalizedName = compra.painel.trim().toLowerCase();
          const current = compradosMap.get(normalizedName) || 0;
          compradosMap.set(normalizedName, current + (compra.quantidade_creditos || 0));
        });
      }

      setCreditosVendidosPorPainel(vendidosMap);
      setCreditosCompradosPorPainel(compradosMap);
    } catch (err) {
      console.error('Error fetching creditos por painel:', err);
    }
  }

  async function fetchEntradasPorPainel() {
    try {
      const entradasPorPainelMap = new Map<string, number>();

      // ESTRATÉGIA 1: Buscar transações do novo schema (fonte principal)
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          *,
          subscriptions:subscription_id (
            panel_name
          )
        `)
        .in('type', ['subscription', 'recharge'])
        .eq('status', 'completed')
        .gt('amount', 0);

      if (!transactionsError && transactions) {
        transactions.forEach(transaction => {
          if (!transaction.amount || transaction.amount <= 0) return;

          // Tentar pegar painel da subscription relacionada
          const subscription = transaction.subscriptions as any;
          let panelName = subscription?.panel_name;

          // Se não encontrou na subscription, tentar extrair dos metadados
          if (!panelName && transaction.metadata) {
            const metadata = typeof transaction.metadata === 'string'
              ? JSON.parse(transaction.metadata)
              : transaction.metadata;
            panelName = metadata?.panel_name || metadata?.painel;
          }

          if (panelName) {
            const normalizedPanelName = panelName.trim().toLowerCase();
            const current = entradasPorPainelMap.get(normalizedPanelName) || 0;
            entradasPorPainelMap.set(normalizedPanelName, current + transaction.amount);
          }
        });
      }

      // ESTRATÉGIA 2: Buscar de creditos_vendidos (dados legados) apenas se tiver painel
      const { data: creditosVendidos, error: creditosError } = await supabase
        .from('creditos_vendidos')
        .select('*')
        .not('painel', 'is', null)
        .not('valor', 'is', null)
        .gt('valor', 0);

      if (!creditosError && creditosVendidos) {
        creditosVendidos.forEach(credito => {
          if (!credito.painel || !credito.valor) return;

          const normalizedPanelName = credito.painel.trim().toLowerCase();
          const current = entradasPorPainelMap.get(normalizedPanelName) || 0;
          entradasPorPainelMap.set(normalizedPanelName, current + credito.valor);
        });
      }

      // ESTRATÉGIA 3: Buscar do caixa_movimentacoes e relacionar com clientes
      const { data: entradas, error: entradasError } = await supabase
        .from('caixa_movimentacoes')
        .select('*')
        .not('entrada', 'is', null)
        .gt('entrada', 0)
        .or('historico.ilike.%Assinatura%,historico.ilike.%Pagamento%,historico.ilike.%Recarga%');

      if (!entradasError && entradas) {
        // Criar mapa de clientes por nome normalizado
        const clientesMap = new Map<string, Client[]>();
        clients.forEach(client => {
          const nomeNormalizado = client.nome.toLowerCase().trim().replace(/\s+/g, ' ');
          const existing = clientesMap.get(nomeNormalizado) || [];
          existing.push(client);
          clientesMap.set(nomeNormalizado, existing);
        });

        // Função para extrair nome do cliente
        const extractClientName = (historico: string): string | null => {
          if (!historico) return null;
          const patterns = [
            /(?:Assinatura|Pagamento\s+Online|Recarga)\s*-\s*([^(]+?)(?:\s*\(|$)/i,
            /(?:Assinatura|Pagamento\s+Online|Recarga)\s*-\s*(.+)/i,
          ];
          for (const pattern of patterns) {
            const match = historico.match(pattern);
            if (match && match[1]) return match[1].trim();
          }
          return null;
        };

        // Processar entradas do caixa
        entradas.forEach(entrada => {
          if (!entrada.entrada || entrada.entrada <= 0) return;

          const clienteNome = extractClientName(entrada.historico);
          if (!clienteNome) return;

          const nomeNormalizado = clienteNome.toLowerCase().trim().replace(/\s+/g, ' ');
          const clientesEncontrados = clientesMap.get(nomeNormalizado);

          if (clientesEncontrados && clientesEncontrados.length > 0) {
            clientesEncontrados.forEach(cliente => {
              // Coletar todos os painéis do cliente
              const paineis = [
                cliente.painel1_nome,
                cliente.painel2_nome,
                cliente.painel3_nome
              ].filter(p => p);

              if (paineis.length === 0) return;

              // Dividir valor entre os painéis
              const valorPorPainel = entrada.entrada / paineis.length;

              paineis.forEach(painel => {
                const normalizedPanelName = painel.trim().toLowerCase();
                const current = entradasPorPainelMap.get(normalizedPanelName) || 0;
                entradasPorPainelMap.set(normalizedPanelName, current + valorPorPainel);
              });
            });
          }
        });
      }

      setEntradasPorPainel(entradasPorPainelMap);
    } catch (err) {
      console.error('Error fetching entradas por painel:', err);
    }
  }

  const calculateClientStatus = (expirationDate: string | null): 'Ativo' | 'Expirado' => {
    if (!expirationDate) return 'Ativo';
    const today = new Date();
    const expiration = new Date(expirationDate);
    return expiration >= today ? 'Ativo' : 'Expirado';
  };

  const calculateAverageCredit = (clients: Client[]): number => {
    const totals = clients.reduce((acc, client) => {
      if (client.valor && client.total_creditos) {
        return {
          totalValue: acc.totalValue + client.valor,
          totalCredits: acc.totalCredits + client.total_creditos
        };
      }
      return acc;
    }, { totalValue: 0, totalCredits: 0 } as any);

    return totals.totalCredits > 0 ? totals.totalValue / totals.totalCredits : 0;
  };

  const calculatePanelSummaries = (): PanelSummary[] => {
    // Mapa usando nome normalizado (lowercase) como chave
    const panelMap = new Map<string, PanelSummary>();
    // Mapa para rastrear clientes únicos por painel (chave normalizada)
    const clientsPerPanel = new Map<string, Set<string>>();
    // Mapa para rastrear clientes expirados únicos por painel (chave normalizada)
    const expiredClientsPerPanel = new Map<string, Set<string>>();
    // Mapa para manter o nome original do painel (para exibição)
    const panelDisplayNames = new Map<string, string>();

    // Função para normalizar nome do painel (lowercase, trim)
    const normalizePanelName = (name: string): string => {
      return name.trim().toLowerCase();
    };

    const processPanel = (panelName: string | null, client: Client) => {
      if (!panelName) return;

      const normalizedName = normalizePanelName(panelName);
      
      // Manter o nome original mais comum (ou o primeiro encontrado)
      if (!panelDisplayNames.has(normalizedName)) {
        panelDisplayNames.set(normalizedName, panelName.trim());
      }

      // Inicializar sets de clientes únicos para este painel
      if (!clientsPerPanel.has(normalizedName)) {
        clientsPerPanel.set(normalizedName, new Set());
        expiredClientsPerPanel.set(normalizedName, new Set());
      }

      const currentSummary = panelMap.get(normalizedName) || {
        panelName: panelDisplayNames.get(normalizedName) || panelName.trim(),
        activeLogins: 0,
        totalClients: 0,
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        expiredClients: 0,
        expirationRate: 0,
        creditosVendidos: 0,
        creditosComprados: 0,
      };

      // Contar logins
      currentSummary.activeLogins++;

      // Adicionar cliente ao set (garante unicidade)
      const clientId = client.id || client.nome || '';
      clientsPerPanel.get(normalizedName)!.add(clientId);

      // Buscar custo usando nome normalizado
      const creditoCusto = creditoCustos.get(normalizedName) || 
                          creditoCustos.get(panelName) || 0;
      currentSummary.totalExpense = currentSummary.activeLogins * creditoCusto;

      const status = calculateClientStatus(client.data_expiracao);
      if (status === 'Expirado') {
        // Adicionar cliente expirado ao set (garante unicidade)
        expiredClientsPerPanel.get(normalizedName)!.add(clientId);
      }

      panelMap.set(normalizedName, currentSummary);
    };

    clients.forEach(client => {
      if (client.painel1_nome) processPanel(client.painel1_nome, client);
      if (client.painel2_nome) processPanel(client.painel2_nome, client);
      if (client.painel3_nome) processPanel(client.painel3_nome, client);
    });

    // Atualizar contagem de clientes únicos e expirados
    panelMap.forEach((summary, normalizedName) => {
      summary.totalClients = clientsPerPanel.get(normalizedName)?.size || 0;
      summary.expiredClients = expiredClientsPerPanel.get(normalizedName)?.size || 0;
    });

    // Agora aplicar as entradas reais do caixa por painel e créditos vendidos/comprados
    panelMap.forEach((summary, normalizedName) => {
      // Buscar entrada usando nome normalizado ou original
      const entradaReal = entradasPorPainel.get(normalizedName) ||
                          entradasPorPainel.get(summary.panelName) || 0;
      summary.totalIncome = entradaReal;
      summary.balance = summary.totalIncome - summary.totalExpense;

      // Buscar créditos vendidos e comprados
      summary.creditosVendidos = creditosVendidosPorPainel.get(normalizedName) || 0;
      summary.creditosComprados = creditosCompradosPorPainel.get(normalizedName) || 0;

      // Taxa de expiração baseada em clientes, não logins
      summary.expirationRate = summary.totalClients > 0
        ? (summary.expiredClients / summary.totalClients) * 100
        : 0;
    });

    return Array.from(panelMap.values()).sort((a, b) => b.totalIncome - a.totalIncome);
  };

  const summaries = calculatePanelSummaries();
  const totals = summaries.reduce(
    (acc, curr) => ({
      panelName: 'Total Geral',
      activeLogins: acc.activeLogins + curr.activeLogins,
      totalClients: acc.totalClients + curr.totalClients,
      totalIncome: acc.totalIncome + curr.totalIncome,
      totalExpense: acc.totalExpense + curr.totalExpense,
      balance: acc.balance + curr.balance,
      expiredClients: acc.expiredClients + curr.expiredClients,
      expirationRate: 0,
      creditosVendidos: acc.creditosVendidos + curr.creditosVendidos,
      creditosComprados: acc.creditosComprados + curr.creditosComprados,
    }),
    {
      panelName: 'Total Geral',
      activeLogins: 0,
      totalClients: 0,
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      expiredClients: 0,
      expirationRate: 0,
      creditosVendidos: 0,
      creditosComprados: 0,
    }
  );

  totals.expirationRate = totals.totalClients > 0
    ? (totals.expiredClients / totals.totalClients) * 100
    : 0;

  return (
    <div className="bg-slate-800 rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-semibold text-slate-100 mb-4">Resumo por Painel</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Painel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Clientes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Logins</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider text-red-400">Expirados</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Taxa de Expiração</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider text-green-400">Créditos Vendidos</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider text-blue-400">Créditos Comprados</th>
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {summaries.map((summary, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">{summary.panelName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-semibold">{summary.totalClients}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{summary.activeLogins}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400 font-medium">{summary.expiredClients}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{summary.expirationRate.toFixed(1)}%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400 font-medium">{summary.creditosVendidos}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-400 font-medium">{summary.creditosComprados}</td>
              </tr>
            ))}
            <tr className="bg-slate-900/60">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-100">{totals.panelName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-100">{totals.totalClients}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-100">{totals.activeLogins}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-400">{totals.expiredClients}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-100">{totals.expirationRate.toFixed(1)}%</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-400">{totals.creditosVendidos}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-400">{totals.creditosComprados}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

