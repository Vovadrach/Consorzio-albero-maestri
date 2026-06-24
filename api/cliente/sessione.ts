import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clienteDaToken } from "../../server/auth";
import { db } from "../../server/db";

/** GET ?token=… : valida il magic-link e ritorna il clienteId (bootstrap della vista cliente). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = db();
  if (!sql) return res.status(503).json({ errore: "DB non configurato" });

  const t = req.query.token;
  const token = (Array.isArray(t) ? t[0] : t) ?? "";
  const clienteId = await clienteDaToken(sql, token);
  if (!clienteId) return res.status(401).json({ errore: "token non valido" });
  return res.status(200).json({ clienteId });
}
