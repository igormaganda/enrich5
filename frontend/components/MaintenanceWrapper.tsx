import React, { useEffect, useState } from 'react';
import backend from '~backend/client';
import { useAuth } from '../contexts/AuthContext';

interface MaintenanceWrapperProps {
  children: React.ReactNode;
}

export function MaintenanceWrapper({ children }: MaintenanceWrapperProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [systemSettings, setSystemSettings] = useState({
    maintenanceMode: false,
    maintenanceMessage: 'Maintenance en cours. Merci de revenir plus tard.'
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        const response = await backend.settings.getSettings({});
        setSystemSettings(response.settings.systemSettings);
        console.log('System settings loaded:', response.settings.systemSettings);
      } catch (error) {
        console.warn('Failed to load system settings, maintenance mode disabled');
      } finally {
        setIsLoading(false);
      }
    };
    loadSystemSettings();
  }, []);

  // Debug logs
  useEffect(() => {
    console.log('MaintenanceWrapper debug:', {
      authLoading,
      user: user ? { username: user.username, role: user.role } : null,
      maintenanceMode: systemSettings.maintenanceMode,
      settingsLoading: isLoading
    });
  }, [authLoading, user, systemSettings.maintenanceMode, isLoading]);

  // Wait for both auth and settings to load
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (systemSettings.maintenanceMode && (!user || user.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Mode Maintenance</h1>
            <p className="text-gray-600">
              {systemSettings.maintenanceMessage}
            </p>
          </div>
          
          <div className="text-sm text-gray-500">
            <p>L'application sera de nouveau disponible prochainement.</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}