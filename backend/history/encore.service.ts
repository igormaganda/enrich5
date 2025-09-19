import { Service } from "encore.dev/service";

export default new Service("history");

// Import all endpoints
export * from "./list";
export * from "./actions";
