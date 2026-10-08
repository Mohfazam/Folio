import type { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { callQueue, calls, campaigns, clients, contacts, followUps, knowledgeBaseEntries } from "@repo/db";

type TenantResource =
  | "callQueue"
  | "calls"
  | "campaigns"
  | "clients"
  | "contacts"
  | "followUps"
  | "knowledgeBaseEntries";

export function requireOwnedResource(resource: TenantResource) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id;
    const clientId = req.clientId;
    if (!id || !clientId) {
      return res.status(404).json({ ok: false, error: "Resource not found" });
    }

    try {
      let owned = false;
      switch (resource) {
        case "callQueue":
          owned = (await db.select({ id: callQueue.id }).from(callQueue)
            .where(and(eq(callQueue.id, id), eq(callQueue.clientId, clientId))).limit(1)).length > 0;
          break;
        case "calls":
          owned = (await db.select({ id: calls.id }).from(calls)
            .where(and(eq(calls.id, id), eq(calls.clientId, clientId))).limit(1)).length > 0;
          break;
        case "campaigns":
          owned = (await db.select({ id: campaigns.id }).from(campaigns)
            .where(and(eq(campaigns.id, id), eq(campaigns.clientId, clientId))).limit(1)).length > 0;
          break;
        case "clients":
          owned = id === clientId;
          break;
        case "contacts":
          owned = (await db.select({ id: contacts.id }).from(contacts)
            .where(and(eq(contacts.id, id), eq(contacts.clientId, clientId))).limit(1)).length > 0;
          break;
        case "followUps":
          owned = (await db.select({ id: followUps.id }).from(followUps)
            .where(and(eq(followUps.id, id), eq(followUps.clientId, clientId))).limit(1)).length > 0;
          break;
        case "knowledgeBaseEntries":
          owned = (await db.select({ id: knowledgeBaseEntries.id }).from(knowledgeBaseEntries)
            .where(and(eq(knowledgeBaseEntries.id, id), eq(knowledgeBaseEntries.clientId, clientId))).limit(1)).length > 0;
          break;
      }

      if (!owned) {
        return res.status(404).json({ ok: false, error: "Resource not found" });
      }
      return next();
    } catch (err: unknown) {
      return next(err);
    }
  };
}
