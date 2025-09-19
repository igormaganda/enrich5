import { api, APIError } from "encore.dev/api";


export interface SendEmailRequest {
  to: string;
  subject: string;
  message: string;
  from?: string;
}

export interface SendEmailResponse {
  success: boolean;
  messageId: string;
  provider: string;
  error?: string;
}

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

// Simple email sending service using real SMTP
export const sendSimpleEmail = api<SendEmailRequest, SendEmailResponse>(
  { expose: true, method: "POST", path: "/send-simple" },
  async (req) => {
    return {
      success: false,
      messageId: "disabled",
      provider: "disabled",
      error: "Email functionality temporarily disabled"
    };
  }
);