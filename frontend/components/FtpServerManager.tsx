import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Settings, Play, Trash2, TestTube2, RefreshCw } from 'lucide-react';
import backend from '~backend/client';
import type { FtpServerConfig, CreateFtpServerRequest, TestFtpConnectionRequest } from '~backend/ftp/types';

export function FtpServerManager() {
  const [servers, setServers] = useState<FtpServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<FtpServerConfig | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const response = await backend.ftp.listFtpServers();
      setServers(response.servers);
    } catch (error) {
      console.error('Error loading FTP servers:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les serveurs FTP",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateServer = async (data: CreateFtpServerRequest) => {
    try {
      await backend.ftp.createFtpServer(data);
      toast({
        title: "Succès",
        description: "Serveur FTP créé avec succès",
      });
      setIsCreateDialogOpen(false);
      loadServers();
    } catch (error) {
      console.error('Error creating FTP server:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer le serveur FTP",
        variant: "destructive",
      });
    }
  };

  const handleUpdateServer = async (id: string, updates: Partial<FtpServerConfig>) => {
    try {
      await backend.ftp.updateFtpServer({ id, ...updates });
      toast({
        title: "Succès",
        description: "Serveur FTP mis à jour",
      });
      loadServers();
    } catch (error) {
      console.error('Error updating FTP server:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le serveur FTP",
        variant: "destructive",
      });
    }
  };

  const handleDeleteServer = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce serveur FTP ?')) return;
    
    try {
      await backend.ftp.deleteFtpServer({ id });
      toast({
        title: "Succès",
        description: "Serveur FTP supprimé",
      });
      loadServers();
    } catch (error) {
      console.error('Error deleting FTP server:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le serveur FTP",
        variant: "destructive",
      });
    }
  };

  const handleTestConnection = async (server: FtpServerConfig) => {
    setTestingConnection(server.id);
    try {
      const response = await backend.ftp.testFtpConnection({
        host: server.host,
        port: server.port,
        username: server.username,
        password: server.password,
        path: server.path
      });
      
      toast({
        title: response.success ? "Connexion réussie" : "Connexion échouée",
        description: response.message,
        variant: response.success ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Error testing FTP connection:', error);
      toast({
        title: "Erreur",
        description: "Impossible de tester la connexion",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(null);
    }
  };

  const handleScanServer = async (serverId: string) => {
    try {
      const response = await backend.ftp.scanFtpServer({ serverId });
      toast({
        title: "Scan lancé",
        description: `Scan du serveur en cours (Job ID: ${response.scanId})`,
      });
    } catch (error) {
      console.error('Error scanning FTP server:', error);
      toast({
        title: "Erreur",
        description: "Impossible de lancer le scan du serveur",
        variant: "destructive",
      });
    }
  };

  const handleCleanupServers = async () => {
    try {
      const response = await backend.ftp.cleanupFtpServers();
      toast({
        title: "Nettoyage terminé",
        description: `${response.fixed} serveur(s) corrigé(s)`,
      });
      if (response.fixed > 0) {
        loadServers();
      }
    } catch (error) {
      console.error('Error cleaning up FTP servers:', error);
      toast({
        title: "Erreur",
        description: "Impossible de nettoyer les serveurs FTP",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Serveurs FTP</h2>
          <p className="text-muted-foreground">
            Gérez les serveurs FTP pour l'import automatique de données
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau serveur
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <FtpServerForm onSubmit={handleCreateServer} />
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" onClick={handleCleanupServers}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Nettoyer
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {servers.map((server) => (
          <Card key={server.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{server.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={server.enabled ? "default" : "secondary"}>
                    {server.enabled ? "Actif" : "Inactif"}
                  </Badge>
                  <Switch
                    checked={server.enabled}
                    onCheckedChange={(enabled) => handleUpdateServer(server.id, { enabled })}
                  />
                </div>
              </div>
              <CardDescription>
                {server.host}:{server.port}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Utilisateur:</span>
                  <span>{server.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chemin:</span>
                  <span className="truncate max-w-32">{server.path}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pattern:</span>
                  <span>{server.filePattern}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Intervalle:</span>
                  <span>{server.pollInterval}min</span>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestConnection(server)}
                  disabled={testingConnection === server.id}
                >
                  {testingConnection === server.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube2 className="h-4 w-4" />
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleScanServer(server.id)}
                  disabled={!server.enabled}
                >
                  <Play className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingServer(server)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteServer(server.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {servers.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">
              Aucun serveur FTP configuré
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter le premier serveur
            </Button>
          </CardContent>
        </Card>
      )}

      {editingServer && (
        <Dialog open={!!editingServer} onOpenChange={() => setEditingServer(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <FtpServerForm
              server={editingServer}
              onSubmit={(data) => {
                handleUpdateServer(editingServer.id, data);
                setEditingServer(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface FtpServerFormProps {
  server?: FtpServerConfig;
  onSubmit: (data: CreateFtpServerRequest) => void;
}

function FtpServerForm({ server, onSubmit }: FtpServerFormProps) {
  const [formData, setFormData] = useState<CreateFtpServerRequest>({
    name: server?.name || '',
    host: server?.host || '',
    port: server?.port || 21,
    username: server?.username || '',
    password: server?.password || '',
    path: server?.path || '/',
    filePattern: server?.filePattern || '*.csv',
    deleteAfterDownload: server?.deleteAfterDownload || false,
    pollInterval: server?.pollInterval || 60,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {server ? 'Modifier le serveur FTP' : 'Nouveau serveur FTP'}
        </DialogTitle>
        <DialogDescription>
          Configurez les paramètres de connexion pour votre serveur FTP
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Nom du serveur</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Mon serveur FTP"
            required
          />
        </div>

        <div>
          <Label htmlFor="host">Hôte</Label>
          <Input
            id="host"
            value={formData.host}
            onChange={(e) => setFormData({ ...formData, host: e.target.value })}
            placeholder="161.97.96.229 (sans ftp://)"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Entrez uniquement l'adresse IP ou le nom d'hôte (sans protocole)
          </p>
        </div>

        <div>
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            value={formData.port}
            onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
            placeholder="21"
            required
          />
        </div>

        <div>
          <Label htmlFor="username">Utilisateur</Label>
          <Input
            id="username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="username"
            required
          />
        </div>

        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="••••••••"
            required
          />
        </div>

        <div>
          <Label htmlFor="path">Chemin sur le serveur</Label>
          <Input
            id="path"
            value={formData.path}
            onChange={(e) => setFormData({ ...formData, path: e.target.value })}
            placeholder="/uploads"
            required
          />
        </div>

        <div>
          <Label htmlFor="filePattern">Pattern de fichiers</Label>
          <Input
            id="filePattern"
            value={formData.filePattern}
            onChange={(e) => setFormData({ ...formData, filePattern: e.target.value })}
            placeholder="*.csv"
            required
          />
        </div>

        <div>
          <Label htmlFor="pollInterval">Intervalle (minutes)</Label>
          <Input
            id="pollInterval"
            type="number"
            value={formData.pollInterval}
            onChange={(e) => setFormData({ ...formData, pollInterval: parseInt(e.target.value) })}
            placeholder="60"
            min="1"
            required
          />
        </div>

        <div className="col-span-2 flex items-center space-x-2">
          <Switch
            id="deleteAfterDownload"
            checked={formData.deleteAfterDownload}
            onCheckedChange={(checked) => setFormData({ ...formData, deleteAfterDownload: checked })}
          />
          <Label htmlFor="deleteAfterDownload">
            Supprimer les fichiers après téléchargement
          </Label>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit">
          {server ? 'Mettre à jour' : 'Créer'}
        </Button>
      </DialogFooter>
    </form>
  );
}