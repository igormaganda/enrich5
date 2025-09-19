import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { History, Download, RefreshCw, AlertCircle, CheckCircle, Clock, ChevronDown, Eye, X, Trash2, Square } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import backend from '~backend/client';
import type { JobHistoryEntry } from '~backend/history/types';

export function JobHistory() {
  const [jobs, setJobs] = useState<JobHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [previewData, setPreviewData] = useState<{headers: string[], rows: string[][], totalRows: number} | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [hasRunningJobs, setHasRunningJobs] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadHistory = async (silent = false) => {
    if (!user) return;

    if (!silent) {
      setIsLoading(true);
    }
    
    try {
      const response = await backend.history.getHistory({
        userId: user.id.toString(),
        limit: 20,
        offset: 0
      });
      
      setJobs(response.jobs);
      setTotal(response.total);
      
      // Check if there are running jobs
      const runningJobs = response.jobs.some(job => 
        ['processing', 'extracting', 'validating', 'enriching'].includes(job.status)
      );
      setHasRunningJobs(runningJobs);
      
    } catch (error) {
      console.error('Failed to load history:', error);
      
      // Only show error message if not silent and user is still on the page
      if (!silent && document.visibilityState === 'visible') {
        let errorMessage = "Impossible de charger l'historique";
        
        if (error instanceof Error) {
          if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
            errorMessage = "Erreur de connexion. Impossible de charger l'historique.";
          } else if (error.message.includes('timeout')) {
            errorMessage = "Timeout de connexion. Le serveur met trop de temps à répondre.";
          }
        }
        
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user]);

  // Smart auto-refresh with dynamic interval from settings
  useEffect(() => {
    if (!hasRunningJobs || isUserInteracting || isPreviewOpen) {
      return;
    }

    // Get refresh interval from settings
    const getRefreshInterval = async () => {
      try {
        const response = await backend.settings.getSettings({});
        return response.settings.processingSettings.autoRefreshInterval * 1000; // Convert to milliseconds
      } catch (error) {
        return 5000; // Default 5 seconds
      }
    };

    let interval: NodeJS.Timeout;
    
    getRefreshInterval().then(intervalMs => {
      interval = setInterval(() => {
        // Silent refresh to avoid loading states during auto-refresh
        loadHistory(true);
      }, intervalMs);
    });
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [hasRunningJobs, isUserInteracting, isPreviewOpen, user]);

  // Track user interactions
  useEffect(() => {
    let interactionTimer: NodeJS.Timeout;

    const handleUserActivity = () => {
      setIsUserInteracting(true);
      clearTimeout(interactionTimer);
      
      // Reset after 3 seconds of inactivity
      interactionTimer = setTimeout(() => {
        setIsUserInteracting(false);
      }, 3000);
    };

    // Listen for user interactions
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });
      clearTimeout(interactionTimer);
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <X className="h-4 w-4 text-orange-500" />;
      case 'processing':
      case 'extracting':
      case 'validating':
      case 'enriching':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'processing': return 'En cours';
      case 'extracting': return 'Extraction...';
      case 'validating': return 'Validation...';
      case 'enriching': return 'Enrichissement...';
      case 'completed': return 'Terminé';
      case 'failed': return 'Échec';
      case 'cancelled': return 'Annulé';
      default: return status;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'cancelled':
        return 'outline';
      case 'processing':
      case 'extracting':
      case 'validating':
      case 'enriching':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handlePreview = async (jobId: string) => {
    try {
      setIsUserInteracting(true); // Prevent auto-refresh during preview
      const preview = await backend.download.previewResults({ jobId, limit: 5 });
      setPreviewData(preview);
      setIsPreviewOpen(true);
    } catch (error) {
      console.error('Preview failed:', error);
      toast({
        title: "Erreur de prévisualisation",
        description: "Impossible de prévisualiser les résultats",
        variant: "destructive"
      });
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      setIsUserInteracting(true); // Prevent auto-refresh during action
      const result = await backend.history.cancelJob({ jobId });
      toast({
        title: "Job annulé",
        description: result.message,
      });
      loadHistory(); // Manual refresh after action
    } catch (error) {
      console.error('Cancel failed:', error);
      toast({
        title: "Erreur d'annulation",
        description: "Impossible d'annuler le job",
        variant: "destructive"
      });
    }
  };

  const confirmDelete = (jobId: string) => {
    setJobToDelete(jobId);
    setIsDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!jobToDelete) return;

    try {
      setIsUserInteracting(true); // Prevent auto-refresh during action
      const result = await backend.history.deleteJob({ jobId: jobToDelete });
      toast({
        title: "Job supprimé",
        description: result.message,
      });
      loadHistory(); // Manual refresh after action
    } catch (error) {
      console.error('Delete failed:', error);
      toast({
        title: "Erreur de suppression",
        description: "Impossible de supprimer le job",
        variant: "destructive"
      });
    } finally {
        setIsDeleteConfirmOpen(false);
        setJobToDelete(null);
    }
  };

  const handleDownload = async (jobId: string, format: 'zip' | 'rar' | 'csv' = 'zip') => {
    try {
        const downloadInfo = await backend.download.getDownloadInfo({ jobId, format });

        if (downloadInfo.r2Url) {
            // If R2 URL is available, use it for direct download
            const link = document.createElement('a');
            link.href = downloadInfo.r2Url;
            link.download = downloadInfo.filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast({
                title: "Téléchargement démarré",
                description: `Le téléchargement de ${downloadInfo.filename} a commencé.`,
            });
        } else {
            // Fallback to fetching from backend if no R2 URL
            const response = await backend.download.downloadFile({ jobId, format });
            
            // Convert base64 to blob
            const binaryString = atob(response.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: response.mimeType });
            
            // Create download URL and trigger download
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = response.filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            URL.revokeObjectURL(downloadUrl);
            
            toast({
                title: "Téléchargement réussi",
                description: `${response.filename} téléchargé avec succès`,
            });
        }
    } catch (error) {
        console.error('Download failed:', error);
        toast({
            title: "Erreur de téléchargement",
            description: "Impossible de télécharger le fichier",
            variant: "destructive"
        });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>Historique des traitements</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <History className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
            <span className="text-lg sm:text-xl font-semibold">Historique des traitements</span>
          </div>
          <Button
            variant="outline"
            size={isMobile ? "sm" : "default"}
            onClick={() => loadHistory()}
            disabled={isLoading}
            className="self-start sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''} ${isMobile ? '' : 'mr-2'}`} />
            {!isMobile && "Actualiser"}
          </Button>
        </CardTitle>
        <CardDescription className="text-sm sm:text-base">
          {total} traitement{total !== 1 ? 's' : ''} au total
          {hasRunningJobs && !isUserInteracting && !isPreviewOpen && (
            <span className="block sm:inline sm:ml-2 text-xs text-blue-500">
              {isMobile ? "Mise à jour auto active" : "• Mise à jour automatique active"}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <div className="space-y-3 sm:space-y-4">
          {jobs.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <History className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/50 mb-4" />
              <p className="text-sm sm:text-base">Aucun traitement effectué</p>
            </div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getStatusIcon(job.status)}
                      <span className="font-medium truncate text-sm sm:text-base">{job.filename}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={getStatusVariant(job.status)} className="text-xs">
                        {getStatusLabel(job.status)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {job.fileType}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
                    <p className="font-mono text-xs">ID: {job.jobId.substring(0, 8)}...</p>
                    <p>
                      {isMobile ? 'Démarré' : 'Démarré le'} {new Date(job.startedAt).toLocaleString('fr-FR', {
                        ...(isMobile ? { 
                          month: '2-digit',
                          day: '2-digit', 
                          hour: '2-digit',
                          minute: '2-digit'
                        } : {})
                      })}
                      {job.completedAt && (
                        <span className={isMobile ? "block" : ""}>
                          {isMobile ? '' : ' • '}
                          {isMobile ? 'Terminé' : 'Terminé le'} {new Date(job.completedAt).toLocaleString('fr-FR', {
                            ...(isMobile ? { 
                              month: '2-digit',
                              day: '2-digit', 
                              hour: '2-digit',
                              minute: '2-digit'
                            } : {})
                          })}
                        </span>
                      )}
                    </p>
                    {job.status === 'completed' && (
                      <p className="text-xs">
                        {job.recordsProcessed} traités • {job.recordsEnriched} enrichis
                      </p>
                    )}
                    {(job.status === 'processing' || job.status === 'enriching') && job.fileType === 'enrichment_import' && (
                      <div className="mt-2">
                        <Progress value={job.recordsProcessed} max={10000} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">{job.recordsProcessed} lignes importées</p>
                      </div>
                    )}
                    {job.errorMessage && (
                        <div className="mt-2 p-2 border border-red-500/50 bg-red-500/10 rounded-md">
                        <p className="text-red-700 dark:text-red-400 text-xs break-words font-medium">
                          <span className="font-bold">Erreur:</span> {job.errorMessage}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`flex ${isMobile ? 'flex-col gap-2' : 'flex-row items-center gap-2'} ${isMobile ? 'w-full' : 'flex-shrink-0'}`}>
                  {/* Preview button for completed jobs */}
                  {job.status === 'completed' && (
                    <Button
                      variant="outline"
                      size={isMobile ? "sm" : "sm"}
                      onClick={() => handlePreview(job.jobId)}
                      className={isMobile ? "w-full justify-start" : ""}
                    >
                      <Eye className="h-4 w-4 ${isMobile ? 'mr-2' : 'mr-1'}" />
                      {isMobile ? "Aperçu" : ""}
                    </Button>
                  )}

                  {/* Download dropdown for completed jobs */}
                  {job.status === 'completed' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          size={isMobile ? "sm" : "sm"}
                          className={isMobile ? "w-full justify-between" : ""}
                        >
                          <div className="flex items-center">
                            <Download className="h-4 w-4 ${isMobile ? 'mr-2' : 'mr-1'}" />
                            {isMobile ? "Télécharger" : ""}
                          </div>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isMobile ? "end" : "start"}>
                        <DropdownMenuItem onClick={() => handleDownload(job.jobId, 'csv')}>
                          📄 Fichier CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(job.jobId, 'zip')}>
                          📦 Archive ZIP
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(job.jobId, 'rar')}>
                          🗜️ Archive RAR
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Cancel button for running jobs */}
                  {(job.status === 'processing' || job.status === 'extracting' || 
                    job.status === 'validating' || job.status === 'enriching') && (
                    <Button
                      variant="outline"
                      size={isMobile ? "sm" : "sm"}
                      onClick={() => handleCancel(job.jobId)}
                      className={isMobile ? "w-full justify-start" : ""}
                    >
                      <Square className="h-4 w-4 ${isMobile ? 'mr-2' : 'mr-1'}" />
                      {isMobile ? "Arrêter" : ""}
                    </Button>
                  )}

                  {/* Delete button for completed/failed/cancelled jobs */}
                  {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                    <Button
                      variant="outline"
                      size={isMobile ? "sm" : "sm"}
                      onClick={() => confirmDelete(job.jobId)}
                      className={isMobile ? "w-full justify-start" : ""}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={(open) => {
        setIsPreviewOpen(open);
        if (!open) {
          // Allow auto-refresh to resume after preview is closed
          setTimeout(() => setIsUserInteracting(false), 1000);
        }
      }}>
        <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[85vh]' : 'max-w-4xl max-h-[80vh]'} overflow-hidden`}>
          <DialogHeader>
            <DialogTitle className={isMobile ? "text-lg" : "text-xl"}>Aperçu des résultats enrichis</DialogTitle>
            <DialogDescription className={isMobile ? "text-sm" : ""}>
              {previewData && `Affichage des ${previewData.rows.length} premières lignes sur ${previewData.totalRows} total`}
            </DialogDescription>
          </DialogHeader>
          
          {previewData && (
            <div className={`mt-4 overflow-auto ${isMobile ? 'max-h-[60vh]' : 'max-h-[60vh]'}`}>
              <div className={isMobile ? "min-w-full" : ""}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewData.headers.map((header, index) => (
                        <TableHead key={index} className={`font-semibold ${isMobile ? 'text-xs px-2' : 'text-xs px-4'}`}>
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.rows.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex} className={isMobile ? 'text-xs px-2' : 'text-xs px-4'}>
                            <div className={isMobile ? "max-w-[100px] truncate" : ""} title={String(cell)}>
                              {String(cell)}
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {previewData.totalRows > previewData.rows.length && (
                <div className={`mt-4 text-center text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  ... et {previewData.totalRows - previewData.rows.length} autres lignes
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirmer la suppression</DialogTitle>
                    <DialogDescription>
                        Êtes-vous sûr de vouloir supprimer ce job de l'historique ? Cette action est irréversible.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Annuler</Button>
                    <Button variant="destructive" onClick={handleDelete}>Supprimer</Button>
                </div>
            </DialogContent>
        </Dialog>
    </Card>
  );
}