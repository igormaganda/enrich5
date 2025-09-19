import { Service } from "encore.dev/service";

export default new Service("ftp");

// Export all API endpoints
export * from "./servers";
export * from "./scanner";
export * from "./scan_logs";
export * from "./background_jobs";
export * from "./processed_files";