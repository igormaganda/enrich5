import { Service } from "encore.dev/service";

export default new Service("scheduler");

// Export all endpoints
export * from "./ftp_cron";