import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Send } from 'lucide-react';
import backend from '~backend/client';

export function EmailTest() {
  const [email, setEmail] = useState('hackersranch@gmail.com');
  const [testType, setTestType] = useState<'completion' | 'error'>('completion');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSendTest = async () => {
    if (!email) {
      toast({
        title: "Email requis",
        description: "Veuillez saisir une adresse email",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    try {
      // Test avec le nouveau service simple
      const testSubject = testType === 'completion' 
        ? "🎉 Test - Enrichissement Terminé" 
        : "❌ Test - Erreur de Traitement";
        
      const testMessage = testType === 'completion'
        ? `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #22c55e;">🎉 Enrichissement Terminé avec Succès</h2>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Job ID:</strong> test-job-123</p>
              <p><strong>Fichier:</strong> test_file.zip</p>
              <p><strong>Enregistrements traités:</strong> 1,000</p>
              <p><strong>Enregistrements enrichis:</strong> 850</p>
              <p><strong>Taux de réussite:</strong> 85%</p>
            </div>
            <p>🔗 <a href="https://example.com/download" style="color: #3b82f6;">Télécharger le fichier enrichi</a></p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 12px;">
              Ceci est un email de test envoyé depuis la plateforme d'enrichissement de données.<br>
              Configuration: Gmail SMTP (hackersranch@gmail.com)
            </p>
          </div>
        `
        : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">❌ Erreur de Traitement</h2>
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
              <p><strong>Job ID:</strong> test-job-456</p>
              <p><strong>Fichier:</strong> test_file_error.zip</p>
              <p><strong>Erreur:</strong> Format de fichier non supporté</p>
              <p>Veuillez vérifier le format de votre fichier et réessayer.</p>
            </div>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 12px;">
              Ceci est un email de test envoyé depuis la plateforme d'enrichissement de données.<br>
              Configuration: Gmail SMTP (hackersranch@gmail.com)
            </p>
          </div>
        `;

      const result = await backend.notification.sendSimpleEmail({
        to: email,
        subject: testSubject,
        message: testMessage,
        from: 'hackersranch@gmail.com'
      });

      toast({
        title: "Email de test traité",
        description: `Provider: ${result.provider} | ID: ${result.messageId}`,
      });

      console.log('Email test result:', result);
    } catch (error) {
      console.error('Test email failed:', error);
      toast({
        title: "Erreur d'envoi",
        description: "Impossible d'envoyer l'email de test",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl">
          <Mail className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
          <span>Test d'Email</span>
        </CardTitle>
        <CardDescription className="text-sm sm:text-base">
          Testez la configuration SMTP Gmail
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
        <div className="space-y-2">
          <Label htmlFor="test-email" className="text-sm font-medium">Adresse email de test</Label>
          <Input
            id="test-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hackersranch@gmail.com"
            disabled={isSending}
            className="text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="test-type" className="text-sm font-medium">Type de test</Label>
          <Select value={testType} onValueChange={(value: 'completion' | 'error') => setTestType(value)}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="completion">Email de complétion</SelectItem>
              <SelectItem value="error">Email d'erreur</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleSendTest}
          disabled={isSending}
          className="w-full py-2 sm:py-3"
          size="lg"
        >
          {isSending ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span className="text-sm sm:text-base">Envoi en cours...</span>
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Send className="h-4 w-4" />
              <span className="text-sm sm:text-base">Envoyer l'email de test</span>
            </span>
          )}
        </Button>

        <div className="bg-blue-50 border border-blue-200 p-3 sm:p-4 rounded-lg">
          <h4 className="font-medium mb-2 text-blue-800 text-sm sm:text-base">📧 Configuration Email Réelle :</h4>
          <ul className="space-y-1 text-blue-700 text-xs sm:text-sm">
            <li>• <strong>Provider:</strong> Gmail SMTP avec nodemailer</li>
            <li>• <strong>Authentification:</strong> App Password Gmail</li>
            <li>• <strong>Encryption:</strong> SSL/TLS (Port 465)</li>
            <li>• <strong>Status:</strong> Emails réels envoyés ✅</li>
          </ul>
        </div>

        <div className="bg-muted/50 p-3 sm:p-4 rounded-lg">
          <h4 className="font-medium mb-2 text-sm sm:text-base">Configuration SMTP :</h4>
          <ul className="space-y-1 text-muted-foreground text-xs sm:text-sm">
            <li>• Host: smtp.gmail.com</li>
            <li>• Port: 465 (SSL/TLS)</li>
            <li>• From: hackersranch@gmail.com</li>
            <li>• Auth: App Password configuré</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}