import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { OfflineClient } from '../types';

export function useOfflineClients() {
  const [clients, setClients] = useState<OfflineClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar da tabela offline_clients, filtrando apenas não migrados
      const { data, error: fetchError } = await supabase
        .from('offline_clients')
        .select('*')
        .is('migrated_to_user_id', null)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Calcular status para cada cliente
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const clientsWithStatus = (data || []).map((client) => {
        const expirationDate = new Date(client.data_expiracao);
        const status = expirationDate >= today ? 'Ativo' : 'Expirado';
        return { ...client, status };
      });

      setClients(clientsWithStatus as OfflineClient[]);
    } catch (err: any) {
      console.error('Erro ao carregar clientes offline:', err);
      setError(err.message || 'Erro ao carregar clientes offline');
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Funções de filtro
  const filterBySearch = useCallback(
    (searchTerm: string): OfflineClient[] => {
      if (!searchTerm.trim()) return clients;

      const term = searchTerm.toLowerCase();
      return clients.filter(
        (client) =>
          client.nome.toLowerCase().includes(term) ||
          client.telefone.toLowerCase().includes(term) ||
          client.email?.toLowerCase().includes(term) ||
          client.cpf?.toLowerCase().includes(term)
      );
    },
    [clients]
  );

  const filterByStatus = useCallback(
    (status: 'all' | 'Ativo' | 'Expirado'): OfflineClient[] => {
      if (status === 'all') return clients;
      return clients.filter((client) => client.status === status);
    },
    [clients]
  );

  const filterClients = useCallback(
    (searchTerm: string, status: 'all' | 'Ativo' | 'Expirado'): OfflineClient[] => {
      let filtered = clients;

      // Filtrar por busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (client) =>
            client.nome.toLowerCase().includes(term) ||
            client.telefone.toLowerCase().includes(term) ||
            client.email?.toLowerCase().includes(term) ||
            client.cpf?.toLowerCase().includes(term)
        );
      }

      // Filtrar por status
      if (status !== 'all') {
        filtered = filtered.filter((client) => client.status === status);
      }

      return filtered;
    },
    [clients]
  );

  return {
    clients,
    loading,
    error,
    refetch: fetchClients,
    filterBySearch,
    filterByStatus,
    filterClients,
  };
}
