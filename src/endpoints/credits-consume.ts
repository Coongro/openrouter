/**
 * POST /credits/consume  (auth: 'jwt')
 *
 * Cobra UNA tarea del asistente: descuenta el costo del nivel elegido del
 * saldo del tenant. Lo invoca el plugin ai-copilot al INICIO de cada tarea
 * (server-to-server, reenviando la cookie del usuario). Atómico contra
 * carreras: si el saldo no alcanza responde ok=false y la tarea no arranca.
 *
 * URL final: POST /api/plugins/openrouter/credits/consume
 */

import { isIntelligenceLevel, loadConfig } from '../config.js';
import { consume, type ConsumeResult } from '../credits/ledger.js';

import type { JwtContext } from './_context.js';

interface ConsumeRequestBody {
  level?: string;
  source?: string;
}

export async function creditsConsume(ctx: JwtContext): Promise<ConsumeResult> {
  if (!ctx.user?.tenantId || !ctx.database) {
    throw new Error('Endpoint requiere autenticación.');
  }
  const body = (ctx.body ?? {}) as ConsumeRequestBody;
  const level = isIntelligenceLevel(body.level) ? body.level : 'standard';
  const config = loadConfig();

  return consume(ctx.database, {
    units: config.taskCost[level],
    level,
    source: body.source?.trim() || 'ai-copilot',
  });
}
