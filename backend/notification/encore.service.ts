import { Service } from "encore.dev/service";

export default new Service("notification");

// Export all endpoints
export * from "./email";
export * from "./simple_email";
