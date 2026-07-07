import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Ledger de Unidades de trabajo del Copilot IA — append-only.
 *
 * Cada fila es un movimiento: `grant` (compra/carga, units positivo) o
 * `usage` (consumo de una tarea, units negativo). El saldo del tenant es
 * SUM(units). No se actualizan ni borran filas: la historia completa queda
 * auditable y la reconciliación contra WordPress se hace por `order_id`.
 */
export const creditLedgerTable = pgTable(
  'module_openrouter_credit_ledger',
  {
    id: uuid('id').primaryKey().notNull(),
    /** 'grant' (carga) | 'usage' (consumo de tarea) */
    entry_type: text('entry_type').notNull(),
    /**
     * Id de la orden externa (WooCommerce) — clave de idempotencia de grants.
     * NULL en usage. El unique index permite múltiples NULL (semántica PG).
     */
    order_id: text('order_id'),
    /** SKU comprado (grants): 'addon-copilot', 'topup-100', etc. */
    sku: text('sku'),
    /** Cantidad de packs comprados (grants). */
    quantity: integer('quantity'),
    /** Movimiento en unidades: positivo (grant) o negativo (usage). */
    units: integer('units').notNull(),
    /** Nivel de inteligencia usado (usage): 'fast' | 'standard' | 'advanced'. */
    level: text('level'),
    /** Modelo real resuelto (usage/metering). */
    model: text('model'),
    /** Métricas de tokens del request (metering, no facturan por sí solas). */
    prompt_tokens: integer('prompt_tokens'),
    completion_tokens: integer('completion_tokens'),
    /** Origen del movimiento: 'wordpress', 'dev-panel', 'ai-copilot', etc. */
    source: text('source'),
    created_at: timestamp('created_at', { mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [uniqueIndex('module_openrouter_credit_ledger_order_id_idx').on(table.order_id)]
);

export type CreditLedgerRow = typeof creditLedgerTable.$inferSelect;

/**
 * Fila a insertar. Se declara explícita en vez de `$inferInsert` porque drizzle
 * 0.38.x omite las columnas nullable del tipo inferido de inserción (bug
 * conocido: pierde order_id/sku/level/etc.), lo que haría fallar el typecheck.
 * El shape acá refleja la tabla real; el runtime de drizzle inserta todas las
 * columnas igual.
 */
export interface NewCreditLedgerRow {
  id: string;
  entry_type: 'grant' | 'usage';
  units: number;
  order_id?: string | null;
  sku?: string | null;
  quantity?: number | null;
  level?: string | null;
  model?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  source?: string | null;
  created_at?: string;
}
