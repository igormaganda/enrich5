import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { History, RefreshCw, AlertCircle, CheckCircle, Clock, Timer } from 'lucide-react';
import backend from '~backend/client';
import type { EnrichmentJob } from '~backend/enrichment/list_jobs';
import { cn } from '@/lib/utils';

type NormalizedStatus = 'waiting' | 'processing' | 'completed' | 'failed';

type StageState = 'pending' | 'active' | 'complete' | 'error';

interface StageProgress {
  key: string;
  label: string;
  value: number;
  progress: number;
  state: StageState;
}

const JOB_FIELDS: (keyof EnrichmentJob)[] = [
  'id',
  'status',
  'file_name',
  'total_records',
  'processed_records',
  'matched_records',
  'enriched_records',
  'filtered_records',
  'final_records',
  'error_message',
  'created_at',
  'started_at',
  'completed_at',
];

const STAGE_DEFINITIONS = [
  { key: 'analysis', label: 'Analyse', accessor: (job: EnrichmentJob) => job.processed_records },
  { key: 'processing', label: 'Traitement', accessor: (job: EnrichmentJob) => job.matched_records },
  { key: 'enrichment', label: 'Enrichissement', accessor: (job: EnrichmentJob) => job.enriched_records },
  { key: 'finalization', label: 'Finalisation', accessor: (job: EnrichmentJob) => job.final_records },
] as const;

const statusBadgeClass: Record<NormalizedStatus, string> = {
  waiting: 'border-muted-foreground/40 bg-muted/60 text-muted-foreground',
  processing: 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:border-blue-500/60 dark:bg-blue-500/20',
  completed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/60 dark:bg-emerald-500/20',
  failed: 'border-red-500/40 bg-red-500/10 text-red-600 dark:border-red-500/60 dark:bg-red-500/20',
};

const progressIndicatorClass: Record<NormalizedStatus, string> = {
  waiting: 'bg-muted-foreground/30',
  processing: 'bg-blue-500 shadow-sm shadow-blue-500/40 animate-pulse',
  completed: 'bg-emerald-500 shadow-sm shadow-emerald-500/40',
  failed: 'bg-red-500 shadow-sm shadow-red-500/40',
};

const stageStyles: Record<StageState, { dot: string; text: string; line: string }> = {
  pending: {
    dot: 'bg-muted-foreground/20 border-muted-foreground/40',
    text: 'text-muted-foreground',
    line: 'bg-muted-foreground/20',
  },
  active: {
    dot: 'bg-blue-500 border-blue-500 shadow-blue-500/40 shadow-sm',
    text: 'text-blue-600',
    line: 'bg-blue-400/60',
  },
  complete: {
    dot: 'bg-emerald-500 border-emerald-500 shadow-emerald-500/30 shadow',
    text: 'text-emerald-600',
    line: 'bg-emerald-400/60',
  },
  error: {
    dot: 'bg-red-500 border-red-500 shadow-red-500/40 shadow',
    text: 'text-red-600',
    line: 'bg-red-400/60',
  },
};

type MetricTone = 'muted' | 'info' | 'success' | 'warning' | 'danger';

const metricToneClass: Record<MetricTone, string> = {
  muted: 'text-foreground',
  info: 'text-blue-600',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const clampPercentage = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
};

const normalizeStatus = (status: string): NormalizedStatus => {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'processing':
      return 'processing';
    default:
      return 'waiting';
  }
};

const formatDuration = (ms: number | null | undefined) => {
  if (!Number.isFinite(ms as number) || (ms ?? 0) < 0) {
    return '—';
  }
  const totalSeconds = Math.floor((ms as number) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} j`);
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0) parts.push(`${minutes} min`);
  if (parts.length === 0 && seconds > 0) parts.push(`${seconds} s`);
  if (parts.length === 0) parts.push('0 s');

  return parts.slice(0, 2).join(' ');
};

const jobsAreEqual = (previous: EnrichmentJob[], next: EnrichmentJob[]) => {
  if (previous.length !== next.length) {
    return false;
  }

  for (let index = 0; index < previous.length; index++) {
    const current = previous[index];
    const candidate = next[index];
    if (!candidate) {
      return false;
    }
    for (const field of JOB_FIELDS) {
      if ((current as Record<string, unknown>)[field] !== (candidate as Record<string, unknown>)[field]) {
        return false;
      }
    }
  }

  return true;
};

const buildStageProgress = (job: EnrichmentJob, status: NormalizedStatus): StageProgress[] => {
  const total = job.total_records ?? 0;
  const stages = STAGE_DEFINITIONS.map((definition) => {
    const value = definition.accessor(job) ?? 0;
    const progress = total > 0 ? Math.min(value / total, 1) : 0;
    return {
      key: definition.key,
      label: definition.label,
      value,
      progress,
      state: 'pending' as StageState,
    };
  });

  if (status === 'completed') {
    return stages.map((stage) => ({ ...stage, state: 'complete' }));
  }

  const firstIncompleteIndex = stages.findIndex((stage) => stage.progress < 0.999);
  return stages.map((stage, index) => {
    let state: StageState = 'pending';

    if (status === 'failed') {
      if (firstIncompleteIndex === -1) {
        state = index === stages.length - 1 ? 'error' : 'complete';
      } else if (index < firstIncompleteIndex) {
        state = 'complete';
      } else if (index === firstIncompleteIndex) {
        state = 'error';
      } else {
        state = 'pending';
      }
    } else if (status === 'processing') {
      if (firstIncompleteIndex === -1) {
        state = index === stages.length - 1 ? 'active' : 'complete';
      } else if (index < firstIncompleteIndex) {
        state = 'complete';
      } else if (index === firstIncompleteIndex) {
        state = 'active';
      } else {
        state = 'pending';
      }
    } else if (status === 'waiting') {
      state = index === 0 ? 'active' : 'pending';
    }

    return {
      ...stage,
      state,
    };
  });
};

const computeProgressRatio = (job: EnrichmentJob, status: NormalizedStatus) => {
  if (status === 'completed') {
    return 1;
  }
  const total = job.total_records ?? 0;
  if (total <= 0) {
    return 0;
  }
  return Math.min((job.processed_records ?? 0) / total, 1);
};

const computeTimeInfo = (job: EnrichmentJob, status: NormalizedStatus, now: number, progressRatio: number) => {
  const startTimestamp = job.started_at ? new Date(job.started_at).getTime() : new Date(job.created_at).getTime();
  const endTimestamp = status === 'completed' && job.completed_at
    ? new Date(job.completed_at).getTime()
    : status === 'failed' && job.completed_at
      ? new Date(job.completed_at).getTime()
      : now;

  const elapsedMs = Math.max(0, endTimestamp - startTimestamp);

  let remainingMs: number | null = null;
  if (status === 'completed') {
    remainingMs = 0;
  } else if (status === 'processing' && progressRatio > 0 && Number.isFinite(progressRatio)) {
    const estimatedTotal = elapsedMs / progressRatio;
    const estimatedRemaining = estimatedTotal - elapsedMs;
    if (Number.isFinite(estimatedRemaining)) {
      remainingMs = Math.max(0, estimatedRemaining);
    }
  }

  return {
    elapsed: elapsedMs,
    remaining: remainingMs,
    elapsedLabel: formatDuration(elapsedMs),
    remainingLabel: remainingMs === null ? '—' : formatDuration(remainingMs),
  };
};

const getStatusMeta = (status: NormalizedStatus) => {
  switch (status) {
    case 'completed':
      return {
        label: 'Terminé',
        icon: <CheckCircle className="h-4 w-4 text-emerald-500" aria-hidden="true" />,
      };
    case 'failed':
      return {
        label: 'Échec',
        icon: <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />,
      };
    case 'processing':
      return {
        label: 'En cours',
        icon: <Clock className="h-4 w-4 text-blue-500 animate-spin" aria-hidden="true" />,
      };
    default:
      return {
        label: 'En attente',
        icon: <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
      };
  }
};

const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const previousValue = useRef<number>(value);
  const animationFrame = useRef<number | null>(null);

  useEffect(() => {
    const start = previousValue.current;
    const end = value;

    if (start === end) {
      setDisplayValue(end);
      return;
    }

    const duration = 500;
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = easeOutCubic(progress);
      setDisplayValue(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(tick);
      }
    };

    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }

    animationFrame.current = requestAnimationFrame(tick);
    previousValue.current = end;

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }
    };
  }, [value]);

  return <span className="tabular-nums">{displayValue}</span>;
};

const DetailMetric: React.FC<{
  label: string;
  value: number | null | undefined;
  total?: number | null;
  tone?: MetricTone;
  className?: string;
}> = ({ label, value = 0, total, tone = 'muted', className }) => (
  <div className={cn('flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-xs shadow-sm dark:bg-muted/20', className)}>
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className={cn('flex items-baseline gap-1 text-sm font-semibold', metricToneClass[tone])}>
      <AnimatedNumber value={Math.max(0, Math.trunc(value))} />
      {typeof total === 'number' && (
        <span className="text-xs font-normal text-muted-foreground">/ {total}</span>
      )}
    </span>
  </div>
);

const StageTimeline: React.FC<{ stages: StageProgress[] }> = ({ stages }) => (
  <div className="mt-3 flex flex-wrap items-center gap-y-2 text-[11px]">
    {stages.map((stage, index) => {
      const styles = stageStyles[stage.state];
      return (
        <React.Fragment key={stage.key}>
          <div className="flex items-center gap-2">
            <span className={cn('flex h-3 w-3 items-center justify-center rounded-full border', styles.dot)} aria-hidden="true" />
            <span className={cn('font-semibold uppercase tracking-wide', styles.text)}>{stage.label}</span>
          </div>
          {index < stages.length - 1 && (
            <span className={cn('mx-2 hidden h-0.5 flex-1 rounded-full sm:block', styles.line)} aria-hidden="true" />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

export function EnrichmentJobHistory() {
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const jobsRef = useRef<EnrichmentJob[]>([]);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShownErrorToast = useRef(false);

  const { toast } = useToast();

  const updateJobs = useCallback((incoming: EnrichmentJob[]) => {
    if (jobsAreEqual(jobsRef.current, incoming)) {
      return;
    }
    jobsRef.current = incoming;
    setJobs(incoming);
  }, []);

  const loadHistory = useCallback(async (options: { withLoader?: boolean } = {}) => {
    if (options.withLoader) {
      setIsInitialLoading(true);
    }
    setIsRefreshing(true);
    try {
      const response = await backend.enrichment.listEnrichmentJobs({});
      const baseJobs = response.jobs ?? [];

      const activeJobs = baseJobs.filter((job) => {
        const status = normalizeStatus(job.status);
        return status === 'processing';
      });

      const detailUpdates = await Promise.all(
        activeJobs.map(async (job) => {
          try {
            const detailed = await backend.enrichment.getEnrichmentJobStatus({ jobId: job.id });
            return detailed.job ?? job;
          } catch (error) {
            console.error('Failed to refresh job details', error);
            return job;
          }
        })
      );

      const detailsMap = new Map(detailUpdates.map((job) => [job.id, job] as const));
      const mergedJobs = baseJobs.map((job) => detailsMap.get(job.id) ?? job);

      updateJobs(mergedJobs);
      hasShownErrorToast.current = false;
    } catch (error) {
      console.error('Failed to load enrichment history:', error);
      if (!hasShownErrorToast.current) {
        toast({
          title: 'Erreur',
          description: "Impossible de charger l'historique des enrichissements",
          variant: 'destructive',
        });
        hasShownErrorToast.current = true;
      }
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [toast, updateJobs]);

  useEffect(() => {
    let isMounted = true;

    const poll = async (withLoader = false) => {
      if (!isMounted) {
        return;
      }

      await loadHistory({ withLoader });

      if (!isMounted) {
        return;
      }

      const hasActiveJob = jobsRef.current.some((job) => normalizeStatus(job.status) === 'processing');
      const interval = hasActiveJob ? 5000 : 15000;

      pollingRef.current = setTimeout(() => {
        void poll(false);
      }, interval);
    };

    void poll(true);

    return () => {
      isMounted = false;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [loadHistory]);

  useEffect(() => {
    const hasActiveJob = jobs.some((job) => normalizeStatus(job.status) === 'processing');
    if (!hasActiveJob) {
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [jobs]);

  const handleManualRefresh = useCallback(() => {
    if (!isRefreshing) {
      void loadHistory();
    }
  }, [isRefreshing, loadHistory]);

  if (isInitialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" aria-hidden="true" />
            <span>Historique des Enrichissements</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" aria-hidden="true" />
            <span>Historique des Enrichissements</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} aria-hidden="true" />
            <span className="sr-only">Rafraîchir</span>
          </Button>
        </CardTitle>
        <CardDescription>{jobs.length} enrichissement{jobs.length !== 1 ? 's' : ''} au total</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fichier</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Progression</TableHead>
              <TableHead>Détails</TableHead>
              <TableHead>Temps</TableHead>
              <TableHead>Créé le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => {
              const normalizedStatus = normalizeStatus(job.status);
              const statusMeta = getStatusMeta(normalizedStatus);
              const progressRatio = computeProgressRatio(job, normalizedStatus);
              const progressPercent = clampPercentage(progressRatio * 100);
              const stageProgress = buildStageProgress(job, normalizedStatus);
              const timeInfo = computeTimeInfo(job, normalizedStatus, now, progressRatio);

              return (
                <TableRow key={job.id} className="align-top">
                  <TableCell className="align-top font-medium">
                    <div className="space-y-1">
                      <p className="truncate text-sm font-semibold">{job.file_name}</p>
                      {job.error_message && normalizedStatus === 'failed' && (
                        <p className="text-xs text-red-600">{job.error_message}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="outline" className={cn('gap-2', statusBadgeClass[normalizedStatus])}>
                      {statusMeta.icon}
                      <span>{statusMeta.label}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top min-w-[200px]">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progression</span>
                        <span className="font-semibold text-foreground">{progressPercent}%</span>
                      </div>
                      <Progress
                        value={progressPercent}
                        className="h-2.5 overflow-hidden bg-muted"
                        indicatorClassName={cn(progressIndicatorClass[normalizedStatus])}
                      />
                      <div className="text-[11px] text-muted-foreground">
                        Traités&nbsp;:&nbsp;
                        <span className="font-semibold text-foreground">
                          <AnimatedNumber value={Math.max(0, job.processed_records ?? 0)} />
                        </span>
                        <span className="text-xs text-muted-foreground"> / {job.total_records ?? 0}</span>
                      </div>
                      <StageTimeline stages={stageProgress} />
                    </div>
                  </TableCell>
                  <TableCell className="align-top min-w-[220px]">
                    <div className="grid grid-cols-2 gap-2">
                      <DetailMetric
                        label="Correspondances"
                        value={job.matched_records}
                        tone="info"
                      />
                      <DetailMetric
                        label="Enrichis"
                        value={job.enriched_records}
                        tone="success"
                      />
                      <DetailMetric
                        label="Filtrés"
                        value={job.filtered_records}
                        tone="warning"
                      />
                      <DetailMetric
                        label="Finales"
                        value={job.final_records}
                        tone="success"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="align-top min-w-[160px]">
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Timer className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <span>Écoulé :</span>
                        <span className="font-semibold text-foreground">{timeInfo.elapsedLabel}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <span>Restant :</span>
                        <span className="font-semibold text-foreground">
                          {timeInfo.remaining === null ? '—' : `≈ ${timeInfo.remainingLabel}`}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap text-xs text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      <span>{new Date(job.created_at).toLocaleString()}</span>
                      {job.completed_at && (
                        <span>
                          Terminé :{' '}
                          <span className="font-medium text-foreground">{new Date(job.completed_at).toLocaleString()}</span>
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {jobs.length === 0 && (
          <div className="py-10 text-center text-muted-foreground">
            <p>Aucun enrichissement effectué pour le moment.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
