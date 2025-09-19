import React, { useEffect, useState } from 'react';
import FileUpload from '@/components/FileUpload';
import FileUploadWithMapping from '@/components/FileUploadWithMapping';
import ArchiveEnrichmentUpload from '@/components/ArchiveEnrichmentUpload';
import { JobHistory } from '../components/JobHistory';
import { EmailTest } from '../components/EmailTest';
import { FtpQuickActions } from '../components/FtpQuickActions';
import { BackgroundJobMonitor } from '../components/BackgroundJobMonitor';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import backend from '~backend/client';

export function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Add global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      if (event.reason && event.reason.message && event.reason.message.includes('Failed to fetch')) {
        toast({
          title: "Erreur de connexion",
          description: "Problème de connexion réseau détecté. Rechargez la page si le problème persiste.",
          variant: "destructive"
        });
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, [toast]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <main className="container mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
      <div className={`${
        isMobile 
          ? 'space-y-6' 
          : 'grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 xl:gap-10'
      }`}>
        <div className={`${
          isMobile 
            ? 'space-y-6' 
            : 'space-y-6 lg:space-y-8'
        }`}>
          <Tabs defaultValue="mapping" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="mapping">Upload avec mapping</TabsTrigger>
              <TabsTrigger value="legacy">Upload standard</TabsTrigger>
              <TabsTrigger value="archive">Enrichissement</TabsTrigger>
            </TabsList>
            <TabsContent value="mapping" className="mt-4">
              <FileUploadWithMapping />
            </TabsContent>
            <TabsContent value="legacy" className="mt-4">
              <FileUpload />
            </TabsContent>
            <TabsContent value="archive" className="mt-4">
              <ArchiveEnrichmentUpload userId={user.id} />
            </TabsContent>
          </Tabs>
          <FtpQuickActions />
          <EmailTest />
        </div>
        <div className="w-full">
          <Tabs defaultValue="history" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="history">Historique</TabsTrigger>
              <TabsTrigger value="jobs">Tâches actives</TabsTrigger>
            </TabsList>
            <TabsContent value="history" className="mt-4">
              <JobHistory />
            </TabsContent>
            <TabsContent value="jobs" className="mt-4">
              <BackgroundJobMonitor />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}
