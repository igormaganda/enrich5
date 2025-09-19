import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, AlertTriangle, Upload, Filter } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { 
  ContactCSVAnalysisResponse, 
  ContactColumnMapping, 
  ContactDatabaseColumn 
} from '~backend/settings/contact_mapping';

interface ContactColumnMappingProps {
  csvContent: string;
  onMappingComplete: (mappings: ContactColumnMapping[]) => void;
  onCancel: () => void;
  onUploadComplete: (result: { success: boolean; totalRows: number; errors?: string[] }) => void;
}

export default function ContactColumnMapping({ 
  csvContent, 
  onMappingComplete, 
  onCancel, 
  onUploadComplete 
}: ContactColumnMappingProps) {
  const [analysis, setAnalysis] = useState<ContactCSVAnalysisResponse | null>(null);
  const [mappings, setMappings] = useState<ContactColumnMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnlySupportedFields, setShowOnlySupportedFields] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    analyzeCSV();
  }, [csvContent, showOnlySupportedFields]);

  const analyzeCSV = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await backend.settings.analyzeContactCSV({
        csvContent,
        delimiter: ',',
        showOnlySupportedFields
      });
      
      setAnalysis(result);
      setMappings(result.suggestedMappings);
      
      // Compter les correspondances automatiques
      const autoMatches = result.suggestedMappings.filter(m => m.matched).length;
      if (autoMatches > 0) {
        toast({
          title: "Correspondances automatiques détectées",
          description: `${autoMatches} colonnes ont été mappées automatiquement`,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'analyse du CSV');
    } finally {
      setLoading(false);
    }
  };

  const updateMapping = (csvHeader: string, dbColumn: string) => {
    setMappings(prev => prev.map(mapping => {
      if (mapping.csvHeader === csvHeader) {
        if (dbColumn === 'unmapped') {
          return {
            ...mapping,
            dbColumn: null,
            dataType: 'string',
            matched: false
          };
        }
        const dbCol = analysis?.dbColumns.find(col => col.name === dbColumn);
        return {
          ...mapping,
          dbColumn,
          dataType: dbCol?.type || 'string',
          matched: false // Devient un mapping manuel
        };
      }
      return mapping;
    }));
  };

  const getDataTypeColor = (dataType: string) => {
    switch (dataType) {
      case 'string': return 'bg-blue-100 text-blue-800';
      case 'integer': return 'bg-green-100 text-green-800';
      case 'boolean': return 'bg-purple-100 text-purple-800';
      case 'date': return 'bg-orange-100 text-orange-800';
      case 'datetime': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMappingStatus = (mapping: ContactColumnMapping) => {
    if (!mapping.dbColumn) {
      return { icon: XCircle, color: 'text-red-500', label: 'Non mappé' };
    }
    if (mapping.matched) {
      return { icon: CheckCircle, color: 'text-green-500', label: 'Auto-détecté' };
    }
    return { icon: AlertTriangle, color: 'text-yellow-500', label: 'Manuel' };
  };

  const handleDirectUpload = async () => {
    const mappedColumns = mappings.filter(m => m.dbColumn);
    if (mappedColumns.length === 0) {
      toast({
        title: "Aucune colonne mappée",
        description: "Veuillez mapper au moins une colonne avant l'upload",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const result = await backend.settings.uploadContactsWithMapping({
        csvContent,
        columnMappings: mappedColumns,
        delimiter: ','
      });

      onUploadComplete(result);
      
      if (result.success) {
        toast({
          title: "Upload réussi",
          description: `${result.totalRows} contacts importés avec succès`,
        });
      } else {
        toast({
          title: "Upload avec erreurs",
          description: `${result.totalRows} contacts traités, ${result.errors?.length || 0} erreurs`,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur d'upload",
        description: error.message || "Une erreur s'est produite lors de l'upload",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleContinue = () => {
    const mappedColumns = mappings.filter(m => m.dbColumn);
    onMappingComplete(mappedColumns);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Analyse du fichier CSV...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert>
        <XCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!analysis) {
    return null;
  }

  const mappedCount = mappings.filter(m => m.dbColumn).length;
  const totalCount = mappings.length;
  const autoCount = mappings.filter(m => m.matched && m.dbColumn).length;
  const manualCount = mappings.filter(m => !m.matched && m.dbColumn).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mappage des colonnes pour les contacts</CardTitle>
          <p className="text-sm text-gray-600">
            Associez les colonnes de votre fichier CSV aux champs de la table contacts.
            Les suggestions automatiques sont mises en évidence.
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="filter-toggle"
                checked={showOnlySupportedFields}
                onCheckedChange={setShowOnlySupportedFields}
              />
              <Label htmlFor="filter-toggle" className="flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <span>Afficher seulement les champs pris en charge</span>
              </Label>
            </div>
            <Badge variant={showOnlySupportedFields ? "default" : "outline"}>
              {showOnlySupportedFields ? "Filtré" : "Tous les champs"}
            </Badge>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>{mappedCount} sur {totalCount} colonnes mappées</span>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{autoCount} auto-détectées</span>
                </div>
                <div className="flex items-center space-x-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span>{manualCount} manuelles</span>
                </div>
                <div className="flex items-center space-x-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>{totalCount - mappedCount} non mappées</span>
                </div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(mappedCount / totalCount) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {mappings.map((mapping, index) => {
              const status = getMappingStatus(mapping);
              const StatusIcon = status.icon;

              return (
                <div key={index} className="flex items-center space-x-4 p-3 border rounded-lg bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{mapping.csvHeader}</span>
                      <StatusIcon className={`h-4 w-4 ${status.color}`} />
                      {mapping.matched && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          Auto
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <Select
                      value={mapping.dbColumn || "unmapped"}
                      onValueChange={(value) => updateMapping(mapping.csvHeader, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une colonne..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unmapped">-- Non mappé --</SelectItem>
                        {analysis.dbColumns.map((col) => (
                          <SelectItem key={col.name} value={col.name}>
                            <div className="flex items-center justify-between w-full">
                              <span>{col.name}</span>
                              <Badge variant="outline" className={`ml-2 ${getDataTypeColor(col.type)}`}>
                                {col.type}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {mapping.dbColumn && (
                    <Badge className={getDataTypeColor(mapping.dataType)}>
                      {mapping.dataType}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              Annuler
            </Button>
            <div className="flex space-x-2">
              <Button 
                variant="outline"
                onClick={handleContinue}
                disabled={mappedCount === 0}
              >
                Continuer ({mappedCount} mappées)
              </Button>
              <Button 
                onClick={handleDirectUpload}
                disabled={mappedCount === 0 || uploading}
                className="min-w-[140px]"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Upload...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload direct
                  </span>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {mappedCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Aperçu des mappages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mappings
                .filter(m => m.dbColumn)
                .map((mapping, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{mapping.csvHeader}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{mapping.dbColumn}</span>
                      <Badge variant="outline" className={`text-xs ${getDataTypeColor(mapping.dataType)}`}>
                        {mapping.dataType}
                      </Badge>
                      {mapping.matched && (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}