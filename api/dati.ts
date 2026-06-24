import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Sql } from "postgres";
import { verificaOperatore } from "../server/auth";
import { COLLEZIONI, type Collezione, isCollezione } from "../server/collezioni";
import { db } from "../server/db";

/*
  API dati (auth operatore) — specchio del contratto Repository sul server.
  GET            → caricaTutto (tutte le righe, tombstone inclusi)
  POST { op: … } → upsert | rimuovi | rimuoviDefinitivo | sostituisciTutto | svuota
  Il server conserva i FATTI come blob JSONB; i derivati restano al client.
*/

type Rec = Record<string, unknown> & { id: string };

async function upsert(sql: Sql, collezione: Collezione, rec: Rec): Promise<void> {
  await sql`
    insert into ${sql(collezione)} (id, data, updated_at, rev, deleted)
    values (${rec.id}, ${sql.json(rec as Parameters<typeof sql.json>[0])}, ${(rec.updatedAt as string) ?? null}, ${(rec.rev as number) ?? 0}, ${(rec.deleted as boolean) ?? false})
    on conflict (id) do update set
      data = excluded.data, updated_at = excluded.updated_at, rev = excluded.rev, deleted = excluded.deleted`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verificaOperatore(req)) return res.status(401).json({ errore: "non autorizzato" });
  const sql = db();
  if (!sql) return res.status(503).json({ errore: "DB non configurato" });

  try {
    if (req.method === "GET") {
      const out: Record<string, unknown[]> = {};
      for (const c of COLLEZIONI) {
        const rows = await sql<{ data: unknown }[]>`select data from ${sql(c)}`;
        out[c] = rows.map((r) => r.data);
      }
      return res.status(200).json(out);
    }

    if (req.method === "POST") {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const op = String(body.op ?? "");

      if (op === "upsert") {
        if (!isCollezione(body.collezione)) return res.status(400).json({ errore: "collezione non valida" });
        const rec = body.record as Rec | undefined;
        if (!rec?.id) return res.status(400).json({ errore: "record senza id" });
        await upsert(sql, body.collezione, rec);
        return res.status(200).json({ ok: true });
      }

      if (op === "rimuovi") {
        if (!isCollezione(body.collezione)) return res.status(400).json({ errore: "collezione non valida" });
        const id = String(body.id ?? "");
        const rows = await sql<{ data: Rec }[]>`select data from ${sql(body.collezione)} where id = ${id}`;
        if (rows.length) {
          const rec = rows[0].data;
          await upsert(sql, body.collezione, {
            ...rec,
            deleted: true,
            rev: ((rec.rev as number) ?? 0) + 1,
            updatedAt: new Date().toISOString(),
          });
        }
        return res.status(200).json({ ok: true });
      }

      if (op === "rimuoviDefinitivo") {
        if (!isCollezione(body.collezione)) return res.status(400).json({ errore: "collezione non valida" });
        await sql`delete from ${sql(body.collezione)} where id = ${String(body.id ?? "")}`;
        return res.status(200).json({ ok: true });
      }

      if (op === "sostituisciTutto") {
        const dati = (body.dati ?? {}) as Record<string, Rec[]>;
        await sql.begin(async (tx) => {
          for (const c of COLLEZIONI) {
            await tx`delete from ${tx(c)}`;
            const arr = Array.isArray(dati[c]) ? dati[c] : [];
            for (const rec of arr) if (rec?.id) await upsert(tx as unknown as Sql, c, rec);
          }
        });
        return res.status(200).json({ ok: true });
      }

      if (op === "svuota") {
        await sql.begin(async (tx) => {
          for (const c of COLLEZIONI) await tx`delete from ${tx(c)}`;
        });
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ errore: "op sconosciuta" });
    }

    return res.status(405).json({ errore: "metodo non consentito" });
  } catch (e) {
    return res.status(500).json({ errore: String(e) });
  }
}
