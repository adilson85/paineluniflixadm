import { useEffect, useState } from 'react';
import { Users, MonitorPlay } from 'lucide-react';
import { Client } from '../types';
import { supabase } from '../lib/supabase';

type PeriodFilter = 'current_month' | 'last_month' | 'custom';

interface DashboardMetricsProps {
  clients: Client[];
  periodFilter: PeriodFilter;
  startDate?: string;
  endDate?: string;
}

export default function DashboardMetrics({ clients, periodFilter, startDate, endDate }: DashboardMetricsProps) {
  const [totalCredits, setTotalCredits] = useState(0);
  const totalClients = clients.length;

  useEffect(() => {
    fetchCredits();
  }, [periodFilter, startDate, endDate]);

  const isInPeriod = (date: string) => {
    const checkDate = new Date(date);
    const today = new Date();

    if (periodFilter === 'current_month') {
      return today.getMonth() === checkDate.getMonth() &&
             today.getFullYear() === checkDate.getFullYear();
    } else if (periodFilter === 'last_month') {
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return lastMonth.getMonth() === checkDate.getMonth() &&
             lastMonth.getFullYear() === checkDate.getFullYear();
    } else if (periodFilter === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return checkDate >= start && checkDate <= end;
    }

    return true;
  };

  async function fetchCredits() {
    try {
      const { data: creditData, error } = await supabase
        .from('compras_creditos')
        .select('*');

      if (error) throw error;

      const totalCreditsSold = (creditData || [])
        .filter((compra: any) => isInPeriod(compra.data))
        .reduce((sum: number, compra: any) => sum + (compra.quantidade_creditos || 0), 0);

      setTotalCredits(totalCreditsSold);
    } catch (err) {
      console.error('Error fetching credits:', err);
      setTotalCredits(0);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-blue-500/10 text-blue-400">
            <Users className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Total de Clientes</p>
            <p className="text-2xl font-semibold text-slate-100">{totalClients}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-green-500/10 text-green-400">
            <MonitorPlay className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-400">Total de Créditos Vendidos</p>
            <p className="text-2xl font-semibold text-slate-100">{totalCredits}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
