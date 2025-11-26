import { X, DollarSign, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { RechargeOption } from '../hooks/useClientTransactions';

interface AddCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    rechargeOptionId: string;
    valorPago: number;
    descontoTipo: 'percentual' | 'fixo';
    descontoValor: number;
  }) => Promise<void>;
  rechargeOptions: RechargeOption[];
  isProcessing: boolean;
  planType: 'ponto_unico' | 'ponto_duplo' | 'ponto_triplo' | null;
  quantidadePontos: number;
}

export function AddCreditsModal({
  isOpen,
  onClose,
  onSubmit,
  rechargeOptions,
  isProcessing,
  planType,
  quantidadePontos,
}: AddCreditsModalProps) {
  const [formData, setFormData] = useState({
    rechargeOptionId: '',
    valorPago: 0,
    descontoTipo: 'percentual' as 'percentual' | 'fixo',
    descontoValor: 0,
  });

  const [selectedOption, setSelectedOption] = useState<RechargeOption | null>(null);
  const [quantidadeCreditos, setQuantidadeCreditos] = useState(0);

  // Filtrar opções de recarga baseado no plan_type do cliente
  const filteredOptions = rechargeOptions.filter(
    opt => opt.plan_type === planType || !planType
  );

  useEffect(() => {
    if (formData.rechargeOptionId) {
      const option = rechargeOptions.find(opt => opt.id === formData.rechargeOptionId);
      setSelectedOption(option || null);

      if (option) {
        // Calcular quantidade de créditos: pontos × meses
        const creditos = quantidadePontos * option.duration_months;
        setQuantidadeCreditos(creditos);

        // Calcular valor com desconto
        const valorFinal = calculateFinalPrice(
          option.price,
          formData.descontoTipo,
          formData.descontoValor
        );
        setFormData(prev => ({ ...prev, valorPago: valorFinal }));
      }
    }
  }, [formData.rechargeOptionId, formData.descontoTipo, formData.descontoValor, rechargeOptions, quantidadePontos]);

  const calculateFinalPrice = (
    basePrice: number,
    descontoTipo: 'percentual' | 'fixo',
    descontoValor: number
  ): number => {
    if (descontoTipo === 'percentual') {
      return basePrice * (1 - descontoValor / 100);
    } else {
      return Math.max(0, basePrice - descontoValor);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rechargeOptionId) return;

    await onSubmit(formData);

    // Resetar formulário
    setFormData({
      rechargeOptionId: '',
      valorPago: 0,
      descontoTipo: 'percentual',
      descontoValor: 0,
    });
    setSelectedOption(null);
  };

  if (!isOpen) return null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-slate-100 flex items-center">
              <Plus className="w-5 h-5 mr-2 text-green-400" />
              Adicionar Créditos / Dar Baixa em Recarga
            </h3>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="text-slate-400 hover:text-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Aviso de filtro */}
          {planType && filteredOptions.length < rechargeOptions.length && (
            <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
              <p className="text-sm text-blue-300">
                ℹ️ Mostrando apenas opções para <strong>{planType === 'ponto_unico' ? 'Ponto Único (1 login)' : planType === 'ponto_duplo' ? 'Ponto Duplo (2 logins)' : 'Ponto Triplo (3 logins)'}</strong>.
                Para alterar o tipo de plano, edite os logins do cliente primeiro.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Opção de Recarga */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Opção de Recarga *
              </label>
              {filteredOptions.length === 0 ? (
                <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300 text-sm">
                  Nenhuma opção de recarga disponível para este tipo de plano.
                </div>
              ) : (
                <select
                  value={formData.rechargeOptionId}
                  onChange={(e) => setFormData({ ...formData, rechargeOptionId: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione uma opção</option>
                  {filteredOptions.map((option) => {
                    const creditos = quantidadePontos * option.duration_months;
                    return (
                      <option key={option.id} value={option.id}>
                        {option.display_name} - R$ {option.price.toFixed(2)} ({option.duration_months} {option.duration_months === 1 ? 'mês' : 'meses'} = {creditos} crédito{creditos > 1 ? 's' : ''})
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {/* Tipo de Desconto */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tipo de Desconto
                </label>
                <select
                  value={formData.descontoTipo}
                  onChange={(e) => setFormData({ ...formData, descontoTipo: e.target.value as 'percentual' | 'fixo' })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="percentual">Percentual (%)</option>
                  <option value="fixo">Valor Fixo (R$)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Valor do Desconto
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.descontoValor}
                  onChange={(e) => setFormData({ ...formData, descontoValor: parseFloat(e.target.value) || 0 })}
                  placeholder={formData.descontoTipo === 'percentual' ? '0-100%' : 'R$ 0,00'}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Resumo da Recarga */}
            {selectedOption && (
              <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-300 mb-3">Resumo da Recarga:</h4>

                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex justify-between">
                    <span>Plano:</span>
                    <span className="font-medium">{selectedOption.display_name}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Tipo de Plano:</span>
                    <span className="font-medium">{quantidadePontos} ponto{quantidadePontos > 1 ? 's' : ''}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Duração:</span>
                    <span className="font-medium">{selectedOption.duration_months} {selectedOption.duration_months === 1 ? 'mês' : 'meses'}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Quantidade de Créditos:</span>
                    <span className="font-medium text-yellow-300">{quantidadeCreditos} crédito{quantidadeCreditos > 1 ? 's' : ''}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Valor Base:</span>
                    <span className="font-medium">R$ {selectedOption.price.toFixed(2)}</span>
                  </div>

                  {formData.descontoValor > 0 && (
                    <div className="flex justify-between text-yellow-300">
                      <span>Desconto:</span>
                      <span className="font-medium">
                        {formData.descontoTipo === 'percentual'
                          ? `${formData.descontoValor}%`
                          : `R$ ${formData.descontoValor.toFixed(2)}`
                        }
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between pt-2 border-t border-blue-700 text-base text-blue-100">
                    <span className="font-semibold">Valor Final:</span>
                    <span className="font-bold text-lg">R$ {formData.valorPago.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-blue-700 space-y-1 text-xs text-blue-200">
                  <p>✓ Data de expiração será estendida em {selectedOption.duration_months} {selectedOption.duration_months === 1 ? 'mês' : 'meses'}</p>
                  <p>✓ Valor será lançado no caixa como entrada</p>
                  <p>✓ Créditos serão registrados em "Créditos Vendidos"</p>
                  <p>✓ Comissão será calculada automaticamente (se houver indicação)</p>
                </div>
              </div>
            )}

            {/* Botões */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isProcessing || !formData.rechargeOptionId}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                {isProcessing ? 'Processando...' : 'Adicionar Créditos'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
