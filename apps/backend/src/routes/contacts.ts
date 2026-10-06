import type { Request, Response } from "express";
import { eq, and, desc, sql, or, like } from "drizzle-orm";
import { db } from "../config/db.js";
import { contacts, uploadBatches, callQueue, clients } from "@repo/db";
import { processNextEligibleCall } from "../worker/processQueue.js";

/**
 * Sanitizes and normalizes phone numbers.
 */
function normalizePhoneNumber(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.trim().replace(/[^\d+]/g, "");
  // If it's a 10-digit Indian number without country code, add +91
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = `+91${cleaned}`;
  } else if (!cleaned.startsWith("+") && cleaned.length > 10) {
    cleaned = `+${cleaned}`;
  }
  return cleaned;
}

/**
 * GET /api/contacts
 *
 * List contacts with filtering (clientId, status, search, lifecycleStage, accountTier, uploadBatchId)
 * and pagination.
 */
export async function getContactsRoute(req: Request, res: Response) {
  try {
    const {
      clientId,
      status,
      search,
      lifecycleStage,
      accountTier,
      uploadBatchId,
      limit,
      offset,
    } = req.query as {
      clientId?: string;
      status?: string;
      search?: string;
      lifecycleStage?: string;
      accountTier?: string;
      uploadBatchId?: string;
      limit?: string;
      offset?: string;
    };

    if (!clientId) {
      return res.status(400).json({ ok: false, error: "clientId is required" });
    }

    const take = Math.min(Math.max(parseInt(limit || "50", 10) || 50, 1), 100);
    const skip = Math.max(parseInt(offset || "0", 10) || 0, 0);

    const conditions = [eq(contacts.clientId, clientId)];

    if (status) {
      conditions.push(eq(contacts.status, status as any));
    }

    if (lifecycleStage) {
      conditions.push(eq(contacts.lifecycleStage, lifecycleStage));
    }

    if (accountTier) {
      conditions.push(eq(contacts.accountTier, accountTier));
    }

    if (uploadBatchId) {
      conditions.push(eq(contacts.uploadBatchId, uploadBatchId));
    }

    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`;
      const searchOr = or(
        like(contacts.fullName, pattern),
        like(contacts.phoneNumber, pattern),
        like(contacts.email, pattern),
        like(contacts.companyName, pattern)
      );
      if (searchOr) conditions.push(searchOr);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select()
      .from(contacts)
      .where(whereClause)
      .orderBy(desc(contacts.createdAt))
      .limit(take)
      .offset(skip);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(contacts)
      .where(whereClause);

    const total = countResult?.total ?? items.length;

    return res.json({
      ok: true,
      contacts: items,
      total,
      limit: take,
      offset: skip,
    });
  } catch (err: unknown) {
    console.error("[contacts/get] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * GET /api/contacts/:id
 *
 * Detailed single contact view.
 */
export async function getContactByIdRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Contact ID is required" });
    }

    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);

    if (!contact) {
      return res.status(404).json({ ok: false, error: `Contact ${id} not found` });
    }

    return res.json({ ok: true, contact });
  } catch (err: unknown) {
    console.error("[contacts/getById] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * POST /api/contacts/bulk
 *
 * Bulk-import contacts for a client (B2B, tech, healthcare, education, general).
 */
export async function bulkContactsRoute(req: Request, res: Response) {
  try {
    const {
      clientId,
      label,
      autoEnqueue,
      campaignId,
      maxCallsPerDay,
      scheduledFor,
      contacts: contactRows,
    } = req.body as {
      clientId?: string;
      label?: string;
      autoEnqueue?: boolean;
      campaignId?: string;
      maxCallsPerDay?: number;
      scheduledFor?: string;
      contacts?: Record<string, unknown>[];
    };

    if (!clientId) {
      return res.status(400).json({ ok: false, error: "clientId is required" });
    }

    if (!Array.isArray(contactRows) || contactRows.length === 0) {
      return res.status(400).json({ ok: false, error: "contacts array is required and must be non-empty" });
    }

    // Update client maxCallsPerDay if specified
    if (typeof maxCallsPerDay === "number" && maxCallsPerDay > 0) {
      await db
        .update(clients)
        .set({ maxCallsPerDay, updatedAt: new Date() })
        .where(eq(clients.id, clientId));
    }

    // 1. Create upload batch
    const [batch] = await db
      .insert(uploadBatches)
      .values({
        clientId,
        filename: label ?? `bulk-upload-${new Date().toISOString()}`,
        totalRows: contactRows.length,
        status: "processing",
      })
      .returning();

    if (!batch) {
      return res.status(500).json({ ok: false, error: "Failed to create upload batch" });
    }

    // 2. Insert contacts
    const failedRows: { index: number; error: string }[] = [];
    const insertedContacts: { id: string; fullName: string | null; phoneNumber: string }[] = [];

    for (let i = 0; i < contactRows.length; i++) {
      const row = contactRows[i]!;
      try {
        const rawPhone = String(row.phoneNumber || row.phone || row.phoneNumberRaw || "");
        const normalizedPhone = normalizePhoneNumber(rawPhone);

        if (!normalizedPhone) {
          throw new Error("Phone number is required and cannot be empty");
        }

        const [newContact] = await db
          .insert(contacts)
          .values({
            clientId,
            uploadBatchId: batch.id,
            fullName: (row.fullName as string | undefined) ?? (row.name as string | undefined) ?? null,
            secondaryName: (row.secondaryName as string | undefined) ?? null,
            phoneNumber: normalizedPhone,
            phoneNumberRaw: rawPhone || normalizedPhone,
            email: (row.email as string | undefined) ?? null,
            
            // Enterprise & Cross-Industry Attributes
            companyName: (row.companyName as string | undefined) ?? (row.company as string | undefined) ?? null,
            jobTitle: (row.jobTitle as string | undefined) ?? (row.title as string | undefined) ?? null,
            department: (row.department as string | undefined) ?? null,
            industry: (row.industry as string | undefined) ?? null,
            city: (row.city as string | undefined) ?? null,
            state: (row.state as string | undefined) ?? null,
            country: (row.country as string | undefined) ?? null,
            timezone: (row.timezone as string | undefined) ?? null,
            leadScore: typeof row.leadScore === "number" ? row.leadScore : null,
            lifecycleStage: (row.lifecycleStage as string | undefined) ?? null,
            accountTier: (row.accountTier as string | undefined) ?? null,
            tags: Array.isArray(row.tags) ? (row.tags as string[]) : null,

            // Domain / Legacy Aliases
            parentName: (row.parentName as string | undefined) ?? null,
            studentName: (row.studentName as string | undefined) ?? null,
            courseOrStream: (row.courseOrStream as string | undefined) ?? null,

            contextData: (row.contextData as Record<string, any>) ?? {},
            customFields: (row.customFields as Record<string, any>) ?? {},
            status: autoEnqueue ? "queued" : "pending",
          })
          .returning({ id: contacts.id, fullName: contacts.fullName, phoneNumber: contacts.phoneNumber });

        if (newContact) {
          insertedContacts.push(newContact);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        failedRows.push({ index: i, error: message });
      }
    }

    // 3. Update batch counts
    await db
      .update(uploadBatches)
      .set({
        status: failedRows.length === contactRows.length ? "failed" : "completed",
        validRows: insertedContacts.length,
        invalidRows: failedRows.length,
        totalRows: contactRows.length,
      })
      .where(eq(uploadBatches.id, batch.id));

    // 4. Auto-enqueue if requested
    let enqueuedCount = 0;
    if (autoEnqueue && insertedContacts.length > 0) {
      const scheduleDate = scheduledFor ? new Date(scheduledFor) : new Date();

      for (const c of insertedContacts) {
        try {
          await db.insert(callQueue).values({
            contactId: c.id,
            clientId,
            campaignId: campaignId ?? null,
            contactName: c.fullName,
            phoneNumber: c.phoneNumber,
            scheduledFor: scheduleDate,
            attemptNumber: 1,
            status: "pending",
            maxAttempts: 2,
            priority: 0,
          });
          enqueuedCount++;
        } catch (enqueueErr) {
          console.error("[contacts/bulk] Auto-enqueue error for contact:", c.id, enqueueErr);
        }
      }

      if (enqueuedCount > 0) {
        void processNextEligibleCall().catch((err) => {
          console.error("[contacts/bulk] Worker trigger error:", err);
        });
      }
    }

    return res.status(201).json({
      ok: true,
      batchId: batch.id,
      totalReceived: contactRows.length,
      inserted: insertedContacts.length,
      autoEnqueued: autoEnqueue ? enqueuedCount : undefined,
      failed: failedRows.length,
      failedRows: failedRows.length > 0 ? failedRows : undefined,
    });
  } catch (err: unknown) {
    console.error("[contacts/bulk] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * PATCH /api/contacts/:id
 *
 * Update a contact.
 */
export async function updateContactRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Contact ID is required" });
    }

    const {
      fullName,
      secondaryName,
      phoneNumber,
      email,
      companyName,
      jobTitle,
      department,
      industry,
      city,
      state,
      country,
      timezone,
      leadScore,
      lifecycleStage,
      accountTier,
      tags,
      contextData,
      customFields,
      status,
      optOut,
    } = req.body as Partial<{
      fullName: string;
      secondaryName: string;
      phoneNumber: string;
      email: string;
      companyName: string;
      jobTitle: string;
      department: string;
      industry: string;
      city: string;
      state: string;
      country: string;
      timezone: string;
      leadScore: number;
      lifecycleStage: string;
      accountTier: string;
      tags: string[];
      contextData: Record<string, any>;
      customFields: Record<string, any>;
      status: any;
      optOut: boolean;
    }>;

    const updateData: Partial<typeof contacts.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (fullName !== undefined) updateData.fullName = fullName;
    if (secondaryName !== undefined) updateData.secondaryName = secondaryName;
    if (phoneNumber !== undefined) updateData.phoneNumber = normalizePhoneNumber(phoneNumber);
    if (email !== undefined) updateData.email = email;
    if (companyName !== undefined) updateData.companyName = companyName;
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
    if (department !== undefined) updateData.department = department;
    if (industry !== undefined) updateData.industry = industry;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (country !== undefined) updateData.country = country;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (typeof leadScore === "number") updateData.leadScore = leadScore;
    if (lifecycleStage !== undefined) updateData.lifecycleStage = lifecycleStage;
    if (accountTier !== undefined) updateData.accountTier = accountTier;
    if (tags !== undefined) updateData.tags = tags;
    if (contextData !== undefined) updateData.contextData = contextData;
    if (customFields !== undefined) updateData.customFields = customFields;
    if (status !== undefined) updateData.status = status;
    if (optOut !== undefined) updateData.optOut = optOut;

    const [updated] = await db
      .update(contacts)
      .set(updateData)
      .where(eq(contacts.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ ok: false, error: `Contact ${id} not found` });
    }

    return res.json({ ok: true, contact: updated });
  } catch (err: unknown) {
    console.error("[contacts/patch] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * DELETE /api/contacts/:id
 *
 * Delete a contact.
 */
export async function deleteContactRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Contact ID is required" });
    }

    const [deleted] = await db
      .delete(contacts)
      .where(eq(contacts.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ ok: false, error: `Contact ${id} not found` });
    }

    return res.json({ ok: true, message: `Contact ${id} deleted` });
  } catch (err: unknown) {
    console.error("[contacts/delete] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
