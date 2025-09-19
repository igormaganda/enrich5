import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MaintenanceWrapper } from './components/MaintenanceWrapper';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { Header } from './components/Header';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const getCurrentPage = (): 'dashboard' | 'settings' => {
    if (location.pathname === '/settings') return 'settings';
    return 'dashboard';
  };

  const handleNavigateToSettings = () => {
    navigate('/settings');
  };

  const handleNavigateToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <MaintenanceWrapper>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Header 
              onNavigateToSettings={handleNavigateToSettings}
              onNavigateToDashboard={handleNavigateToDashboard}
              currentPage={getCurrentPage()}
            />
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Header 
              onNavigateToSettings={handleNavigateToSettings}
              onNavigateToDashboard={handleNavigateToDashboard}
              currentPage={getCurrentPage()}
            />
            <div className="container mx-auto px-4 py-8">
              <SettingsPage />
            </div>
          </ProtectedRoute>
        } />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MaintenanceWrapper>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-background antialiased">
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
        <Toaster />
      </AuthProvider>
    </div>
  );
}
