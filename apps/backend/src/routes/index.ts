import { Router, type Express } from "express";
import {
  requireAuth,
  requireClientAdmin,
  requireWebhookSecret,
  requireWorkerSecret,
  requireWorkspace,
} from "../middleware/auth.js";
import { requireOwnedResource } from "../middleware/tenant.js";
import { authRateLimiter, uploadRateLimiter } from "../middleware/rateLimiters.js";
import { getLivenessRoute, getReadinessRoute } from "./health.js";
import { getAnalyticsOverviewRoute } from "./analytics.js";
import { syncAuthUserRoute, getAuthMeRoute, updateAuthPhoneRoute } from "./auth.js";
import { getBusinessProfileRoute, upsertBusinessProfileRoute } from "./businessProfile.js";
import { getCallsRoute, getCallByIdRoute, callCompleteRoute } from "./calls.js";
import { getCampaignsRoute, getCampaignByIdRoute, createCampaignRoute, updateCampaignRoute, deleteCampaignRoute } from "./campaigns.js";
import { getClientByIdRoute, getClientsRoute, updateClientRoute } from "./clients.js";
import { bulkContactsRoute, deleteContactRoute, getContactByIdRoute, getContactsRoute, updateContactRoute } from "./contacts.js";
import { contactImportUpload, importContactsFileRoute } from "./contactImport.js";
import { createFollowUpRoute, deleteFollowUpRoute, getFollowUpsRoute, updateFollowUpRoute } from "./followUps.js";
import {
  createKnowledgeBaseEntryRoute,
  deleteKnowledgeBaseEntryRoute,
  getKnowledgeBaseEntryByIdRoute,
  getKnowledgeBaseRoute,
  updateKnowledgeBaseEntryRoute,
} from "./knowledgeBase.js";
import { deleteQueueRoute, enqueueRoute, getQueueRoute, updateQueueRoute } from "./queue.js";
import { processQueueRoute } from "./process.js";

export function registerRoutes(app: Express) {
  // Liveness & Readiness endpoints (unauthenticated, probe-friendly)
  app.get("/health", getLivenessRoute);
  app.get("/health/live", getLivenessRoute);
  app.get("/health/ready", getReadinessRoute);

  const api = Router();

  // Rate-limited Auth endpoints (Firebase session validation)
  api.post("/auth/sync", authRateLimiter, requireAuth, syncAuthUserRoute);
  api.get("/auth/me", authRateLimiter, requireAuth, getAuthMeRoute);
  api.patch("/auth/phone", authRateLimiter, requireAuth, updateAuthPhoneRoute);

  // Machine-to-machine service endpoints
  api.post("/calls/complete", requireWebhookSecret, callCompleteRoute);
  api.post("/queue/process", requireWorkerSecret, processQueueRoute);

  // All other API routes require a provisioned user and are scoped to that user's workspace.
  api.use(requireAuth, requireWorkspace);

  api.get("/analytics/overview", getAnalyticsOverviewRoute);

  api.get("/contacts", getContactsRoute);
  api.get("/contacts/:id", requireOwnedResource("contacts"), getContactByIdRoute);
  api.post("/contacts/bulk", requireClientAdmin, uploadRateLimiter, bulkContactsRoute);
  api.post("/contacts/import", requireClientAdmin, uploadRateLimiter, contactImportUpload, importContactsFileRoute);
  api.patch("/contacts/:id", requireClientAdmin, requireOwnedResource("contacts"), updateContactRoute);
  api.delete("/contacts/:id", requireClientAdmin, requireOwnedResource("contacts"), deleteContactRoute);

  api.get("/queue", getQueueRoute);
  api.post("/queue/enqueue", requireClientAdmin, enqueueRoute);
  api.patch("/queue/:id", requireClientAdmin, requireOwnedResource("callQueue"), updateQueueRoute);
  api.delete("/queue/:id", requireClientAdmin, requireOwnedResource("callQueue"), deleteQueueRoute);

  api.get("/calls", getCallsRoute);
  api.get("/calls/:id", requireOwnedResource("calls"), getCallByIdRoute);

  api.get("/follow-ups", getFollowUpsRoute);
  api.post("/follow-ups", requireClientAdmin, createFollowUpRoute);
  api.patch("/follow-ups/:id", requireClientAdmin, requireOwnedResource("followUps"), updateFollowUpRoute);
  api.delete("/follow-ups/:id", requireClientAdmin, requireOwnedResource("followUps"), deleteFollowUpRoute);

  api.get("/campaigns", getCampaignsRoute);
  api.get("/campaigns/:id", requireOwnedResource("campaigns"), getCampaignByIdRoute);
  api.post("/campaigns", requireClientAdmin, createCampaignRoute);
  api.patch("/campaigns/:id", requireClientAdmin, requireOwnedResource("campaigns"), updateCampaignRoute);
  api.delete("/campaigns/:id", requireClientAdmin, requireOwnedResource("campaigns"), deleteCampaignRoute);

  api.get("/business-profile", getBusinessProfileRoute);
  api.post("/business-profile", requireClientAdmin, upsertBusinessProfileRoute);
  api.put("/business-profile", requireClientAdmin, upsertBusinessProfileRoute);

  api.get("/knowledge-base", getKnowledgeBaseRoute);
  api.get("/knowledge-base/:id", requireOwnedResource("knowledgeBaseEntries"), getKnowledgeBaseEntryByIdRoute);
  api.post("/knowledge-base", requireClientAdmin, createKnowledgeBaseEntryRoute);
  api.patch("/knowledge-base/:id", requireClientAdmin, requireOwnedResource("knowledgeBaseEntries"), updateKnowledgeBaseEntryRoute);
  api.delete("/knowledge-base/:id", requireClientAdmin, requireOwnedResource("knowledgeBaseEntries"), deleteKnowledgeBaseEntryRoute);

  api.get("/clients", getClientsRoute);
  api.get("/clients/:id", requireOwnedResource("clients"), getClientByIdRoute);
  api.patch("/clients/:id", requireClientAdmin, requireOwnedResource("clients"), updateClientRoute);

  app.use("/api", api);
}
