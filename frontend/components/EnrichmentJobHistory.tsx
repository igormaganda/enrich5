import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { History, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import backend from '~backend/client';
import type { EnrichmentJob } from '~backend/enrichment/list_jobs';

const STANDARD_REFRESH_INTERVAL = 30000;
const LOW_POWER_REFRESH_INTERVAL = 120000;

type LoadHistoryOptions = {
  silent?: boolean;
  initial?: boolean;
};

export function EnrichmentJobHistory() {
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isManuallyRefreshing, setIsManuallyRefreshing] = useState(false);
  const [lowPowerMode, setLowPowerMode] = useState(true);

  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);

  const { toast } = useToast();

  const refreshInterval = lowPowerMode ? LOW_POWER_REFRESH_INTERVAL : STANDARD_REFRESH_INTERVAL;
  const refreshIntervalSeconds = Math.round(refreshInterval / 1000);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadHistory = useCallback(async ({ silent = false, initial = false }: LoadHistoryOptions = {}) => {
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;

    if (initial) {
      if (isMountedRef.current) {
        setIsInitialLoading(true);
      }
    } else if (!silent) {
      if (isMountedRef.current) {
        setIsManuallyRefreshing(true);
      }
    }

    try {
      const response = await backend.enrichment.listEnrichmentJobs({});
      if (isMountedRef.current) {
        setJobs(response.jobs);
      }
    } catch (error) {
      console.error('Failed to load enrichment history:', error);
      if (!silent) {
        toast({
          title: 'Erreur',
          description: "Impossible de charger l'historique des enrichissements",
          variant: 'destructive'
        });
      }
    } finally {
      if (initial) {
        if (isMountedRef.current) {
          setIsInitialLoading(false);
        }
      } else if (!silent) {
        if (isMountedRef.current) {
          setIsManuallyRefreshing(false);
        }
      }
      isFetchingRef.current = false;
    }
  }, [toast]);

  useEffect(() => {
    loadHistory({ initial: true });
  }, [loadHistory]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadHistory({ silent: true });
    }, refreshInterval);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadHistory, refreshInterval]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'processing': return 'En cours';
      case 'completed': return 'Terminé';
      case 'failed': return 'Échec';
      default: return status;
    }
  };

  if (isInitialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>Historique des Enrichissements</span>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>Historique des Enrichissements</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="low-power-mode"
                checked={lowPowerMode}
                onCheckedChange={setLowPowerMode}
                aria-label="Activer le mode basse consommation"
              />
              <Label htmlFor="low-power-mode" className="text-sm font-normal text-muted-foreground">
                Mode basse consommation
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadHistory()}
              disabled={isInitialLoading || isManuallyRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isManuallyRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
        <CardDescription className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{jobs.length} enrichissement{jobs.length !== 1 ? 's' : ''} au total</span>
          <span>
            Actualisation automatique toutes les {refreshIntervalSeconds} s
            {lowPowerMode ? ' (mode basse consommation)' : ' (mode standard)'}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fichier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progression</TableHead>
              <TableHead>Détails</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.file_name}</TableCell>
                <TableCell>
                  <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(job.status)}
                      {getStatusLabel(job.status)}
                    </div>
                  </Badge>
                </TableCell>
                <TableCell>
                  {job.status === 'processing' && job.total_records > 0 && (
                    <Progress value={(job.processed_records / job.total_records) * 100} className="w-[100px]" />
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <p>Traitées: {job.processed_records}/{job.total_records}</p>
                  <p>Correspondances: {job.matched_records}</p>
                  <p>Enrichies: {job.enriched_records}</p>
                  <p>Filtrées: {job.filtered_records}</p>
                  <p>Finales: {job.final_records}</p>
                </TableCell>
                <TableCell>{new Date(job.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {jobs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Aucun enrichissement effectué</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
