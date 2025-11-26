import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ value, onChange, placeholder = 'Selecione uma data', className = '' }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const pickerRef = useRef<HTMLDivElement>(null);

  // Fechar quando clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Inicializar mês atual com a data selecionada ou hoje
  useEffect(() => {
    if (value) {
      setCurrentMonth(new Date(value));
    } else {
      // Sempre usar hoje como base quando não há valor
      setCurrentMonth(new Date());
    }
  }, [value, isOpen]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDate = value ? new Date(value) : null;
  if (selectedDate) {
    selectedDate.setHours(0, 0, 0, 0);
  }

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Primeiro dia do mês
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const todayDate = new Date();
    setCurrentMonth(todayDate);
    onChange(todayDate.toISOString().split('T')[0]);
    setIsOpen(false);
  };

  // Quando abrir sem valor, ir para o mês atual
  useEffect(() => {
    if (isOpen && !value) {
      setCurrentMonth(new Date());
    }
  }, [isOpen, value]);

  const handleDateClick = (day: number) => {
    const date = new Date(year, month, day);
    const dateString = date.toISOString().split('T')[0];
    onChange(dateString);
    setIsOpen(false);
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const isToday = (day: number) => {
    const date = new Date(year, month, day);
    return date.getTime() === today.getTime();
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    const date = new Date(year, month, day);
    return date.getTime() === selectedDate.getTime();
  };

  // Removido: permitir seleção de datas passadas

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      {/* Input */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center cursor-pointer px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-200 hover:border-blue-500 transition-colors"
      >
        <CalendarIcon className="w-4 h-4 mr-2 text-slate-400" />
        <input
          type="text"
          readOnly
          value={value ? formatDisplayDate(value) : ''}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder-slate-500 cursor-pointer"
        />
        {value && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="ml-2 text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Calendário */}
      {isOpen && (
        <div className="absolute z-50 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 min-w-[280px]">
          {/* Header do Calendário */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPreviousMonth}
              className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-slate-200 font-semibold">{monthNames[month]}</span>
              <span className="text-slate-400">{year}</span>
            </div>
            <button
              onClick={goToNextMonth}
              className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Dias da Semana */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-slate-400 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Dias do Mês */}
          <div className="grid grid-cols-7 gap-1">
            {/* Espaços vazios antes do primeiro dia */}
            {Array.from({ length: startingDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}

            {/* Dias do mês */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const isTodayDate = isToday(day);
              const isSelectedDate = isSelected(day);

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  className={`
                    aspect-square rounded text-sm transition-colors
                    ${isSelectedDate
                      ? 'bg-blue-600 text-white font-semibold'
                      : isTodayDate
                      ? 'bg-blue-900/50 text-blue-300 font-semibold border border-blue-600'
                      : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Botão Hoje */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <button
              onClick={goToToday}
              className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Usar Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

