import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Upload, CheckCircle, XCircle, Clock, Download } from 'lucide-react';
import backend from '~backend/client';
import type { ArchiveJob } from '~backend/archive_enrichment/types';

interface ArchiveUploadProps {
  userId: number;
}

export default function ArchiveEnrichmentUpload({ userId }: ArchiveUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [archiveJobs, setArchiveJobs] = useState<ArchiveJob[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  // Charger les jobs existants
  const loadArchiveJobs = useCallback(async () => {
    try {
      const response = await backend.archive_enrichment.listArchiveJobs({ userId, limit: 10 });
      setArchiveJobs(response.jobs);
    } catch (error: any) {
      console.error('Erreur lors du chargement des jobs:', error);
    }
  }, [userId]);

  React.useEffect(() => {
    loadArchiveJobs();
    
    // Rafraîchir toutes les 5 secondes si il y a des jobs en cours
    const interval = setInterval(() => {
      const hasProcessingJobs = archiveJobs.some(job => 
        job.status === 'processing' || job.status === 'enriching'
      );
      if (hasProcessingJobs) {
        loadArchiveJobs();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [loadArchiveJobs, archiveJobs]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        toast({
          title: "Erreur",
          description: "Veuillez sélectionner un fichier ZIP contenant les 4 fichiers CSV.",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier à uploader.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simuler le progrès d'upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Convertir le fichier en Base64
      const fileBuffer = await selectedFile.arrayBuffer();
      const uint8Array = new Uint8Array(fileBuffer);
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      const base64Data = btoa(binaryString);

      const response = await backend.archive_enrichment.uploadArchive({
        archiveBuffer: base64Data,
        fileName: selectedFile.name,
        userId
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.success) {
        toast({
          title: "Succès",
          description: response.message,
        });
        setSelectedFile(null);
        loadArchiveJobs(); // Recharger la liste
      } else {
        toast({
          title: "Erreur",
          description: response.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'upload:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'upload de l'archive.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownload = async (job: ArchiveJob) => {
    try {
      const response = await backend.archive_enrichment.downloadEnrichedArchive({
        archiveJobId: job.id,
        userId
      });

      if (response.success && response.fileData) {
        // Créer un blob à partir des données Base64
        const binaryData = atob(response.fileData);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        
        // Créer un lien de téléchargement
        const link = document.createElement('a');
        link.href = url;
        link.download = response.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: "Succès",
          description: "Archive enrichie téléchargée avec succès.",
        });
      } else {
        toast({
          title: "Erreur",
          description: response.message || "Erreur lors du téléchargement.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Erreur lors du téléchargement:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors du téléchargement de l'archive.",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
      case 'enriching':
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processing':
        return 'Traitement en cours...';
      case 'enriching':
        return 'Enrichissement en cours...';
      case 'completed':
        return 'Terminé';
      case 'failed':
        return 'Échec';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Section d'upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload d'Archive pour Enrichissement
          </CardTitle>
          <CardDescription>
            Uploadez une archive ZIP contenant 4 fichiers CSV. Le système effectuera automatiquement 
            l'enrichissement basé sur les correspondances d'adresse et appliquera la blacklist mobile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>Format attendu:</strong> Archive ZIP avec 3 fichiers de données de contact + 1 fichier Blacklist_mobile_[MMYYYY].csv
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <input
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="hidden"
                id="archive-upload"
                disabled={isUploading}
              />
              <label
                htmlFor="archive-upload"
                className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
              >
                <div className="text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">
                    {selectedFile ? selectedFile.name : 'Cliquez pour sélectionner une archive ZIP'}
                  </p>
                </div>
              </label>
            </div>

            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-sm text-gray-600 text-center">
                  Upload en cours... {uploadProgress}%
                </p>
              </div>
            )}

            <Button 
              onClick={handleUpload} 
              disabled={!selectedFile || isUploading}
              className="w-full"
            >
              {isUploading ? 'Upload en cours...' : 'Démarrer l\'enrichissement'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des jobs d'enrichissement */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Enrichissements</CardTitle>
          <CardDescription>
            Suivez le progrès de vos enrichissements et téléchargez les résultats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {archiveJobs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              Aucun enrichissement en cours ou terminé.
            </p>
          ) : (
            <div className="space-y-3">
              {archiveJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="font-medium">{job.archiveName}</p>
                      <p className="text-sm text-gray-500">
                        {getStatusText(job.status)} • {new Date(job.createdAt).toLocaleString('fr-FR')}
                      </p>
                      {job.errorMessage && (
                        <p className="text-sm text-red-500 mt-1">{job.errorMessage}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {job.status === 'completed' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDownload(job)}
                        className="flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        Télécharger
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}