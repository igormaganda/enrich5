import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Download, RefreshCw } from 'lucide-react';
import backend from '~backend/client';

export function FtpQuickActions() {
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();

  const handleScanAllServers = async () => {
    setScanning(true);
    try {
      const response = await backend.ftp.scanAllFtpServers();
      toast({
        title: "Scan FTP lancé",
        description: `Scan de tous les serveurs FTP en cours (Job ID: ${response.scanId})`,
      });
    } catch (error) {
      console.error('Error starting FTP scan:', error);
      toast({
        title: "Erreur",
        description: "Impossible de lancer le scan FTP",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Actions FTP rapides
        </CardTitle>
        <CardDescription>
          Déclenchez des actions sur vos serveurs FTP configurés
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button 
            onClick={handleScanAllServers}
            disabled={scanning}
            className="w-full"
          >
            {scanning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Scan en cours...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Scanner tous les serveurs FTP
              </>
            )}
          </Button>
          
          <div className="text-sm text-muted-foreground">
            Cette action va scanner tous les serveurs FTP actifs pour détecter de nouveaux fichiers à traiter.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}