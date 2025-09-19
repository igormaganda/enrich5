import { Service } from "encore.dev/service";

export default new Service("settings");

// Import all endpoints
export * from "./settings";
export * from "./contacts";
export * from "./contact_mapping";