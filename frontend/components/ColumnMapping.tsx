import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import backend from '~backend/client';
import type { CSVAnalysisResponse, ColumnMapping as ColumnMappingType, DatabaseColumn } from '~backend/upload/mapping';

interface ColumnMappingProps {
  csvContent: string;
  onMappingComplete: (mappings: ColumnMappingType[]) => void;
  onCancel: () => void;
}

export default function ColumnMapping({ csvContent, onMappingComplete, onCancel }: ColumnMappingProps) {
  const [analysis, setAnalysis] = useState<CSVAnalysisResponse | null>(null);
  const [mappings, setMappings] = useState<ColumnMappingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyzeCSV();
  }, [csvContent]);

  const analyzeCSV = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await backend.upload.analyzeCSV({
        csvContent,
        delimiter: ','
      });
      
      setAnalysis(result);
      setMappings(result.suggestedMappings);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze CSV');
    } finally {
      setLoading(false);
    }
  };

  const updateMapping = (csvHeader: string, dbColumn: string) => {
    setMappings(prev => prev.map(mapping => {
      if (mapping.csvHeader === csvHeader) {
        const dbCol = analysis?.dbColumns.find(col => col.name === dbColumn);
        return {
          ...mapping,
          dbColumn,
          dataType: dbCol?.type || 'string'
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

  const getMappingStatus = (mapping: ColumnMappingType) => {
    if (!mapping.dbColumn) {
      return { icon: XCircle, color: 'text-red-500', label: 'Non mappé' };
    }
    if (mapping.dbColumn && analysis?.suggestedMappings.find(m => m.csvHeader === mapping.csvHeader)?.dbColumn === mapping.dbColumn) {
      return { icon: CheckCircle, color: 'text-green-500', label: 'Auto-suggéré' };
    }
    return { icon: AlertTriangle, color: 'text-yellow-500', label: 'Manuel' };
  };

  const handleComplete = () => {
    onMappingComplete(mappings.filter(m => m.dbColumn));
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mappage des colonnes CSV</CardTitle>
          <p className="text-sm text-gray-600">
            Associez les colonnes de votre fichier CSV aux champs de la base de données.
            Les suggestions automatiques sont basées sur les noms des colonnes.
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{mappedCount} sur {totalCount} colonnes mappées</span>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Auto-suggéré</span>
                </div>
                <div className="flex items-center space-x-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span>Manuel</span>
                </div>
                <div className="flex items-center space-x-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>Non mappé</span>
                </div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(mappedCount / totalCount) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-3">
            {mappings.map((mapping, index) => {
              const status = getMappingStatus(mapping);
              const StatusIcon = status.icon;

              return (
                <div key={index} className="flex items-center space-x-4 p-3 border rounded-lg bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{mapping.csvHeader}</span>
                      <StatusIcon className={`h-4 w-4 ${status.color}`} />
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <Select
                      value={mapping.dbColumn || ""}
                      onValueChange={(value) => updateMapping(mapping.csvHeader, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une colonne..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">-- Non mappé --</SelectItem>
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
            <Button 
              onClick={handleComplete}
              disabled={mappedCount === 0}
              className="min-w-[120px]"
            >
              Continuer ({mappedCount} mappées)
            </Button>
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