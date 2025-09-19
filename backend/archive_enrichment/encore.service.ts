import { Service } from "encore.dev/service";

export default new Service("archive_enrichment");

// Export all endpoints
export * from "./upload_archive";
export * from "./status";
export * from "./download";