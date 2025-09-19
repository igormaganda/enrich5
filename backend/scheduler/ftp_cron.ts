import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import { ftp } from "~encore/clients";

// API endpoint qui sera appelé par le cron job
export const scheduledFtpScan = api({}, async (): Promise<void> => {
  try {
    console.log("Starting scheduled FTP scan...");
    
    const result = await ftp.scanAllFtpServers({});
    
    console.log(`FTP scan initiated with job ID: ${result.scanId}`);
  } catch (error) {
    console.error("Error during scheduled FTP scan:", error);
  }
});

// Cron job qui s'exécute toutes les 30 minutes pour scanner les serveurs FTP
const ftpScanJob = new CronJob("ftp-scan", {
  title: "FTP Server Scanner",
  every: "30m", // Toutes les 30 minutes
  endpoint: scheduledFtpScan,
});