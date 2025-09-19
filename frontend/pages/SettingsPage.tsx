import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings,
  Mail,
  Cpu,
  FileText,
  Palette,
  Shield,
  Save,
  RotateCcw,
  Plus,
  Upload,
  Trash2,
  Eye,
  ArrowLeft,
  Server,
  Activity,
} from "lucide-react";
import ContactColumnMapping from "@/components/ContactColumnMapping";
import { FtpServerManager } from "@/components/FtpServerManager";
import { BackgroundJobMonitor } from "@/components/BackgroundJobMonitor";
import { FtpScanResults } from "@/components/FtpScanResults";
import backend from "~backend/client";
import type {
  AppSettings,
  EnrichmentSource,
  PreviewEnrichmentSourceResponse,
} from "~backend/settings/types";
import type { ContactColumnMapping as ContactColumnMappingType } from "~backend/settings/contact_mapping";

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  // Enrichment Source States
  const [sources, setSources] = useState<EnrichmentSource[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceFile, setNewSourceFile] = useState<File | null>(null);
  const [newSourceHasHeaders, setNewSourceHasHeaders] = useState(true);
  const [newSourceDelimiter, setNewSourceDelimiter] = useState(";");
  const [newSourcePreview, setNewSourcePreview] =
    useState<PreviewEnrichmentSourceResponse | null>(null);
  const [newSourceMapping, setNewSourceMapping] = useState<
    Record<string, string>
  >({});
  const [destinationFields, setDestinationFields] = useState<string[]>([
    "HEXACLE",
    "NUMERO",
    "VOIE",
    "VILLE",
    "COD_POST",
    "COD_INSEE",
  ]);
  const [newDestinationField, setNewDestinationField] = useState("");
  const [isAddingField, setIsAddingField] = useState(false);
  const [isUploadingSource, setIsUploadingSource] = useState(false);
  const [saveConfiguration, setSaveConfiguration] = useState(false);
  const [runningImports, setRunningImports] = useState<string[]>([]);
  const [sourcePreviewData, setSourcePreviewData] =
    useState<PreviewEnrichmentSourceResponse | null>(null);
  const [isSourcePreviewOpen, setIsSourcePreviewOpen] = useState(false);

  // Contact Source States
  const [contactConfigSource, setContactConfigSource] = useState<"csv" | "db">(
    "csv"
  );
  const [newContactFile, setNewContactFile] = useState<File | null>(null);
  const [isUploadingContactFile, setIsUploadingContactFile] = useState(false);
  const [contactsCount, setContactsCount] = useState(0);
  const [sourcesView, setSourcesView] = useState<"list" | "add" | "contacts">("list");
  
  // Contact mapping states
  const [contactUploadStep, setContactUploadStep] = useState<"file-selection" | "mapping" | "completed">("file-selection");
  const [contactCsvContent, setContactCsvContent] = useState<string>("");
  const [contactMappings, setContactMappings] = useState<ContactColumnMappingType[]>([]);
  const [contactUploadResult, setContactUploadResult] = useState<{ success: boolean; totalRows: number; errors?: string[] } | null>(null);

  const handleContactFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validation
    const fileExtension = file.name.toLowerCase().split('.').pop();
    if (fileExtension !== 'csv') {
      toast({
        title: "Format non supporté",
        description: "Seuls les fichiers CSV sont supportés",
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
      setNewContactFile(file);
      setContactCsvContent(text);
      setContactUploadStep('mapping');
    } catch (error) {
      toast({
        title: "Erreur de lecture",
        description: "Impossible de lire le contenu du fichier",
        variant: "destructive"
      });
    }
  };

  const handleContactMappingComplete = (mappings: ContactColumnMappingType[]) => {
    setContactMappings(mappings);
    // Le mapping direct fait l'upload automatiquement
  };

  const handleContactUploadComplete = (result: { success: boolean; totalRows: number; errors?: string[] }) => {
    setContactUploadResult(result);
    setContactUploadStep('completed');
    loadContactsCount(); // Recharger le compte
  };

  const resetContactUpload = () => {
    setContactUploadStep('file-selection');
    setNewContactFile(null);
    setContactCsvContent('');
    setContactMappings([]);
    setContactUploadResult(null);
  };

  const goBackToContactFileSelection = () => {
    setContactUploadStep('file-selection');
    setNewContactFile(null);
    setContactCsvContent('');
    setContactMappings([]);
  };

  const loadContactsCount = async () => {
    try {
      const response = await backend.settings.getContactsCount();
      setContactsCount(response.count);
    } catch (error) {
      console.error("Failed to load contacts count:", error);
    }
  };

  // Detect mobile screen size
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    loadSettings();
    loadSources();
    loadContactsCount();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await backend.settings.getSettings({});
      setSettings(response.settings);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to load settings:", error);
      try {
        const initResponse = await backend.settings.initializeSettings();
        setSettings(initResponse.settings);
        setHasChanges(false);
        toast({
          title: "Paramètres initialisés",
          description: "Les paramètres par défaut ont été créés",
        });
      } catch (initError) {
        console.error("Failed to initialize settings:", initError);
        toast({
          title: "Erreur",
          description: "Impossible de charger les paramètres",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await backend.settings.updateSettings({ settings });
      setHasChanges(false);
      toast({
        title: "Paramètres sauvegardés",
        description: "Les modifications ont été appliquées avec succès",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        title: "Erreur de sauvegarde",
        description: "Impossible de sauvegarder les paramètres",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetSettings = async (section?: keyof AppSettings) => {
    try {
      const response = await backend.settings.resetSettings({ section });
      setSettings(response.settings);
      setHasChanges(false);
      toast({
        title: "Paramètres réinitialisés",
        description: section
          ? `Section ${section} réinitialisée`
          : "Tous les paramètres ont été réinitialisés",
      });
    } catch (error) {
      console.error("Failed to reset settings:", error);
      toast({
        title: "Erreur de réinitialisation",
        description: "Impossible de réinitialiser les paramètres",
        variant: "destructive",
      });
    }
  };

  const updateSetting = <T extends keyof AppSettings>(
    section: T,
    key: keyof AppSettings[T],
    value: any
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value,
      },
    });
    setHasChanges(true);
  };

  const loadSources = async () => {
    setIsLoadingSources(true);
    try {
      const response = await backend.settings.listSources();
      setSources(response.sources);
    } catch (error) {
      console.error("Failed to load enrichment sources:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les sources d'enrichissement",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSources(false);
    }
  };

  const handleAddDestinationField = () => {
    if (
      newDestinationField &&
      !destinationFields.includes(newDestinationField)
    ) {
      setDestinationFields([...destinationFields, newDestinationField]);
    }
    setNewDestinationField("");
    setIsAddingField(false);
  };

  const handleSourceFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      setNewSourceFile(file);
      setNewSourcePreview(null);
      setNewSourceMapping({});
      setSaveConfiguration(false);

      setNewSourceName(file.name.split(".").shift() || "");

      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        try {
          const preview = await backend.settings.previewEnrichmentSource({
            filePath: content,
            name: file.name,
            delimiter: newSourceDelimiter,
            hasHeaders: newSourceHasHeaders,
            limit: 5,
          });
          setNewSourcePreview(preview);

          if (preview.savedConfiguration) {
            setNewSourceMapping(preview.savedConfiguration.mapping);
            setNewSourceDelimiter(preview.savedConfiguration.delimiter);
            setSaveConfiguration(true);
            toast({
              title: "Configuration chargée",
              description: "Une configuration existante a été appliquée.",
            });
          } else {
            const initialMapping: Record<string, string> = {};
            const columns = newSourceHasHeaders
              ? preview.headers
              : preview.firstRow || [];
            for (const col of columns) {
              initialMapping[col] = "";
            }

            if (newSourceHasHeaders) {
              for (const header of preview.headers) {
                if (destinationFields.includes(header.toUpperCase())) {
                  initialMapping[header] = header.toUpperCase();
                }
              }
            }
            setNewSourceMapping(initialMapping);
          }
        } catch (error) {
          console.error("Failed to preview new source:", error);
          toast({
            title: "Erreur de prévisualisation",
            description: "Impossible de prévisualiser le fichier source",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    },
    [newSourceDelimiter, newSourceHasHeaders, toast, destinationFields]
  );

  const handleCreateSource = async () => {
    if (!newSourceFile || !newSourceName) {
      toast({
        title: "Champs manquants",
        description: "Veuillez fournir un nom et un fichier source.",
        variant: "destructive",
      });
      return;
    }

    if (!newSourceHasHeaders) {
      const isMappingIncomplete = Object.values(newSourceMapping).some(
        (value) => !value || value.trim() === ""
      );
      if (isMappingIncomplete) {
        toast({
          title: "Mappage incomplet",
          description:
            "Veuillez définir un champ de destination pour chaque colonne.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsUploadingSource(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileContent = e.target?.result as string;

        const response = await backend.settings.createSource({
          name: newSourceName,
          filePath: fileContent,
          hasHeaders: newSourceHasHeaders,
          delimiter: newSourceDelimiter,
          mapping: newSourceMapping,
        });

        if (saveConfiguration && newSourceFile && newSourcePreview?.fingerprint) {
          try {
            await backend.settings.createSourceConfiguration({
              name: newSourceFile.name,
              fingerprint: newSourcePreview.fingerprint,
              mapping: newSourceMapping,
              delimiter: newSourceDelimiter,
            });
            toast({
              title: "Configuration enregistrée",
              description: "Le mappage et le délimiteur ont été sauvegardés pour ce type de fichier.",
            });
          } catch (configError) {
            console.error("Failed to save configuration:", configError);
            toast({
              title: "Erreur de sauvegarde de configuration",
              description: "Impossible d'enregistrer la configuration.",
              variant: "destructive",
            });
          }
        }

        toast({
          title: "Source créée",
          description: `La source ${response.name} a été ajoutée..`,
        });
        setNewSourceName("");
        setNewSourceFile(null);
        setNewSourcePreview(null);
        setNewSourceMapping({});
        setSaveConfiguration(false);
        loadSources();
      };
      reader.readAsText(newSourceFile);
    } catch (error) {
      console.error("Failed to create source:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la source d'enrichissement",
        variant: "destructive",
      });
    } finally {
      setIsUploadingSource(false);
    }
  };

  const handleDeleteSource = async (id: string | number) => {
    try {
      // Convert to number if it's a string, or use as-is if it's already a number
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      // Validate that we have a valid number
      if (isNaN(numericId)) {
        throw new Error('Invalid source ID');
      }
      
      await backend.settings.deleteSource({ id: numericId });
      toast({
        title: "Source supprimée",
        description: "La source d'enrichissement a été supprimée.",
      });
      loadSources();
    } catch (error) {
      console.error("Failed to delete source:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la source d'enrichissement",
        variant: "destructive",
      });
    }
  };

  const handleStartImport = async (sourceId: string | number) => {
    // Convert to string for tracking since runningImports uses strings
    const stringId = typeof sourceId === 'number' ? sourceId.toString() : sourceId;
    setRunningImports([...runningImports, stringId]);
    try {
      // Convert to number for the API call
      const numericId = typeof sourceId === 'string' ? parseInt(sourceId, 10) : sourceId;
      
      // Validate that we have a valid number
      if (isNaN(numericId)) {
        throw new Error('Invalid source ID');
      }
      
      const response = await backend.enrichment.startImport({
        sourceId: numericId,
      });
      toast({
        title: "Importation terminée",
        description: `${response.recordsProcessed} lignes ont été importées avec succès.`,
      });
    } catch (error: any) {
      console.error("Failed to start import:", error);
      toast({
        title: "Erreur d'importation",
        description: error.details?.message || "L'importation a échoué.",
        variant: "destructive",
      });
    } finally {
      setRunningImports((prev) => prev.filter((id) => id !== stringId));
    }
  };

  const handleSetDefault = async (id: string | number, isDefault: boolean) => {
    try {
      // Convert to string since the API expects a string path parameter
      const stringId = typeof id === 'number' ? id.toString() : id;
      await backend.settings.setSourceDefaultStatus({ id: stringId, isDefault });
      toast({
        title: "Statut par défaut mis à jour",
        description: `La source a été marquée comme ${
          isDefault ? "défaut" : "non défaut"
        }.`,
      });
      loadSources();
    } catch (error) {
      console.error("Failed to set default status:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut par défaut",
        variant: "destructive",
      });
    }
  };

  const handleSourcePreview = async (id: string | number) => {
    try {
      // Convert to number if it's a string, or use as-is if it's already a number
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      // Validate that we have a valid number
      if (isNaN(numericId)) {
        throw new Error('Invalid source ID');
      }
      
      const preview = await backend.settings.previewSourceFile({ id: numericId });
      setSourcePreviewData(preview);
      setIsSourcePreviewOpen(true);
    } catch (error) {
      console.error("Failed to preview source file:", error);
      toast({
        title: "Erreur de prévisualisation",
        description: "Impossible de prévisualiser le fichier source",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-8">
        <p>Impossible de charger les paramètres</p>
        <Button onClick={loadSettings} className="mt-4">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Paramètres
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Configuration de la plateforme d'enrichissement
          </p>
        </div>
      </div>

      <Tabs defaultValue="email" className="space-y-4">
        <TabsList
          className={`${
            isMobile
              ? "grid w-full grid-cols-4 gap-1 h-auto p-1"
              : "grid w-full grid-cols-8"
          }`}
        >
          {isMobile ? (
            <>
              <TabsTrigger value="email" className="text-xs p-2">
                <Mail className="h-3 w-3 mr-1" />
                Email
              </TabsTrigger>
              <TabsTrigger value="processing" className="text-xs p-2">
                <Cpu className="h-3 w-3 mr-1" />
                Process
              </TabsTrigger>
              <TabsTrigger value="files" className="text-xs p-2">
                <FileText className="h-3 w-3 mr-1" />
                Fichiers
              </TabsTrigger>
              <TabsTrigger value="ui" className="text-xs p-2">
                <Palette className="h-3 w-3 mr-1" />
                UI
              </TabsTrigger>
              <TabsTrigger value="system" className="text-xs p-2">
                <Shield className="h-3 w-3 mr-1" />
                Système
              </TabsTrigger>
              <TabsTrigger value="sources" className="text-xs p-2">
                <Plus className="h-3 w-3 mr-1" />
                Sources
              </TabsTrigger>
              <TabsTrigger value="ftp" className="text-xs p-2">
                <Server className="h-3 w-3 mr-1" />
                FTP
              </TabsTrigger>
              <TabsTrigger value="jobs" className="text-xs p-2">
                <Activity className="h-3 w-3 mr-1" />
                Jobs
              </TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="email">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </TabsTrigger>
              <TabsTrigger value="processing">
                <Cpu className="h-4 w-4 mr-2" />
                Traitement
              </TabsTrigger>
              <TabsTrigger value="files">
                <FileText className="h-4 w-4 mr-2" />
                Fichiers
              </TabsTrigger>
              <TabsTrigger value="ui">
                <Palette className="h-4 w-4 mr-2" />
                Interface
              </TabsTrigger>
              <TabsTrigger value="system">
                <Shield className="h-4 w-4 mr-2" />
                Système
              </TabsTrigger>
              <TabsTrigger value="sources">
                <Plus className="h-4 w-4 mr-2" />
                Sources
              </TabsTrigger>
              <TabsTrigger value="ftp">
                <Server className="h-4 w-4 mr-2" />
                FTP
              </TabsTrigger>
              <TabsTrigger value="jobs">
                <Activity className="h-4 w-4 mr-2" />
                Tâches
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Email Settings */}
        <TabsContent value="email">
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-lg sm:text-xl">
                Configuration Email
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Paramètres SMTP pour l'envoi d'emails de notification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost" className="text-sm font-medium">
                    Serveur SMTP
                  </Label>
                  <Input
                    id="smtpHost"
                    value={settings.emailSettings.smtpHost}
                    onChange={(e) =>
                      updateSetting("emailSettings", "smtpHost", e.target.value)
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort" className="text-sm font-medium">
                    Port SMTP
                  </Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={settings.emailSettings.smtpPort}
                    onChange={(e) =>
                      updateSetting(
                        "emailSettings",
                        "smtpPort",
                        parseInt(e.target.value)
                      )
                    }
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpUser" className="text-sm font-medium">
                    Utilisateur SMTP
                  </Label>
                  <Input
                    id="smtpUser"
                    value={settings.emailSettings.smtpUser}
                    onChange={(e) =>
                      updateSetting("emailSettings", "smtpUser", e.target.value)
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword" className="text-sm font-medium">
                    Mot de passe
                  </Label>
                  <Input
                    id="smtpPassword"
                    type="password"
                    value={settings.emailSettings.smtpPassword}
                    onChange={(e) =>
                      updateSetting(
                        "emailSettings",
                        "smtpPassword",
                        e.target.value
                      )
                    }
                    className="text-sm"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="smtpSecure"
                    className="text-sm font-medium flex-1"
                  >
                    Connexion sécurisée (SSL/TLS)
                  </Label>
                  <Switch
                    id="smtpSecure"
                    checked={settings.emailSettings.smtpSecure}
                    onCheckedChange={(checked) =>
                      updateSetting("emailSettings", "smtpSecure", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="enableNotifications"
                    className="text-sm font-medium flex-1"
                  >
                    Activer les notifications par email
                  </Label>
                  <Switch
                    id="enableNotifications"
                    checked={settings.emailSettings.enableNotifications}
                    onCheckedChange={(checked) =>
                      updateSetting(
                        "emailSettings",
                        "enableNotifications",
                        checked
                      )
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Processing Settings */}
        <TabsContent value="processing">
          <Card>
            <CardHeader>
              <CardTitle>Configuration du Traitement</CardTitle>
              <CardDescription>
                Paramètres de performance et de traitement des fichiers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxConcurrentJobs">
                    Jobs simultanés maximum
                  </Label>
                  <Input
                    id="maxConcurrentJobs"
                    type="number"
                    min="1"
                    max="20"
                    value={settings.processingSettings.maxConcurrentJobs}
                    onChange={(e) =>
                      updateSetting(
                        "processingSettings",
                        "maxConcurrentJobs",
                        parseInt(e.target.value)
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultTimeout">
                    Timeout par défaut (minutes)
                  </Label>
                  <Input
                    id="defaultTimeout"
                    type="number"
                    min="5"
                    max="180"
                    value={settings.processingSettings.defaultTimeout}
                    onChange={(e) =>
                      updateSetting(
                        "processingSettings",
                        "defaultTimeout",
                        parseInt(e.target.value)
                      )
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="autoRefreshInterval">
                    Intervalle de rafraîchissement (secondes)
                  </Label>
                  <Input
                    id="autoRefreshInterval"
                    type="number"
                    min="1"
                    max="60"
                    value={settings.processingSettings.autoRefreshInterval}
                    onChange={(e) =>
                      updateSetting(
                        "processingSettings",
                        "autoRefreshInterval",
                        parseInt(e.target.value)
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retryAttempts">
                    Tentatives en cas d'échec
                  </Label>
                  <Input
                    id="retryAttempts"
                    type="number"
                    min="0"
                    max="10"
                    value={settings.processingSettings.retryAttempts}
                    onChange={(e) =>
                      updateSetting(
                        "processingSettings",
                        "retryAttempts",
                        parseInt(e.target.value)
                      )
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center space-x-2">
                <Switch
                  id="enableAutoCleanup"
                  checked={settings.processingSettings.enableAutoCleanup}
                  onCheckedChange={(checked) =>
                    updateSetting(
                      "processingSettings",
                      "enableAutoCleanup",
                      checked
                    )
                  }
                />
                <Label htmlFor="enableAutoCleanup">
                  Nettoyage automatique des anciens jobs
                </Label>
              </div>

              {settings.processingSettings.enableAutoCleanup && (
                <div className="space-y-2">
                  <Label htmlFor="cleanupAfterDays">
                    Supprimer après (jours)
                  </Label>
                  <Input
                    id="cleanupAfterDays"
                    type="number"
                    min="1"
                    max="365"
                    value={settings.processingSettings.cleanupAfterDays}
                    onChange={(e) =>
                      updateSetting(
                        "processingSettings",
                        "cleanupAfterDays",
                        parseInt(e.target.value)
                      )
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* File Settings */}
        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle>Configuration des Fichiers</CardTitle>
              <CardDescription>
                Paramètres de gestion et traitement des fichiers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxFileSize">Taille maximum (MB)</Label>
                  <Input
                    id="maxFileSize"
                    type="number"
                    min="1"
                    max="1000"
                    value={settings.fileSettings.maxFileSize}
                    onChange={(e) =>
                      updateSetting(
                        "fileSettings",
                        "maxFileSize",
                        parseInt(e.target.value)
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compressionFormat">
                    Format de compression
                  </Label>
                  <Select
                    value={settings.fileSettings.compressionFormat}
                    onValueChange={(value: "zip" | "rar" | "both") =>
                      updateSetting("fileSettings", "compressionFormat", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zip">ZIP</SelectItem>
                      <SelectItem value="rar">RAR</SelectItem>
                      <SelectItem value="both">ZIP et RAR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="previewRowLimit">Lignes dans l'aperçu</Label>
                  <Input
                    id="previewRowLimit"
                    type="number"
                    min="1"
                    max="100"
                    value={settings.fileSettings.previewRowLimit}
                    onChange={(e) =>
                      updateSetting(
                        "fileSettings",
                        "previewRowLimit",
                        parseInt(e.target.value)
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="separator">Séparateur CSV</Label>
                  <Input
                    id="separator"
                    value={settings.fileSettings.separator}
                    onChange={(e) =>
                      updateSetting("fileSettings", "separator", e.target.value)
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center space-x-2">
                <Switch
                  id="enablePreview"
                  checked={settings.fileSettings.enablePreview}
                  onCheckedChange={(checked) =>
                    updateSetting("fileSettings", "enablePreview", checked)
                  }
                />
                <Label htmlFor="enablePreview">
                  Activer l'aperçu des résultats
                </Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* UI Settings */}
        <TabsContent value="ui">
          <Card>
            <CardHeader>
              <CardTitle>Configuration de l'Interface</CardTitle>
              <CardDescription>
                Paramètres d'affichage et d'expérience utilisateur
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appName">Nom de l'application</Label>
                <Input
                  id="appName"
                  value={settings.uiSettings.appName}
                  onChange={(e) =>
                    updateSetting("uiSettings", "appName", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appDescription">Description</Label>
                <Input
                  id="appDescription"
                  value={settings.uiSettings.appDescription}
                  onChange={(e) =>
                    updateSetting(
                      "uiSettings",
                      "appDescription",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Thème</Label>
                  <Select
                    value={settings.uiSettings.theme}
                    onValueChange={(value: "light" | "dark" | "auto") =>
                      updateSetting("uiSettings", "theme", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Clair</SelectItem>
                      <SelectItem value="dark">Sombre</SelectItem>
                      <SelectItem value="auto">Automatique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Langue</Label>
                  <Select
                    value={settings.uiSettings.language}
                    onValueChange={(value: "fr" | "en") =>
                      updateSetting("uiSettings", "language", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemsPerPage">Éléments par page</Label>
                <Input
                  id="itemsPerPage"
                  type="number"
                  min="5"
                  max="100"
                  value={settings.uiSettings.itemsPerPage}
                  onChange={(e) =>
                    updateSetting(
                      "uiSettings",
                      "itemsPerPage",
                      parseInt(e.target.value)
                    )
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center space-x-2">
                <Switch
                  id="enableAnimations"
                  checked={settings.uiSettings.enableAnimations}
                  onCheckedChange={(checked) =>
                    updateSetting("uiSettings", "enableAnimations", checked)
                  }
                />
                <Label htmlFor="enableAnimations">Activer les animations</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>Configuration Système</CardTitle>
              <CardDescription>
                Paramètres avancés et maintenance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="enableDebugLogs"
                  checked={settings.systemSettings.enableDebugLogs}
                  onCheckedChange={(checked) =>
                    updateSetting("systemSettings", "enableDebugLogs", checked)
                  }
                />
                <Label htmlFor="enableDebugLogs">
                  Activer les logs de débogage
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enableMetrics"
                  checked={settings.systemSettings.enableMetrics}
                  onCheckedChange={(checked) =>
                    updateSetting("systemSettings", "enableMetrics", checked)
                  }
                />
                <Label htmlFor="enableMetrics">Collecter les métriques</Label>
              </div>

              <Separator />

              <div className="flex items-center space-x-2">
                <Switch
                  id="maintenanceMode"
                  checked={settings.systemSettings.maintenanceMode}
                  onCheckedChange={(checked) =>
                    updateSetting("systemSettings", "maintenanceMode", checked)
                  }
                />
                <Label htmlFor="maintenanceMode">Mode maintenance</Label>
              </div>

              {settings.systemSettings.maintenanceMode && (
                <div className="space-y-2">
                  <Label htmlFor="maintenanceMessage">
                    Message de maintenance
                  </Label>
                  <Input
                    id="maintenanceMessage"
                    value={settings.systemSettings.maintenanceMessage}
                    onChange={(e) =>
                      updateSetting(
                        "systemSettings",
                        "maintenanceMessage",
                        e.target.value
                      )
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Enrichment Sources Settings */}
        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle>Sources d'enrichissement</CardTitle>
              <CardDescription>
                Gérer les sources de données pour l'enrichissement et la table de contacts.
              </CardDescription>
              <div className="flex space-x-2 pt-4">
                <Button onClick={() => setSourcesView("list")} variant={sourcesView === 'list' ? 'default' : 'outline'}>Liste des sources</Button>
                <Button onClick={() => setSourcesView("add")} variant={sourcesView === 'add' ? 'default' : 'outline'}>Ajouter une source</Button>
                <Button onClick={() => setSourcesView("contacts")} variant={sourcesView === 'contacts' ? 'default' : 'outline'}>Source des contacts</Button>
              </div>
            </CardHeader>
            <CardContent>
              {sourcesView === 'list' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Sources d'enrichissement existantes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>Lignes</TableHead>
                          <TableHead>Par défaut</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sources.map((source) => (
                          <TableRow key={source.id}>
                            <TableCell>{source.name}</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>
                              <Switch
                                checked={source.isDefault}
                                onCheckedChange={(checked) =>
                                  handleSetDefault(source.id.toString(), checked)
                                }
                              />
                            </TableCell>
                            <TableCell className="space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSourcePreview(source.id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartImport(source.id.toString())}
                                disabled={runningImports.includes(source.id.toString())}
                              >
                                {runningImports.includes(source.id.toString()) ? (
                                  <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                                    <span>Import...</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Upload className="h-4 w-4" />
                                    <span>Importer</span>
                                  </div>
                                )}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteSource(source.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {sourcesView === 'add' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Ajouter une source d'enrichissement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newSourceName">Nom de la source</Label>
                        <Input
                          id="newSourceName"
                          value={newSourceName}
                          onChange={(e) => setNewSourceName(e.target.value)}
                          placeholder="Ex: 'Fichier clients 2024'"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newSourceFile">Fichier source</Label>
                        <Input
                          id="newSourceFile"
                          type="file"
                          onChange={handleSourceFileChange}
                        />
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="newSourceHasHeaders"
                            checked={newSourceHasHeaders}
                            onCheckedChange={setNewSourceHasHeaders}
                          />
                          <Label htmlFor="newSourceHasHeaders">
                            Le fichier a des en-têtes
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="newSourceDelimiter">Délimiteur</Label>
                          <Input
                            id="newSourceDelimiter"
                            value={newSourceDelimiter}
                            onChange={(e) =>
                              setNewSourceDelimiter(e.target.value)
                            }
                            className="w-16"
                          />
                        </div>
                      </div>

                      {newSourcePreview && (
                        <div className="space-y-4 pt-4 border-t">
                          <h4 className="text-sm font-semibold">
                            Aperçu du fichier
                          </h4>
                          <div className="overflow-auto max-h-60 border rounded-md">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  {newSourcePreview.headers.map(
                                    (header, index) => (
                                      <TableHead key={index}>{header}</TableHead>
                                    )
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {newSourcePreview.rows.map((row, rowIndex) => (
                                  <TableRow key={rowIndex}>
                                    {row.map((cell, cellIndex) => (
                                      <TableCell key={cellIndex}>
                                        {cell}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          {newSourcePreview.totalRows >
                            newSourcePreview.rows.length && (
                            <p className="text-xs text-muted-foreground">
                              Et{" "}
                              {newSourcePreview.totalRows -
                                newSourcePreview.rows.length}{" "}
                              autres lignes
                            </p>
                          )}
                        </div>
                      )}

                      {newSourcePreview && (
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold">
                            Mappage des colonnes
                          </h4>
                          <div className="overflow-auto max-h-60 border rounded-md">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Colonne du fichier</TableHead>
                                  <TableHead>Champ de destination</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(newSourceHasHeaders
                                  ? newSourcePreview.headers
                                  : newSourcePreview.firstRow || []
                                ).map((col, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium">
                                      {col}
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={newSourceMapping[col]}
                                        onValueChange={(value) =>
                                          setNewSourceMapping({
                                            ...newSourceMapping,
                                            [col]: value,
                                          })
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Sélectionner un champ" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {destinationFields.map((field) => (
                                            <SelectItem
                                              key={field}
                                              value={field}
                                            >
                                              {field}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          {!newSourceHasHeaders && (
                            <p className="text-xs text-muted-foreground">
                              Le fichier n'a pas d'en-têtes. La première ligne
                              est utilisée pour l'aperçu du mappage.
                            </p>
                          )}

                          <div className="flex items-center gap-2">
                            {isAddingField ? (
                              <>
                                <Input
                                  value={newDestinationField}
                                  onChange={(e) =>
                                    setNewDestinationField(
                                      e.target.value.toUpperCase()
                                    )
                                  }
                                  placeholder="Nouveau nom de champ"
                                  className="h-9"
                                />
                                <Button
                                  onClick={handleAddDestinationField}
                                  size="sm"
                                >
                                  Ajouter
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setIsAddingField(false)}
                                >
                                  Annuler
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsAddingField(true)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Ajouter un champ de destination
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center space-x-2 pt-4 mt-4 border-t">
                        <Switch
                          id="saveConfiguration"
                          checked={saveConfiguration}
                          onCheckedChange={setSaveConfiguration}
                        />
                        <Label htmlFor="saveConfiguration">
                          Sauvegarder la configuration pour ce type de fichier
                        </Label>
                      </div>

                      <Button
                        onClick={handleCreateSource}
                        disabled={
                          !newSourceFile || !newSourceName || isUploadingSource
                        }
                        className="w-full mt-4"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingSource
                          ? "Création..."
                          : "Créer la source"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {sourcesView === 'contacts' && (
                <div>
                  {contactUploadStep === 'file-selection' && (
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          Configuration de la table des contacts
                        </CardTitle>
                        <CardDescription>
                          Importez vos contacts depuis un fichier CSV avec mappage automatique des colonnes. 
                          Il y a actuellement {contactsCount} contacts dans la base de données.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-4">
                          <h3 className="text-md font-semibold">
                            Importer des contacts depuis un fichier CSV
                          </h3>
                          <div className="space-y-2">
                            <Label htmlFor="contactFile">Fichier CSV</Label>
                            <Input
                              id="contactFile"
                              type="file"
                              accept=".csv"
                              onChange={handleContactFileSelect}
                              disabled={isUploadingContactFile}
                            />
                            <p className="text-sm text-muted-foreground">
                              Le système détectera automatiquement les colonnes et proposera un mappage intelligent.
                            </p>
                          </div>
                        </div>

                        <div className="bg-muted/30 p-4 rounded-lg">
                          <h4 className="text-sm font-medium mb-3">Comment ça fonctionne:</h4>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-start gap-2">
                              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">1</span>
                              <span>Sélectionnez votre fichier CSV de contacts</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">2</span>
                              <span>Le système analysera les colonnes et proposera des mappages automatiques</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">3</span>
                              <span>Vérifiez et ajustez les mappages si nécessaire</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">4</span>
                              <span>Les données seront automatiquement converties et importées</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="font-medium text-blue-800 mb-2">Mappages automatiques supportés:</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-blue-700">
                            <span>• email, mail, e-mail</span>
                            <span>• mobile, portable, gsm</span>
                            <span>• nom, lastname</span>
                            <span>• prenom, firstname</span>
                            <span>• adresse, address</span>
                            <span>• ville, city</span>
                            <span>• code_postal, cp</span>
                            <span>• age, années</span>
                            <span>• et bien d'autres...</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {contactUploadStep === 'mapping' && (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <Button variant="outline" onClick={goBackToContactFileSelection}>
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Retour
                        </Button>
                        <div>
                          <h2 className="text-xl font-semibold">Mappage des colonnes contacts</h2>
                          <p className="text-sm text-gray-600">{newContactFile?.name}</p>
                        </div>
                      </div>
                      
                      <ContactColumnMapping
                        csvContent={contactCsvContent}
                        onMappingComplete={handleContactMappingComplete}
                        onCancel={goBackToContactFileSelection}
                        onUploadComplete={handleContactUploadComplete}
                      />
                    </div>
                  )}

                  {contactUploadStep === 'completed' && contactUploadResult && (
                    <Card>
                      <CardHeader>
                        <CardTitle className={contactUploadResult.success ? "text-green-600" : "text-yellow-600"}>
                          {contactUploadResult.success ? "Import terminé avec succès" : "Import terminé avec des erreurs"}
                        </CardTitle>
                        <CardDescription>
                          {contactUploadResult.totalRows} contacts traités
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{contactUploadResult.totalRows}</div>
                            <div className="text-sm text-green-700">Contacts importés</div>
                          </div>
                          <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{contactMappings.length}</div>
                            <div className="text-sm text-blue-700">Colonnes mappées</div>
                          </div>
                          <div className="text-center p-4 bg-red-50 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">{contactUploadResult.errors?.length || 0}</div>
                            <div className="text-sm text-red-700">Erreurs</div>
                          </div>
                        </div>

                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold text-gray-600">{contactsCount}</div>
                          <div className="text-sm text-gray-700">Total contacts en base</div>
                        </div>

                        {contactUploadResult.errors && contactUploadResult.errors.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <h4 className="font-medium text-red-800 mb-2">Erreurs détectées:</h4>
                            <div className="space-y-1 text-sm text-red-700 max-h-32 overflow-y-auto">
                              {contactUploadResult.errors.map((error, index) => (
                                <div key={index} className="font-mono">
                                  {error}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <Button onClick={resetContactUpload} className="w-full">
                          Importer un autre fichier
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FTP Settings */}
        <TabsContent value="ftp">
          <div className="space-y-6">
            <FtpServerManager />
            <FtpScanResults />
          </div>
        </TabsContent>

        {/* Background Jobs Monitor */}
        <TabsContent value="jobs">
          <BackgroundJobMonitor />
        </TabsContent>
      </Tabs>

      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
            <p className="text-sm font-semibold text-primary">
              Vous avez des modifications non sauvegardées.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => resetSettings()}
                disabled={isSaving}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Réinitialiser
              </Button>
              <Button
                onClick={saveSettings}
                disabled={isSaving}
                className="min-w-[120px]"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={isSourcePreviewOpen} onOpenChange={setIsSourcePreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Aperçu de la source</DialogTitle>
            {sourcePreviewData && (
              <DialogDescription>
                Affichage des 5 premières lignes de{" "}
                {sourcePreviewData.totalRows} au total.
              </DialogDescription>
            )}
          </DialogHeader>
          {sourcePreviewData && (
            <div className="mt-4 overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {sourcePreviewData.headers.map((header, index) => (
                      <TableHead key={index}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourcePreviewData.rows.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <TableCell key={cellIndex}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
