import { api, APIError } from "encore.dev/api";

import type { SendCompletionEmailRequest, SendErrorEmailRequest, TestEmailRequest, EmailResponse } from "./types";

// Récupère les paramètres email dynamiquement
async function getEmailSettings() {
  try {
    const { settings } = await import("~encore/clients");
    const settingsResponse = await settings.getSettings({});
    return settingsResponse.settings.emailSettings;
  } catch (error) {
    console.warn('Failed to get email settings, using fallback');
    return {
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: 'hackersranch@gmail.com',
      smtpPassword: 'wftu sloa kpsq wecy',
      fromAddress: 'hackersranch@gmail.com',
      fromName: 'Plateforme d\'Enrichissement',
      enableNotifications: true
    };
  }
}

// Create nodemailer transporter
async function createTransporter() {
  const emailSettings = await getEmailSettings();
  
  if (!emailSettings.enableNotifications) {
    throw new Error('Email notifications are disabled');
  }

  // const nodemailer = await import('nodemailer');
  // Temporarily disabled until nodemailer is properly installed
  throw new Error('Email functionality temporarily disabled');
}

// Sends completion notification email
export const sendCompletionEmail = api<SendCompletionEmailRequest, EmailResponse>(
  { method: "POST", path: "/send-completion" },
  async (req) => {
    try {
      const emailSettings = await getEmailSettings();
      
      if (!emailSettings.enableNotifications) {
        console.log('Email notifications are disabled');
        return { success: true, messageId: 'disabled' };
      }

      const subject = `${emailSettings.fromName} - Enrichissement Terminé - ${req.filename}`;
      const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #22c55e;">🎉 Enrichissement Terminé avec Succès</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Job ID:</strong> ${req.jobId}</p>
            <p><strong>Filename:</strong> ${req.filename}</p>
            <p><strong>Records Processed:</strong> ${req.recordsProcessed.toLocaleString()}</p>
            <p><strong>Records Enriched:</strong> ${req.recordsEnriched.toLocaleString()}</p>
            <p><strong>Taux de réussite:</strong> ${Math.round((req.recordsEnriched / req.recordsProcessed) * 100)}%</p>
          </div>
          <p>🔗 <a href="${req.downloadUrl}" style="color: #3b82f6;">Télécharger le fichier enrichi</a></p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 12px;">
            Email envoyé depuis ${emailSettings.fromName}<br>
            Configuration: ${emailSettings.smtpHost}:${emailSettings.smtpPort}
          </p>
        </div>
      `;

      const messageId = await sendEmail(getUserEmail(req.userId), subject, body);
      return { success: true, messageId };
    } catch (error) {
      console.error('Failed to send completion email:', error);
      throw APIError.internal("Failed to send completion email", error as Error);
    }
  }
);

// Sends error notification email
export const sendErrorEmail = api<SendErrorEmailRequest, EmailResponse>(
  { method: "POST", path: "/send-error" },
  async (req) => {
    try {
      const emailSettings = await getEmailSettings();
      
      if (!emailSettings.enableNotifications) {
        console.log('Email notifications are disabled');
        return { success: true, messageId: 'disabled' };
      }

      const subject = `${emailSettings.fromName} - Erreur de Traitement - ${req.filename}`;
      const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ef4444;">❌ Erreur de Traitement</h2>
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <p><strong>Job ID:</strong> ${req.jobId}</p>
            <p><strong>Filename:</strong> ${req.filename}</p>
            <p><strong>Erreur:</strong> ${req.errorMessage}</p>
          </div>
          <p>Veuillez vérifier le fichier et réessayer.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 12px;">
            Email envoyé depuis ${emailSettings.fromName}
          </p>
        </div>
      `;

      const messageId = await sendEmail(getUserEmail(req.userId), subject, body);
      return { success: true, messageId };
    } catch (error) {
      console.error('Failed to send error email:', error);
      throw APIError.internal("Failed to send error email", error as Error);
    }
  }
);

// Test email sending
export const sendTestEmail = api<TestEmailRequest, EmailResponse>(
  { expose: true, method: "POST", path: "/test-email" },
  async (req) => {
    try {
      const emailSettings = await getEmailSettings();
      const testType = req.testType || 'completion';
      
      let subject: string;
      let body: string;
      
      if (testType === 'completion') {
        subject = `${emailSettings.fromName} - Test Complétion`;
        body = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #22c55e;">🎉 Test Email - Enrichissement Terminé</h2>
            <p>Configuration email active :</p>
            <ul>
              <li>SMTP: ${emailSettings.smtpHost}:${emailSettings.smtpPort}</li>
              <li>De: "${emailSettings.fromName}" &lt;${emailSettings.fromAddress}&gt;</li>
              <li>Notifications: ${emailSettings.enableNotifications ? 'Activées' : 'Désactivées'}</li>
            </ul>
            <p style="color: #22c55e; font-weight: bold;">✅ Email réel envoyé via SMTP Gmail!</p>
          </div>
        `;
      } else {
        subject = `${emailSettings.fromName} - Test Erreur`;
        body = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">❌ Test Email - Erreur de Traitement</h2>
            <p>Configuration email active :</p>
            <ul>
              <li>SMTP: ${emailSettings.smtpHost}:${emailSettings.smtpPort}</li>
              <li>De: "${emailSettings.fromName}" &lt;${emailSettings.fromAddress}&gt;</li>
              <li>Notifications: ${emailSettings.enableNotifications ? 'Activées' : 'Désactivées'}</li>
            </ul>
            <p style="color: #ef4444; font-weight: bold;">✅ Email réel envoyé via SMTP Gmail!</p>
          </div>
        `;
      }

      const messageId = await sendEmail(req.to, subject, body);
      return { success: true, messageId };
    } catch (error) {
      console.error('Failed to send test email:', error);
      throw APIError.internal("Failed to send test email", error as Error);
    }
  }
);

async function sendEmail(to: string, subject: string, html: string): Promise<string> {
  const emailSettings = await getEmailSettings();
  
  if (!emailSettings.enableNotifications) {
    console.log('📧 Email sending is disabled in settings');
    return 'disabled';
  }

  // Email functionality temporarily disabled
  console.log('📧 Email functionality temporarily disabled');
  return 'disabled';
}

function getUserEmail(userId: string): string {
  // In a real app, you would fetch the user's email from the database
  return 'hackersranch@gmail.com';
}