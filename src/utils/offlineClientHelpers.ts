import type { OfflineClient } from '../types';

/**
 * Calcula o status do cliente offline baseado na data de expiração
 * Parse manual para evitar problemas de timezone
 */
export function calculateOfflineClientStatus(dataExpiracao: string | null): 'Ativo' | 'Expirado' {
  if (!dataExpiracao) return 'Expirado';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse manual da data para evitar timezone
  const dateStr = dataExpiracao.split('T')[0];
  const [year, month, day] = dateStr.split('-').map(Number);
  const expiration = new Date(year, month - 1, day);
  expiration.setHours(0, 0, 0, 0);

  return expiration >= today ? 'Ativo' : 'Expirado';
}

/**
 * Conta quantos logins o cliente offline possui
 */
export function countOfflineClientLogins(client: OfflineClient): number {
  let count = 0;

  if (client.login_01 && client.senha_01) count++;
  if (client.login_02 && client.senha_02) count++;
  if (client.login_03 && client.senha_03) count++;

  return count;
}

/**
 * Determina o tipo de plano baseado na quantidade de logins
 */
export function getOfflineClientPlanType(client: OfflineClient): {
  type: 'ponto_unico' | 'ponto_duplo' | 'ponto_triplo' | null;
  label: string;
} {
  const loginCount = countOfflineClientLogins(client);

  switch (loginCount) {
    case 1:
      return { type: 'ponto_unico', label: 'Ponto Único' };
    case 2:
      return { type: 'ponto_duplo', label: 'Ponto Duplo' };
    case 3:
      return { type: 'ponto_triplo', label: 'Ponto Triplo' };
    default:
      return { type: null, label: 'Sem Plano' };
  }
}

/**
 * Valida se o cliente offline possui email válido para migração
 */
export function canMigrateOfflineClient(client: OfflineClient): {
  canMigrate: boolean;
  reason?: string;
} {
  // Verifica se já foi migrado
  if (client.migrated_to_user_id) {
    return {
      canMigrate: false,
      reason: 'Cliente já foi migrado anteriormente',
    };
  }

  // Verifica se tem email
  if (!client.email || client.email.trim() === '') {
    return {
      canMigrate: false,
      reason: 'Email é obrigatório para migração',
    };
  }

  // Verifica formato básico de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(client.email)) {
    return {
      canMigrate: false,
      reason: 'Email inválido',
    };
  }

  return { canMigrate: true };
}

/**
 * Calcula quantos dias faltam para expirar
 * Parse manual para evitar problemas de timezone
 */
export function getDaysUntilExpiration(dataExpiracao: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse manual da data para evitar timezone
  const dateStr = dataExpiracao.split('T')[0];
  const [year, month, day] = dateStr.split('-').map(Number);
  const expiration = new Date(year, month - 1, day);
  expiration.setHours(0, 0, 0, 0);

  const diffTime = expiration.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Formata o status de migração para exibição
 */
export function formatMigrationStatus(client: OfflineClient): string {
  if (!client.migrated_to_user_id) {
    return 'Não Migrado';
  }

  if (client.migrated_at) {
    const date = new Date(client.migrated_at);
    return `Migrado em ${date.toLocaleDateString('pt-BR')}`;
  }

  return 'Migrado';
}

/**
 * Valida os dados antes de criar um cliente offline
 */
export function validateOfflineClientData(data: Partial<OfflineClient>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Nome obrigatório
  if (!data.nome || data.nome.trim() === '') {
    errors.push('Nome é obrigatório');
  }

  // Telefone obrigatório
  if (!data.telefone || data.telefone.trim() === '') {
    errors.push('Telefone é obrigatório');
  }

  // Pelo menos um login
  const hasLogin1 = data.login_01 && data.senha_01;
  const hasLogin2 = data.login_02 && data.senha_02;
  const hasLogin3 = data.login_03 && data.senha_03;

  if (!hasLogin1 && !hasLogin2 && !hasLogin3) {
    errors.push('É necessário fornecer pelo menos um login com senha');
  }

  // Data de expiração
  if (!data.data_expiracao) {
    errors.push('Data de expiração é obrigatória');
  }

  // Email formato válido (se fornecido)
  if (data.email && data.email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Email inválido');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Prepara os dados do cliente offline para envio ao backend
 */
export function prepareOfflineClientForCreate(data: Partial<OfflineClient>): Record<string, any> {
  return {
    p_nome: data.nome?.trim() || '',
    p_telefone: data.telefone?.trim() || '',
    p_cpf: data.cpf?.trim() || null,
    p_email: data.email?.trim() || null,
    p_id_botconversa: data.id_botconversa || null,

    p_login_01: data.login_01?.trim() || null,
    p_senha_01: data.senha_01?.trim() || null,
    p_painel_01: data.painel_01?.trim() || null,

    p_login_02: data.login_02?.trim() || null,
    p_senha_02: data.senha_02?.trim() || null,
    p_painel_02: data.painel_02?.trim() || null,

    p_login_03: data.login_03?.trim() || null,
    p_senha_03: data.senha_03?.trim() || null,
    p_painel_03: data.painel_03?.trim() || null,

    p_data_expiracao: data.data_expiracao || null,
    p_valor_mensal: data.valor_mensal || null,
  };
}

/**
 * Obtém uma lista de painéis usados pelo cliente offline
 */
export function getOfflineClientPanels(client: OfflineClient): string[] {
  const panels: string[] = [];

  if (client.painel_01) panels.push(client.painel_01);
  if (client.painel_02) panels.push(client.painel_02);
  if (client.painel_03) panels.push(client.painel_03);

  return panels;
}
