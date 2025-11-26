/**
 * Formata uma data do banco de dados para exibição, evitando problemas de timezone
 *
 * @param dateString - Data em formato ISO do banco (ex: "2025-11-25T00:00:00+00:00")
 * @param options - Opções de formatação do Intl.DateTimeFormat
 * @returns Data formatada em pt-BR
 */
export function formatDateBR(
  dateString: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateString) return '-';

  // Extrai apenas a parte da data (YYYY-MM-DD) se estiver em formato ISO
  const dateOnly = dateString.split('T')[0];
  const [year, month, day] = dateOnly.split('-').map(Number);

  // Cria a data usando o timezone do Brasil para evitar conversão incorreta
  const date = new Date(year, month - 1, day);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    ...options,
  };

  return date.toLocaleDateString('pt-BR', defaultOptions);
}

/**
 * Formata uma data timestamp completa (com hora) do banco de dados
 *
 * @param dateString - Data em formato ISO do banco
 * @returns Data e hora formatadas em pt-BR
 */
export function formatDateTimeBR(dateString: string | null | undefined): string {
  if (!dateString) return '-';

  const date = new Date(dateString);

  return date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
