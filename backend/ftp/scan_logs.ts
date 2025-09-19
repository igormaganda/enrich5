import { api } from "encore.dev/api";
import { db } from "./db";
import type { FtpScanResult, FileDetail } from "./types";

interface FtpScanLog {
  id: string;
  serverId: string;
  serverName: string;
  filesFound: number;
  filesDownloaded: number;
  fileDetails: FileDetail[];
  errors: string[];
  scanStartedAt: string;
  scanCompletedAt: string;
}

export const getScanLogs = api<{}, { logs: FtpScanLog[] }>(
  { expose: true, method: "GET", path: "/ftp/scan-logs" },
  async () => {
    const logsResult = await db.query<{
      id: string;
      serverId: string;
      serverName: string;
      filesFound: number;
      filesDownloaded: number;
      fileDetails: string;
      errors: string;
      scanStartedAt: string;
      scanCompletedAt: string;
    }>`
      SELECT 
        l.id,
        l.server_id as "serverId",
        s.name as "serverName",
        l.files_found as "filesFound",
        l.files_downloaded as "filesDownloaded",
        COALESCE(l.file_details, '[]'::jsonb)::text as "fileDetails",
        COALESCE(l.errors, '[]'::jsonb)::text as "errors",
        l.scan_started_at::text as "scanStartedAt",
        l.scan_completed_at::text as "scanCompletedAt"
      FROM ftp_scan_logs l
      LEFT JOIN ftp_servers s ON l.server_id = s.id
      ORDER BY l.scan_completed_at DESC
      LIMIT 50
    `;

    const logs: FtpScanLog[] = [];
    for await (const log of logsResult) {
      logs.push({
        id: log.id,
        serverId: log.serverId,
        serverName: log.serverName || 'Serveur inconnu',
        filesFound: log.filesFound,
        filesDownloaded: log.filesDownloaded,
        fileDetails: JSON.parse(log.fileDetails),
        errors: JSON.parse(log.errors),
        scanStartedAt: log.scanStartedAt,
        scanCompletedAt: log.scanCompletedAt
      });
    }

    return { logs };
  }
);

export const getScanLogDetails = api<{ logId: string }, { scanResult: FtpScanResult }>(
  { expose: true, method: "GET", path: "/ftp/scan-logs/:logId" },
  async ({ logId }) => {
    const logResult = await db.queryRow<{
      id: string;
      serverId: string;
      serverName: string;
      filesFound: number;
      filesDownloaded: number;
      fileDetails: string;
      errors: string;
      scanStartedAt: string;
      scanCompletedAt: string;
    }>`
      SELECT 
        l.id,
        l.server_id as "serverId",
        s.name as "serverName",
        l.files_found as "filesFound",
        l.files_downloaded as "filesDownloaded",
        COALESCE(l.file_details, '[]'::jsonb)::text as "fileDetails",
        COALESCE(l.errors, '[]'::jsonb)::text as "errors",
        l.scan_started_at::text as "scanStartedAt",
        l.scan_completed_at::text as "scanCompletedAt"
      FROM ftp_scan_logs l
      LEFT JOIN ftp_servers s ON l.server_id = s.id
      WHERE l.id = ${logId}
    `;

    if (!logResult) {
      throw new Error('Log de scan non trouvé');
    }

    const scanResult: FtpScanResult = {
      serverId: logResult.serverId,
      serverName: logResult.serverName || 'Serveur inconnu',
      filesFound: logResult.filesFound,
      filesDownloaded: logResult.filesDownloaded,
      fileDetails: JSON.parse(logResult.fileDetails),
      errors: JSON.parse(logResult.errors),
      scanStartedAt: logResult.scanStartedAt,
      scanCompletedAt: logResult.scanCompletedAt
    };

    return { scanResult };
  }
);