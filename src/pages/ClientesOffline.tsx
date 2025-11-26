import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { NovoClienteOfflineModal } from '../components/modals/NovoClienteOfflineModal';
import { useOfflineClients } from '../hooks/useOfflineClients';
import { getOfflineClientPlanType, getDaysUntilExpiration } from '../utils/offlineClientHelpers';
import { formatCurrency, formatDate, formatCPF, formatPhone } from '../utils/clientHelpers';
import { 
  UserPlus, 
  Search, 
  Filter, 
  Users, 
  RefreshCw,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { DatePicker } from '../components/DatePicker';

export default function ClientesOffline() {
  const navigate = useNavigate();
  const {
    clients,
    loading,
    error,
    refetch,
    filterClients,
  } = useOfflineClients();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Ativo' | 'Expirado'>('all');
  const [planFilter, setPlanFilter] = useState<'all' | 'ponto_unico' | 'ponto_duplo' | 'ponto_triplo'>('all');
  const [dateFilterType, setDateFilterType] = useState<'none' | 'single' | 'range'>('none');
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [sortField, setSortField] = useState<'nome' | 'data_expiracao' | 'valor_mensal' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtrar clientes
  let filteredClients = filterClients(searchTerm, statusFilter);

  // Filtro por plano
  if (planFilter !== 'all') {
    filteredClients = filteredClients.filter(client => {
      const planInfo = getOfflineClientPlanType(client);
      return planInfo.type === planFilter;
    });
  }

  // Filtro por data de expiração
  if (dateFilterType === 'single' && singleDate) {
    filteredClients = filteredClients.filter(client => {
      const clientDate = new Date(client.data_expiracao);
      clientDate.setHours(0, 0, 0, 0);
      const filterDate = new Date(singleDate);
      filterDate.setHours(0, 0, 0, 0);
      return clientDate.getTime() === filterDate.getTime();
    });
  } else if (dateFilterType === 'range') {
    filteredClients = filteredClients.filter(client => {
      const clientDate = new Date(client.data_expiracao);
      clientDate.setHours(0, 0, 0, 0);
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (clientDate < start) return false;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (clientDate > end) return false;
      }
      
      return true;
    });
  }

  // Ordenação
  const sortedClients = useMemo(() => {
    if (sortField) {
      // Ordenação manual quando há campo selecionado
      return [...filteredClients].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
          case 'nome':
            aValue = a.nome?.toLowerCase() || '';
            bValue = b.nome?.toLowerCase() || '';
            break;
          case 'data_expiracao':
            aValue = new Date(a.data_expiracao).getTime();
            bValue = new Date(b.data_expiracao).getTime();
            break;
          case 'valor_mensal':
            aValue = a.valor_mensal || 0;
            bValue = b.valor_mensal || 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Ordenação padrão: hoje primeiro, depois amanhã, depois próximos dias, por último expirados
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return [...filteredClients].sort((a, b) => {
      const dateA = new Date(a.data_expiracao);
      dateA.setHours(0, 0, 0, 0);
      const dateB = new Date(b.data_expiracao);
      dateB.setHours(0, 0, 0, 0);

      const isAExpired = dateA < today;
      const isBExpired = dateB < today;
      const isAToday = dateA.getTime() === today.getTime();
      const isBToday = dateB.getTime() === today.getTime();
      const isATomorrow = dateA.getTime() === tomorrow.getTime();
      const isBTomorrow = dateB.getTime() === tomorrow.getTime();

      // Expirados sempre por último
      if (isAExpired && !isBExpired) return 1;
      if (!isAExpired && isBExpired) return -1;
      if (isAExpired && isBExpired) {
        // Entre expirados, ordenar por data (mais recente primeiro)
        return dateB.getTime() - dateA.getTime();
      }

      // Hoje primeiro
      if (isAToday && !isBToday) return -1;
      if (!isAToday && isBToday) return 1;

      // Amanhã segundo
      if (isATomorrow && !isBTomorrow && !isBToday) return -1;
      if (!isATomorrow && isBTomorrow && !isAToday) return 1;

      // Depois ordenar por data crescente (próximos dias)
      return dateA.getTime() - dateB.getTime();
    });
  }, [filteredClients, sortField, sortDirection]);

  // Paginação
  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedClients = sortedClients.slice(startIndex, endIndex);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, planFilter, dateFilterType, singleDate, startDate, endDate]);

  const handleSort = (field: 'nome' | 'data_expiracao' | 'valor_mensal') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPlanFilter('all');
    setDateFilterType('none');
    setSingleDate('');
    setStartDate('');
    setEndDate('');
    setSortField(null);
    setCurrentPage(1);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || planFilter !== 'all' || dateFilterType !== 'none' || sortField !== null;

  // Estatísticas
  const totalClientes = clients.length;
  const clientesAtivos = clients.filter(c => c.status === 'Ativo').length;
  const clientesExpirados = clients.filter(c => c.status === 'Expirado').length;

  const handleNovoClienteSuccess = () => {
    refetch();
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'Ativo':
        return 'bg-green-900/30 text-green-300 border border-green-700';
      case 'Expirado':
        return 'bg-red-900/30 text-red-300 border border-red-700';
      default:
        return 'bg-slate-700/50 text-slate-300 border border-slate-600';
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Clientes Offline</h1>
            <p className="text-slate-400 mt-1">
              Clientes que pagam via WhatsApp e não têm acesso ao painel
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowNovoModal(true)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Novo Cliente Offline
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total de Clientes</p>
                <p className="text-3xl font-bold text-slate-100 mt-2">{totalClientes}</p>
              </div>
              <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Clientes Ativos</p>
                <p className="text-3xl font-bold text-green-400 mt-2">{clientesAtivos}</p>
              </div>
              <div className="p-3 bg-green-900/30 rounded-lg border border-green-700">
                <Users className="w-8 h-8 text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Clientes Expirados</p>
                <p className="text-3xl font-bold text-red-400 mt-2">{clientesExpirados}</p>
              </div>
              <div className="p-3 bg-red-900/30 rounded-lg border border-red-700">
                <Users className="w-8 h-8 text-red-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700 mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Busca */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome, telefone, email ou CPF..."
                  className="w-full pl-10 pr-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Filtro de Status */}
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">Todos ({totalClientes})</option>
                  <option value="Ativo">Ativos ({clientesAtivos})</option>
                  <option value="Expirado">Expirados ({clientesExpirados})</option>
                </select>
              </div>

              {/* Filtro de Plano */}
              <div className="flex items-center space-x-2">
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">Todos os Planos</option>
                  <option value="ponto_unico">Ponto Único</option>
                  <option value="ponto_duplo">Ponto Duplo</option>
                  <option value="ponto_triplo">Ponto Triplo</option>
                </select>
              </div>

              {/* Botão Limpar Filtros */}
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="flex items-center px-4 py-2 bg-slate-700 text-slate-200 rounded-md hover:bg-slate-600 transition-colors"
                  title="Limpar todos os filtros"
                >
                  <X className="w-4 h-4 mr-2" />
                  Limpar
                </button>
              )}
            </div>

            {/* Filtro por Data de Expiração */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-700">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-300">Filtrar por Data de Expiração:</span>
                <select
                  value={dateFilterType}
                  onChange={(e) => {
                    setDateFilterType(e.target.value as any);
                    if (e.target.value === 'none') {
                      setSingleDate('');
                      setStartDate('');
                      setEndDate('');
                    }
                  }}
                  className="px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="none">Sem filtro de data</option>
                  <option value="single">Data específica</option>
                  <option value="range">Período</option>
                </select>
              </div>

              {/* Filtro por data única */}
              {dateFilterType === 'single' && (
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-slate-400">Data:</label>
                  <DatePicker
                    value={singleDate}
                    onChange={setSingleDate}
                    placeholder="Selecione uma data"
                    className="w-auto"
                  />
                </div>
              )}

              {/* Filtro por período */}
              {dateFilterType === 'range' && (
                <div className="flex items-center space-x-2 flex-wrap">
                  <label className="text-sm text-slate-400">De:</label>
                  <DatePicker
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Data inicial"
                    className="w-auto"
                  />
                  <label className="text-sm text-slate-400">Até:</label>
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="Data final"
                    className="w-auto"
                  />
                </div>
              )}
            </div>

            {/* Contador de Resultados */}
            <div className="flex items-center justify-between text-sm text-slate-400 pt-2 border-t border-slate-700">
              <span>
                Mostrando <span className="font-semibold text-slate-300">{paginatedClients.length}</span> de{' '}
                <span className="font-semibold text-slate-300">{sortedClients.length}</span> cliente{sortedClients.length !== 1 ? 's' : ''}
                {hasActiveFilters && ' (filtrado)'}
              </span>
              {hasActiveFilters && (
                <span className="flex items-center text-yellow-400">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Filtros ativos
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden">
            <div className="p-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                      <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                    </div>
                    <div className="h-4 bg-slate-700 rounded w-24"></div>
                    <div className="h-4 bg-slate-700 rounded w-24"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Tabela */}
        {!loading && !error && (
          <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden">
            {filteredClients.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Nenhum cliente encontrado com os filtros aplicados'
                    : 'Nenhum cliente offline cadastrado ainda'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-700">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                        onClick={() => handleSort('nome')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Cliente</span>
                          {sortField === 'nome' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Contato
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Plano
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                        onClick={() => handleSort('data_expiracao')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Expiração</span>
                          {sortField === 'data_expiracao' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-800 divide-y divide-slate-700">
                    {paginatedClients.map((client) => {
                      const planInfo = getOfflineClientPlanType(client);
                      const daysUntilExpiration = getDaysUntilExpiration(client.data_expiracao);

                      return (
                        <tr 
                          key={client.id} 
                          className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/clientes-offline/${client.id}`)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-slate-200">{client.nome}</div>
                              {client.cpf && (
                                <div className="text-xs text-slate-400">CPF: {formatCPF(client.cpf)}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-300">{formatPhone(client.telefone)}</div>
                            {client.email && (
                              <div className="text-xs text-slate-400">{client.email}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(client.status)}`}>
                              {client.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-300">{planInfo.label}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm text-slate-300">
                                {formatDate(client.data_expiracao)}
                              </div>
                              {client.status === 'Ativo' && (
                                <div className={`text-xs font-medium flex items-center mt-1 ${
                                  daysUntilExpiration <= 3 
                                    ? 'text-red-400' 
                                    : daysUntilExpiration <= 7 
                                    ? 'text-yellow-400' 
                                    : 'text-slate-400'
                                }`}>
                                  {daysUntilExpiration <= 7 && (
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                  )}
                                  {daysUntilExpiration > 0 
                                    ? `${daysUntilExpiration} dia${daysUntilExpiration !== 1 ? 's' : ''} restante${daysUntilExpiration !== 1 ? 's' : ''}`
                                    : 'Expira hoje'}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginação */}
            {!loading && !error && sortedClients.length > 0 && totalPages > 1 && (
              <div className="bg-slate-900/50 px-6 py-4 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-400">Itens por página:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-400">
                      Página {currentPage} de {totalPages}
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Página anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Próxima página"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Novo Cliente */}
      <NovoClienteOfflineModal
        isOpen={showNovoModal}
        onClose={() => setShowNovoModal(false)}
        onSuccess={handleNovoClienteSuccess}
      />
    </Layout>
  );
}
