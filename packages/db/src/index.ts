export * from "./schema.js";
export type UserSelect = typeof import("./schema.js").users.$inferSelect;
export type UserInsert = typeof import("./schema.js").users.$inferInsert;
export type ClientSelect = typeof import("./schema.js").clients.$inferSelect;
export type ClientInsert = typeof import("./schema.js").clients.$inferInsert;

export type MessageTemplateSelect = typeof import("./schema.js").messageTemplates.$inferSelect;
export type MessageTemplateInsert = typeof import("./schema.js").messageTemplates.$inferInsert;

export type MessageThreadSelect = typeof import("./schema.js").messageThreads.$inferSelect;
export type MessageThreadInsert = typeof import("./schema.js").messageThreads.$inferInsert;

export type MessageSelect = typeof import("./schema.js").messages.$inferSelect;
export type MessageInsert = typeof import("./schema.js").messages.$inferInsert;

export type MessageDeliveryReceiptSelect = typeof import("./schema.js").messageDeliveryReceipts.$inferSelect;
export type MessageDeliveryReceiptInsert = typeof import("./schema.js").messageDeliveryReceipts.$inferInsert;

export type MessageOptOutSelect = typeof import("./schema.js").messageOptOuts.$inferSelect;
export type MessageOptOutInsert = typeof import("./schema.js").messageOptOuts.$inferInsert;
