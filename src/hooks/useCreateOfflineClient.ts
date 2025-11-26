import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { OfflineClient } from '../types';
import { prepareOfflineClientForCreate, validateOfflineClientData } from '../utils/offlineClientHelpers';

export function useCreateOfflineClient() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOfflineClient = async (data: Partial<OfflineClient>): Promise<string | null> => {
    try {
      setIsProcessing(true);
      setError(null);

      // Validar dados
      const validation = validateOfflineClientData(data);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Preparar dados para o backend
      const params = prepareOfflineClientForCreate(data);

      // Chamar função RPC
      const { data: newClientId, error: createError } = await supabase
        .rpc('create_offline_client', params);

      if (createError) throw createError;

      if (!newClientId) {
        throw new Error('Erro ao criar cliente: ID não foi retornado');
      }

      return newClientId as string;
    } catch (err: any) {
      console.error('Erro ao criar cliente offline:', err);

      let errorMessage = 'Erro ao criar cliente. Tente novamente.';

      if (err.message.includes('obrigatório')) {
        errorMessage = err.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    createOfflineClient,
    isProcessing,
    error,
    clearError: () => setError(null),
  };
}
