import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LogOut, User, Settings, Menu, Home, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import backend from '~backend/client';

interface HeaderProps {
  onNavigateToSettings?: () => void;
  onNavigateToDashboard?: () => void;
  onNavigateToEnrichment?: () => void;
  currentPage?: 'dashboard' | 'settings' | 'enrichment';
}

export function Header({ onNavigateToSettings, onNavigateToDashboard, onNavigateToEnrichment, currentPage = 'dashboard' }: HeaderProps) {
  const { user, logout } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [uiSettings, setUiSettings] = useState({
    appName: 'Pipeline d\'enrichissement',
    appDescription: 'Système automatisé d\'enrichissement de données client',
    enableAnimations: true
  });

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsMenuOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Charger les paramètres UI
  useEffect(() => {
    const loadUiSettings = async () => {
      try {
        const response = await backend.settings.getSettings({});
        setUiSettings(response.settings.uiSettings);
      } catch (error) {
        console.warn('Failed to load UI settings, using defaults');
      }
    };
    loadUiSettings();
  }, []);

  const handleNavClick = (action: () => void) => {
    action();
    setIsMenuOpen(false);
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo et titre */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button 
              onClick={() => handleNavClick(onNavigateToDashboard || (() => {}))}
              className={`font-bold hover:text-primary cursor-pointer truncate ${
                isMobile ? 'text-lg' : 'text-xl sm:text-2xl'
              } ${
                uiSettings.enableAnimations ? 'transition-colors duration-200' : ''
              }`}
              title={uiSettings.appDescription}
            >
              {isMobile 
                ? uiSettings.appName.split(' ')[0] // Show only first word on mobile
                : uiSettings.appName
              }
            </button>
            
            {/* Navigation desktop */}
            {!isMobile && (
              <nav className="flex items-center gap-1">
                <Button 
                  variant={currentPage === 'dashboard' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={onNavigateToDashboard}
                  className={uiSettings.enableAnimations ? 'transition-all duration-200' : ''}
                >
                  <Home className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
                <Button 
                  variant={currentPage === 'enrichment' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={onNavigateToEnrichment}
                  className={uiSettings.enableAnimations ? 'transition-all duration-200' : ''}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Enrichissement
                </Button>
                <Button 
                  variant={currentPage === 'settings' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={onNavigateToSettings}
                  className={uiSettings.enableAnimations ? 'transition-all duration-200' : ''}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Paramètres
                </Button>
              </nav>
            )}
          </div>
          
          {/* Actions utilisateur */}
          <div className="flex items-center gap-2">
            {/* Menu mobile */}
            {isMobile ? (
              <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="p-2"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => handleNavClick(onNavigateToDashboard || (() => {}))}>
                    <Home className="h-4 w-4 mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleNavClick(onNavigateToEnrichment || (() => {}))}>
                    <Zap className="h-4 w-4 mr-2" />
                    Enrichissement
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleNavClick(onNavigateToSettings || (() => {}))}>
                    <Settings className="h-4 w-4 mr-2" />
                    Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {user && (
                    <>
                      <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground border-b">
                        <User className="h-4 w-4 inline mr-2" />
                        {user.username}
                      </div>
                      <DropdownMenuItem onClick={() => handleNavClick(logout)}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Se déconnecter
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              /* Menu desktop */
              user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className={`${uiSettings.enableAnimations ? 'transition-all duration-200' : ''}`}
                    >
                      <User className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">{user.username}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onNavigateToSettings}>
                      <Settings className="h-4 w-4 mr-2" />
                      Paramètres
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Se déconnecter
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
