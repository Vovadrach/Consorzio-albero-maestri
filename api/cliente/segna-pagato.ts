import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clienteDaToken } from "../../server/auth";
import { db } from "../../server/db";

/*
  POST ?token=… { lavoroId } : il cliente SEGNALA un pagamento (non è un fatto di cassa).
  Finisce in segnalazioni_pagamento; l'operatore lo riconcilia (E4). Ownership verificata.
*/
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ errore: "metodo non consentito" });
  const sql = db();
  if (!sql) return res.status(503).json({ errore: "DB non configurato" });

  const t = req.query.token;
  const token = (Array.isArray(t) ? t[0] : t) ?? "";
  const clienteId = await clienteDaToken(sql, token);
  if (!clienteId) return res.status(401).json({ errore: "token non valido" });

  const lavoroId = String((req.body as { lavoroId?: unknown } | undefined)?.lavoroId ?? "");
  if (!lavoroId) return res.status(400).json({ errore: "lavoroId mancante" });

  // Ownership: il lavoro deve appartenere a QUESTO cliente.
  const rows = await sql<{ id: string }[]>`
    select id from lavori
    where id = ${lavoroId} and data->>'clienteId' = ${clienteId} and not deleted
    limit 1`;
  if (!rows.length) return res.status(403).json({ errore: "lavoro non tuo" });

  await sql`insert into segnalazioni_pagamento (id, cliente_id, lavoro_id) values (${randomUUID()}, ${clienteId}, ${lavoroId})`;
  return res.status(200).json({ ok: true });
}
