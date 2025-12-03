import React, { useEffect, useState, useMemo } from 'react';
import { Search, Filter, CalendarDays, Edit2, X, Check, Plus, Copy, CheckCircle2, Trash2, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import type { TesteLiberado } from '../types';
import { formatDateBR } from '../utils/dateUtils';
import { formatPhone } from '../utils/clientHelpers';

interface TesteSummary {
  period: string;
  total: number;
  assinantes: number;
  naoAssinantes: number;
}

export default function TestesLiberados() {
  const [testes, setTestes] = useState<TesteLiberado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [painelFilter, setPainelFilter] = useState('');
  const [mesFilter, setMesFilter] = useState('');
  const [paineis, setPaineis] = useState<string[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
  const [editingTeste, setEditingTeste] = useState<TesteLiberado | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<TesteLiberado>>({});
  const [showTornarAssinanteModal, setShowTornarAssinanteModal] = useState(false);
  const [testeParaAssinante, setTesteParaAssinante] = useState<TesteLiberado | null>(null);
  const [rechargeOptions, setRechargeOptions] = useState<Array<{
    id: string;
    plan_type: string;
    period: string;
    duration_months: number;
    price: number;
    display_name: string;
  }>>([]);
  const [assinanteFormData, setAssinanteFormData] = useState({
    plan_type: 'ponto_unico',
    recharge_option_id: '',
    desconto_tipo: 'percentual' as 'percentual' | 'fixo',
    desconto_valor: 0,
    valor_pago: 0,
    login1: '',
    senha1: '',
    painel1: '',
    login2: '',
    senha2: '',
    painel2: '',
    login3: '',
    senha3: '',
    painel3: '',
  });
  const [showNovoTesteModal, setShowNovoTesteModal] = useState(false);
  const [isSavingNovoTeste, setIsSavingNovoTeste] = useState(false);
  const [availablePanels, setAvailablePanels] = useState<Array<{ name: string; display_name: string }>>([]);
  const [novoTesteForm, setNovoTesteForm] = useState({
    nome: '',
    telefone: '',
    email: '',
    usuario1: '',
    senha1: '',
    painel1: '',
    data_teste: new Date().toISOString().split('T')[0],
    aplicativo: '',
    quantidade_teste: 1,
  });
  const [showCredenciaisModal, setShowCredenciaisModal] = useState(false);
  const [credenciaisGeradas, setCredenciaisGeradas] = useState<{
    email: string;
    senha: string;
    nomeCliente: string;
  } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [testeParaExcluir, setTesteParaExcluir] = useState<TesteLiberado | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Resumos
  const [summaries, setSummaries] = useState<TesteSummary[]>([]);

  useEffect(() => {
    fetchTestes();
    fetchRechargeOptions();
    fetchPanels();
  }, []);

  async function fetchPanels() {
    try {
      const { data, error: panelsError } = await supabase
        .from('panels')
        .select('name, display_name')
        .eq('active', true)
        .order('name');

      if (panelsError) throw panelsError;

      setAvailablePanels((data || []).map(p => ({ name: p.name, display_name: p.display_name })));
    } catch (err) {
      console.error('Error fetching panels:', err);
      // Fallback
      setAvailablePanels([
        { name: 'Unitv', display_name: 'Unitv' },
        { name: 'Warez', display_name: 'Warez' },
        { name: 'Elite', display_name: 'Elite' }
      ]);
    }
  }

  async function fetchRechargeOptions() {
    try {
      const { data, error } = await supabase
        .from('recharge_options')
        .select('*')
        .eq('active', true)
        .order('plan_type, duration_months');

      if (error) throw error;
      setRechargeOptions(data || []);
    } catch (err) {
      console.error('Error fetching recharge options:', err);
    }
  }

  async function fetchTestes() {
    try {
      setError(null);
      const { data, error: supabaseError } = await supabase
        .from('testes_liberados')
        .select('*')
        .order('data_teste', { ascending: false });

      if (supabaseError) throw supabaseError;

      setTestes(data || []);
      const uniquePaineis = [...new Set((data || []).map((t: any) => t.painel1))];
      setPaineis(uniquePaineis);

      const uniqueMeses = [...new Set((data || []).map((t: any) => {
        // Extrai apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
        const dateOnly = t.data_teste.split('T')[0];
        const [year, month] = dateOnly.split('-');
        return `${year}-${month}`;
      }))];
      setMeses(uniqueMeses.sort().reverse());

      // Calcular resumos
      calculateSummaries(data || []);
    } catch (err) {
      console.error('Error fetching testes:', err);
      setError('Erro ao carregar os dados. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const calculateSummaries = (data: TesteLiberado[]) => {
    // Data atual no timezone do Brasil
    const today = new Date();
    const todayKey = today.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).split('/').reverse().join('-'); // YYYY-MM-DD

    const currentMonth = today.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit'
    }).split('/').reverse().join('-'); // YYYY-MM

    // Mês passado
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthKey = lastMonth.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit'
    }).split('/').reverse().join('-'); // YYYY-MM

    // Contadores
    let todayTotal = 0, todayAssinantes = 0, todayNaoAssinantes = 0;
    let currentMonthTotal = 0, currentMonthAssinantes = 0, currentMonthNaoAssinantes = 0;
    let lastMonthTotal = 0, lastMonthAssinantes = 0, lastMonthNaoAssinantes = 0;

    data.forEach(teste => {
      const dateOnly = teste.data_teste.split('T')[0];
      const [year, month] = dateOnly.split('-');
      const monthKey = `${year}-${month}`;

      // Hoje
      if (dateOnly === todayKey) {
        todayTotal++;
        if (teste.assinante) todayAssinantes++;
        else todayNaoAssinantes++;
      }

      // Mês atual
      if (monthKey === currentMonth) {
        currentMonthTotal++;
        if (teste.assinante) currentMonthAssinantes++;
        else currentMonthNaoAssinantes++;
      }

      // Mês passado
      if (monthKey === lastMonthKey) {
        lastMonthTotal++;
        if (teste.assinante) lastMonthAssinantes++;
        else lastMonthNaoAssinantes++;
      }
    });

    setSummaries([
      {
        period: 'today',
        total: todayTotal,
        assinantes: todayAssinantes,
        naoAssinantes: todayNaoAssinantes
      },
      {
        period: currentMonth,
        total: currentMonthTotal,
        assinantes: currentMonthAssinantes,
        naoAssinantes: currentMonthNaoAssinantes
      },
      {
        period: lastMonthKey,
        total: lastMonthTotal,
        assinantes: lastMonthAssinantes,
        naoAssinantes: lastMonthNaoAssinantes
      }
    ]);
  };

  const filteredTestes = useMemo(() => {
    return testes.filter(teste => {
      const matchesSearch =
        teste.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (teste.telefone && teste.telefone.includes(searchTerm));

      const matchesPainel = !painelFilter || teste.painel1 === painelFilter;

      // Extrai apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
      const dateOnly = teste.data_teste.split('T')[0];
      const [year, month] = dateOnly.split('-');
      const monthKey = `${year}-${month}`;
      const matchesMes = !mesFilter || monthKey === mesFilter;

      return matchesSearch && matchesPainel && matchesMes;
    });
  }, [testes, searchTerm, painelFilter, mesFilter]);

  // Cálculos de paginação
  const totalPages = Math.ceil(filteredTestes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTestes = filteredTestes.slice(startIndex, endIndex);

  // Reset página ao mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, painelFilter, mesFilter]);

  const formatDate = (dateString: string) => formatDateBR(dateString);
  const formatMonth = (monthKey: string) => {
    if (monthKey === 'Total Geral') return monthKey;
    const [year, month] = monthKey.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const formatPeriod = (period: string) => {
    if (period === 'today') {
      return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    }
    const [year, month] = period.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleEditClick = (teste: TesteLiberado) => {
    setEditingTeste(teste);
    setEditFormData({
      nome: teste.nome,
      telefone: teste.telefone || '',
      email: teste.email || '',
      usuario1: teste.usuario1 || '',
      senha1: teste.senha1 || '',
      painel1: teste.painel1 || '',
      data_teste: teste.data_teste,
      aplicativo: teste.aplicativo || '',
      quantidade_teste: teste.quantidade_teste,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTeste || isSaving) return;

    try {
      setIsSaving(true);
      setError(null);

      const updateData: any = {
        nome: editFormData.nome,
        telefone: editFormData.telefone || null,
        email: editFormData.email || null,
        usuario1: editFormData.usuario1 || null,
        senha1: editFormData.senha1 || null,
        painel1: editFormData.painel1 || null,
        data_teste: editFormData.data_teste,
        aplicativo: editFormData.aplicativo || null,
        quantidade_teste: editFormData.quantidade_teste || 1,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('testes_liberados')
        .update(updateData)
        .eq('id', editingTeste.id);

      if (updateError) throw updateError;

      await fetchTestes();
      setIsEditing(false);
      setEditingTeste(null);
      setEditFormData({});
    } catch (err) {
      console.error('Error updating teste:', err);
      setError('Erro ao atualizar o teste. Por favor, tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingTeste(null);
    setEditFormData({});
    setError(null);
  };

  const handleDeleteTeste = async () => {
    if (!testeParaExcluir) return;

    if (deleteConfirmText !== testeParaExcluir.nome) {
      setError(`Digite "${testeParaExcluir.nome}" para confirmar`);
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/delete-teste`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          testeId: testeParaExcluir.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao excluir teste');
      }

      // Recarregar lista de testes
      await fetchTestes();
      
      // Fechar modal
      setShowDeleteModal(false);
      setTesteParaExcluir(null);
      setDeleteConfirmText('');
    } catch (err: any) {
      console.error('Erro ao excluir teste:', err);
      setError(err.message || 'Erro ao excluir teste. Por favor, tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTornarAssinanteClick = (teste: TesteLiberado, e: React.MouseEvent) => {
    e.stopPropagation(); // Previne que o clique abra o modal de edição
    setTesteParaAssinante(teste);
    // Determinar tipo de plano baseado na quantidade de testes
    let planType = 'ponto_unico';
    if (teste.quantidade_teste === 2) planType = 'ponto_duplo';
    else if (teste.quantidade_teste >= 3) planType = 'ponto_triplo';
    
    // Buscar primeira opção mensal do plano
    const firstOption = rechargeOptions.find(
      opt => opt.plan_type === planType && opt.period === 'mensal'
    );

    setAssinanteFormData({
      plan_type: planType,
      recharge_option_id: firstOption?.id || '',
      desconto_tipo: 'percentual',
      desconto_valor: 0,
      valor_pago: firstOption?.price || 0,
      login1: teste.usuario1 || '',
      senha1: teste.senha1 || '',
      painel1: teste.painel1 || '',
      login2: '',
      senha2: '',
      painel2: '',
      login3: '',
      senha3: '',
      painel3: '',
    });
    setShowTornarAssinanteModal(true);
  };

  const calculateFinalPrice = (optionPrice: number, descontoTipo: string, descontoValor: number): number => {
    if (!optionPrice || descontoValor <= 0) return optionPrice;
    
    if (descontoTipo === 'percentual') {
      return optionPrice * (1 - descontoValor / 100);
    } else {
      return Math.max(0, optionPrice - descontoValor);
    }
  };

  const handleRechargeOptionChange = (optionId: string) => {
    const selectedOption = rechargeOptions.find(opt => opt.id === optionId);
    if (selectedOption) {
      const finalPrice = calculateFinalPrice(
        selectedOption.price,
        assinanteFormData.desconto_tipo,
        assinanteFormData.desconto_valor
      );
      setAssinanteFormData({
        ...assinanteFormData,
        recharge_option_id: optionId,
        plan_type: selectedOption.plan_type,
        valor_pago: finalPrice,
      });
    }
  };

  const handleDescontoChange = (tipo: 'percentual' | 'fixo', valor: number) => {
    const selectedOption = rechargeOptions.find(opt => opt.id === assinanteFormData.recharge_option_id);
    if (selectedOption) {
      const finalPrice = calculateFinalPrice(selectedOption.price, tipo, valor);
      setAssinanteFormData({
        ...assinanteFormData,
        desconto_tipo: tipo,
        desconto_valor: valor,
        valor_pago: finalPrice,
      });
    }
  };

  const handleConfirmarAssinante = async () => {
    if (!testeParaAssinante || isSaving) return;

    try {
      setIsSaving(true);
      setError(null);

      // Validações
      if (!assinanteFormData.login1 || !assinanteFormData.senha1) {
        throw new Error('Login 1 e Senha 1 são obrigatórios');
      }

      if (assinanteFormData.plan_type === 'ponto_duplo') {
        if (!assinanteFormData.login2 || !assinanteFormData.senha2) {
          throw new Error('Ponto Duplo requer Login 2 e Senha 2');
        }
      }

      if (assinanteFormData.plan_type === 'ponto_triplo') {
        if (!assinanteFormData.login2 || !assinanteFormData.senha2) {
          throw new Error('Ponto Triplo requer Login 2 e Senha 2');
        }
        if (!assinanteFormData.login3 || !assinanteFormData.senha3) {
          throw new Error('Ponto Triplo requer Login 3 e Senha 3');
        }
      }

      const selectedOption = rechargeOptions.find(opt => opt.id === assinanteFormData.recharge_option_id);
      if (!selectedOption) {
        throw new Error('Opção de recarga não selecionada');
      }

      // Criar cliente completo usando Edge Function
      const { data: resultado, error: createError } = await supabase.functions.invoke('create-client-from-test', {
        body: {
          testeId: testeParaAssinante.id,
          planType: assinanteFormData.plan_type,
          rechargeOptionId: assinanteFormData.recharge_option_id,
          valorPago: assinanteFormData.valor_pago,
          login1: assinanteFormData.login1,
          senha1: assinanteFormData.senha1,
          painel1: assinanteFormData.painel1 || testeParaAssinante.painel1 || '',
          login2: assinanteFormData.login2 || null,
          senha2: assinanteFormData.senha2 || null,
          painel2: assinanteFormData.painel2 || null,
          login3: assinanteFormData.login3 || null,
          senha3: assinanteFormData.senha3 || null,
          painel3: assinanteFormData.painel3 || null,
        },
      });

      if (createError) {
        console.error('Erro ao chamar Edge Function:', createError);
        throw createError;
      }

      if (!resultado?.success) {
        throw new Error(resultado?.error || 'Erro desconhecido ao criar cliente');
      }

      // resultado tem {user_id, temp_password}
      const userId = resultado.user_id;
      const tempPassword = resultado.temp_password;

      // Determinar quantidade de testes baseado no tipo de plano
      const quantidadeTestes = 
        assinanteFormData.plan_type === 'ponto_triplo' ? 3 :
        assinanteFormData.plan_type === 'ponto_duplo' ? 2 : 1;

      // Atualizar o teste para assinante
      const { error: updateError } = await supabase
        .from('testes_liberados')
        .update({
          assinante: true,
          valor_pago: assinanteFormData.valor_pago,
          quantidade_teste: quantidadeTestes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', testeParaAssinante.id);

      if (updateError) throw updateError;

      // Calcular quantidade de créditos vendidos
      // Quantidade = número de logins × duração em meses
      const quantidadeCreditos = quantidadeTestes * selectedOption.duration_months;

      // Registrar no caixa
      if (assinanteFormData.valor_pago > 0) {
        // Usar data do Brasil (America/Sao_Paulo) ao invés de UTC
        const hoje = new Date().toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).split('/').reverse().join('-'); // Converte de DD/MM/YYYY para YYYY-MM-DD
        const historico = `Assinatura - ${testeParaAssinante.nome}`;

        const { error: caixaError } = await supabase
          .from('caixa_movimentacoes')
          .insert({
            data: hoje,
            historico: historico,
            entrada: assinanteFormData.valor_pago,
            saida: 0,
          });

        if (caixaError) throw caixaError;
      }

      // Registrar créditos vendidos
      // Usar o painel principal (painel1) como padrão
      const painelPrincipal = assinanteFormData.painel1 || testeParaAssinante.painel1 || '';

      // Usar data do Brasil (America/Sao_Paulo) ao invés de UTC
      const hojeCreditosVendidos = new Date().toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).split('/').reverse().join('-'); // Converte de DD/MM/YYYY para YYYY-MM-DD

      const historicoCreditos = `Assinatura - ${testeParaAssinante.nome} (${quantidadeTestes} login${quantidadeTestes > 1 ? 's' : ''} × ${selectedOption.duration_months} ${selectedOption.duration_months === 1 ? 'mês' : 'meses'})`;

      const { error: creditosError } = await supabase
        .from('creditos_vendidos')
        .insert({
          data: hojeCreditosVendidos,
          historico: historicoCreditos,
          painel: painelPrincipal,
          quantidade_creditos: quantidadeCreditos,
        });

      if (creditosError) throw creditosError;

      await fetchTestes();

      // Fechar modal de tornar assinante
      setShowTornarAssinanteModal(false);

      // Se foi gerada uma senha temporária, mostrar ao admin
      if (tempPassword) {
        setCredenciaisGeradas({
          email: testeParaAssinante.email || `${testeParaAssinante.telefone}@uniflix.temp`,
          senha: tempPassword,
          nomeCliente: testeParaAssinante.nome,
        });
        setShowCredenciaisModal(true);
        setPasswordCopied(false);
      }

      // Resetar form
      setTesteParaAssinante(null);
      setAssinanteFormData({
        plan_type: 'ponto_unico',
        recharge_option_id: '',
        desconto_tipo: 'percentual',
        desconto_valor: 0,
        valor_pago: 0,
        login1: '',
        senha1: '',
        painel1: '',
        login2: '',
        senha2: '',
        painel2: '',
        login3: '',
        senha3: '',
        painel3: '',
      });
    } catch (err: any) {
      console.error('Error turning into assinante:', err);
      setError(err.message || 'Erro ao tornar assinante. Por favor, tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelarAssinante = () => {
    setShowTornarAssinanteModal(false);
    setTesteParaAssinante(null);
      setAssinanteFormData({
        plan_type: 'ponto_unico',
        recharge_option_id: '',
        desconto_tipo: 'percentual',
        desconto_valor: 0,
        valor_pago: 0,
        login1: '',
        senha1: '',
        painel1: '',
        login2: '',
        senha2: '',
        painel2: '',
        login3: '',
        senha3: '',
        painel3: '',
      });
    setError(null);
  };

  const getPlanOptions = (planType: string) => {
    return rechargeOptions.filter(opt => opt.plan_type === planType);
  };

  const handleCopyPassword = async () => {
    if (credenciaisGeradas?.senha) {
      await navigator.clipboard.writeText(credenciaisGeradas.senha);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center">
            <CalendarDays className="h-6 w-6 mr-2" />
            Testes Liberados
          </h1>
        </div>
        <button
          onClick={() => setShowNovoTesteModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Teste
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {summaries.map((summary, index) => (
          <div key={summary.period} className="bg-slate-800 rounded-lg shadow p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-400" />
              {formatPeriod(summary.period)}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Total de Testes</span>
                <span className="text-2xl font-bold text-blue-400">{summary.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Convertidos</span>
                <span className="text-lg font-medium text-green-400">{summary.assinantes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Não Convertidos</span>
                <span className="text-lg font-medium text-orange-400">{summary.naoAssinantes}</span>
              </div>
              {summary.total > 0 && (
                <div className="pt-2 border-t border-slate-700">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-400">Taxa de Conversão</span>
                    <span className="text-sm font-medium text-slate-200">
                      {((summary.assinantes / summary.total) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(summary.assinantes / summary.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4 md:space-y-0 md:flex md:items-center md:space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            className="pl-10 pr-4 py-2 rounded-lg w-full bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-slate-400" />
          <select
            className="border border-slate-700 bg-slate-900 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={painelFilter}
            onChange={(e) => setPainelFilter(e.target.value)}
          >
            <option value="">Todos os Painéis</option>
            {paineis.map(painel => (
              <option key={painel} value={painel}>{painel}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <CalendarDays className="h-5 w-5 text-slate-400" />
          <select
            className="border border-slate-700 bg-slate-900 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={mesFilter}
            onChange={(e) => setMesFilter(e.target.value)}
          >
            <option value="">Todos os Meses</option>
            {meses.map(mes => (
              <option key={mes} value={mes}>{formatMonth(mes)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">{error}</div>
      )}

      <div className="bg-slate-800 rounded-lg shadow overflow-x-auto border border-slate-700">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Telefone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Usuário</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Senha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Painel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Data Teste</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Aplicativo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Assinante</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-4 text-center text-slate-300">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Carregando...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedTestes.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-4 text-center text-slate-300">Nenhum teste encontrado</td>
              </tr>
            ) : (
              paginatedTestes.map((teste) => (
                <tr 
                  key={teste.id}
                  className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                  onClick={() => handleEditClick(teste)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">{teste.nome}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{teste.telefone ? formatPhone(teste.telefone) : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{teste.usuario1 || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{teste.senha1 || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{teste.painel1 || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{formatDate(teste.data_teste)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{teste.aplicativo || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {teste.assinante ? (
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900/30 text-green-300">
                        Sim
                      </span>
                    ) : (
                      <button
                        onClick={(e) => handleTornarAssinanteClick(teste, e)}
                        className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Tornar Assinante
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {teste.assinante ? (
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-700/50 text-slate-400">
                        -
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTesteParaExcluir(teste);
                          setShowDeleteModal(true);
                          setDeleteConfirmText('');
                        }}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Excluir Teste"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {!loading && filteredTestes.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>
              Mostrando {startIndex + 1}-{Math.min(endIndex, filteredTestes.length)} de {filteredTestes.length} testes
            </span>
            <div className="flex items-center gap-2">
              <span>Por página:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Primeira página"
            >
              ««
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Página anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1">
              {/* Renderiza os números das páginas */}
              {(() => {
                const pages = [];
                const maxVisiblePages = 5;
                let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

                if (endPage - startPage + 1 < maxVisiblePages) {
                  startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }

                if (startPage > 1) {
                  pages.push(
                    <button
                      key={1}
                      onClick={() => setCurrentPage(1)}
                      className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      1
                    </button>
                  );
                  if (startPage > 2) {
                    pages.push(
                      <span key="ellipsis1" className="px-2 text-slate-500">...</span>
                    );
                  }
                }

                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${
                        currentPage === i
                          ? 'bg-blue-600 text-white border border-blue-600'
                          : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {i}
                    </button>
                  );
                }

                if (endPage < totalPages) {
                  if (endPage < totalPages - 1) {
                    pages.push(
                      <span key="ellipsis2" className="px-2 text-slate-500">...</span>
                    );
                  }
                  pages.push(
                    <button
                      key={totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      {totalPages}
                    </button>
                  );
                }

                return pages;
              })()}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Próxima página"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Última página"
            >
              »»
            </button>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {isEditing && editingTeste && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-100">Editar Teste Liberado</h2>
              <button
                onClick={handleCancelEdit}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Nome</label>
                  <input
                    type="text"
                    value={editFormData.nome || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, nome: e.target.value })}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={editFormData.telefone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, telefone: e.target.value })}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={editFormData.email || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Usuário</label>
                  <input
                    type="text"
                    value={editFormData.usuario1 || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, usuario1: e.target.value })}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Senha</label>
                  <input
                    type="text"
                    value={editFormData.senha1 || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, senha1: e.target.value })}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Painel</label>
                  <input
                    type="text"
                    value={editFormData.painel1 || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, painel1: e.target.value })}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Data do Teste</label>
                  <input
                    type="date"
                    value={editFormData.data_teste || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, data_teste: e.target.value })}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Aplicativo</label>
                  <input
                    type="text"
                    value={editFormData.aplicativo || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, aplicativo: e.target.value })}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Quantidade de Testes</label>
                  <input
                    type="number"
                    value={editFormData.quantidade_teste || 1}
                    onChange={(e) => setEditFormData({ ...editFormData, quantidade_teste: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 px-6 py-4 flex justify-between items-center">
              <div>
                {editingTeste && !editingTeste.assinante && (
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      handleTornarAssinanteClick(editingTeste, { stopPropagation: () => {} } as React.MouseEvent);
                    }}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    Tornar Assinante
                  </button>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tornar Assinante */}
      {showTornarAssinanteModal && testeParaAssinante && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl font-semibold text-slate-100">Tornar Assinante</h2>
              <button
                onClick={handleCancelarAssinante}
                className="text-slate-400 hover:text-slate-200"
                disabled={isSaving}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <p className="text-sm text-slate-400 mb-1">Cliente</p>
                <p className="text-lg font-medium text-slate-100">{testeParaAssinante.nome}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Tipo de Plano</label>
                <select
                  value={assinanteFormData.plan_type}
                  onChange={(e) => {
                    const newPlanType = e.target.value;
                    const firstOption = getPlanOptions(newPlanType)[0];
                    if (firstOption) {
                      handleRechargeOptionChange(firstOption.id);
                    } else {
                      setAssinanteFormData({
                        ...assinanteFormData,
                        plan_type: newPlanType,
                        recharge_option_id: '',
                        valor_pago: 0,
                      });
                    }
                  }}
                  className="w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  disabled={isSaving}
                >
                  <option value="ponto_unico">Ponto Único (1 Login)</option>
                  <option value="ponto_duplo">Ponto Duplo (2 Logins)</option>
                  <option value="ponto_triplo">Ponto Triplo (3 Logins)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Opção de Recarga</label>
                <select
                  value={assinanteFormData.recharge_option_id}
                  onChange={(e) => handleRechargeOptionChange(e.target.value)}
                  className="w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  disabled={isSaving}
                >
                  <option value="">Selecione uma opção</option>
                  {getPlanOptions(assinanteFormData.plan_type).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Tipo de Desconto</label>
                  <select
                    value={assinanteFormData.desconto_tipo}
                    onChange={(e) => handleDescontoChange(
                      e.target.value as 'percentual' | 'fixo',
                      assinanteFormData.desconto_valor
                    )}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={isSaving}
                  >
                    <option value="percentual">Percentual (%)</option>
                    <option value="fixo">Valor Fixo (R$)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    {assinanteFormData.desconto_tipo === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)'}
                  </label>
                  <input
                    type="number"
                    step={assinanteFormData.desconto_tipo === 'percentual' ? '1' : '0.01'}
                    min="0"
                    max={assinanteFormData.desconto_tipo === 'percentual' ? '100' : undefined}
                    value={assinanteFormData.desconto_valor}
                    onChange={(e) => handleDescontoChange(
                      assinanteFormData.desconto_tipo,
                      parseFloat(e.target.value) || 0
                    )}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Login 1 - Sempre obrigatório */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Login 1 (Obrigatório)</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Painel</label>
                    <input
                      type="text"
                      value={assinanteFormData.painel1}
                      onChange={(e) => setAssinanteFormData({ ...assinanteFormData, painel1: e.target.value })}
                      className="w-full rounded-md bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                      disabled={isSaving}
                      placeholder="Ex: Elite"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Login</label>
                    <input
                      type="text"
                      value={assinanteFormData.login1}
                      onChange={(e) => setAssinanteFormData({ ...assinanteFormData, login1: e.target.value })}
                      className="w-full rounded-md bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                      disabled={isSaving}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Senha</label>
                    <input
                      type="text"
                      value={assinanteFormData.senha1}
                      onChange={(e) => setAssinanteFormData({ ...assinanteFormData, senha1: e.target.value })}
                      className="w-full rounded-md bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                      disabled={isSaving}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Login 2 - Ponto Duplo ou Triplo */}
              {(assinanteFormData.plan_type === 'ponto_duplo' || assinanteFormData.plan_type === 'ponto_triplo') && (
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Login 2 (Obrigatório)</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Painel</label>
                      <input
                        type="text"
                        value={assinanteFormData.painel2}
                        onChange={(e) => setAssinanteFormData({ ...assinanteFormData, painel2: e.target.value })}
                        className="w-full rounded-md bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                        disabled={isSaving}
                        placeholder="Ex: Elite"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Login</label>
                      <input
                        type="text"
                        value={assinanteFormData.login2}
                        onChange={(e) => setAssinanteFormData({ ...assinanteFormData, login2: e.target.value })}
                        className="w-full rounded-md bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                        disabled={isSaving}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Senha</label>
                      <input
                        type="text"
                        value={assinanteFormData.senha2}
                        onChange={(e) => setAssinanteFormData({ ...assinanteFormData, senha2: e.target.value })}
                        className="w-full rounded-md bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                        disabled={isSaving}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Login 3 - Ponto Triplo */}
              {assinanteFormData.plan_type === 'ponto_triplo' && (
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Login 3 (Obrigatório)</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Painel</label>
                      <input
                        type="text"
                        value={assinanteFormData.painel3}
                        onChange={(e) => setAssinanteFormData({ ...assinanteFormData, painel3: e.target.value })}
                        className="w-full rounded-md bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                        disabled={isSaving}
                        placeholder="Ex: Elite"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Login</label>
                      <input
                        type="text"
                        value={assinanteFormData.login3}
                        onChange={(e) => setAssinanteFormData({ ...assinanteFormData, login3: e.target.value })}
                        className="w-full rounded-md bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                        disabled={isSaving}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Senha</label>
                      <input
                        type="text"
                        value={assinanteFormData.senha3}
                        onChange={(e) => setAssinanteFormData({ ...assinanteFormData, senha3: e.target.value })}
                        className="w-full rounded-md bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                        disabled={isSaving}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {assinanteFormData.recharge_option_id && (
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 space-y-2">
                  {(() => {
                    const selectedOption = rechargeOptions.find(opt => opt.id === assinanteFormData.recharge_option_id);
                    if (!selectedOption) return null;
                    const valorOriginal = selectedOption.price;
                    const desconto = assinanteFormData.desconto_valor > 0 ? (
                      assinanteFormData.desconto_tipo === 'percentual'
                        ? valorOriginal * (assinanteFormData.desconto_valor / 100)
                        : assinanteFormData.desconto_valor
                    ) : 0;
                    const valorFinal = assinanteFormData.valor_pago;

                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Valor Original:</span>
                          <span className="text-slate-200">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorOriginal)}</span>
                        </div>
                        {desconto > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Desconto:</span>
                            <span className="text-red-400">- {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(desconto)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-semibold pt-2 border-t border-slate-700">
                          <span className="text-slate-300">Valor Final:</span>
                          <span className="text-green-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorFinal)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {assinanteFormData.valor_pago > 0 && (
                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                  <p className="text-sm text-blue-300">
                    <strong>Valor a ser registrado no caixa:</strong>{' '}
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(assinanteFormData.valor_pago)}
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-700 flex justify-end space-x-3 flex-shrink-0">
              <button
                onClick={handleCancelarAssinante}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarAssinante}
                disabled={
                  isSaving || 
                  assinanteFormData.valor_pago <= 0 || 
                  !assinanteFormData.recharge_option_id ||
                  !assinanteFormData.login1 ||
                  !assinanteFormData.senha1 ||
                  (assinanteFormData.plan_type === 'ponto_duplo' && (!assinanteFormData.login2 || !assinanteFormData.senha2)) ||
                  (assinanteFormData.plan_type === 'ponto_triplo' && (!assinanteFormData.login2 || !assinanteFormData.senha2 || !assinanteFormData.login3 || !assinanteFormData.senha3))
                }
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Teste */}
      {showNovoTesteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-700 sticky top-0 bg-slate-800">
              <h3 className="text-xl font-bold text-slate-100">Novo Teste</h3>
              <button
                onClick={() => {
                  setShowNovoTesteModal(false);
                  setNovoTesteForm({
                    nome: '',
                    telefone: '',
                    email: '',
                    usuario1: '',
                    senha1: '',
                    painel1: '',
                    data_teste: new Date().toISOString().split('T')[0],
                    aplicativo: '',
                    quantidade_teste: 1,
                  });
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingNovoTeste(true);
                try {
                  const { error: insertError } = await supabase
                    .from('testes_liberados')
                    .insert([
                      {
                        nome: novoTesteForm.nome,
                        telefone: novoTesteForm.telefone || null,
                        email: novoTesteForm.email || null,
                        usuario1: novoTesteForm.usuario1 || null,
                        senha1: novoTesteForm.senha1 || null,
                        painel1: novoTesteForm.painel1 || null,
                        data_teste: novoTesteForm.data_teste,
                        aplicativo: novoTesteForm.aplicativo || null,
                        quantidade_teste: novoTesteForm.quantidade_teste || 1,
                        assinante: false,
                        valor_pago: 0,
                      },
                    ]);

                  if (insertError) throw insertError;

                  // Recarregar lista de testes
                  await fetchTestes();
                  
                  // Fechar modal e limpar formulário
                  setShowNovoTesteModal(false);
                  setNovoTesteForm({
                    nome: '',
                    telefone: '',
                    email: '',
                    usuario1: '',
                    senha1: '',
                    painel1: '',
                    data_teste: new Date().toISOString().split('T')[0],
                    aplicativo: '',
                    quantidade_teste: 1,
                  });
                } catch (err) {
                  console.error('Erro ao criar teste:', err);
                  setError('Erro ao criar teste. Por favor, tente novamente.');
                } finally {
                  setIsSavingNovoTeste(false);
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={novoTesteForm.nome}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, nome: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Digite o nome completo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={novoTesteForm.telefone}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, telefone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={novoTesteForm.email}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Usuário
                </label>
                <input
                  type="text"
                  value={novoTesteForm.usuario1}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, usuario1: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Usuário do teste"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Senha
                </label>
                <input
                  type="text"
                  value={novoTesteForm.senha1}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, senha1: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Senha do teste"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Painel
                </label>
                <select
                  value={novoTesteForm.painel1}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, painel1: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Selecione o painel</option>
                  {availablePanels.map((panel) => (
                    <option key={panel.name} value={panel.name}>
                      {panel.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Data do Teste *
                </label>
                <input
                  type="date"
                  required
                  value={novoTesteForm.data_teste}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, data_teste: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Aplicativo
                </label>
                <input
                  type="text"
                  value={novoTesteForm.aplicativo}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, aplicativo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Nome do aplicativo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Quantidade de Testes
                </label>
                <input
                  type="number"
                  min="1"
                  value={novoTesteForm.quantidade_teste}
                  onChange={(e) => setNovoTesteForm({ ...novoTesteForm, quantidade_teste: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNovoTesteModal(false);
                    setNovoTesteForm({
                      nome: '',
                      telefone: '',
                      email: '',
                      usuario1: '',
                      senha1: '',
                      painel1: '',
                      data_teste: new Date().toISOString().split('T')[0],
                      aplicativo: '',
                      quantidade_teste: 1,
                    });
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingNovoTeste}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingNovoTeste ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Credenciais Geradas */}
      {showCredenciaisModal && credenciaisGeradas && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-900/30 rounded-lg border border-green-700">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <h2 className="text-xl font-semibold text-slate-100">Cliente Criado com Sucesso!</h2>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-300 mb-2">
                  <strong>Cliente:</strong> {credenciaisGeradas.nomeCliente}
                </p>
                <p className="text-xs text-blue-400">
                  As credenciais abaixo foram geradas automaticamente. Envie-as ao cliente para que ele possa acessar o painel.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Email de Acesso</label>
                <div className="px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg">
                  <p className="text-slate-200 font-mono text-sm break-all">{credenciaisGeradas.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Senha Temporária</label>
                <div className="px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-between">
                  <p className="text-slate-200 font-mono text-lg font-semibold">{credenciaisGeradas.senha}</p>
                  <button
                    onClick={handleCopyPassword}
                    className="ml-3 p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    title="Copiar senha"
                  >
                    {passwordCopied ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-slate-300" />
                    )}
                  </button>
                </div>
                {passwordCopied && (
                  <p className="mt-2 text-xs text-green-400">✓ Senha copiada para a área de transferência!</p>
                )}
              </div>

              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                <p className="text-xs text-yellow-300">
                  <strong>⚠️ Importante:</strong> Esta senha é temporária. Recomende ao cliente que a altere no primeiro acesso ao painel.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => {
                  setShowCredenciaisModal(false);
                  setCredenciaisGeradas(null);
                  setPasswordCopied(false);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Excluir Teste */}
      {showDeleteModal && testeParaExcluir && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-900/30 rounded-lg border border-red-700">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-100">Excluir Teste</h2>
              </div>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setTesteParaExcluir(null);
                  setDeleteConfirmText('');
                  setError(null);
                }}
                disabled={isDeleting}
                className="text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-start space-x-3 mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg">
                <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-semibold mb-2">Atenção: Esta ação é irreversível!</p>
                  <p className="text-red-400 text-sm">
                    Ao excluir este teste, todos os dados relacionados serão permanentemente removidos.
                  </p>
                </div>
              </div>

              <div className="mb-6 p-4 bg-slate-900 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm mb-2">Teste a ser excluído:</p>
                <p className="text-slate-100 font-semibold text-lg">{testeParaExcluir.nome}</p>
                {testeParaExcluir.telefone && (
                  <p className="text-slate-400 text-sm mt-1">{testeParaExcluir.telefone}</p>
                )}
                {testeParaExcluir.email && (
                  <p className="text-slate-400 text-sm">{testeParaExcluir.email}</p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Para confirmar, digite o nome do teste: <span className="font-mono text-slate-400">"{testeParaExcluir.nome}"</span>
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => {
                    setDeleteConfirmText(e.target.value);
                    setError(null);
                  }}
                  disabled={isDeleting}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={testeParaExcluir.nome}
                />
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setTesteParaExcluir(null);
                    setDeleteConfirmText('');
                    setError(null);
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteTeste}
                  disabled={isDeleting || deleteConfirmText !== testeParaExcluir.nome}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Excluir Teste</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

