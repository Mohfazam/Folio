import type { Request, Response } from "express";
import { eq, and, desc, sql, or, like, inArray } from "drizzle-orm";
import { db } from "../config/db.js";
import { contacts, uploadBatches, callQueue, campaigns } from "@repo/db";
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
      status,
      search,
      lifecycleStage,
      accountTier,
      uploadBatchId,
      limit,
      offset,
    } = req.query as {
      status?: string;
      search?: string;
      lifecycleStage?: string;
      accountTier?: string;
      uploadBatchId?: string;
      limit?: string;
      offset?: string;
    };

    const clientId = req.clientId!;

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
      .where(and(eq(contacts.id, id), eq(contacts.clientId, req.clientId!)))
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
      label,
      autoEnqueue,
      campaignId,
      scheduledFor,
      contacts: contactRows,
    } = req.body as {
      label?: string;
      autoEnqueue?: boolean;
      campaignId?: string;
      scheduledFor?: string;
      contacts?: Record<string, unknown>[];
    };

    const clientId = req.clientId!;

    if (!Array.isArray(contactRows) || contactRows.length === 0) {
      return res.status(400).json({ ok: false, error: "contacts array is required and must be non-empty" });
    }

    if (contactRows.length > 500) {
      return res.status(413).json({ ok: false, error: "A bulk import may contain at most 500 contacts" });
    }

    if (autoEnqueue) {
      if (!campaignId) {
        return res.status(400).json({ ok: false, error: "An active campaignId is required to enqueue imported contacts" });
      }
      const [campaign] = await db
        .select({ id: campaigns.id, status: campaigns.status })
        .from(campaigns)
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.clientId, clientId)))
        .limit(1);
      if (!campaign || campaign.status !== "active") {
        return res.status(400).json({ ok: false, error: "Contacts can only be auto-enqueued for an active workspace campaign" });
      }
    }

    const scheduleDate = scheduledFor ? new Date(scheduledFor) : new Date();
    if (autoEnqueue && Number.isNaN(scheduleDate.getTime())) {
      return res.status(400).json({ ok: false, error: "scheduledFor must be a valid date" });
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
    const insertedContacts: { id: string; fullName: string | null; phoneNumber: string; optOut: boolean; index: number }[] = [];
    const normalizedPhones = contactRows.map((row) =>
      normalizePhoneNumber(String(row.phoneNumber || row.phone || row.phoneNumberRaw || "")),
    );
    const phoneCandidates = [...new Set(normalizedPhones.filter((phone) => /^\+\d{7,15}$/.test(phone)))];
    const existingPhones = phoneCandidates.length
      ? await db
          .select({ phoneNumber: contacts.phoneNumber })
          .from(contacts)
          .where(and(eq(contacts.clientId, clientId), inArray(contacts.phoneNumber, phoneCandidates)))
      : [];
    const seenPhones = new Set(existingPhones.map((contact) => contact.phoneNumber));
    let duplicateRows = 0;

    for (let i = 0; i < contactRows.length; i++) {
      const row = contactRows[i]!;
      try {
        const rawPhone = String(row.phoneNumber || row.phone || row.phoneNumberRaw || "");
        const normalizedPhone = normalizedPhones[i]!;

        if (!/^\+\d{7,15}$/.test(normalizedPhone)) {
          throw new Error("A valid phone number is required (E.164 format, or a 10-digit Indian number)");
        }
        if (seenPhones.has(normalizedPhone)) {
          duplicateRows++;
          failedRows.push({ index: i, error: "Duplicate phone number in this workspace" });
          continue;
        }
        seenPhones.add(normalizedPhone);

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
            optOut: row.optOut === true,
            status: row.optOut === true ? "do_not_call" : "pending",
          })
          .returning({ id: contacts.id, fullName: contacts.fullName, phoneNumber: contacts.phoneNumber });

        if (newContact) {
          insertedContacts.push({ ...newContact, optOut: row.optOut === true, index: i });
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
        duplicateRows,
        totalRows: contactRows.length,
      })
      .where(eq(uploadBatches.id, batch.id));

    // 4. Auto-enqueue if requested
    let enqueuedCount = 0;
    const enqueueFailures: { index: number; error: string }[] = [];
    if (autoEnqueue && insertedContacts.length > 0) {
      for (const c of insertedContacts.filter((contact) => !contact.optOut)) {
        try {
          await db.transaction(async (tx) => {
            await tx.insert(callQueue).values({
              contactId: c.id,
              clientId,
              campaignId,
              contactName: c.fullName,
              phoneNumber: c.phoneNumber,
              scheduledFor: scheduleDate,
              attemptNumber: 1,
              status: "pending",
              maxAttempts: 2,
              priority: 0,
            });
            await tx.update(contacts)
              .set({ status: "queued", updatedAt: new Date() })
              .where(and(eq(contacts.id, c.id), eq(contacts.clientId, clientId)));
          });
          enqueuedCount++;
        } catch (enqueueErr: unknown) {
          console.error("[contacts/bulk] Auto-enqueue error for contact:", c.id, enqueueErr);
          enqueueFailures.push({
            index: c.index,
            error: enqueueErr instanceof Error ? enqueueErr.message : "Failed to enqueue contact",
          });
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
      enqueueFailed: enqueueFailures.length,
      duplicates: duplicateRows,
      failedRows: failedRows.length > 0 ? failedRows : undefined,
      enqueueFailures: enqueueFailures.length > 0 ? enqueueFailures : undefined,
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
      optOut: boolean;
    }>;

    const updateData: Partial<typeof contacts.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (fullName !== undefined) updateData.fullName = fullName;
    if (secondaryName !== undefined) updateData.secondaryName = secondaryName;
    if (phoneNumber !== undefined) {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!/^\+\d{7,15}$/.test(normalizedPhone)) {
        return res.status(400).json({ ok: false, error: "A valid phone number is required" });
      }
      updateData.phoneNumber = normalizedPhone;
    }
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
    if (optOut === false) {
      return res.status(400).json({ ok: false, error: "An opt-out cannot be reversed through contact editing" });
    }
    if (optOut === true) {
      updateData.optOut = true;
      updateData.status = "do_not_call";
    }

    const [updated] = await db
      .update(contacts)
      .set(updateData)
      .where(and(eq(contacts.id, id), eq(contacts.clientId, req.clientId!)))
      .returning();

    if (!updated) {
      return res.status(404).json({ ok: false, error: `Contact ${id} not found` });
    }

    if (optOut === true) {
      await db
        .update(callQueue)
        .set({ status: "failed", updatedAt: new Date() })
        .where(and(
          eq(callQueue.contactId, id),
          eq(callQueue.clientId, req.clientId!),
          eq(callQueue.status, "pending"),
        ));
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
      .where(and(eq(contacts.id, id), eq(contacts.clientId, req.clientId!)))
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
