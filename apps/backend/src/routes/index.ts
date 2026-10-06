import type { Express } from "express";
import {
  getContactsRoute,
  getContactByIdRoute,
  bulkContactsRoute,
  updateContactRoute,
  deleteContactRoute,
} from "./contacts.js";
import { getQueueRoute, enqueueRoute, updateQueueRoute, deleteQueueRoute } from "./queue.js";
import { processQueueRoute } from "./process.js";
import { callCompleteRoute, getCallsRoute, getCallByIdRoute } from "./calls.js";
import {
  getFollowUpsRoute,
  createFollowUpRoute,
  updateFollowUpRoute,
  deleteFollowUpRoute,
} from "./followUps.js";
import {
  getCampaignsRoute,
  getCampaignByIdRoute,
  createCampaignRoute,
  updateCampaignRoute,
  deleteCampaignRoute,
} from "./campaigns.js";
import { getBusinessProfileRoute, upsertBusinessProfileRoute } from "./businessProfile.js";
import {
  getKnowledgeBaseRoute,
  getKnowledgeBaseEntryByIdRoute,
  createKnowledgeBaseEntryRoute,
  updateKnowledgeBaseEntryRoute,
  deleteKnowledgeBaseEntryRoute,
} from "./knowledgeBase.js";
import { getClientsRoute, getClientByIdRoute, updateClientRoute } from "./clients.js";
import { syncAuthUserRoute, getAuthMeRoute, updateAuthPhoneRoute } from "./auth.js";

export function registerRoutes(app: Express) {
  // ── Contacts ────────────────────────────────────────────────────────
  app.get("/api/contacts", getContactsRoute);
  app.get("/api/contacts/:id", getContactByIdRoute);
  app.post("/api/contacts/bulk", bulkContactsRoute);
  app.patch("/api/contacts/:id", updateContactRoute);
  app.delete("/api/contacts/:id", deleteContactRoute);

  // ── Call Queue ──────────────────────────────────────────────────────
  app.get("/api/queue", getQueueRoute);
  app.post("/api/queue/enqueue", enqueueRoute);
  app.patch("/api/queue/:id", updateQueueRoute);
  app.delete("/api/queue/:id", deleteQueueRoute);
  app.post("/api/queue/process", processQueueRoute);

  // ── Calls & Logs ────────────────────────────────────────────────────
  app.get("/api/calls", getCallsRoute);
  app.get("/api/calls/:id", getCallByIdRoute);
  app.post("/api/calls/complete", callCompleteRoute);

  // ── Follow-Ups ──────────────────────────────────────────────────────
  app.get("/api/follow-ups", getFollowUpsRoute);
  app.post("/api/follow-ups", createFollowUpRoute);
  app.patch("/api/follow-ups/:id", updateFollowUpRoute);
  app.delete("/api/follow-ups/:id", deleteFollowUpRoute);

  // ── Campaigns ───────────────────────────────────────────────────────
  app.get("/api/campaigns", getCampaignsRoute);
  app.get("/api/campaigns/:id", getCampaignByIdRoute);
  app.post("/api/campaigns", createCampaignRoute);
  app.patch("/api/campaigns/:id", updateCampaignRoute);
  app.delete("/api/campaigns/:id", deleteCampaignRoute);

  // ── Business Profile ────────────────────────────────────────────────
  app.get("/api/business-profile", getBusinessProfileRoute);
  app.post("/api/business-profile", upsertBusinessProfileRoute);
  app.put("/api/business-profile", upsertBusinessProfileRoute);

  // ── Knowledge Base ──────────────────────────────────────────────────
  app.get("/api/knowledge-base", getKnowledgeBaseRoute);
  app.get("/api/knowledge-base/:id", getKnowledgeBaseEntryByIdRoute);
  app.post("/api/knowledge-base", createKnowledgeBaseEntryRoute);
  app.patch("/api/knowledge-base/:id", updateKnowledgeBaseEntryRoute);
  app.delete("/api/knowledge-base/:id", deleteKnowledgeBaseEntryRoute);

  // ── Clients ─────────────────────────────────────────────────────────
  app.get("/api/clients", getClientsRoute);
  app.get("/api/clients/:id", getClientByIdRoute);
  app.patch("/api/clients/:id", updateClientRoute);

  // ── Health Check ────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });
}
