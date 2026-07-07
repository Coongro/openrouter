/**
 * POST /config/test-connection  (auth: 'none', pero SOLO operativo en modo dev)
 *
 * Herramienta de desarrollo: dispara una completion mínima real contra
 * OpenRouter con el modelo configurado para un nivel, para confirmar desde el
 * dev panel que la API key y el modelo funcionan sin gastar una tarea real
 * del Copilot (no pasa por el ledger de créditos).
 *
 * URL final: /api/plugins/openrouter/config/test-connection
 */

import { isDevMode } from '../config-store.js';
import { isIntelligenceLevel, loadConfig } from '../config.js';
import { callOpenRouter } from '../openrouter-client.js';

export interface TestConnectionResult {
  ok: boolean;
  model: string;
  latencyMs: number;
  reply?: string;
  error?: string;
}

interface TestConnectionBody {
  level?: string;
}

export async function testConnection(ctx: { body: unknown }): Promise<TestConnectionResult> {
  if (!isDevMode()) {
    throw new Error('Probar conexión solo está disponible en modo desarrollo.');
  }

  const body = (ctx.body ?? {}) as TestConnectionBody;
  if (!isIntelligenceLevel(body.level)) {
    throw new Error('Body requiere `level` (fast | standard | advanced).');
  }

  const config = loadConfig();
  const model = config.models[body.level];
  const startedAt = Date.now();

  try {
    const result = await callOpenRouter(
      {
        messages: [{ role: 'user', content: 'Respondé únicamente con la palabra: pong' }],
        model,
        maxTokens: 5,
      },
      config
    );
    return {
      ok: true,
      model,
      latencyMs: Date.now() - startedAt,
      reply: result.content.trim(),
    };
  } catch (error) {
    return {
      ok: false,
      model,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
