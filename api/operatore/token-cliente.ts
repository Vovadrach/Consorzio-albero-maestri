import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generaToken, hashToken, verificaOperatore } from "../../server/auth";
import { db } from "../../server/db";

/** POST (auth operatore): genera un magic-link token per un cliente. Ritorna il token in chiaro UNA volta. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ errore: "metodo non consentito" });
  if (!verificaOperatore(req)) return res.status(401).json({ errore: "non autorizzato" });
  const sql = db();
  if (!sql) return res.status(503).json({ errore: "DB non configurato" });

  const clienteId = String(req.body?.clienteId ?? "").trim();
  if (!clienteId) return res.status(400).json({ errore: "clienteId mancante" });

  const token = generaToken();
  await sql`insert into client_tokens (token_hash, cliente_id) values (${hashToken(token)}, ${clienteId})`;
  return res.status(200).json({ token });
}
