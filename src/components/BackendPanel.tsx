import { useState } from "react";
import { HttpRepository } from "@/db/http-repository";
import { Button, Card, Field } from "@/components/ui";
import { backendAttivo, backendBaseUrl, configuraBackend, operatoreSecret } from "@/lib/backend";
import { codiceCliente } from "@/lib/codice-parlante";
import { calcoloLavoro } from "@/lib/lavoro-calc";
import { incassaLavoro } from "@/store/azioni";
import { useStore } from "@/store/store";

interface Segnalazione {
  id: string;
  cliente_id: string;
  lavoro_id: string | null;
  segnalato_il: string;
}

/*
  Pannello operatore del backend proprietario (Impostazioni). Config (url/segreto/cutover),
  migrazione dei dati locali sul server, generazione magic-link per cliente e
  riconciliazione dei pagamenti segnalati. Tutto opzionale: spento = app local-first.
*/
export function BackendPanel() {
  const dati = useStore((s) => s.dati);
  const [url, setUrl] = useState(backendBaseUrl());
  const [secret, setSecret] = useState(operatoreSecret());
  const [attivo, setAttivo] = useState(backendAttivo());
  const [msg, setMsg] = useState<string | null>(null);
  const [clienteSel, setClienteSel] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [segn, setSegn] = useState<Segnalazione[]>([]);

  const base = url.trim();
  const headers = () => ({ "content-type": "application/json", authorization: `Bearer ${secret.trim()}` });

  const salva = () => {
    configuraBackend({ baseUrl: url, secret, attivo });
    setMsg("Configurazione salvata. Ricarica l'app per applicare il cutover.");
  };

  const migra = async () => {
    configuraBackend({ baseUrl: url, secret });
    try {
      await new HttpRepository().sostituisciTutto(dati);
      setMsg("Dati locali caricati sul server.");
    } catch (e) {
      setMsg("Errore migrazione: " + String(e));
    }
  };

  const genera = async () => {
    if (!clienteSel) return;
    try {
      const r = await fetch(`${base}/api/operatore/token-cliente`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clienteId: clienteSel }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const { token } = (await r.json()) as { token: string };
      setLink(`${base || window.location.origin}/c/${token}`);
    } catch (e) {
      setMsg("Errore link: " + String(e));
    }
  };

  const caricaSegn = async () => {
    try {
      const r = await fetch(`${base}/api/operatore/segnalazioni`, { headers: headers() });
      if (!r.ok) throw new Error(String(r.status));
      setSegn((await r.json()) as Segnalazione[]);
    } catch (e) {
      setMsg("Errore: " + String(e));
    }
  };

  const accetta = async (s: Segnalazione) => {
    const l = s.lavoro_id ? dati.lavori.find((x) => x.id === s.lavoro_id) : undefined;
    if (l) {
      const c = calcoloLavoro(dati, l);
      if (c.daIncassare > 0) await incassaLavoro(l.id, c.daIncassare);
    }
    try {
      await fetch(`${base}/api/operatore/segnalazioni`, { method: "POST", headers: headers(), body: JSON.stringify({ id: s.id }) });
    } catch {
      /* ignora: riprovabile */
    }
    setSegn((arr) => arr.filter((x) => x.id !== s.id));
    setMsg("Segnalazione riconciliata.");
  };

  const clienti = dati.clienti.filter((c) => !c.deleted);
  const nomeCliente = (id: string) => {
    const c = dati.clienti.find((x) => x.id === id);
    return c ? `${c.nome} ${c.cognome ?? ""}`.trim() : id;
  };
  const titoloLavoro = (id: string | null) => dati.lavori.find((x) => x.id === id)?.titolo ?? "—";

  return (
    <Card tono="alta" className="flex flex-col gap-3 p-4">
      <h2 className="font-display text-lg text-bianco">Backend · portale cliente</h2>
      <p className="text-sm text-fumo-2">
        Backend proprietario su Vercel (Postgres). Inserisci il segreto operatore; con
        «cutover» l'app usa il server come fonte di verità. I clienti ricevono un link privato.
      </p>

      <Field label="URL backend (vuoto = stesso dominio)" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…vercel.app" />
      <Field label="Segreto operatore" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="OPERATOR_SECRET" />
      <label className="flex items-center gap-2 text-sm text-fumo">
        <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} />
        Usa il backend come fonte di verità (cutover)
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant="ottone" onClick={salva}>Salva</Button>
        <Button variant="tenue" onClick={() => void migra()}>Migra i dati locali sul server</Button>
      </div>

      <div className="mt-1 flex flex-col gap-2 border-t border-bordo pt-3">
        <span className="font-mono text-[11px] uppercase tracking-label text-fumo-2">Link privato cliente</span>
        <select value={clienteSel} onChange={(e) => setClienteSel(e.target.value)} className="h-10 rounded-2xl bg-superficie-bassa px-2 text-sm text-bianco">
          <option value="">— scegli cliente —</option>
          {clienti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} {c.cognome ?? ""} · {codiceCliente(dati, c.id)}
            </option>
          ))}
        </select>
        <Button variant="tenue" className="self-start" disabled={!clienteSel} onClick={() => void genera()}>
          Genera link
        </Button>
        {link && (
          <button
            type="button"
            onClick={() => { void navigator.clipboard?.writeText(link); setMsg("Link copiato."); }}
            className="self-start break-all rounded-pill bg-superficie px-3 py-1.5 text-left font-mono text-xs text-lime"
          >
            {link}
          </button>
        )}
      </div>

      <div className="mt-1 flex flex-col gap-2 border-t border-bordo pt-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-label text-fumo-2">Pagamenti segnalati</span>
          <Button size="sm" variant="tenue" onClick={() => void caricaSegn()}>Aggiorna</Button>
        </div>
        {segn.length === 0 ? (
          <p className="text-xs text-fumo-2">Nessuna segnalazione in attesa.</p>
        ) : (
          segn.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-vetro bg-superficie px-3 py-2">
              <span className="min-w-0 truncate text-sm">
                {titoloLavoro(s.lavoro_id)} · {nomeCliente(s.cliente_id)}
              </span>
              <Button size="sm" variant="ottone" onClick={() => void accetta(s)}>Accetta e incassa</Button>
            </div>
          ))
        )}
      </div>

      {msg && <p className="text-center text-sm text-verde">{msg}</p>}
    </Card>
  );
}
