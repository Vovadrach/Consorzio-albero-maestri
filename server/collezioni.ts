/** Whitelist delle collezioni: i nomi tabella non sono parametrizzabili, quindi
    si validano contro questa lista prima di interpolarli (anche se via sql(identifier)). */
export const COLLEZIONI = [
  "clienti",
  "operatori",
  "lavori",
  "ore",
  "pagamenti",
  "compensi",
  "spese",
  "attrezzi",
] as const;

export type Collezione = (typeof COLLEZIONI)[number];

export function isCollezione(x: unknown): x is Collezione {
  return typeof x === "string" && (COLLEZIONI as readonly string[]).includes(x);
}
