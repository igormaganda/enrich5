import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Play,
  Pause,
  AlertTriangle,
  Download,
  Upload,
  Zap
} from 'lucide-react';
import backend from '~backend/client';
import type { BackgroundJob } from '~backend/ftp/types';

export function BackgroundJobMonitor() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadJobs();
    }, 3000); // Actualisation toutes les 3 secondes

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadJobs = async () => {
    try {
      const response = await backend.ftp.listBackgroundJobs({ limit: 50 });
      setJobs(response.jobs);
    } catch (error) {
      console.error('Error loading background jobs:', error);
      
      // Only show error if the page is visible to avoid spam
      if (document.visibilityState === 'visible') {
        let errorMessage = "Impossible de charger les tâches en arrière-plan";
        
        if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('Network'))) {
          errorMessage = "Erreur de connexion. Impossible de charger les tâches.";
        }
        
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await backend.ftp.cancelBackgroundJob({ id: jobId });
      toast({
        title: "Succès",
        description: "Tâche annulée",
      });
      loadJobs();
    } catch (error) {
      console.error('Error cancelling job:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'annuler la tâche",
        variant: "destructive",
      });
    }
  };

  const getJobTypeIcon = (type: string) => {
    switch (type) {
      case 'ftp_scan':
        return <Download className="h-4 w-4" />;
      case 'file_processing':
        return <Upload className="h-4 w-4" />;
      case 'enrichment':
        return <Zap className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'ftp_scan':
        return 'Scan FTP';
      case 'file_processing':
        return 'Traitement fichier';
      case 'enrichment':
        return 'Enrichissement';
      default:
        return type;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'running':
        return 'outline';
      case 'cancelled':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return '-';
    
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  const runningJobs = jobs.filter(job => job.status === 'running');
  const recentJobs = jobs.filter(job => job.status !== 'running').slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Suivi des tâches</h2>
          <p className="text-muted-foreground">
            Surveillez les tâches d'enrichissement en temps réel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {autoRefresh ? 'Pause' : 'Play'}
          </Button>
          <Button variant="outline" onClick={loadJobs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Tâches en cours */}
      {runningJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Tâches en cours ({runningJobs.length})
            </CardTitle>
            <CardDescription>
              Tâches actuellement en traitement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {runningJobs.map((job) => (
                <div key={job.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getJobTypeIcon(job.type)}
                      <span className="font-medium">{getJobTypeLabel(job.type)}</span>
                      <Badge variant={getStatusVariant(job.status)}>
                        {job.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(job.startedAt)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelJob(job.id)}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{job.currentStep || 'En cours...'}</span>
                      <span>{job.progress}%</span>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                    {job.totalSteps > 1 && (
                      <div className="text-xs text-muted-foreground">
                        Étape {job.completedSteps}/{job.totalSteps}
                      </div>
                    )}
                  </div>

                  {job.data && (
                    <div className="text-xs text-muted-foreground">
                      {job.data.fileName && `Fichier: ${job.data.fileName}`}
                      {job.data.serverId && ` • Serveur: ${job.data.serverId}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historique des tâches */}
      <Card>
        <CardHeader>
          <CardTitle>Historique récent</CardTitle>
          <CardDescription>
            Les dernières tâches terminées
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {recentJobs.map((job, index) => (
                <div key={job.id}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent">
                    <div className="flex items-center gap-3">
                      {getJobTypeIcon(job.type)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getJobTypeLabel(job.type)}</span>
                          <Badge variant={getStatusVariant(job.status)}>
                            {getStatusIcon(job.status)}
                            {job.status}
                          </Badge>
                        </div>
                        {job.error && (
                          <div className="text-sm text-red-500 mt-1">{job.error}</div>
                        )}
                        {job.data?.fileName && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {job.data.fileName}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right text-sm text-muted-foreground">
                      <div>
                        {new Date(job.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <div>{formatDuration(job.startedAt, job.completedAt)}</div>
                    </div>
                  </div>
                  {index < recentJobs.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
              
              {recentJobs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune tâche récente
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">
                  {jobs.filter(j => j.status === 'running').length}
                </div>
                <div className="text-xs text-muted-foreground">En cours</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-2xl font-bold">
                  {jobs.filter(j => j.status === 'completed').length}
                </div>
                <div className="text-xs text-muted-foreground">Terminées</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <div>
                <div className="text-2xl font-bold">
                  {jobs.filter(j => j.status === 'failed').length}
                </div>
                <div className="text-xs text-muted-foreground">Échouées</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <div className="text-2xl font-bold">
                  {jobs.filter(j => j.status === 'pending').length}
                </div>
                <div className="text-xs text-muted-foreground">En attente</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}