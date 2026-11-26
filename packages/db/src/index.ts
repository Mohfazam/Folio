export * from "./schema.js";
export type UserSelect = typeof import("./schema.js").users.$inferSelect;
export type UserInsert = typeof import("./schema.js").users.$inferInsert;
export type ClientSelect = typeof import("./schema.js").clients.$inferSelect;
export type ClientInsert = typeof import("./schema.js").clients.$inferInsert;
