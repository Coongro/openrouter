/**
 * GET /credits/balance  (auth: 'jwt')
 *
 * Saldo de Unidades de trabajo del tenant + costo por tarea por nivel (para
 * que el frontend muestre el selector de inteligencia con su precio).
 *
 * URL final: GET /api/plugins/openrouter/credits/balance
 */

import { loadConfig, type IntelligenceLevel } from '../config.js';
import { getBalance } from '../credits/ledger.js';

import type { JwtContext } from './_context.js';

export interface BalanceResponse {
  balance: number;
  taskCost: Record<IntelligenceLevel, number>;
}

export async function creditsBalance(ctx: JwtContext): Promise<BalanceResponse> {
  if (!ctx.user?.tenantId || !ctx.database) {
    throw new Error('Endpoint requiere autenticación.');
  }
  const config = loadConfig();
  return {
    balance: await getBalance(ctx.database),
    taskCost: config.taskCost,
  };
}
