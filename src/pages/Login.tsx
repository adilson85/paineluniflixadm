import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { Users, AlertCircle, UserPlus, Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginFormData {
  email: string;
  password: string;
}

interface ForgotPasswordFormData {
  email: string;
}

export default function Login() {
  const { signIn, signUp, error } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();
  const { register: registerForgot, handleSubmit: handleForgotSubmit, formState: { errors: forgotErrors } } = useForm<ForgotPasswordFormData>();
  const [isCreatingUser, setIsCreatingUser] = React.useState(false);
  const [showCreateUser, setShowCreateUser] = React.useState(false);
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = React.useState(false);
  const [forgotPasswordError, setForgotPasswordError] = React.useState<string | null>(null);

  const onSubmit = async (data: LoginFormData) => {
    if (isCreatingUser) {
      await signUp(data.email, data.password);
      setIsCreatingUser(false);
      setShowCreateUser(false);
      // After successful signup, try to sign in
      await signIn(data.email, data.password);
    } else {
      await signIn(data.email, data.password);
    }
    if (!error) {
      navigate('/');
    }
  };

  const onForgotPasswordSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setForgotPasswordError(null);
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      setForgotPasswordSuccess(true);
    } catch (err) {
      setForgotPasswordError(err instanceof Error ? err.message : 'Erro ao enviar email de recuperação');
    }
  };

  const handleCreateUser = () => {
    setIsCreatingUser(true);
    setShowCreateUser(true);
  };

  const handleCancelCreate = () => {
    setIsCreatingUser(false);
    setShowCreateUser(false);
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setForgotPasswordSuccess(false);
    setForgotPasswordError(null);
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img 
                src="/uniflixtv.svg" 
                alt="Uniflix TV Logo" 
                className="h-32 w-auto object-contain"
              />
            </div>
            <p className="text-gray-600">
              Recuperar senha
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="flex justify-center mb-6">
              <div className="p-3 rounded-full bg-blue-100">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
            </div>

            {forgotPasswordSuccess ? (
              <div className="text-center">
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
                  <p className="font-medium">Email enviado com sucesso!</p>
                  <p className="text-sm mt-1">
                    Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                  </p>
                </div>
                <button
                  onClick={handleBackToLogin}
                  className="inline-flex items-center text-blue-600 hover:text-blue-800"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao login
                </button>
              </div>
            ) : (
              <>
                {forgotPasswordError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                    <div className="flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      <p className="text-sm">{forgotPasswordError}</p>
                    </div>
                  </div>
                )}

                <form className="space-y-6" onSubmit={handleForgotSubmit(onForgotPasswordSubmit)}>
                  <div>
                    <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      {...registerForgot('email', {
                        required: 'Email é obrigatório',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Email inválido',
                        },
                      })}
                      type="email"
                      id="forgot-email"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="seu@email.com"
                    />
                    {forgotErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{forgotErrors.email.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Enviar email de recuperação
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={handleBackToLogin}
                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar ao login
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img 
              src="/uniflixtv.svg" 
              alt="Uniflix TV Logo" 
              className="h-32 w-auto object-contain"
            />
          </div>
          <p className="text-gray-600">
            Área administrativa
          </p>
        </div>
        
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="flex justify-center mb-6">
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                <div>
                  <p className="font-medium">Erro de autenticação</p>
                  <p className="text-sm mt-1">{error}</p>
                  {error.includes('Invalid login credentials') && !showCreateUser && (
                    <button
                      type="button"
                      onClick={() => setShowCreateUser(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 mt-2 underline"
                    >
                      Criar primeiro usuário administrador
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {showCreateUser && !isCreatingUser && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <UserPlus className="h-4 w-4 mr-2" />
                  <p className="text-sm">
                    Parece que você precisa criar o primeiro usuário administrador.
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleCreateUser}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Criar
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelCreate}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                {...register('email', {
                  required: 'Email é obrigatório',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Email inválido',
                  },
                })}
                type="email"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="seu@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              <input
                {...register('password', {
                  required: 'Senha é obrigatória',
                  minLength: {
                    value: 6,
                    message: 'A senha deve ter pelo menos 6 caracteres',
                  },
                })}
                type="password"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isCreatingUser ? 'Criar Usuário' : 'Entrar'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Esqueceu sua senha?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}