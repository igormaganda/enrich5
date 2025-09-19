import { Service } from "encore.dev/service";

export default new Service("auth");

// Export all endpoints
export * from "./login";
