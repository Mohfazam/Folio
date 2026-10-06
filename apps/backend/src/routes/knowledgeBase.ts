import type { Request, Response } from "express";
import { eq, and, desc, sql, or, like } from "drizzle-orm";
import { db } from "../config/db.js";
import { knowledgeBaseEntries } from "@repo/db";

const VALID_KB_TYPES = [
  "faq",
  "course_info",
  "fee",
  "deadline",
  "policy",
  "document",
] as const;
type KbEntryType = (typeof VALID_KB_TYPES)[number];

/**
 * GET /api/knowledge-base
 *
 * List knowledge base entries with optional filtering by type, active status, search keyword, and pagination.
 */
export async function getKnowledgeBaseRoute(req: Request, res: Response) {
  try {
    const { clientId, type, isActive, search, limit, offset } = req.query as {
      clientId?: string;
      type?: string;
      isActive?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };

    if (!clientId) {
      return res.status(400).json({ ok: false, error: "clientId is required" });
    }

    const take = Math.min(Math.max(parseInt(limit || "50", 10) || 50, 1), 100);
    const skip = Math.max(parseInt(offset || "0", 10) || 0, 0);

    const conditions = [eq(knowledgeBaseEntries.clientId, clientId)];

    if (type && VALID_KB_TYPES.includes(type as KbEntryType)) {
      conditions.push(eq(knowledgeBaseEntries.type, type as KbEntryType));
    }

    if (isActive !== undefined) {
      conditions.push(eq(knowledgeBaseEntries.isActive, isActive === "true"));
    }

    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`;
      const searchOr = or(
        like(knowledgeBaseEntries.question, pattern),
        like(knowledgeBaseEntries.content, pattern)
      );
      if (searchOr) conditions.push(searchOr);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select()
      .from(knowledgeBaseEntries)
      .where(whereClause)
      .orderBy(desc(knowledgeBaseEntries.updatedAt))
      .limit(take)
      .offset(skip);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(knowledgeBaseEntries)
      .where(whereClause);

    const total = countResult?.total ?? items.length;

    return res.json({
      ok: true,
      entries: items,
      total,
      limit: take,
      offset: skip,
    });
  } catch (err: unknown) {
    console.error("[knowledge-base/get] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * GET /api/knowledge-base/:id
 *
 * Detailed single KB entry.
 */
export async function getKnowledgeBaseEntryByIdRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "KB Entry ID is required" });
    }

    const [entry] = await db
      .select()
      .from(knowledgeBaseEntries)
      .where(eq(knowledgeBaseEntries.id, id))
      .limit(1);

    if (!entry) {
      return res.status(404).json({ ok: false, error: `Knowledge base entry ${id} not found` });
    }

    return res.json({
      ok: true,
      entry,
    });
  } catch (err: unknown) {
    console.error("[knowledge-base/getById] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * POST /api/knowledge-base
 *
 * Create a new KB entry.
 */
export async function createKnowledgeBaseEntryRoute(req: Request, res: Response) {
  try {
    const {
      clientId,
      type = "faq",
      question,
      content,
      isActive = true,
    } = req.body as {
      clientId?: string;
      type?: string;
      question?: string;
      content?: string;
      isActive?: boolean;
    };

    if (!clientId || !content) {
      return res.status(400).json({
        ok: false,
        error: "clientId and content are required",
      });
    }

    const validatedType = VALID_KB_TYPES.includes(type as KbEntryType)
      ? (type as KbEntryType)
      : "faq";

    const [newEntry] = await db
      .insert(knowledgeBaseEntries)
      .values({
        clientId,
        type: validatedType,
        question: question ?? null,
        content,
        version: 1,
        isActive,
      })
      .returning();

    return res.status(201).json({
      ok: true,
      entry: newEntry,
    });
  } catch (err: unknown) {
    console.error("[knowledge-base/create] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * PATCH /api/knowledge-base/:id
 *
 * Update a KB entry and automatically increment version.
 */
export async function updateKnowledgeBaseEntryRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "KB Entry ID is required" });
    }

    const { type, question, content, isActive } = req.body as {
      type?: string;
      question?: string;
      content?: string;
      isActive?: boolean;
    };

    const updateData: Partial<typeof knowledgeBaseEntries.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (type && VALID_KB_TYPES.includes(type as KbEntryType)) {
      updateData.type = type as KbEntryType;
    }

    if (question !== undefined) {
      updateData.question = question;
    }

    if (content !== undefined) {
      updateData.content = content;
      updateData.version = sql`${knowledgeBaseEntries.version} + 1` as any;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const [updated] = await db
      .update(knowledgeBaseEntries)
      .set(updateData)
      .where(eq(knowledgeBaseEntries.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ ok: false, error: `Knowledge base entry ${id} not found` });
    }

    return res.json({ ok: true, entry: updated });
  } catch (err: unknown) {
    console.error("[knowledge-base/patch] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * DELETE /api/knowledge-base/:id
 *
 * Delete a KB entry.
 */
export async function deleteKnowledgeBaseEntryRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "KB Entry ID is required" });
    }

    const [deleted] = await db
      .delete(knowledgeBaseEntries)
      .where(eq(knowledgeBaseEntries.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ ok: false, error: `Knowledge base entry ${id} not found` });
    }

    return res.json({ ok: true, message: `Knowledge base entry ${id} deleted` });
  } catch (err: unknown) {
    console.error("[knowledge-base/delete] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
