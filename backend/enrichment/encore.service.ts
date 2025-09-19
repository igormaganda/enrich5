import { Service } from "encore.dev/service";

export default new Service("enrichment");

// Import all endpoints
export * from "./process";
export * from "./background_processor";
export * from "./complete_workflow";
export * from "./blacklist_management";
export * from "./blacklist_mobile";
