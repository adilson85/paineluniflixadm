import { Link } from 'react-router-dom';
import { ArrowLeft, Monitor, Edit2, Plus, DollarSign, Users, CheckCircle, MessageCircle } from 'lucide-react';
import type { Client } from '../../../types';
import { formatPhone } from '../../../utils/clientHelpers';

interface ClientHeaderProps {
  client: Client;
  onAddCredits: () => void;
  onEditProfile: () => void;
  totalCommission: number;
  totalReferrals: number;
  subscribersCount: number;
  onViewReferrals: () => void;
}

export function ClientHeader({
  client,
  onAddCredits,
  onEditProfile,
  totalCommission,
  totalReferrals,
  subscribersCount,
  onViewReferrals,
}: ClientHeaderProps) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ativo':
      case 'ativado':
        return 'bg-green-900/30 text-green-300 border border-green-700';
      case 'expirado':
        return 'bg-red-900/30 text-red-300 border border-red-700';
      case 'teste':
        return 'bg-blue-900/30 text-blue-300 border border-blue-700';
      default:
        return 'bg-slate-700/50 text-slate-300 border border-slate-600';
    }
  };

  const getBotConversaLink = (telefone: string) => {
    const cleanPhone = telefone.replace(/\D/g, '');
    return `https://app.botconversa.com.br/24872/live-chat/all/+55${cleanPhone}`;
  };

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg p-6 mb-6 border border-slate-700">
      {/* Breadcrumb e ações */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/"
          className="flex items-center text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Dashboard
        </Link>

        <div className="flex items-center space-x-2">
          <button
            onClick={onAddCredits}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Créditos
          </button>
          <button
            onClick={onEditProfile}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Editar Dados
          </button>
        </div>
      </div>

      {/* Informações do cliente */}
      <div className="flex items-start">
        <div className="p-3 bg-blue-900/30 rounded-lg mr-4 border border-blue-700">
          <Monitor className="w-8 h-8 text-blue-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-2xl font-bold text-slate-100">{client.nome}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(client.status)}`}>
              {client.status}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {client.telefone && (
              <div>
                <span className="text-slate-400">Telefone:</span>
                <span className="ml-2 text-slate-200 font-medium">{formatPhone(client.telefone)}</span>
                <a
                  href={getBotConversaLink(client.telefone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-400 hover:text-blue-300 inline-flex"
                  title="Abrir no BotConversa"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              </div>
            )}
            {client.email && (
              <div>
                <span className="text-slate-400">Email:</span>
                <span className="ml-2 text-slate-200 font-medium">{client.email}</span>
              </div>
            )}
            {client.cpf && (
              <div>
                <span className="text-slate-400">CPF:</span>
                <span className="ml-2 text-slate-200 font-medium">{client.cpf}</span>
              </div>
            )}
            {client.codigo_referencia && (
              <div>
                <span className="text-slate-400">Código Referência:</span>
                <span className="ml-2 text-slate-200 font-medium font-mono">{client.codigo_referencia}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cards de Indicação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="p-4 bg-gradient-to-br from-green-900/20 to-green-800/20 rounded-lg border border-green-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-300 mb-1">Total em Comissões</p>
              <p className="text-2xl font-bold text-green-400">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(totalCommission)}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-green-400 opacity-20" />
          </div>
        </div>

        <button
          onClick={onViewReferrals}
          disabled={totalReferrals === 0}
          className="p-4 bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-lg border border-blue-700 hover:from-blue-800/30 hover:to-blue-700/30 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-left"
        >
          <div className="flex items-center justify-between pointer-events-none">
            <div>
              <p className="text-sm text-blue-300 mb-1">Total Indicados</p>
              <p className="text-2xl font-bold text-blue-400">{totalReferrals}</p>
            </div>
            <Users className="w-10 h-10 text-blue-400 opacity-20" />
          </div>
        </button>

        <div className="p-4 bg-gradient-to-br from-purple-900/20 to-purple-800/20 rounded-lg border border-purple-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-300 mb-1">Assinantes</p>
              <p className="text-2xl font-bold text-purple-400">{subscribersCount}</p>
              <p className="text-xs text-purple-400 mt-1">
                de {totalReferrals} indicado{totalReferrals !== 1 ? 's' : ''}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-purple-400 opacity-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
