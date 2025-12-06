import { useEffect, useState } from 'react';
import { Users, UserMinus, DollarSign, TrendingDown, CalendarCheck, UserPlus, ArrowDownRight, CreditCard, TrendingUp, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Client } from '../types';

interface DashboardMetrics {
  activeClients: number;
  expiredClients: number;
  totalClients: number;
  churnRate: number;
  monthlyRevenue: number;
  estimatedExpenses: number;
  monthlyTests: number;
  newClients: number;
  conversionRate: number;
  profit: number;
  totalCreditsVendidos: number;
  pendingBonuses: number;
}

type PeriodFilter = 'current_month' | 'last_month' | 'custom';

interface MainDashboardProps {
  clients: Client[];
  periodFilter: PeriodFilter;
  startDate?: string;
  endDate?: string;
}

export default function MainDashboard({ clients, periodFilter, startDate, endDate }: MainDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeClients: 0,
    expiredClients: 0,
    totalClients: 0,
    churnRate: 0,
    monthlyRevenue: 0,
    estimatedExpenses: 0,
    monthlyTests: 0,
    newClients: 0,
    conversionRate: 0,
    profit: 0,
    totalCreditsVendidos: 0,
    pendingBonuses: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [clients, periodFilter, startDate, endDate]);

  const isInPeriod = (date: string) => {
    if (!date) return false;

    // Extrair ano-mes da data no formato YYYY-MM-DD (evita problemas de timezone)
    const dateStr = date.split('T')[0]; // Remove hora se tiver
    const parts = dateStr.split('-');

    // Validar se tem 3 partes (ano-mês-dia)
    if (parts.length !== 3) return false;

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);

    // Validar se são números válidos
    if (isNaN(year) || isNaN(month)) return false;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // getMonth() retorna 0-11, precisamos 1-12

    if (periodFilter === 'current_month') {
      return year === currentYear && month === currentMonth;
    } else if (periodFilter === 'last_month') {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      return year === lastMonthYear && month === lastMonth;
    } else if (periodFilter === 'custom' && startDate && endDate) {
      // Para custom, usar comparação de strings é mais seguro
      return dateStr >= startDate && dateStr <= endDate;
    }

    return true; // Se custom sem datas, mostrar tudo
  };

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      // Buscar testes
      const { data: tests, error: testsError } = await supabase
        .from('testes_liberados')
        .select('*');

      if (testsError) throw testsError;

      // Buscar transações (caixa)
      const { data: transactions, error: transError } = await supabase
        .from('caixa_movimentacoes')
        .select('*');

      if (transError) throw transError;

      // Buscar compras de créditos
      const { data: creditData, error: creditError } = await supabase
        .from('compras_creditos')
        .select('*');

      if (creditError) throw creditError;

      // Buscar créditos vendidos
      const { data: creditosVendidos, error: creditosError } = await supabase
        .from('creditos_vendidos')
        .select('*');

      if (creditosError) throw creditosError;

      // Buscar total de bônus pendentes (soma de total_commission de todos os usuários)
      const { data: usersWithCommission, error: commissionError } = await supabase
        .from('users')
        .select('total_commission');

      if (commissionError) throw commissionError;

      // Calcular total de bônus pendentes
      const pendingBonuses = (usersWithCommission || [])
        .reduce((sum: number, user: any) => sum + (parseFloat(user.total_commission) || 0), 0);

      // Usar clients recebidos via props (já inclui online + offline)
      const allClients = clients;

      // Calcular métricas de clientes
      const activeClients = allClients.filter(c => c.status === 'Ativo').length;
      const expiredClients = allClients.filter(c => c.status === 'Expirado').length;
      const totalClients = allClients.length;
      const churnRate = (totalClients > 0 ? (expiredClients / totalClients) * 100 : 0);

      // RECEITA NO PERÍODO: Somar ENTRADAS do caixa no período
      const monthlyRevenue = (transactions || [])
        .filter((t: any) => {
          // Verificar se tem valor em entrada
          if (!t.entrada || t.entrada === 0) return false;
          // Campo de data é "data"
          const dateField = t.data || t.created_at;
          if (!dateField) {
            console.warn('⚠️ Transação sem data:', t);
            return false;
          }
          const inPeriod = isInPeriod(dateField);
          if (inPeriod) {
            console.log('✅ Entrada contada:', { data: dateField, valor: t.entrada, historico: t.historico });
          }
          return inPeriod;
        })
        .reduce((sum: number, t: any) => sum + (parseFloat(t.entrada) || 0), 0);

      console.log(`📊 Total de Receita no Período: R$ ${monthlyRevenue.toFixed(2)}`);

      // DESPESAS: Compras de créditos no período
      const estimatedExpenses = (creditData || [])
        .filter((compra: any) => {
          const dateField = compra.data || compra.created_at;
          if (!dateField) return false;
          return isInPeriod(dateField);
        })
        .reduce((sum: number, compra: any) => sum + (compra.valor_total || 0), 0);

      // LUCRO/SALDO: Receita - Despesas
      const profit = monthlyRevenue - estimatedExpenses;

      // TESTES NO PERÍODO
      const monthlyTests = (tests || [])
        .filter((test: any) => {
          const dateField = test.data_teste || test.created_at;
          if (!dateField) return false;
          return isInPeriod(dateField);
        })
        .length;

      // NOVOS CLIENTES: Clientes criados no período (online + offline)
      const newClients = allClients
        .filter((client: any) => {
          const dateField = client.created_at || client.data_cadastro;
          if (!dateField) return false;
          return isInPeriod(dateField);
        })
        .length;

      // TAXA DE CONVERSÃO: (Testes que viraram assinantes / Total de testes) * 100
      const testsConverted = (tests || [])
        .filter((test: any) => {
          const dateField = test.data_teste || test.created_at;
          if (!dateField) return false;
          return isInPeriod(dateField) && test.assinante === true;
        })
        .length;

      const conversionRate = (monthlyTests > 0 ? (testsConverted / monthlyTests) * 100 : 0);

      // TOTAL DE CRÉDITOS VENDIDOS NO PERÍODO
      const totalCreditsVendidos = (creditosVendidos || [])
        .filter((credito: any) => {
          const dateField = credito.data || credito.created_at;
          if (!dateField) return false;
          return isInPeriod(dateField);
        })
        .length;

      setMetrics({
        activeClients,
        expiredClients,
        totalClients,
        churnRate,
        monthlyRevenue,
        estimatedExpenses,
        monthlyTests,
        newClients,
        conversionRate,
        profit,
        totalCreditsVendidos,
        pendingBonuses
      });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Erro ao carregar os dados do dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Seção 1 - Clientes */}
      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-green-500/10 text-green-400">
            <Users className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Clientes Ativos</p>
            <p className="text-2xl font-semibold text-slate-100">{metrics.activeClients}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-red-500/10 text-red-400">
            <UserMinus className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Clientes Expirados</p>
            <p className="text-2xl font-semibold text-slate-100">{metrics.expiredClients}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-orange-500/10 text-orange-400">
            <TrendingDown className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Taxa de Perda</p>
            <p className="text-2xl font-semibold text-slate-100">
              {metrics.churnRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Seção 2 - Receita e Saída */}
      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-blue-500/10 text-blue-400">
            <DollarSign className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Receita no Período</p>
            <p className="text-2xl font-semibold text-slate-100">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(metrics.monthlyRevenue)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-red-500/10 text-red-400">
            <CreditCard className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Despesas</p>
            <p className="text-2xl font-semibold text-slate-100">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(metrics.estimatedExpenses)}
            </p>
          </div>
        </div>
      </div>

      {/* Lucro/Saldo - Logo após Despesas */}
      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className={`p-3 rounded-full ${metrics.profit >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            <TrendingUp className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Lucro/Saldo</p>
            <p className={`text-2xl font-semibold ${metrics.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(metrics.profit)}
            </p>
          </div>
        </div>
      </div>

      {/* Bônus Pendentes - Reserva necessária no caixa */}
      <div className="bg-slate-800 rounded-lg shadow p-6 border-2 border-yellow-500/30">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-yellow-500/10 text-yellow-400">
            <Wallet className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Bônus a Pagar</p>
            <p className="text-2xl font-semibold text-yellow-400">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(metrics.pendingBonuses)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Reserva necessária no caixa</p>
          </div>
        </div>
      </div>

      {/* Seção 3 - Testes e Conversão */}
      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-purple-500/10 text-purple-400">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Testes no Período</p>
            <p className="text-2xl font-semibold text-slate-100">{metrics.monthlyTests}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-green-500/10 text-green-400">
            <UserPlus className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Novos Clientes</p>
            <p className="text-2xl font-semibold text-slate-100">{metrics.newClients}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-blue-500/10 text-blue-400">
            <ArrowDownRight className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Taxa de Conversão</p>
            <p className="text-2xl font-semibold text-slate-100">
              {metrics.conversionRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Total de Clientes */}
      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-blue-500/10 text-blue-400">
            <Users className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Total de Clientes</p>
            <p className="text-2xl font-semibold text-slate-100">{metrics.totalClients}</p>
          </div>
        </div>
      </div>

      {/* Total de Créditos Vendidos */}
      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400">
            <CreditCard className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Total de Créditos Vendidos</p>
            <p className="text-2xl font-semibold text-slate-100">{metrics.totalCreditsVendidos}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

