# 11 — Backend proprietario + portale cliente (Blocco E)

> Nota: rinominato 10→11 perché `canone/10-prd-3d-gemini-garage.md` (lavoro parallelo
> «Garage 3D») occupa già il numero 10.

> Estende il canone **oltre la v1** (che era single-user, local-first, senza server).
> Documenta l'architettura del backend scritto **da noi** (niente Supabase) e del portale
> cliente. Deriva dalla specifica [09](09-specifica-blocchi-lavoro.md) (Blocco E).

## 0. Regola operativa (chi fa cosa)

**L'agente esegue TUTTA la configurazione e tutto il codice**: schema DB, migrazioni,
funzioni serverless, repository HTTP, auth, viste, file di config (`vercel.json`,
`tsconfig`, `.env.example`, script). **All'utente si chiede SOLO ciò che richiede le sue
credenziali** — cioè quello che l'agente non può creare dal proprio ambiente:

- creare il database **Neon** (o Vercel Postgres) e fornire la stringa `DATABASE_URL` (pooled);
- impostare le **Environment Variables** sul progetto Vercel: `DATABASE_URL`,
  `OPERATOR_SECRET`, `TOKEN_SECRET` (i due segreti li genera l'agente, l'utente li incolla).

Tutto il resto (test inclusi, via Postgres locale in Docker) lo fa l'agente.

## 1. Decisioni (bloccate)

| Tema | Scelta | Motivo |
|---|---|---|
| Proprietà del dato | **Migrazione completa al server** (server = verità) | scelta dell'utente; abilita multi-dispositivo reale |
| Database | **Postgres** (Neon/Vercel), schema e query **scritti da noi** | relazionale, free tier, no lock-in Supabase |
| Economia lato cliente | **Il cliente vede il proprio importo** | serve a dare senso al «segna pagato» |
| Backend-as-a-service | **No** (niente Supabase) | backend proprietario su funzioni Vercel |

## 2. Architettura

```
[App operatore]  ──HTTP (OPERATOR_SECRET)──▶  [/api/* su Vercel]  ──▶  [Postgres Neon]
   HttpRepository implements Repository            funzioni serverless        (verità)
                                                         ▲
[Vista cliente /c/:token]  ──HTTP (token)──────────────┘  query SCOPED al cliente
   read-only: i propri lavori + importo; «segna pagato» = segnalazione
```

- **Forma dati**: una tabella per collezione `(id, data JSONB, updated_at, rev, deleted)` —
  mirror esatto del modello Dexie. Il server conserva i **fatti** (blob JSONB); i
  **derivati** (codice parlante, totali, stati) restano calcolati dal client (canone §2.1).
  Conseguenza: l'`HttpRepository` parla la stessa forma `Dati`, niente mappature.
- **Cucitura repository**: si aggiunge `HttpRepository`; `DexieRepository` resta finché il
  cutover non è pronto e testato (commit sempre deployabili).
- **«RLS» applicata da noi**: l'endpoint cliente interroga solo le righe del proprio
  `clienteId` (indici su `data->>'clienteId'`). Nessun dato altrui è raggiungibile.
- **Auth**: operatore = `OPERATOR_SECRET`; cliente = token opaco nel magic-link, di cui in
  DB sta solo l'**hash** (`client_tokens`).
- **Pagamento del cliente = segnale**: il «pagato» finisce in `segnalazioni_pagamento`;
  l'operatore lo **riconcilia** e solo allora diventa un `Pagamento` reale (registro sacro).

## 3. Stack

- Funzioni serverless **Vercel** (`/api/*.ts`, runtime Node) — codice nostro.
- Driver **postgres.js** (`postgres`), `prepare:false` per il pooler Neon.
- Codice condiviso del backend in `server/` (fuori da `/api`, non instradato).
- Migrazioni: `server/schema.sql` + `scripts/migrate.mjs` (`npm run db:migrate`), idempotente.

## 4. Fasi (E0–E4)

| Fase | Contenuto | Stato |
|---|---|---|
| **E0** | Scaffolding: `/api`, `server/db`, schema JSONB, migrate, `/api/health`, tsconfig server, `.env.example`. Testato su Postgres locale (Docker). | ✅ fatto |
| **E1** | Auth operatore + emissione/validazione magic-link cliente. | ✅ fatto |
| **E2** | API dati per collezione + `HttpRepository` (server = verità), cutover configurabile. | ⏳ |
| **E3** | Vista cliente `/c/:token` (read-only, settimana, importo, «segna pagato»). | ⏳ |
| **E4** | Riconciliazione segnalazioni + cutover finale + istruzioni env Vercel. | ⏳ |

## 5. Cosa serve dall'utente (riepilogo)

1. Creare il DB Neon → copiare la `DATABASE_URL` **pooled**.
2. Su Vercel → Project → Settings → Environment Variables: incollare `DATABASE_URL`,
   `OPERATOR_SECRET`, `TOKEN_SECRET` (gli ultimi due forniti dall'agente).
3. Nient'altro: migrazioni, deploy e test li esegue l'agente.
