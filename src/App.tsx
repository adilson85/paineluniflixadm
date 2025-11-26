import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import ClientDetails from './pages/ClientDetails'; // Versão refatorada modular
import ClientesOffline from './pages/ClientesOffline';
import ClienteOfflineDetails from './pages/ClienteOfflineDetails';
import Caixa from './pages/Caixa';
import TestesLiberados from './pages/TestesLiberadosDark';
import CreditosComprados from './pages/CreditosComprados';
import CreditosVendidos from './pages/CreditosVendidos';
import Revendedores from './pages/Revendedores';
import PrecosPlanos from './pages/PrecosPlanos';
import PrecosRevendedores from './pages/PrecosRevendedores';
import Configuracoes from './pages/Configuracoes';
import ResetPassword from './pages/ResetPassword';
import Login from './pages/Login';
import AdminRoute from './components/AdminRoute';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <AdminRoute>
                <Dashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/clientes"
            element={
              <AdminRoute>
                <Clientes />
              </AdminRoute>
            }
          />
          <Route
            path="/clientes/:id"
            element={
              <AdminRoute>
                <ClientDetails />
              </AdminRoute>
            }
          />
          <Route
            path="/clientes-offline"
            element={
              <AdminRoute>
                <ClientesOffline />
              </AdminRoute>
            }
          />
          <Route
            path="/clientes-offline/:id"
            element={
              <AdminRoute>
                <ClienteOfflineDetails />
              </AdminRoute>
            }
          />
          <Route
            path="/caixa"
            element={
              <AdminRoute>
                <Caixa />
              </AdminRoute>
            }
          />
          <Route
            path="/testes-liberados"
            element={
              <AdminRoute>
                <TestesLiberados />
              </AdminRoute>
            }
          />
          <Route
            path="/creditos-comprados"
            element={
              <AdminRoute>
                <CreditosComprados />
              </AdminRoute>
            }
          />
          <Route
            path="/creditos-vendidos"
            element={
              <AdminRoute>
                <CreditosVendidos />
              </AdminRoute>
            }
          />
          <Route
            path="/revendedores"
            element={
              <AdminRoute>
                <Revendedores />
              </AdminRoute>
            }
          />
          <Route
            path="/precos-planos"
            element={
              <AdminRoute>
                <PrecosPlanos />
              </AdminRoute>
            }
          />
          <Route
            path="/precos-revendedores"
            element={
              <AdminRoute>
                <PrecosRevendedores />
              </AdminRoute>
            }
          />
          <Route
            path="/configuracoes"
            element={
              <AdminRoute>
                <Configuracoes />
              </AdminRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App
