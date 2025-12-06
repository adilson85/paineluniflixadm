/**
 * Utilitários para manipulação de dados de clientes
 * Evita duplicação de código entre componentes
 */

import type { Client, User, Subscription, OfflineClient } from '../types';

/**
 * Calcula o status de um cliente baseado na data de expiração
 * Parse manual para evitar problemas de timezone
 */
export function calculateStatus(expirationDate: string | null): 'Ativo' | 'Expirado' {
  if (!expirationDate) return 'Ativo';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse manual da data para evitar timezone
  const dateStr = expirationDate.split('T')[0];
  const [year, month, day] = dateStr.split('-').map(Number);
  const expiration = new Date(year, month - 1, day);
  expiration.setHours(0, 0, 0, 0);

  return expiration >= today ? 'Ativo' : 'Expirado';
}

/**
 * Transforma dados do schema novo (users + subscriptions) para o formato legado (Client)
 */
export function transformUserToClient(
  user: User & { subscriptions: Subscription[] }
): Client {
  const activeSubscription = user.subscriptions?.find(s => s.status === 'active');
  const mainSubscription = activeSubscription || user.subscriptions?.[0];

  return {
    id: user.id,
    nome: user.full_name,
    telefone: user.phone || '',
    cpf: user.cpf || '',
    email: user.email || '',
    data_nascimento: user.data_nascimento || '',
    data_expiracao: mainSubscription?.expiration_date || '',
    status: mainSubscription ? calculateStatus(mainSubscription.expiration_date) : 'Ativo',
    painel1_login: user.subscriptions?.[0]?.app_username || '',
    painel1_senha: user.subscriptions?.[0]?.app_password || '',
    painel1_nome: user.subscriptions?.[0]?.panel_name || '',
    painel2_login: user.subscriptions?.[1]?.app_username || '',
    painel2_senha: user.subscriptions?.[1]?.app_password || '',
    painel2_nome: user.subscriptions?.[1]?.panel_name || '',
    painel3_login: user.subscriptions?.[2]?.app_username || '',
    painel3_senha: user.subscriptions?.[2]?.app_password || '',
    painel3_nome: user.subscriptions?.[2]?.panel_name || '',
    mac_address: mainSubscription?.mac_address || '',
    device_key: mainSubscription?.device_key || '',
    codigo_referencia: user.referral_code || '',
    indicado_por: user.referred_by || '',
    total_comissao: user.total_commission || 0,
    id_botconversa: user.id_botconversa?.toString() || '',
    teste: 'Não',
    data_criacao: user.created_at || new Date().toISOString(),
    ultima_atualizacao: user.updated_at || new Date().toISOString(),
  };
}

/**
 * Determina o tipo de plano do cliente baseado no número de logins ativos
 */
export function getPlanType(
  client: Client,
  subscriptions?: Array<{ status: string }>
): {
  type: 'ponto_unico' | 'ponto_duplo' | 'ponto_triplo' | null;
  label: string;
} {
  // Se tiver subscriptions, contar apenas as ativas
  if (subscriptions) {
    const activeCount = subscriptions.filter(s => s.status === 'active').length;

    switch (activeCount) {
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

  // Fallback: contar logins preenchidos no formato legado
  const loginsCount = [
    client.painel1_login,
    client.painel2_login,
    client.painel3_login,
  ].filter(login => login && login.trim() !== '').length;

  switch (loginsCount) {
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
 * Formata um valor monetário para exibição
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Formata uma data para exibição em português
 * Parse manual para evitar problemas de timezone
 */
export function formatDate(date: string | Date, includeTime = false): string {
  if (typeof date === 'string') {
    // Parse manual para evitar conversão de timezone
    const dateStr = date.split('T')[0]; // "2025-12-18"
    const [year, month, day] = dateStr.split('-').map(Number);

    if (includeTime && date.includes('T')) {
      // Se tem horário, usar o Date object
      const dateObj = new Date(date);
      return dateObj.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    // Formatar manualmente sem conversão de timezone
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    return `${dayStr}/${monthStr}/${year}`;
  }

  // Se já é um Date object, usar toLocaleDateString normalmente
  const dateObj = date;

  if (includeTime) {
    return dateObj.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Calcula quantos dias faltam até uma data
 * Parse manual para evitar problemas de timezone
 */
export function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse manual da data para evitar timezone
  const dateStr = date.split('T')[0];
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Valida se um CPF é válido
 */
export function isValidCPF(cpf: string): boolean {
  // Remove caracteres não numéricos
  cpf = cpf.replace(/\D/g, '');

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

/**
 * Formata um CPF para exibição
 */
export function formatCPF(cpf: string): string {
  cpf = cpf.replace(/\D/g, '');
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Converte qualquer formato de telefone para E.164 padrão (+5547989167448)
 * Este deve ser o formato usado para SALVAR no banco de dados
 */
export function toE164(phone: string): string | null {
  if (!phone) return null;

  // Remove caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');

  // Remove DDI 55 se já estiver presente
  if (cleaned.startsWith('55') && cleaned.length > 11) {
    cleaned = cleaned.substring(2);
  }

  // Valida se tem 10 ou 11 dígitos (DDD + número)
  if (cleaned.length !== 10 && cleaned.length !== 11) {
    return null;
  }

  // Valida se o DDD é válido (11-99)
  const ddd = parseInt(cleaned.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    return null;
  }

  // Retorna no formato E.164: +55DDNNNNNNNNN
  return '+55' + cleaned;
}

/**
 * Formata um telefone para exibição
 * Remove DDI (55) e exibe apenas no formato brasileiro (DDD) 99999-9999
 */
export function formatPhone(phone: string): string {
  // Remove caracteres não numéricos
  phone = phone.replace(/\D/g, '');

  // Remove DDI 55 se existir (telefone com 13 dígitos = 55 + DDD + número)
  if (phone.length === 13 && phone.startsWith('55')) {
    phone = phone.substring(2);
  }

  // Formata: (DDD) 99999-9999
  if (phone.length === 11) {
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  // Formata: (DDD) 9999-9999 (números antigos sem 9)
  else if (phone.length === 10) {
    return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  // Retorna original se não tiver formato reconhecido
  return phone;
}

/**
 * Formata um telefone para o padrão do BotConversa
 * O BotConversa usa o mesmo padrão do WhatsApp:
 * - Alguns DDDs usam apenas 8 dígitos (sem o nono dígito)
 * - Outros DDDs usam 9 dígitos (com o nono dígito)
 */
export function formatPhoneForBotConversa(telefone: string): string {
  const ddi = '+55';
  
  // Remove caracteres não numéricos
  let phone = telefone.replace(/\D/g, '');
  
  // Remove o DDI se já estiver presente
  if (phone.startsWith('55') && phone.length > 11) {
    phone = phone.substring(2);
  }
  
  let ddd: string;
  let numero: string;
  
  // Verifica o comprimento do número para determinar se o DDD está presente
  if (phone.length === 8) {
    // Sem DDD - adiciona o DDD padrão 47
    ddd = '47';
    numero = phone;
  } else if (phone.length === 9) {
    // Apenas número com 9 dígitos - adiciona DDD padrão 47
    ddd = '47';
    numero = phone;
  } else if (phone.length >= 10) {
    // Com DDD
    ddd = phone.slice(0, 2);
    numero = phone.slice(2);
  } else {
    // Número inválido - retorna como está
    return ddi + phone;
  }
  
  // Lista de DDDs que requerem o nono dígito (celulares com 9 na frente)
  // Basicamente todos os DDDs EXCETO os de SC (47, 48, 49), PR (41-46) e RS (51, 53, 54, 55)
  const dddsComNonoDigito = [
    '11', '12', '13', '14', '15', '16', '17', '18', '19', // São Paulo
    '21', '22', '24', // Rio de Janeiro
    '27', '28', // Espírito Santo
    '31', '32', '33', '34', '35', '37', '38', // Minas Gerais
    '61', '62', '63', '64', '65', '66', '67', '68', '69', // Centro-Oeste e Norte
    '71', '73', '74', '75', '77', '79', // Bahia e Sergipe
    '81', '82', '83', '84', '85', '86', '87', '88', '89', // Nordeste
    '91', '92', '93', '94', '95', '96', '97', '98', '99'  // Norte
  ];
  
  if (dddsComNonoDigito.includes(ddd)) {
    // DDD que requer 9 dígitos - adiciona o 9 se não tiver
    if (numero.length === 8) {
      numero = '9' + numero;
    }
  } else {
    // DDD que NÃO requer 9 dígitos (SC, PR, RS) - remove o 9 se tiver
    if (numero.length === 9 && numero.startsWith('9')) {
      numero = numero.substring(1);
    }
  }
  
  return ddi + ddd + numero;
}

/**
 * Gera o link do BotConversa para um telefone
 */
export function getBotConversaLink(telefone: string): string {
  const phoneFormatted = formatPhoneForBotConversa(telefone);
  return `https://app.botconversa.com.br/24872/live-chat/all/${phoneFormatted}`;
}

/**
 * Transforma um cliente offline para o formato Client
 * Parse manual para evitar problemas de timezone
 */
export function transformOfflineClientToClient(offlineClient: OfflineClient): Client {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse manual da data para evitar timezone
  const dateStr = offlineClient.data_expiracao.split('T')[0];
  const [year, month, day] = dateStr.split('-').map(Number);
  const expirationDate = new Date(year, month - 1, day);
  expirationDate.setHours(0, 0, 0, 0);

  return {
    id: offlineClient.id,
    nome: offlineClient.nome,
    telefone: offlineClient.telefone,
    cpf: offlineClient.cpf || '',
    data_nascimento: '',
    status: expirationDate >= today ? 'Ativo' : 'Expirado',
    data_expiracao: offlineClient.data_expiracao,
    email: offlineClient.email || '',
    valor: offlineClient.valor_mensal || 0,
    total_creditos: 0,
    painel1_login: offlineClient.login_01 || '',
    painel1_senha: offlineClient.senha_01 || '',
    painel1_nome: offlineClient.painel_01 || '',
    painel2_login: offlineClient.login_02 || '',
    painel2_senha: offlineClient.senha_02 || '',
    painel2_nome: offlineClient.painel_02 || '',
    painel3_login: offlineClient.login_03 || '',
    painel3_senha: offlineClient.senha_03 || '',
    painel3_nome: offlineClient.painel_03 || '',
    created_at: offlineClient.created_at,
    updated_at: offlineClient.updated_at,
  };
}
