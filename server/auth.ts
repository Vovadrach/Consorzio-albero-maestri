import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type postgres from "postgres";

/*
  Auth proprietaria (niente Supabase):
  - Operatore: segreto condiviso OPERATOR_SECRET (header Authorization: Bearer …).
  - Cliente: token opaco nel magic-link; in DB sta solo l'hash sha256 (client_tokens).
*/

/** Token opaco per il magic-link cliente (in chiaro va nel link, mostrato una volta). */
export function generaToken(): string {
  return randomBytes(24).toString("hex"); // 48 char hex
}

/** Hash del token: in DB conserviamo solo questo, mai il token in chiaro. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type Headers = Record<string, string | string[] | undefined>;

/** Verifica il segreto operatore (confronto a tempo costante). */
export function verificaOperatore(req: { headers: Headers }): boolean {
  const atteso = process.env.OPERATOR_SECRET;
  if (!atteso) return false;
  const auth = req.headers["authorization"];
  const header = Array.isArray(auth) ? auth[0] : auth;
  const alt = req.headers["x-operator-secret"];
  const fornito = header?.startsWith("Bearer ") ? header.slice(7) : Array.isArray(alt) ? alt[0] : alt;
  if (!fornito) return false;
  const a = Buffer.from(atteso);
  const b = Buffer.from(fornito);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Valida un token cliente → clienteId, oppure null se assente/revocato. */
export async function clienteDaToken(
  sql: ReturnType<typeof postgres>,
  token: string,
): Promise<string | null> {
  if (!token) return null;
  const rows = await sql<{ cliente_id: string }[]>`
    select cliente_id from client_tokens
    where token_hash = ${hashToken(token)} and not revocato
    limit 1`;
  return rows.length ? rows[0].cliente_id : null;
}
