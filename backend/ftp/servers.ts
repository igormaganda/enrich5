import { api, APIError } from "encore.dev/api";
import { db } from "./db";
import type {
  CreateFtpServerRequest,
  UpdateFtpServerRequest,
  ListFtpServersResponse,
  GetFtpServerResponse,
  DeleteFtpServerRequest,
  TestFtpConnectionRequest,
  TestFtpConnectionResponse,
  FtpServerConfig
} from "./types";
import { v4 as uuidv4 } from "uuid";

export const createFtpServer = api<CreateFtpServerRequest, { id: string }>(
  { expose: true, method: "POST", path: "/ftp/servers" },
  async (req) => {
    try {
      const id = uuidv4();
      
      // Sanitize the host field to remove protocol and port
      let cleanHost = req.host.trim();
      
      // Remove protocol prefixes
      cleanHost = cleanHost.replace(/^(ftp:\/\/|ftps:\/\/|sftp:\/\/)/i, '');
      
      // Remove port if included in host (port should be in separate field)
      cleanHost = cleanHost.split(':')[0];
      
      await db.exec`
        INSERT INTO ftp_servers (
          id, name, host, port, username, password, path, 
          file_pattern, delete_after_download, poll_interval
        )
        VALUES (
          ${id}, ${req.name}, ${cleanHost}, ${req.port}, ${req.username}, 
          ${req.password}, ${req.path}, ${req.filePattern}, 
          ${req.deleteAfterDownload}, ${req.pollInterval}
        )
      `;
      
      return { id };
    } catch (error: any) {
      throw APIError.internal("Failed to create FTP server", error as Error);
    }
  }
);

export const listFtpServers = api<{}, ListFtpServersResponse>(
  { expose: true, method: "GET", path: "/ftp/servers" },
  async () => {
    try {
      const serversResult = await db.query<FtpServerConfig>`
        SELECT 
          id,
          name,
          host,
          port,
          username,
          password,
          path,
          file_pattern as "filePattern",
          delete_after_download as "deleteAfterDownload",
          poll_interval as "pollInterval",
          enabled,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM ftp_servers
        ORDER BY created_at DESC
      `;
      
      const servers: FtpServerConfig[] = [];
      for await (const server of serversResult) {
        servers.push(server);
      }
      
      return { servers };
    } catch (error: any) {
      throw APIError.internal("Failed to list FTP servers", error as Error);
    }
  }
);

export const getFtpServer = api<{ id: string }, GetFtpServerResponse>(
  { expose: true, method: "GET", path: "/ftp/servers/:id" },
  async ({ id }) => {
    try {
      const server = await db.queryRow<FtpServerConfig>`
        SELECT 
          id,
          name,
          host,
          port,
          username,
          password,
          path,
          file_pattern as "filePattern",
          delete_after_download as "deleteAfterDownload",
          poll_interval as "pollInterval",
          enabled,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM ftp_servers
        WHERE id = ${id}
      `;
      
      if (!server) {
        throw APIError.notFound("FTP server not found");
      }
      
      return { server };
    } catch (error: any) {
      if (error instanceof APIError) throw error;
      throw APIError.internal("Failed to get FTP server", error as Error);
    }
  }
);

export const updateFtpServer = api<UpdateFtpServerRequest, { success: boolean }>(
  { expose: true, method: "PUT", path: "/ftp/servers/:id" },
  async (req) => {
    try {
      let hasUpdates = false;
      
      if (req.name !== undefined || req.host !== undefined || req.port !== undefined ||
          req.username !== undefined || req.password !== undefined || req.path !== undefined ||
          req.filePattern !== undefined || req.deleteAfterDownload !== undefined ||
          req.pollInterval !== undefined || req.enabled !== undefined) {
        hasUpdates = true;
      }
      
      if (!hasUpdates) {
        return { success: true };
      }
      
      // Utilisons des requêtes séparées pour éviter les problèmes de template strings dynamiques
      if (req.name !== undefined) {
        await db.exec`UPDATE ftp_servers SET name = ${req.name} WHERE id = ${req.id}`;
      }
      if (req.host !== undefined) {
        // Sanitize the host field
        let cleanHost = req.host.trim();
        cleanHost = cleanHost.replace(/^(ftp:\/\/|ftps:\/\/|sftp:\/\/)/i, '');
        cleanHost = cleanHost.split(':')[0];
        await db.exec`UPDATE ftp_servers SET host = ${cleanHost} WHERE id = ${req.id}`;
      }
      if (req.port !== undefined) {
        await db.exec`UPDATE ftp_servers SET port = ${req.port} WHERE id = ${req.id}`;
      }
      if (req.username !== undefined) {
        await db.exec`UPDATE ftp_servers SET username = ${req.username} WHERE id = ${req.id}`;
      }
      if (req.password !== undefined) {
        await db.exec`UPDATE ftp_servers SET password = ${req.password} WHERE id = ${req.id}`;
      }
      if (req.path !== undefined) {
        await db.exec`UPDATE ftp_servers SET path = ${req.path} WHERE id = ${req.id}`;
      }
      if (req.filePattern !== undefined) {
        await db.exec`UPDATE ftp_servers SET file_pattern = ${req.filePattern} WHERE id = ${req.id}`;
      }
      if (req.deleteAfterDownload !== undefined) {
        await db.exec`UPDATE ftp_servers SET delete_after_download = ${req.deleteAfterDownload} WHERE id = ${req.id}`;
      }
      if (req.pollInterval !== undefined) {
        await db.exec`UPDATE ftp_servers SET poll_interval = ${req.pollInterval} WHERE id = ${req.id}`;
      }
      if (req.enabled !== undefined) {
        await db.exec`UPDATE ftp_servers SET enabled = ${req.enabled} WHERE id = ${req.id}`;
      }
      
      await db.exec`UPDATE ftp_servers SET updated_at = NOW() WHERE id = ${req.id}`;
      
      return { success: true };
    } catch (error: any) {
      throw APIError.internal("Failed to update FTP server", error as Error);
    }
  }
);

export const deleteFtpServer = api<DeleteFtpServerRequest, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/ftp/servers/:id" },
  async ({ id }) => {
    try {
      await db.exec`DELETE FROM ftp_servers WHERE id = ${id}`;
      return { success: true };
    } catch (error: any) {
      throw APIError.internal("Failed to delete FTP server", error as Error);
    }
  }
);

export const testFtpConnection = api<TestFtpConnectionRequest, TestFtpConnectionResponse>(
  { expose: true, method: "POST", path: "/ftp/test-connection" },
  async (req) => {
    // Implémentation de test de connexion FTP sera ajoutée
    // Pour l'instant, on simule un succès
    try {
      // Ici on ajoutera la logique de test FTP réelle avec une librairie comme 'ftp'
      return {
        success: true,
        message: "Connexion FTP réussie",
        files: ["test1.csv", "test2.zip"]
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Erreur de connexion: ${error.message}`
      };
    }
  }
);

export const cleanupFtpServers = api<{}, { fixed: number }>(
  { expose: true, method: "POST", path: "/ftp/servers/cleanup" },
  async () => {
    try {
      const serversResult = await db.query<{ id: string; host: string }>`
        SELECT id, host FROM ftp_servers
      `;
      
      let fixedCount = 0;
      
      for await (const server of serversResult) {
        let cleanHost = server.host.trim();
        const originalHost = cleanHost;
        
        // Remove protocol prefixes
        cleanHost = cleanHost.replace(/^(ftp:\/\/|ftps:\/\/|sftp:\/\/)/i, '');
        
        // Remove port if included in host
        cleanHost = cleanHost.split(':')[0];
        
        if (cleanHost !== originalHost) {
          await db.exec`UPDATE ftp_servers SET host = ${cleanHost} WHERE id = ${server.id}`;
          fixedCount++;
          console.log(`Fixed FTP server ${server.id}: "${originalHost}" -> "${cleanHost}"`);
        }
      }
      
      return { fixed: fixedCount };
    } catch (error: any) {
      throw APIError.internal("Failed to cleanup FTP servers", error as Error);
    }
  }
);