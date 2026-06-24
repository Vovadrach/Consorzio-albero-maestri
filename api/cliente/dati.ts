import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clienteDaToken } from "../../server/auth";
import { db } from "../../server/db";

/*
  GET ?token=… : ritorna SOLO i dati del cliente del token (lavori/ore/pagamenti),
  scoped via data->>'clienteId'. Niente dati altrui, nessun costo/operatore.
  Gli importi li calcola il client con il motore conti (canone), su questo sottoinsieme.
*/
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = db();
  if (!sql) return res.status(503).json({ errore: "DB non configurato" });

  const t = req.query.token;
  const token = (Array.isArray(t) ? t[0] : t) ?? "";
  const clienteId = await clienteDaToken(sql, token);
  if (!clienteId) return res.status(401).json({ errore: "token non valido" });

  const [lavori, ore, pagamenti] = await Promise.all([
    sql<{ data: unknown }[]>`select data from lavori    where data->>'clienteId' = ${clienteId} and not deleted`,
    sql<{ data: unknown }[]>`select data from ore        where data->>'clienteId' = ${clienteId} and not deleted`,
    sql<{ data: unknown }[]>`select data from pagamenti  where data->>'clienteId' = ${clienteId} and not deleted`,
  ]);

  return res.status(200).json({
    lavori: lavori.map((r) => r.data),
    ore: ore.map((r) => r.data),
    pagamenti: pagamenti.map((r) => r.data),
  });
}
