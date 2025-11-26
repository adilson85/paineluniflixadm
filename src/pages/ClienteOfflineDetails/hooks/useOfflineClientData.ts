import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { OfflineClient } from '../../../types';

export function useOfflineClientData(clientId: string | undefined) {
  const [client, setClient] = useState<OfflineClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClient = useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Buscar da tabela offline_clients
      const { data, error: fetchError } = await supabase
        .from('offline_clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (fetchError) throw fetchError;

      if (!data) {
        throw new Error('Cliente offline não encontrado');
      }

      // Calcular status baseado na data de expiração
      const expirationDate = new Date(data.data_expiracao);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const status = expirationDate >= today ? 'Ativo' : 'Expirado';

      setClient({ ...data, status } as OfflineClient);
    } catch (err: any) {
      console.error('Erro ao carregar cliente offline:', err);
      setError(err.message || 'Erro ao carregar cliente offline');
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  return {
    client,
    loading,
    error,
    refetch: fetchClient,
  };
}
