import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
  FileText, 
  Archive, 
  Download, 
  Clock, 
  Server, 
  AlertCircle,
  CheckCircle,
  FileX,
  FolderOpen
} from 'lucide-react';
import backend from '~backend/client';

interface FileDetail {
  name: string;
  size: number;
  format: string;
  isZip: boolean;
  extractedFiles?: string[];
  downloadPath: string;
  downloadedAt: string;
}

interface FtpScanResult {
  serverId: string;
  serverName: string;
  filesFound: number;
  filesDownloaded: number;
  fileDetails: FileDetail[] | null | any;
  errors: string[] | null | any;
  scanStartedAt: string;
  scanCompletedAt: string;
}

interface ScanLog {
  id: string;
  serverId: string;
  serverName: string;
  filesFound: number;
  filesDownloaded: number;
  errors: string[] | null | any;
  scanCompletedAt: string;
}

export function FtpScanResults() {
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [scanDetails, setScanDetails] = useState<FtpScanResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadScanLogs();
  }, []);

  const loadScanLogs = async () => {
    try {
      setLoading(true);
      const response = await backend.ftp.getScanLogs();
      setScanLogs(response.logs);
    } catch (error) {
      console.error('Error loading scan logs:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les logs de scan FTP",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadScanDetails = async (scanId: string) => {
    try {
      const response = await backend.ftp.getScanLogDetails({ logId: scanId });
      setScanDetails(response.scanResult);
      setSelectedScan(scanId);
    } catch (error) {
      console.error('Error loading scan details:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les détails du scan",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (format: string, isZip: boolean) => {
    if (isZip) return <Archive className="h-4 w-4" />;
    switch (format.toLowerCase()) {
      case 'csv':
      case 'xlsx':
      case 'xls':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileX className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (log: ScanLog) => {
    if (log.errors && Array.isArray(log.errors) && log.errors.length > 0) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    if (log.filesDownloaded === log.filesFound) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    return <Clock className="h-4 w-4 text-yellow-600" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-muted-foreground">Chargement des résultats de scan...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Liste des scans récents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Historique des scans FTP
          </CardTitle>
          <CardDescription>
            Résultats des derniers scans effectués sur vos serveurs FTP
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scanLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Aucun scan FTP effectué récemment
            </div>
          ) : (
            <div className="space-y-3">
              {scanLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => loadScanDetails(log.id)}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log)}
                    <div>
                      <div className="font-medium">{log.serverName}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(log.scanCompletedAt).toLocaleString('fr-FR')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={log.errors && Array.isArray(log.errors) && log.errors.length > 0 ? "destructive" : "default"}>
                      {log.filesDownloaded}/{log.filesFound} fichiers
                    </Badge>
                    {log.errors && Array.isArray(log.errors) && log.errors.length > 0 && (
                      <Badge variant="destructive">{log.errors.length} erreurs</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Détails du scan sélectionné */}
      {scanDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Détails du scan - {scanDetails.serverName}
            </CardTitle>
            <CardDescription>
              Fichiers récupérés le {new Date(scanDetails.scanCompletedAt).toLocaleString('fr-FR')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Résumé */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{scanDetails.filesFound}</div>
                  <div className="text-sm text-muted-foreground">Fichiers trouvés</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{scanDetails.filesDownloaded}</div>
                  <div className="text-sm text-muted-foreground">Fichiers téléchargés</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-destructive">
                    {scanDetails.errors && Array.isArray(scanDetails.errors) ? scanDetails.errors.length : 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Erreurs</div>
                </div>
              </div>

              {/* Liste des fichiers */}
              <div className="space-y-3">
                <h4 className="font-medium">Fichiers traités</h4>
                {scanDetails.fileDetails && Array.isArray(scanDetails.fileDetails) ? scanDetails.fileDetails.map((file, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getFileIcon(file.format, file.isZip)}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{file.name}</div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {file.format.toUpperCase()}
                              </Badge>
                            </span>
                            <span>{formatFileSize(file.size)}</span>
                            <span>{new Date(file.downloadedAt).toLocaleString('fr-FR')}</span>
                          </div>
                          
                          {/* Fichiers extraits du ZIP */}
                          {file.isZip && file.extractedFiles && file.extractedFiles.length > 0 && (
                            <div className="mt-3 pl-4 border-l-2 border-muted">
                              <div className="text-sm font-medium mb-2">
                                Fichiers extraits ({file.extractedFiles.length})
                              </div>
                              <div className="space-y-1">
                                {file.extractedFiles.map((extractedFile: string, idx: number) => (
                                  <div key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                                    <FileText className="h-3 w-3" />
                                    {extractedFile}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center text-muted-foreground py-4">
                    Aucun fichier traité lors de ce scan
                  </div>
                )}
              </div>

              {/* Erreurs */}
              {scanDetails.errors && Array.isArray(scanDetails.errors) && scanDetails.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-destructive">Erreurs rencontrées</h4>
                  {scanDetails.errors.map((error, index) => (
                    <div key={index} className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                        <div className="text-sm">{error}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}