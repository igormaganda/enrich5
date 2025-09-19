import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileText, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ColumnMapping from './ColumnMapping';
import backend from '~backend/client';
import type { ColumnMapping as ColumnMappingType } from '~backend/upload/mapping';

type UploadStep = 'file-selection' | 'column-mapping' | 'uploading' | 'completed';

export default function FileUploadWithMapping() {
  const [currentStep, setCurrentStep] = useState<UploadStep>('file-selection');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [mappings, setMappings] = useState<ColumnMappingType[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; totalRows: number; errors: string[] } | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validation
    const fileExtension = file.name.toLowerCase().split('.').pop();
    if (fileExtension !== 'csv') {
      toast({
        title: "Format non supporté",
        description: "Seuls les fichiers CSV sont supportés avec le mappage de colonnes",
        variant: "destructive"
      });
      return;
    }

    const maxSizeBytes = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSizeBytes) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximum autorisée est de 50 MB",
        variant: "destructive"
      });
      return;
    }

    try {
      const text = await file.text();
      setSelectedFile(file);
      setCsvContent(text);
      setCurrentStep('column-mapping');
    } catch (error) {
      toast({
        title: "Erreur de lecture",
        description: "Impossible de lire le contenu du fichier",
        variant: "destructive"
      });
    }
  }, [toast]);

  const handleMappingComplete = useCallback((columnMappings: ColumnMappingType[]) => {
    setMappings(columnMappings);
    setCurrentStep('uploading');
    performUpload(columnMappings);
  }, [csvContent]);

  const performUpload = async (columnMappings: ColumnMappingType[]) => {
    if (!csvContent) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await backend.upload.uploadWithMapping({
        csvContent,
        columnMappings,
        delimiter: ','
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadResult(result);
      setCurrentStep('completed');

      if (result.success) {
        toast({
          title: "Upload réussi",
          description: `${result.totalRows} lignes traitées avec succès`,
        });
      } else {
        toast({
          title: "Upload avec erreurs",
          description: `${result.totalRows} lignes traitées, ${result.errors.length} erreurs détectées`,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      setUploadProgress(0);
      toast({
        title: "Erreur d'upload",
        description: error.message || "Une erreur s'est produite lors de l'upload",
        variant: "destructive",
      });
      setCurrentStep('column-mapping');
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setCurrentStep('file-selection');
    setSelectedFile(null);
    setCsvContent('');
    setMappings([]);
    setUploadResult(null);
    setUploadProgress(0);
    
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const goBackToFileSelection = () => {
    setCurrentStep('file-selection');
    setSelectedFile(null);
    setCsvContent('');
    setMappings([]);
  };

  if (currentStep === 'column-mapping') {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-4">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={goBackToFileSelection}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <div>
            <h2 className="text-xl font-semibold">Mappage des colonnes</h2>
            <p className="text-sm text-gray-600">{selectedFile?.name}</p>
          </div>
        </div>
        
        <ColumnMapping
          csvContent={csvContent}
          onMappingComplete={handleMappingComplete}
          onCancel={goBackToFileSelection}
        />
      </div>
    );
  }

  if (currentStep === 'uploading') {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Upload en cours</CardTitle>
          <CardDescription>
            Traitement du fichier avec les mappages sélectionnés...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Traitement des données...</span>
              <span className="font-mono">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full h-3" />
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Mappages appliqués:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {mappings.map((mapping, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-gray-600">{mapping.csvHeader}</span>
                  <span className="font-medium">{mapping.dbColumn}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (currentStep === 'completed' && uploadResult) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className={uploadResult.success ? "text-green-600" : "text-yellow-600"}>
            {uploadResult.success ? "Upload terminé avec succès" : "Upload terminé avec des erreurs"}
          </CardTitle>
          <CardDescription>
            {uploadResult.totalRows} lignes traitées
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{uploadResult.totalRows}</div>
              <div className="text-sm text-green-700">Lignes traitées</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{mappings.length}</div>
              <div className="text-sm text-blue-700">Colonnes mappées</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{uploadResult.errors.length}</div>
              <div className="text-sm text-red-700">Erreurs</div>
            </div>
          </div>

          {uploadResult.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2">Erreurs détectées:</h4>
              <div className="space-y-1 text-sm text-red-700 max-h-32 overflow-y-auto">
                {uploadResult.errors.map((error, index) => (
                  <div key={index} className="font-mono">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={resetUpload} className="w-full">
            Uploader un autre fichier
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Upload className="h-6 w-6" />
          Upload avec mappage de colonnes
        </CardTitle>
        <CardDescription>
          Uploadez un fichier CSV et mappez les colonnes aux champs de la base de données
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="file-upload" className="text-base font-medium">
            Sélectionner un fichier CSV
          </Label>
          <Input
            id="file-upload"
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="cursor-pointer file:cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />
          <p className="text-sm text-muted-foreground">
            Formats supportés: CSV • Taille max: 50 MB
          </p>
        </div>

        {selectedFile && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <div className="font-medium">{selectedFile.name}</div>
              <div className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          </div>
        )}

        <div className="bg-muted/30 p-4 rounded-lg">
          <h3 className="text-base font-medium mb-3">Comment ça fonctionne:</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">1</span>
              <span>Sélectionnez votre fichier CSV</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">2</span>
              <span>Mappez les colonnes CSV aux champs de la base de données</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">3</span>
              <span>Les données seront automatiquement converties et importées</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}