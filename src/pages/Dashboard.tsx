import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import Layout from '../components/Layout';
import MainDashboard from '../components/MainDashboard';
import AnalyticsPanel from '../components/AnalyticsPanel';
import { PendingWithdrawals } from '../components/PendingWithdrawals';
import { supabase } from '../lib/supabase';
import type { Client, User, Subscription, OfflineClient } from '../types';
import { transformUserToClient, transformOfflineClientToClient } from '../utils/clientHelpers';

type PeriodFilter = 'current_month' | 'last_month' | 'custom';

export default function Dashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('current_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

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
      let nonAdminUsers = usersData || [];
      
      try {
        const { data: adminIds } = await supabase.rpc('get_admin_user_ids');
        if (adminIds && Array.isArray(adminIds)) {
          nonAdminUsers = (usersData || []).filter(user => !adminIds.includes(user.id));
        }
      } catch (err) {
        // Se a função não existir, usar todos os usuários (fallback)
        console.warn('Could not filter admins via RPC, including all users');
      }

      // Transformar dados usando função utilitária (evita duplicação de código)
      const processedClients: Client[] = nonAdminUsers.map((user: User & { subscriptions: Subscription[] }) =>
        transformUserToClient(user)
      );

      // Buscar clientes offline (não migrados)
      const { data: offlineClientsData, error: offlineError } = await supabase
        .from('offline_clients')
        .select('*')
        .is('migrated_to_user_id', null)
        .order('created_at', { ascending: false });

      if (offlineError) {
        console.warn('Error fetching offline clients:', offlineError);
      } else {
        // Transformar clientes offline para formato Client
        const processedOfflineClients: Client[] = (offlineClientsData || []).map((offlineClient: OfflineClient) =>
          transformOfflineClientToClient(offlineClient)
        );

        // Combinar clientes online e offline
        processedClients.push(...processedOfflineClients);
      }

      setClients(processedClients);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('Erro ao carregar os dados. Por favor, verifique sua conexão.');
    }
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto mb-6">
        <h2 className="text-2xl font-bold text-slate-100">Dashboard</h2>
        <p className="text-slate-400 text-sm">Visão geral do CRM</p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Filtro de Período */}
      <div className="bg-slate-800 rounded-lg shadow p-4 mb-6 border border-slate-700">
        <div className="flex items-center flex-wrap gap-4">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-slate-400 mr-2" />
            <span className="text-sm font-medium text-slate-300">Período:</span>
          </div>

          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="current_month">Mês Atual</option>
            <option value="last_month">Mês Passado</option>
            <option value="custom">Período Personalizado</option>
          </select>

          {periodFilter === 'custom' && (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <span className="text-slate-400">até</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mb-8">
        <MainDashboard
          clients={clients}
          periodFilter={periodFilter}
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      <div className="mb-8">
        <PendingWithdrawals />
      </div>

      <AnalyticsPanel clients={clients} />
    </Layout>
  );
}

