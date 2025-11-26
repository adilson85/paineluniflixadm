import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

export function useOfflineClientMigration() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const migrateToUser = async (offlineClientId: string, email: string): Promise<{ userId: string; tempPassword: string | null } | null> => {
    try {
      setIsProcessing(true);
      setError(null);

      // Chamar Edge Function de migração
      const { data, error: migrationError } = await supabase.functions.invoke('migrate-offline-client', {
        body: {
          offlineClientId: offlineClientId,
          email: email.trim(),
        },
      });

      if (migrationError) {
        console.error('Erro ao chamar Edge Function:', migrationError);
        throw migrationError;
      }

      // Verificar se houve erro na resposta
      if (!data?.success) {
        throw new Error(data?.error || 'Erro desconhecido ao migrar cliente');
      }

      if (!data.user_id) {
        throw new Error('Erro ao migrar cliente: ID do novo usuário não foi retornado');
      }

      return {
        userId: data.user_id,
        tempPassword: data.temp_password,
      };
    } catch (err: any) {
      console.error('Erro ao migrar cliente offline:', err);

      // Tratar erros específicos
      let errorMessage = 'Erro ao migrar cliente. Tente novamente.';

      if (err.message.includes('já foi migrado')) {
        errorMessage = 'Este cliente já foi migrado anteriormente.';
      } else if (err.message.includes('já está cadastrado')) {
        errorMessage = 'Este email já está sendo usado por outro cliente.';
      } else if (err.message.includes('obrigatório')) {
        errorMessage = 'Email é obrigatório para a migração.';
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
    migrateToUser,
    isProcessing,
    error,
  };
}
