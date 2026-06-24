import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { backendBaseUrl } from "@/lib/backend";
import { etichetta } from "@/lib/dominio";
import { formatData, formatEuro } from "@/lib/format";
import { calcoloLavoro } from "@/lib/lavoro-calc";
import { DATI_VUOTI, type Dati } from "@/lib/types";

/*
  Portale cliente (read-only, magic-link /c/:token). Esperienza isolata: niente
  bootstrap operatore, niente chrome. Vede SOLO i propri lavori e il proprio importo;
  può segnalare «ho pagato» (l'operatore poi riconcilia). Mobile-first.
*/
export function PortaleCliente() {
  const { token = "" } = useParams();
  const [stato, setStato] = useState<"caricamento" | "ok" | "errore">("caricamento");
  const [dati, setDati] = useState<Dati>(DATI_VUOTI);
  const [segnalati, setSegnalati] = useState<Set<string>>(new Set());

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`${backendBaseUrl()}/api/cliente/dati?token=${encodeURIComponent(token)}`);
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Partial<Dati>;
        if (vivo) {
          setDati({ ...DATI_VUOTI, ...j });
          setStato("ok");
        }
      } catch {
        if (vivo) setStato("errore");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [token]);

  const lavori = useMemo(() => [...dati.lavori].sort((a, b) => b.data.localeCompare(a.data)), [dati]);

  const segna = async (lavoroId: string) => {
    try {
      const r = await fetch(`${backendBaseUrl()}/api/cliente/segna-pagato?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lavoroId }),
      });
      if (r.ok) setSegnalati((s) => new Set(s).add(lavoroId));
    } catch {
      /* rete assente: riprova più tardi */
    }
  };

  if (stato === "caricamento") return <Centro>Caricamento…</Centro>;
  if (stato === "errore") return <Centro>Link non valido o scaduto.</Centro>;

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 py-7">
      <h1 className="font-display text-2xl font-bold text-bianco">I tuoi lavori</h1>
      <p className="mt-0.5 font-mono text-xs uppercase tracking-wider text-fumo-2">Promemoria personale</p>

      <div className="mt-5 flex flex-col gap-2.5">
        {lavori.length === 0 ? (
          <p className="py-10 text-center text-sm text-fumo-2">Nessun lavoro registrato.</p>
        ) : (
          lavori.map((l) => {
            const c = calcoloLavoro(dati, l);
            const fascia = l.fascia && l.fascia !== "orario" ? etichetta(l.fascia) : null;
            const pagato = c.statoIncasso === "pagato";
            const programmato = l.fase === "da_fare";
            const segnalato = segnalati.has(l.id);
            return (
              <div key={l.id} className="rounded-vetro bg-superficie p-3.5 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-bianco">{l.titolo}</span>
                  <span className="shrink-0 font-mono text-sm text-fumo">{formatData(l.data)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="text-fumo-2">
                    {programmato ? "Programmato" : fascia ?? "Svolto"}
                  </span>
                  {programmato ? (
                    <span className="font-mono text-blu">in programma</span>
                  ) : pagato ? (
                    <span className="font-medium text-verde">Pagato ✓</span>
                  ) : (
                    <span className="font-mono font-bold tabular-nums text-rosso">{formatEuro(c.daIncassare)} da pagare</span>
                  )}
                </div>
                {!pagato && !programmato && c.daIncassare > 0 && (
                  <button
                    type="button"
                    disabled={segnalato}
                    onClick={() => void segna(l.id)}
                    className="mt-2.5 w-full rounded-pill bg-scuro py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
                  >
                    {segnalato ? "Pagamento segnalato ✓" : "Ho pagato"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="mt-6 text-center text-[11px] text-fumo-2">
        «Ho pagato» avvisa solo l'operatore: la conferma resta a lui.
      </p>
    </div>
  );
}

function Centro({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 text-center text-sm text-fumo-2">{children}</div>
  );
}
