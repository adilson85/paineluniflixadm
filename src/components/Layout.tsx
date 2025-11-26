import React from 'react';
import { Menu, Users, UserMinus, LogOut, Wallet, CalendarDays, CreditCard, Store, DollarSign, TrendingUp, LayoutDashboard, Settings } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 md:flex">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-200 ease-in-out md:translate-x-0 md:relative md:inset-auto md:transform-none md:h-screen`}
      >
        <div className="flex items-center justify-center h-16 px-4 bg-slate-900 border-b border-slate-800">
          <h1 className="text-xl font-bold text-slate-100">Uniflix TV CRM</h1>
        </div>
        <nav className="mt-6">
          <Link
            to="/"
            className={`mx-2 rounded-md flex items-center px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white ${
              location.pathname === '/' ? 'bg-slate-800 text-white' : ''
            }`}
            onClick={() => setSidebarOpen(false)}
                >
                  <LayoutDashboard className="w-5 h-5 mr-2" />
                  Dashboard
                </Link>
                <Link
                  to="/clientes"
                  className={`mx-2 rounded-md flex items-center px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white ${
                    location.pathname === '/clientes' ? 'bg-slate-800 text-white' : ''
                  }`}
                  onClick={() => setSidebarOpen(false)}
          >
            <Users className="w-5 h-5 mr-2" />
            Clientes
                </Link>
                <Link
                  to="/clientes-offline"
                  className={`mx-2 rounded-md flex items-center px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white ${
                    location.pathname.startsWith('/clientes-offline') ? 'bg-slate-800 text-white' : ''
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <UserMinus className="w-5 h-5 mr-2" />
                  Clientes Offline
                </Link>
          <Link
            to="/revendedores"
            className={`mx-2 rounded-md flex items-center px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white ${
              location.pathname === '/revendedores' ? 'bg-slate-800 text-white' : ''
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            <Store className="w-5 h-5 mr-2" />
            Revendedores
          </Link>
          <Link
            to="/caixa"
            className={`mx-2 rounded-md flex items-center px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white ${
              location.pathname === '/caixa' ? 'bg-slate-800 text-white' : ''
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            <Wallet className="w-5 h-5 mr-2" />
            Caixa
          </Link>
          <Link
            to="/testes-liberados"
            className={`mx-2 rounded-md flex items-center px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white ${
              location.pathname === '/testes-liberados' ? 'bg-slate-800 text-white' : ''
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            <CalendarDays className="w-5 h-5 mr-2" />
            Testes Liberados
          </Link>
          <Link
            to="/creditos-comprados"
            className={`mx-2 rounded-md flex items-center px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white ${
              location.pathname === '/creditos-comprados' ? 'bg-slate-800 text-white' : ''
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Créditos Comprados
          </Link>
          <Link
            to="/creditos-vendidos"
            className={`mx-2 rounded-md flex items-center px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white ${
              location.pathname === '/creditos-vendidos' ? 'bg-slate-800 text-white' : ''
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Créditos Vendidos
          </Link>
          <Link
            to="/precos-planos"
            className={`mx-2 rounded-md flex items-center px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white ${
              location.pathname === '/precos-planos' ? 'bg-slate-800 text-white' : ''
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            <DollarSign className="w-5 h-5 mr-2" />
            Preços dos Planos
          </Link>
                 <Link
                   to="/precos-revendedores"
                   className={`mx-2 rounded-md flex items-center px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white ${
                     location.pathname === '/precos-revendedores' ? 'bg-slate-800 text-white' : ''
                   }`}
                   onClick={() => setSidebarOpen(false)}
                 >
                   <TrendingUp className="w-5 h-5 mr-2" />
                   Preços Revendedores
                 </Link>
                 <Link
                   to="/configuracoes"
                   className={`mx-2 rounded-md flex items-center px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white ${
                     location.pathname === '/configuracoes' ? 'bg-slate-800 text-white' : ''
                   }`}
                   onClick={() => setSidebarOpen(false)}
                 >
                   <Settings className="w-5 h-5 mr-2" />
                   Configurações
          </Link>
        </nav>
      </div>

      {/* Mobile overlay to close sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 min-h-screen text-slate-100">
        <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              className="p-2 rounded-md md:hidden text-slate-200 hover:bg-slate-800"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-semibold">Painel de Controle</h1>
            {user && (
              <button
                onClick={handleSignOut}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </button>
            )}
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

