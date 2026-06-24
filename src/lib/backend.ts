/*
  Configurazione del backend proprietario, lato operatore. I valori vivono in
  localStorage (inseriti in Impostazioni), NON nel bundle: il segreto operatore non
  è pubblico. baseUrl vuoto = stesso dominio del deploy (l'API è su /api dello stesso Vercel).
*/
const K_BASE = "albero:backend-url";
const K_SECRET = "albero:operatore-secret";
const K_ATTIVO = "albero:backend-attivo";

export function backendBaseUrl(): string {
  try {
    return localStorage.getItem(K_BASE)?.trim() || "";
  } catch {
    return "";
  }
}

export function operatoreSecret(): string {
  try {
    return localStorage.getItem(K_SECRET)?.trim() || "";
  } catch {
    return "";
  }
}

/** Il backend è la fonte di verità solo se attivato esplicitamente E c'è un segreto. */
export function backendAttivo(): boolean {
  try {
    return localStorage.getItem(K_ATTIVO) === "1" && Boolean(operatoreSecret());
  } catch {
    return false;
  }
}

export function configuraBackend(opts: { baseUrl?: string; secret?: string; attivo?: boolean }): void {
  try {
    if (opts.baseUrl !== undefined) localStorage.setItem(K_BASE, opts.baseUrl.trim());
    if (opts.secret !== undefined) localStorage.setItem(K_SECRET, opts.secret.trim());
    if (opts.attivo !== undefined) localStorage.setItem(K_ATTIVO, opts.attivo ? "1" : "0");
  } catch {
    /* storage non disponibile: ignora */
  }
}
