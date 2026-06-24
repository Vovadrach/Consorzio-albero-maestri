import { backendBaseUrl, operatoreSecret } from "@/lib/backend";
import { DATI_VUOTI, type CollezioneKey, type Dati } from "@/lib/types";
import type { Repository } from "./repository";

/*
  Implementazione HTTP del Repository: parla con /api/dati (auth operatore).
  Stessa forma `Dati` del DexieRepository → nessuno schermo cambia (canone 02 §1.4).
  Attiva solo quando il backend è configurato (vedi src/lib/backend.ts); altrimenti
  resta in uso DexieRepository (local-first).
*/

async function chiama(path: string, init?: RequestInit): Promise<Response> {
  const r = await fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${operatoreSecret()}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`backend ${r.status}: ${await r.text().catch(() => "")}`);
  return r;
}

function post(op: string, extra: Record<string, unknown>): Promise<Response> {
  return chiama("/api/dati", { method: "POST", body: JSON.stringify({ op, ...extra }) });
}

export class HttpRepository implements Repository {
  async caricaTutto(): Promise<Dati> {
    const r = await chiama("/api/dati");
    const j = (await r.json()) as Partial<Dati>;
    return { ...DATI_VUOTI, ...j };
  }

  async upsert<K extends CollezioneKey>(collezione: K, record: Dati[K][number]): Promise<void> {
    await post("upsert", { collezione, record });
  }

  async rimuovi(collezione: CollezioneKey, id: string): Promise<void> {
    await post("rimuovi", { collezione, id });
  }

  async rimuoviDefinitivo(collezione: CollezioneKey, id: string): Promise<void> {
    await post("rimuoviDefinitivo", { collezione, id });
  }

  async sostituisciTutto(dati: Dati): Promise<void> {
    await post("sostituisciTutto", { dati });
  }

  async svuota(): Promise<void> {
    await post("svuota", {});
  }
}
