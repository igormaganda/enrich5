import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { History, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import backend from '~backend/client';
import type { EnrichmentJob } from '~backend/enrichment/list_jobs';

const HIDDEN_FILE_NAME_PREFIXES = ['blacklist_mobile_'];

const shouldDisplayJob = (job: EnrichmentJob) => {
  const fileName = job.file_name.toLowerCase();
  return !HIDDEN_FILE_NAME_PREFIXES.some((prefix) => fileName.startsWith(prefix));
};

export function EnrichmentJobHistory() {
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { toast } = useToast();

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const response = await backend.enrichment.listEnrichmentJobs({});
      setJobs(response.jobs);
    } catch (error) {
      console.error('Failed to load enrichment history:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique des enrichissements",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

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

  const visibleJobs = jobs.filter(shouldDisplayJob);

  if (isLoading) {
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
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>Historique des Enrichissements</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadHistory} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>{visibleJobs.length} enrichissement{visibleJobs.length !== 1 ? 's' : ''} au total</CardDescription>
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
            {visibleJobs.map((job) => (
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
        {visibleJobs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Aucun enrichissement effectué</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
