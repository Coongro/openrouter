/**
 * Operaciones sobre el ledger de Unidades de trabajo (append-only).
 *
 * Todas reciben el `database` del contexto HTTP (scope-aware al tenant que
 * resolvió el core: JWT del usuario o header X-Coongro-Tenant validado por
 * la firma platform).
 */

import { randomUUID } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';

import type { ModuleDatabaseAPI } from '../endpoints/_context.js';
import { creditLedgerTable, type NewCreditLedgerRow } from '../schema/credit-ledger.js';

export interface GrantInput {
  orderId: string;
  sku: string;
  quantity: number;
  units: number;
  source: string;
}

export interface GrantResult {
  granted: number;
  balance: number;
  duplicate: boolean;
}

export interface ConsumeInput {
  units: number;
  level: string;
  source: string;
}

export interface ConsumeResult {
  ok: boolean;
  balance: number;
  /** Presente cuando ok=false. */
  error?: string;
}

export async function getBalance(db: ModuleDatabaseAPI): Promise<number> {
  const rows = await db.ormQuery((tx) =>
    tx
      .select({ balance: sql<number>`coalesce(sum(${creditLedgerTable.units}), 0)::int` })
      .from(creditLedgerTable)
  );
  return rows[0]?.balance ?? 0;
}

/**
 * Acredita una compra. Idempotente por `orderId`: si la orden ya fue
 * acreditada (reintento del webhook), devuelve el saldo actual sin duplicar.
 */
export async function grant(db: ModuleDatabaseAPI, input: GrantInput): Promise<GrantResult> {
  const existing = await db.ormQuery<Array<{ id: string }>>((tx) =>
    tx
      .select({ id: creditLedgerTable.id })
      .from(creditLedgerTable)
      .where(eq(creditLedgerTable.order_id, input.orderId))
      .limit(1)
  );
  if (existing.length > 0) {
    return { granted: 0, balance: await getBalance(db), duplicate: true };
  }

  const row: NewCreditLedgerRow = {
    id: randomUUID(),
    entry_type: 'grant',
    order_id: input.orderId,
    sku: input.sku,
    quantity: input.quantity,
    units: input.units,
    source: input.source,
  };
  try {
    await db.ormQuery((tx) => tx.insert(creditLedgerTable).values(row));
  } catch (error) {
    // Carrera entre reintentos simultáneos: el unique index de order_id ganó.
    const message = error instanceof Error ? error.message : String(error);
    if (/duplicate key|unique/i.test(message)) {
      return { granted: 0, balance: await getBalance(db), duplicate: true };
    }
    throw error;
  }

  return { granted: input.units, balance: await getBalance(db), duplicate: false };
}

/**
 * Consume unidades para una tarea. Atómico: el INSERT solo se materializa si
 * el saldo alcanza (INSERT ... SELECT ... WHERE saldo >= costo), evitando
 * sobregiro por carreras entre tareas concurrentes del mismo tenant.
 */
export async function consume(db: ModuleDatabaseAPI, input: ConsumeInput): Promise<ConsumeResult> {
  const cost = Math.max(1, Math.floor(input.units));
  const inserted = await db.ormQuery((tx) =>
    tx.execute(sql`
      INSERT INTO ${creditLedgerTable} (id, entry_type, units, level, source)
      SELECT ${randomUUID()}::uuid, 'usage', ${-cost}, ${input.level}, ${input.source}
      WHERE (SELECT coalesce(sum(units), 0) FROM ${creditLedgerTable}) >= ${cost}
      RETURNING id
    `)
  );

  const rows = inserted as { length?: number } | Array<unknown>;
  const ok = Array.isArray(rows)
    ? rows.length > 0
    : ((rows as { length?: number }).length ?? 0) > 0;
  const balance = await getBalance(db);
  if (!ok) {
    return {
      ok: false,
      balance,
      error: 'Sin Unidades de trabajo suficientes. Recargá desde tu cuenta de Coongro.',
    };
  }
  return { ok: true, balance };
}

/** Registra métricas de un request LLM (metering, no descuenta unidades). */
export async function recordUsageMetrics(
  db: ModuleDatabaseAPI,
  input: {
    level?: string;
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    source: string;
  }
): Promise<void> {
  const row: NewCreditLedgerRow = {
    id: randomUUID(),
    entry_type: 'usage',
    units: 0,
    level: input.level,
    model: input.model,
    prompt_tokens: input.promptTokens,
    completion_tokens: input.completionTokens,
    source: input.source,
  };
  await db.ormQuery((tx) => tx.insert(creditLedgerTable).values(row));
}
