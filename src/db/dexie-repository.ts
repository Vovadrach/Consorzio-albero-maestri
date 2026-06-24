import { backendAttivo } from "@/lib/backend";
import { adessoISO } from "@/lib/format";
import type { CollezioneKey, Dati } from "@/lib/types";
import { HttpRepository } from "./http-repository";
import type { Repository } from "./repository";
import { db } from "./schema";

const COLLEZIONI: CollezioneKey[] = [
  "clienti",
  "operatori",
  "lavori",
  "ore",
  "pagamenti",
  "compensi",
  "spese",
  "attrezzi",
];

export class DexieRepository implements Repository {
  async caricaTutto(): Promise<Dati> {
    const out: Dati = {
      clienti: [],
      operatori: [],
      lavori: [],
      ore: [],
      pagamenti: [],
      compensi: [],
      spese: [],
      attrezzi: [],
    };
    await Promise.all(
      COLLEZIONI.map(async (k) => {
        // tombstone inclusi: la UI filtra `deleted` a lettura; servono per cestino/merge/orfani (08 §2.4)
        (out as Record<CollezioneKey, unknown[]>)[k] = await db.table(k).toArray();
      }),
    );
    return out;
  }

  async upsert<K extends CollezioneKey>(collezione: K, record: Dati[K][number]): Promise<void> {
    await db.table(collezione).put(record);
  }

  async rimuovi(collezione: CollezioneKey, id: string): Promise<void> {
    const rec = await db.table(collezione).get(id);
    if (rec) await db.table(collezione).put({ ...rec, deleted: true, rev: ((rec as { rev?: number }).rev ?? 0) + 1, updatedAt: adessoISO() });
  }

  async rimuoviDefinitivo(collezione: CollezioneKey, id: string): Promise<void> {
    await db.table(collezione).delete(id);
  }

  async sostituisciTutto(dati: Dati): Promise<void> {
    await db.transaction(
      "rw",
      COLLEZIONI.map((k) => db.table(k)),
      async () => {
        for (const k of COLLEZIONI) {
          await db.table(k).clear();
          await db.table(k).bulkPut(dati[k]);
        }
      },
    );
  }

  async svuota(): Promise<void> {
    await db.transaction(
      "rw",
      COLLEZIONI.map((k) => db.table(k)),
      async () => {
        for (const k of COLLEZIONI) await db.table(k).clear();
      },
    );
  }
}

// Selezione dell'implementazione: HTTP (server = verità) solo se il backend è attivato
// in Impostazioni; altrimenti local-first con Dexie. Nessuno schermo cambia (canone 02 §1.4).
export const repository: Repository = backendAttivo() ? new HttpRepository() : new DexieRepository();
