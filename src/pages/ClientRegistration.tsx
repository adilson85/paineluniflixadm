import React from 'react';
import { useForm } from 'react-hook-form';
import { Phone } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';

interface FormData {
  nome: string;
  data_nascimento: string;
  cpf: string;
  telefone: string;
}

export default function ClientRegistration() {
  const [isSuccess, setIsSuccess] = React.useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      // Criar user na tabela users
      const { error } = await supabase
        .from('users')
        .insert([
          {
            full_name: data.nome,
            phone: data.telefone,
            cpf: data.cpf,
            data_nascimento: data.data_nascimento,
          },
        ]);

      if (error) throw error;

      setIsSuccess(true);
      reset();
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Erro ao salvar os dados. Por favor, tente novamente.');
    }
  };

  const openWhatsApp = () => {
    const phone = '5511999999999'; // Replace with your actual WhatsApp number
    const message = encodeURIComponent('Olá! Gostaria de falar sobre a Uniflix TV.');
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  if (isSuccess) {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-10 bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Cadastro realizado com sucesso!
            </h2>
            <p className="text-gray-600 mb-6">
              Entraremos em contato pelo WhatsApp.
            </p>
            <button
              onClick={openWhatsApp}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Phone className="h-5 w-5 mr-2" />
              Falar com a Uniflix no WhatsApp
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Cadastro de Cliente
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700">
              Nome completo
            </label>
            <input
              type="text"
              id="nome"
              {...register('nome', { required: 'Nome é obrigatório' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.nome && (
              <p className="mt-1 text-sm text-red-600">{errors.nome.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="data_nascimento" className="block text-sm font-medium text-gray-700">
              Data de nascimento
            </label>
            <input
              type="date"
              id="data_nascimento"
              {...register('data_nascimento', { required: 'Data de nascimento é obrigatória' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.data_nascimento && (
              <p className="mt-1 text-sm text-red-600">{errors.data_nascimento.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="cpf" className="block text-sm font-medium text-gray-700">
              CPF
            </label>
            <input
              type="text"
              id="cpf"
              {...register('cpf', {
                required: 'CPF é obrigatório',
                pattern: {
                  value: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
                  message: 'CPF inválido (formato: 000.000.000-00)',
                },
              })}
              placeholder="000.000.000-00"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.cpf && (
              <p className="mt-1 text-sm text-red-600">{errors.cpf.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="telefone" className="block text-sm font-medium text-gray-700">
              WhatsApp
            </label>
            <input
              type="tel"
              id="telefone"
              {...register('telefone', {
                required: 'Telefone é obrigatório',
                pattern: {
                  value: /^\+55\d{2}\d{9}$/,
                  message: 'Telefone inválido (formato: +55DDD000000000)',
                },
              })}
              placeholder="+55DDD000000000"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.telefone && (
              <p className="mt-1 text-sm text-red-600">{errors.telefone.message}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Enviar dados
          </button>
        </form>
      </div>
    </Layout>
  );
}