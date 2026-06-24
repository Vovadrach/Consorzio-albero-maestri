import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verificaOperatore } from "../../server/auth";
import { db } from "../../server/db";

/*
  Riconciliazione (auth operatore):
  GET  → pagamenti segnalati dai clienti, ancora in attesa.
  POST { id } → marca la segnalazione come riconciliata (l'incasso reale lo fa
  l'app operatore col motore conti: il registro pagamenti resta sotto controllo).
*/
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verificaOperatore(req)) return res.status(401).json({ errore: "non autorizzato" });
  const sql = db();
  if (!sql) return res.status(503).json({ errore: "DB non configurato" });

  if (req.method === "GET") {
    const rows = await sql`
      select id, cliente_id, lavoro_id, segnalato_il
      from segnalazioni_pagamento
      where not riconciliato
      order by segnalato_il`;
    return res.status(200).json(rows);
  }

  if (req.method === "POST") {
    const id = String((req.body as { id?: unknown } | undefined)?.id ?? "");
    if (!id) return res.status(400).json({ errore: "id mancante" });
    await sql`update segnalazioni_pagamento set riconciliato = true where id = ${id}`;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ errore: "metodo non consentito" });
}
