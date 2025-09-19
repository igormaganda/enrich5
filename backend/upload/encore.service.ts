import { Service } from "encore.dev/service";

export default new Service("upload");

// Import all endpoints
export * from "./upload";
export * from "./mapping";
export * from "./upload_with_mapping";
