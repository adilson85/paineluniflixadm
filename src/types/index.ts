// ============================================================
// NOVO SCHEMA UNIFICADO - UNIFLIX
// ============================================================

export interface User {
  id: string;
  full_name: string;
  phone: string | null;
  cpf: string | null;
  email: string | null;
  data_nascimento: string | null;
  referral_code: string | null;
  referred_by: string | null;
  total_commission: number;
  id_botconversa: number | null;
  created_at: string;
  updated_at: string;
  // Campos de endereço
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string | null;
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  app_username: string;
  app_password: string;
  panel_name: string | null;
  expiration_date: string;
  monthly_value: number | null;
  mac_address: string | null;
  device_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithSubscriptions extends User {
  subscriptions: Subscription[];
}

// ============================================================
// TIPOS PARA CLIENTES OFFLINE
// ============================================================

export interface OfflineClient {
  id: string;

  // Dados básicos
  nome: string;
  telefone: string;
  cpf: string | null;
  email: string | null;
  id_botconversa: number | null;

  // Login 01
  login_01: string | null;
  senha_01: string | null;
  painel_01: string | null;

  // Login 02
  login_02: string | null;
  senha_02: string | null;
  painel_02: string | null;

  // Login 03
  login_03: string | null;
  senha_03: string | null;
  painel_03: string | null;

  // Financeiro e validade
  data_expiracao: string;
  valor_mensal: number | null;

  // Migração
  migrated_to_user_id: string | null;
  migrated_at: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Campo calculado no cliente baseado em data_expiracao
  status?: 'Ativo' | 'Expirado';
}

// ============================================================
// TIPOS LEGADOS (para compatibilidade temporária)
// ============================================================

export interface Client {
  id: string;
  nome: string;
  telefone: string;
  cpf: string;
  data_nascimento: string;
  status: string;
  data_expiracao: string;
  email: string;
  valor?: number;
  total_creditos?: number;
  painel1_login: string;
  painel1_senha: string;
  painel1_nome: string;
  painel2_login: string;
  painel2_senha: string;
  painel2_nome: string;
  painel3_login: string;
  painel3_senha: string;
  painel3_nome: string;
  created_at?: string;
  updated_at?: string;
  // Campos adicionais
  mac_address?: string;
  device_key?: string;
  codigo_referencia?: string;
  indicado_por?: string;
  total_comissao?: number;
  id_botconversa?: string;
  teste?: string;
  data_criacao?: string;
  ultima_atualizacao?: string;
  // Campos de endereço
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

export interface CaixaMovimentacao {
  id: number;
  data: string;
  historico: string;
  entrada: number | null;
  saida: number | null;
  created_at: string;
  updated_at: string;
}

export interface MonthSummary {
  month: string;
  totalEntrada: number;
  totalSaida: number;
  saldo: number;
}

export interface TesteLiberado {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  usuario1: string | null;
  senha1: string | null;
  painel1: string | null;
  data_teste: string;
  aplicativo: string | null;
  assinante: boolean;
  valor_pago: number;
  quantidade_teste: number;
  created_at: string;
}

export interface PainelSummary {
  painel: string;
  totalTestes: number;
  totalAssinantes: number;
  conversao: number;
}

export interface MonthTestSummary {
  mes: string;
  totalTestes: number;
  totalAssinantes: number;
  conversao: number;
}

export interface CompraCredito {
  id: string;
  data: string;
  painel: string;
  quantidade_creditos: number;
  valor_total: number;
  created_at: string;
}

export interface CreditoMensal {
  mes: string;
  total_creditos: number;
  valor_total: number;
  custo_medio: number;
  paineis: {
    painel: string;
    creditos: number;
    valor_total: number;
    custo_medio: number;
  }[];
}

export interface CreditoVendido {
  id: string;
  data: string;
  historico: string;
  painel: string | null;
  quantidade_creditos: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// TIPOS PARA REVENDEDORES
// ============================================================

export interface Reseller {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  status: 'active' | 'inactive' | 'suspended';
  credit_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Panel {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResellerPanel {
  id: string;
  reseller_id: string;
  panel_name: string;
  panel_login: string;
  panel_password: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResellerPricing {
  id: string;
  panel_name: string;
  min_quantity: number;
  max_quantity: number | null;
  price_per_credit: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResellerRecharge {
  id: string;
  reseller_id: string;
  panel_name: string;
  quantity: number;
  price_per_credit: number;
  total_amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResellerWithPanels extends Reseller {
  panels: ResellerPanel[];
}

// ============================================================
// TIPOS PARA PREÇOS E PROMOÇÕES
// ============================================================

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  promotion_type: 'percentage' | 'fixed_amount' | 'free_period' | 'bonus_credits';
  apply_to: 'all_plans' | 'ponto_unico' | 'ponto_duplo' | 'ponto_triplo' | 'specific_plan';
  apply_to_period: 'all_periods' | 'mensal' | 'trimestral' | 'semestral' | 'anual' | null;
  plan_id: string | null;
  discount_percentage: number | null;
  discount_amount: number | null;
  free_days: number | null;
  bonus_credits: number | null;
  start_date: string;
  end_date: string | null;
  max_uses: number | null;
  current_uses: number;
  is_individual: boolean;
  conditions: {
    keep_payments_current?: boolean;
    max_recharges?: number;
    [key: string]: any;
  } | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  // Dados relacionados (quando usado com JOIN)
  promotion_users?: PromotionUser[];
}

export interface PromotionUser {
  id: string;
  promotion_id: string;
  user_id: string;
  uses_count: number;
  max_uses: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromotionUse {
  id: string;
  promotion_id: string;
  user_id: string | null;
  subscription_id: string | null;
  original_price: number;
  discounted_price: number;
  discount_applied: number;
  created_at: string;
}