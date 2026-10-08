import type { Request, Response } from "express";
import { eq, and, desc, sql, or, like } from "drizzle-orm";
import { db } from "../config/db.js";
import { knowledgeBaseEntries } from "@repo/db";

const VALID_KB_TYPES = [
  "faq",
  "product_feature",
  "pricing_plan",
  "technical_spec",
  "troubleshooting",
  "integration_guide",
  "competitor_comparison",
  "case_study",
  "policy_legal",
  "document",
  "course_info",
  "fee",
  "deadline",
  "policy",
] as const;
type KbEntryType = (typeof VALID_KB_TYPES)[number];

/**
 * GET /api/knowledge-base
 *
 * List knowledge base entries with sophisticated filtering by type, category, target personas,
 * active status, search keywords, and pagination.
 */
export async function getKnowledgeBaseRoute(req: Request, res: Response) {
  try {
    const { type, category, isActive, search, limit, offset } = req.query as {
      type?: string;
      category?: string;
      isActive?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };

    const clientId = req.clientId!;

    const take = Math.min(Math.max(parseInt(limit || "50", 10) || 50, 1), 100);
    const skip = Math.max(parseInt(offset || "0", 10) || 0, 0);

    const conditions = [eq(knowledgeBaseEntries.clientId, clientId)];

    if (type && VALID_KB_TYPES.includes(type as KbEntryType)) {
      conditions.push(eq(knowledgeBaseEntries.type, type as KbEntryType));
    }

    if (category && category.trim()) {
      conditions.push(eq(knowledgeBaseEntries.category, category.trim()));
    }

    if (isActive !== undefined) {
      conditions.push(eq(knowledgeBaseEntries.isActive, isActive === "true"));
    }

    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`;
      const searchOr = or(
        like(knowledgeBaseEntries.title, pattern),
        like(knowledgeBaseEntries.question, pattern),
        like(knowledgeBaseEntries.content, pattern),
        like(knowledgeBaseEntries.category, pattern)
      );
      if (searchOr) conditions.push(searchOr);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select({
        id: knowledgeBaseEntries.id,
        clientId: knowledgeBaseEntries.clientId,
        type: knowledgeBaseEntries.type,
        title: knowledgeBaseEntries.title,
        category: knowledgeBaseEntries.category,
        question: knowledgeBaseEntries.question,
        content: knowledgeBaseEntries.content,
        tags: knowledgeBaseEntries.tags,
        metadata: knowledgeBaseEntries.metadata,
        priority: knowledgeBaseEntries.priority,
        targetPersonas: knowledgeBaseEntries.targetPersonas,
        version: knowledgeBaseEntries.version,
        isActive: knowledgeBaseEntries.isActive,
        createdAt: knowledgeBaseEntries.createdAt,
        updatedAt: knowledgeBaseEntries.updatedAt,
      })
      .from(knowledgeBaseEntries)
      .where(whereClause)
      .orderBy(desc(knowledgeBaseEntries.priority), desc(knowledgeBaseEntries.updatedAt))
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
      .where(and(eq(knowledgeBaseEntries.id, id), eq(knowledgeBaseEntries.clientId, req.clientId!)))
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
 * Create a new sophisticated KB entry (features, architecture, pricing, security specs, FAQs, etc.).
 */
export async function createKnowledgeBaseEntryRoute(req: Request, res: Response) {
  try {
    const {
      type = "product_feature",
      title,
      category,
      question,
      content,
      tags = [],
      metadata = {},
      priority = 0,
      targetPersonas = [],
      isActive = true,
    } = req.body as {
      type?: string;
      title?: string;
      category?: string;
      question?: string;
      content?: string;
      tags?: string[];
      metadata?: Record<string, any>;
      priority?: number;
      targetPersonas?: string[];
      isActive?: boolean;
    };

    if (!content) {
      return res.status(400).json({
        ok: false,
        error: "content is required",
      });
    }

    const validatedType = VALID_KB_TYPES.includes(type as KbEntryType)
      ? (type as KbEntryType)
      : "product_feature";

    const [newEntry] = await db
      .insert(knowledgeBaseEntries)
      .values({
        clientId: req.clientId!,
        type: validatedType,
        title: title ?? null,
        category: category ?? null,
        question: question ?? null,
        content,
        tags,
        metadata,
        priority: typeof priority === "number" ? priority : 0,
        targetPersonas,
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

    const {
      type,
      title,
      category,
      question,
      content,
      tags,
      metadata,
      priority,
      targetPersonas,
      isActive,
    } = req.body as Partial<{
      type: string;
      title: string;
      category: string;
      question: string;
      content: string;
      tags: string[];
      metadata: Record<string, any>;
      priority: number;
      targetPersonas: string[];
      isActive: boolean;
    }>;

    const updateData: Partial<typeof knowledgeBaseEntries.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (type && VALID_KB_TYPES.includes(type as KbEntryType)) {
      updateData.type = type as KbEntryType;
    }

    if (title !== undefined) updateData.title = title;
    if (category !== undefined) updateData.category = category;
    if (question !== undefined) updateData.question = question;
    if (tags !== undefined) updateData.tags = tags;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (priority !== undefined) updateData.priority = priority;
    if (targetPersonas !== undefined) updateData.targetPersonas = targetPersonas;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (content !== undefined) {
      updateData.content = content;
      updateData.version = sql`${knowledgeBaseEntries.version} + 1` as any;
    }

    const [updated] = await db
      .update(knowledgeBaseEntries)
      .set(updateData)
      .where(and(eq(knowledgeBaseEntries.id, id), eq(knowledgeBaseEntries.clientId, req.clientId!)))
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
      .where(and(eq(knowledgeBaseEntries.id, id), eq(knowledgeBaseEntries.clientId, req.clientId!)))
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
