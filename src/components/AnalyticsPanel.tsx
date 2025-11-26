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
}

interface AnalyticsPanelProps {
  clients: Client[];
}

interface CreditoCusto {
  painel: string;
  custo_medio: number;
}

export default function AnalyticsPanel({ clients }: AnalyticsPanelProps) {
  const [creditoCustos, setCreditoCustos] = useState<Map<string, number>>(new Map());
  const [entradasPorPainel, setEntradasPorPainel] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    fetchCreditoCustos();
    fetchEntradasPorPainel();
  }, [clients]);

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
        const current = custosPorPainel.get(compra.painel) || {
          painel: compra.painel,
          total_creditos: 0,
          valor_total: 0,
          custo_medio: 0
        };

        current.total_creditos += compra.quantidade_creditos;
        current.valor_total += compra.valor_total;
        current.custo_medio = current.valor_total / current.total_creditos;

        custosPorPainel.set(compra.painel, current);
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

  async function fetchEntradasPorPainel() {
    try {
      // Buscar créditos vendidos com painel
      const { data: creditosVendidos, error: creditosError } = await supabase
        .from('creditos_vendidos')
        .select('*')
        .not('painel', 'is', null)
        .order('data', { ascending: false });

      if (creditosError) throw creditosError;

      // Buscar entradas do caixa relacionadas a assinaturas
      const { data: entradas, error: entradasError } = await supabase
        .from('caixa_movimentacoes')
        .select('*')
        .not('entrada', 'is', null)
        .gt('entrada', 0)
        .ilike('historico', '%Assinatura%')
        .order('data', { ascending: false });

      if (entradasError) throw entradasError;

      // Criar mapa de entradas por data e nome do cliente
      const entradasMap = new Map<string, number>(); // chave: "data|nome" -> valor
      entradas?.forEach(entrada => {
        if (!entrada.entrada || entrada.entrada <= 0) return;
        const match = entrada.historico.match(/Assinatura\s*-\s*(.+)/i);
        if (!match) return;
        const clienteNome = match[1].trim();
        const key = `${entrada.data}|${clienteNome}`;
        entradasMap.set(key, entrada.entrada);
      });

      // Processar créditos vendidos e relacionar com entradas
      const entradasPorPainelMap = new Map<string, number>();

      creditosVendidos?.forEach(credito => {
        if (!credito.painel) return;

        // Tentar encontrar entrada correspondente pela data e histórico
        const match = credito.historico.match(/Assinatura\s*-\s*(.+?)(?:\s*\(|$)/i);
        if (!match) return;

        const clienteNome = match[1].trim();
        const key = `${credito.data}|${clienteNome}`;
        const valorEntrada = entradasMap.get(key);

        if (valorEntrada) {
          // Se encontrou entrada, usar o valor real
          const current = entradasPorPainelMap.get(credito.painel) || 0;
          entradasPorPainelMap.set(credito.painel, current + valorEntrada);
        }
      });

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
    const panelMap = new Map<string, PanelSummary>();
    // Mapa para rastrear clientes únicos por painel
    const clientsPerPanel = new Map<string, Set<string>>();
    // Mapa para rastrear clientes expirados únicos por painel
    const expiredClientsPerPanel = new Map<string, Set<string>>();

    const processPanel = (panelName: string | null, client: Client) => {
      if (!panelName) return;

      // Inicializar sets de clientes únicos para este painel
      if (!clientsPerPanel.has(panelName)) {
        clientsPerPanel.set(panelName, new Set());
        expiredClientsPerPanel.set(panelName, new Set());
      }

      const currentSummary = panelMap.get(panelName) || {
        panelName,
        activeLogins: 0,
        totalClients: 0,
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        expiredClients: 0,
        expirationRate: 0,
      };

      // Contar logins
      currentSummary.activeLogins++;

      // Adicionar cliente ao set (garante unicidade)
      const clientId = client.id || client.nome || '';
      clientsPerPanel.get(panelName)!.add(clientId);

      const creditoCusto = creditoCustos.get(panelName) || 0;
      currentSummary.totalExpense = currentSummary.activeLogins * creditoCusto;

      const status = calculateClientStatus(client.data_expiracao);
      if (status === 'Expirado') {
        // Adicionar cliente expirado ao set (garante unicidade)
        expiredClientsPerPanel.get(panelName)!.add(clientId);
      }

      panelMap.set(panelName, currentSummary);
    };

    clients.forEach(client => {
      if (client.painel1_nome) processPanel(client.painel1_nome, client);
      if (client.painel2_nome) processPanel(client.painel2_nome, client);
      if (client.painel3_nome) processPanel(client.painel3_nome, client);
    });

    // Atualizar contagem de clientes únicos e expirados
    panelMap.forEach((summary, panelName) => {
      summary.totalClients = clientsPerPanel.get(panelName)?.size || 0;
      summary.expiredClients = expiredClientsPerPanel.get(panelName)?.size || 0;
    });

    // Agora aplicar as entradas reais do caixa por painel
    panelMap.forEach((summary, panelName) => {
      const entradaReal = entradasPorPainel.get(panelName) || 0;
      summary.totalIncome = entradaReal;
      summary.balance = summary.totalIncome - summary.totalExpense;
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
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Entrada</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Saída</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Saldo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider text-red-400">Expirados</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Taxa de Expiração</th>
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {summaries.map((summary, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">{summary.panelName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-semibold">{summary.totalClients}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{summary.activeLogins}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.totalIncome)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.totalExpense)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.balance)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400 font-medium">{summary.expiredClients}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{summary.expirationRate.toFixed(1)}%</td>
              </tr>
            ))}
            <tr className="bg-slate-900/60">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-100">{totals.panelName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-100">{totals.totalClients}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-100">{totals.activeLogins}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-100">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.totalIncome)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-100">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.totalExpense)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-100">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.balance)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-400">{totals.expiredClients}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-100">{totals.expirationRate.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

