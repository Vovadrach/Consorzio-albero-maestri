import { ArrowLeft, Download, RotateCcw, Trash2, Undo2, Upload, UserRound, Warehouse } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Intestazione } from "@/components/Intestazione";
import { BackendPanel } from "@/components/BackendPanel";
import { Button, Card, Conferma, Field } from "@/components/ui";
import { getWorkspaceId, isSyncConfigured, setWorkspaceId } from "@/db/sync-config";
import { esportaJSON, importaJSON } from "@/lib/backup";
import { notificaUndo } from "@/lib/undo";
import { adessoISO, oggiISO } from "@/lib/format";
import { operatoreIo } from "@/lib/lavoro-calc";
import type { CollezioneKey } from "@/lib/types";
import { useStore } from "@/store/store";

type CestinoKey = "lavori" | "clienti" | "operatori" | "attrezzi";
const CESTINO: { key: CestinoKey; label: string }[] = [
  { key: "lavori", label: "Lavori" },
  { key: "clienti", label: "Clienti" },
  { key: "operatori", label: "Operai" },
  { key: "attrezzi", label: "Attrezzi" },
];
function nomeRecord(key: CestinoKey, r: { nome?: string; cognome?: string; titolo?: string }): string {
  if (key === "clienti") return `${r.nome ?? ""} ${r.cognome ?? ""}`.trim() || "—";
  if (key === "lavori") return r.titolo ?? "—";
  return r.nome ?? "—";
}

export function Impostazioni() {
  const navigate = useNavigate();
  const dati = useStore((s) => s.dati);
  const io = operatoreIo(dati);
  const salva = useStore((s) => s.salva);
  const importa = useStore((s) => s.importa);
  const importaUnisci = useStore((s) => s.importaUnisci);
  const rimuoviDefinitivo = useStore((s) => s.rimuoviDefinitivo);
  const reset = useStore((s) => s.reset);
  const fileRef = useRef<HTMLInputElement>(null);
  const modoRef = useRef<"sostituisci" | "unisci">("sostituisci");
  const [msg, setMsg] = useState<string | null>(null);
  const [confermaReset, setConfermaReset] = useState(false);
  const [daEliminare, setDaEliminare] = useState<{ key: CestinoKey; id: string; nome: string } | null>(null);
  const [linkCode, setLinkCode] = useState("");
  const syncOn = isSyncConfigured();
  const wsCode = getWorkspaceId();

  const esporta = () => {
    const blob = new Blob([esportaJSON(dati)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `albero-maestri-${oggiISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Backup esportato.");
  };

  const apriFile = (modo: "sostituisci" | "unisci") => {
    modoRef.current = modo;
    fileRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const incoming = importaJSON(await file.text());
      if (modoRef.current === "unisci") {
        await importaUnisci(incoming);
        setMsg("Dati uniti (merge).");
      } else {
        await importa(incoming);
        setMsg("Dati importati.");
      }
    } catch {
      setMsg("File di backup non valido.");
    }
    e.target.value = "";
  };

  const ricarica = async () => {
    const prima = dati; // snapshot per annullare
    await reset();
    notificaUndo("Dati d'esempio ricaricati", async () => { await importa(prima); });
    setMsg("Dati d'esempio ricaricati.");
  };

  const ripristina = async (key: CestinoKey, r: { id: string }) => {
    await salva(key as CollezioneKey, { ...r, deleted: false } as never);
    setMsg("Ripristinato.");
  };

  const cestino = CESTINO.map(({ key, label }) => ({
    key,
    label,
    items: (dati[key] as Array<{ id: string; deleted?: boolean; nome?: string; cognome?: string; titolo?: string }>).filter((r) => r.deleted),
  }));
  const cestinoVuoto = cestino.every((c) => c.items.length === 0);

  return (
    <div className="flex flex-col gap-4 px-5 pt-5 pb-10">
      <Intestazione
        titolo="Impostazioni"
        sottotitolo="i tuoi dati vivono nel telefono"
        azione={
          <Button size="icona" variant="tenue" onClick={() => navigate(-1)} aria-label="Indietro">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
      />

      <Card tono="alta" className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-lg text-bianco">Io · titolare</h2>
        <p className="text-sm text-fumo-2">Il tuo profilo: le tue ore sono profitto, non un costo. Da qui prelievi e storico.</p>
        {io && (
          <Button variant="tenue" className="self-start" onClick={() => navigate(`/operaio/${io.id}`)}>
            <UserRound className="h-4 w-4" /> Apri il mio profilo ({io.nome})
          </Button>
        )}
      </Card>

      <Card tono="alta" className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-lg text-bianco">Garage</h2>
        <p className="text-sm text-fumo-2">Parco auto e attrezzi: valore, consumi e percorsi. Lo apri di rado, quindi vive qui.</p>
        <Button variant="tenue" className="self-start" onClick={() => navigate("/garage")}>
          <Warehouse className="h-4 w-4" /> Apri il garage
        </Button>
      </Card>

      <Card tono="alta" className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-lg text-bianco">Backup e dispositivi</h2>
        <p className="text-sm text-fumo-2">
          Un file = tutti i tuoi dati. <span className="text-bianco">Sostituisci</span> per ripristinare;
          <span className="text-bianco"> Unisci</span> per fondere un altro telefono senza perdere nulla.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ottone" onClick={esporta}>
            <Download className="h-4 w-4" /> Esporta
          </Button>
          <Button variant="tenue" onClick={() => apriFile("sostituisci")}>
            <Upload className="h-4 w-4" /> Importa (sostituisci)
          </Button>
          <Button variant="tenue" onClick={() => apriFile("unisci")}>
            <Upload className="h-4 w-4" /> Unisci
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e)} />
        </div>
      </Card>

      <Card tono="alta" className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-lg text-bianco">Sincronizzazione</h2>
        <p className="text-sm text-fumo-2">
          {syncOn
            ? "Attiva. Condividi il codice per collegare un altro telefono: stesso codice = stessi dati."
            : "Non configurata: i dati restano sul telefono. Backend opzionale (vedi supabase/schema.sql)."}
        </p>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(wsCode); setMsg("Codice copiato."); }} className="self-start break-all rounded-pill bg-superficie px-3 py-1.5 text-left font-mono text-xs text-lime">
          {wsCode}
        </button>
        <Field label="Collega un telefono (incolla il suo codice)" value={linkCode} onChange={(e) => setLinkCode(e.target.value)} placeholder="codice…" />
        <Button variant="tenue" className="self-start" disabled={!linkCode.trim()} onClick={() => { setWorkspaceId(linkCode); window.location.reload(); }}>
          Collega e sincronizza
        </Button>
      </Card>

      <BackendPanel />

      <Card tono="alta" className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-lg text-bianco">Cestino</h2>
        <p className="text-sm text-fumo-2">Tutto ciò che hai archiviato. Ripristina o elimina per sempre.</p>
        {cestinoVuoto ? (
          <p className="py-2 text-center text-sm text-fumo-2">Cestino vuoto. 🌿</p>
        ) : (
          cestino
            .filter((c) => c.items.length > 0)
            .map((c) => (
              <div key={c.key} className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-label text-fumo-2">{c.label}</span>
                {c.items.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-vetro bg-superficie px-3 py-2">
                    <span className="min-w-0 truncate text-sm">{nomeRecord(c.key, r)}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="tenue" onClick={() => void ripristina(c.key, r)}>
                        <Undo2 className="h-3.5 w-3.5" /> Ripristina
                      </Button>
                      <Button size="sm" variant="critico" onClick={() => setDaEliminare({ key: c.key, id: r.id, nome: nomeRecord(c.key, r) })} aria-label="Elimina per sempre">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            ))
        )}
      </Card>

      <Card tono="alta" className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-lg text-bianco">Dati d'esempio</h2>
        <p className="text-sm text-fumo-2">Ricarica i dati d'esempio. Sostituisce tutto quello che c'è ora.</p>
        <Button variant="fantasma" className="self-start" onClick={() => setConfermaReset(true)}>
          <RotateCcw className="h-4 w-4" /> Ricarica esempio
        </Button>
      </Card>

      <Conferma
        open={confermaReset}
        onOpenChange={setConfermaReset}
        titolo="Ricaricare i dati d'esempio?"
        testo="Sostituisce tutto quello che c'è ora. Si può annullare subito dopo."
        etichettaConferma="Sì, ricarica"
        onConferma={() => void ricarica()}
      />

      <Conferma
        open={daEliminare != null}
        onOpenChange={(o) => { if (!o) setDaEliminare(null); }}
        titolo="Eliminare per sempre?"
        testo={daEliminare ? `«${daEliminare.nome}» sarà rimosso definitivamente. Non si può annullare.` : ""}
        etichettaConferma="Elimina per sempre"
        onConferma={() => {
          if (daEliminare) void rimuoviDefinitivo(daEliminare.key as CollezioneKey, daEliminare.id);
          setDaEliminare(null);
        }}
      />

      {msg && <p className="text-center text-sm text-verde">{msg}</p>}

      <p className="text-center font-mono text-[0.65rem] text-fumo-2">Albero Maestri · local-first · {adessoISO().slice(0, 10)}</p>
    </div>
  );
}
