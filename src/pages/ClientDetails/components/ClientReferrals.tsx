import { Users, Search, Filter, DollarSign, X } from 'lucide-react';
import { useState } from 'react';
import type { Referral } from '../hooks/useClientReferrals';
import { formatDateBR } from '../../../utils/dateUtils';
import { formatPhone } from '../../../utils/clientHelpers';

interface ClientReferralsProps {
  referrals: Referral[];
  totalCommission: number;
  onWithdrawCommission: () => void;
  filterReferrals: (filter: 'all' | 'subscribers' | 'non_subscribers', searchTerm: string) => Referral[];
  isOpen: boolean;
  onClose: () => void;
}

export function ClientReferrals({
  referrals,
  totalCommission,
  onWithdrawCommission,
  filterReferrals,
  isOpen,
  onClose,
}: ClientReferralsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'subscribers' | 'non_subscribers'>('all');

  const filteredReferrals = filterReferrals(filter, searchTerm);
  const subscribersCount = referrals.filter(r => r.is_subscriber).length;
  const nonSubscribersCount = referrals.length - subscribersCount;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-900/30 rounded-lg border border-purple-700">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Indicações</h2>
              <p className="text-sm text-slate-400">
                {referrals.length} indicações · {subscribersCount} assinantes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
            title="Fechar"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Saldo de Comissão */}
        <div className="text-center mb-6">
          <p className="text-sm text-slate-400 mb-1">Comissão Disponível</p>
          <p className="text-2xl font-bold text-green-400">
            R$ {totalCommission.toFixed(2)}
          </p>
          {totalCommission >= 35 && (
            <button
              onClick={onWithdrawCommission}
              className="mt-2 inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors mx-auto"
            >
              <DollarSign className="w-4 h-4 mr-1" />
              Resgatar
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, email ou telefone..."
              className="w-full pl-10 pr-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="pl-10 pr-8 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500 appearance-none"
            >
              <option value="all">Todos ({referrals.length})</option>
              <option value="subscribers">Assinantes ({subscribersCount})</option>
              <option value="non_subscribers">Não Assinantes ({nonSubscribersCount})</option>
            </select>
          </div>
        </div>

        {/* Lista de Indicações */}
        {filteredReferrals.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {searchTerm || filter !== 'all' ? 'Nenhuma indicação encontrada com os filtros aplicados' : 'Nenhuma indicação ainda'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Comissão Gerada
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody className="bg-slate-900 divide-y divide-slate-700">
                {filteredReferrals.map((referral) => (
                  <tr key={referral.id} className="hover:bg-slate-700/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-200">
                        {referral.referred_user?.full_name || 'Nome não disponível'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-slate-400">
                        {referral.referred_user?.phone ? formatPhone(referral.referred_user.phone) : (referral.referred_user?.email || '-')}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          referral.is_subscriber
                            ? 'bg-green-900/30 text-green-300 border border-green-700'
                            : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                        }`}
                      >
                        {referral.is_subscriber ? 'Assinante' : 'Não Assinante'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200">
                      {referral.total_commission_earned > 0 ? (
                        <span className="font-medium text-green-400">
                          R$ {referral.total_commission_earned.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-500">R$ 0,00</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400">
                      {formatDateBR(referral.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
