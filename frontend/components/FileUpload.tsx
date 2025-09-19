import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileText, CheckCircle, Archive, Files } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function FileUpload() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadType, setUploadType] = useState<'archive' | 'direct'>('archive');
  const [fileSettings, setFileSettings] = useState({
    maxFileSize: 100,
    allowedFormats: ['zip', 'rar', 'csv', 'xlsx'],
    enablePreview: true
  });
  const { user } = useAuth();
  const { toast } = useToast();

  // Charger les paramètres de fichier
  useEffect(() => {
    const loadFileSettings = async () => {
      try {
        // NOTE: The backend client is not used here anymore for upload,
        // but it might be used for other things. For now, we comment out
        // the settings loading to avoid dependency on the generated client.
        // const response = await backend.settings.getSettings({});
        // setFileSettings(response.settings.fileSettings);
      } catch (error) {
        console.warn('Failed to load file settings, using defaults');
      }
    };
    loadFileSettings();
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const selectedFilesList = Array.from(files);
    const validFiles: File[] = [];
    
    // Détecter le type d'upload basé sur le premier fichier
    const firstFile = selectedFilesList[0];
    const firstExtension = firstFile.name.toLowerCase().split('.').pop();
    const isArchive = firstExtension === 'zip' || firstExtension === 'rar';
    
    setUploadType(isArchive ? 'archive' : 'direct');

    for (const file of selectedFilesList) {
      // Vérification de la taille (selon les paramètres)
      const maxSizeBytes = fileSettings.maxFileSize * 1024 * 1024; // MB to bytes
      if (file.size > maxSizeBytes) {
        toast({
          title: "Fichier trop volumineux",
          description: `${file.name}: La taille maximum autorisée est de ${fileSettings.maxFileSize} MB`,
          variant: "destructive"
        });
        continue;
      }

      // Vérification du format (selon les paramètres)
      const fileExtension = file.name.toLowerCase().split('.').pop();
      if (!fileExtension || !fileSettings.allowedFormats.includes(fileExtension)) {
        toast({
          title: "Format de fichier non autorisé",
          description: `${file.name}: Formats acceptés: ${fileSettings.allowedFormats.join(', ')}`,
          variant: "destructive"
        });
        continue;
      }

      // Si c'est une archive, vérifier qu'on n'a qu'un seul fichier
      if (isArchive && selectedFilesList.length > 1) {
        toast({
          title: "Sélection invalide",
          description: "Vous ne pouvez sélectionner qu'une seule archive à la fois",
          variant: "destructive"
        });
        return;
      }

      // Si ce sont des fichiers directs, vérifier qu'ils sont tous CSV/XLSX
      if (!isArchive && fileExtension !== 'csv' && fileExtension !== 'xlsx') {
        toast({
          title: "Type de fichier incompatible",
          description: "En mode sélection multiple, seuls les fichiers CSV et XLSX sont acceptés",
          variant: "destructive"
        });
        return;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      setUploadProgress(0);
    } else {
      // Reset if no valid files
      setSelectedFiles([]);
      event.target.value = '';
    }
  }, [toast, fileSettings]);

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0 || !user) return;

    setIsUploading(true);
    setUploadProgress(0);

    const uploadFile = async (file: File, isArchive: boolean) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id.toString());
      formData.append('isArchive', String(isArchive));

      // Note: We are not using the generated client here.
      const response = await fetch('http://localhost:4000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown server error' }));
        throw new Error(errorData.message || 'Upload failed');
      }

      return response.json();
    };

    try {
      if (uploadType === 'archive') {
        const archiveFile = selectedFiles[0];
        const response = await uploadFile(archiveFile, true);
        setUploadProgress(100);
        toast({
          title: "Archive uploadée avec succès",
          description: `Job ID: ${response.jobId}. L'extraction et le traitement ont commencé.`,
        });
      } else {
        const responses = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const response = await uploadFile(file, false);
          responses.push(response);
          setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
        }
        toast({
          title: "Fichiers uploadés avec succès",
          description: `${selectedFiles.length} job(s) créé(s). Le traitement a commencé.`,
        });
      }

      setSelectedFiles([]);
      setUploadProgress(0);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadProgress(0);
      let errorMessage = "Une erreur s'est produite lors de l'upload";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        title: "Erreur d'upload",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles, user, toast, uploadType]);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-lg sm:text-xl">
          <Upload className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
          <span>Upload de fichiers</span>
        </CardTitle>
        <CardDescription className="text-sm sm:text-base">
          Uploadez une archive (ZIP/RAR) ou sélectionnez plusieurs fichiers CSV/XLSX à enrichir
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
        <div className="space-y-2">
          <Label htmlFor="file-upload" className="text-sm sm:text-base font-medium">
            {uploadType === 'archive' ? 'Archive' : 'Fichiers CSV/XLSX'}
          </Label>
          <Input
            id="file-upload"
            type="file"
            accept={fileSettings.allowedFormats.map(format => `.${format}`).join(',')}
            onChange={handleFileSelect}
            disabled={isUploading}
            multiple={true}
            className="cursor-pointer file:cursor-pointer file:mr-2 sm:file:mr-4 file:py-1 sm:file:py-2 file:px-2 sm:file:px-4 file:rounded file:border-0 file:text-xs sm:file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />
          <p className="text-xs sm:text-sm text-muted-foreground">
            <span className="block sm:inline">Archives: ZIP, RAR</span>
            <span className="hidden sm:inline"> • </span>
            <span className="block sm:inline">Fichiers directs: CSV, XLSX (sélection multiple)</span>
            <span className="hidden sm:inline"> • </span>
            <span className="block sm:inline">Taille max: {fileSettings.maxFileSize} MB par fichier</span>
          </p>
        </div>

        {selectedFiles.length > 0 && (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                {uploadType === 'archive' ? (
                  <Archive className="h-4 w-4 text-blue-600 flex-shrink-0" />
                ) : (
                  <Files className="h-4 w-4 text-green-600 flex-shrink-0" />
                )}
                <span className="text-sm font-medium">
                  {uploadType === 'archive' 
                    ? 'Archive sélectionnée' 
                    : `${selectedFiles.length} fichier(s) sélectionné(s)`
                  }
                </span>
              </div>
              {uploadType === 'archive' && (
                <span className="text-xs text-muted-foreground sm:ml-auto">
                  (sera extraite automatiquement)
                </span>
              )}
            </div>
            
            <div className="space-y-2 max-h-32 sm:max-h-40 overflow-y-auto border rounded-lg p-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 sm:gap-3 p-2 bg-background rounded border">
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs sm:text-sm font-medium truncate block">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {isUploading && (
              <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {uploadType === 'archive' ? 'Upload et extraction...' : 'Upload des fichiers...'}
                  </span>
                  <span className="font-mono">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full h-2" />
              </div>
            )}

            <Button 
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full py-2 sm:py-3 text-sm sm:text-base"
              size="lg"
            >
              {isUploading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span className="truncate">
                    {uploadType === 'archive' 
                      ? 'Upload et extraction...' 
                      : `Upload de ${selectedFiles.length} fichier(s)...`
                    }
                  </span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Upload className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {uploadType === 'archive' 
                      ? 'Démarrer l\'upload et extraction' 
                      : `Démarrer l\'upload (${selectedFiles.length} job(s))`
                    }
                  </span>
                </span>
              )}
            </Button>
          </div>
        )}

        <div className="bg-muted/30 p-3 sm:p-4 rounded-lg">
          <h3 className="text-sm sm:text-base font-medium mb-2 sm:mb-3">Types de fichiers supportés:</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
            <div className="space-y-2">
              <h4 className="font-medium text-foreground text-sm">Archives (extraction automatique):</h4>
              <ul className="space-y-1 pl-2">
                <li>• Fichiers ZIP contenant des CSV</li>
                <li>• Fichiers RAR contenant des CSV</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-foreground text-sm">Fichiers directs (sélection multiple):</h4>
              <ul className="space-y-1 pl-2">
                <li>• Referentiel_Zone_FTTH_[MMYYYY].csv</li>
                <li>• Referentiel_Zone_4GBOX_[MMYYYY].csv</li>
                <li>• Referentiel_mobile_[MMYYYY].csv</li>
                <li>• Blacklist_mobile_[MMYYYY].csv</li>
                <li>• Fichiers XLSX équivalents</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
