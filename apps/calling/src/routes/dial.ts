import type { Request, Response } from "express";
import { dialTestCall } from "../providers/plivo/dial.js";

export async function dialRoute(_req: Request, res: Response) {
  try {
    const call = await dialTestCall();
    res.json({ ok: true, call });
  } catch (err) {
    console.error("Dial failed:", err);
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Dial failed",
    });
  }
}
