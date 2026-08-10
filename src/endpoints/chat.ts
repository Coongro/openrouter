/**
 * POST /chat
 *
 * Proxy autenticado a OpenRouter — el gateway LLM de la plataforma. El caller
 * (frontend o plugin ai-copilot) manda `{ messages, level?, temperature?,
 * maxTokens?, json? }` y recibe el texto del assistant.
 *
 * - `level` ('fast' | 'standard' | 'advanced') se resuelve a modelo con el
 *   catálogo server-side — el cliente nunca nombra modelos. `model` explícito
 *   sigue soportado por compatibilidad.
 * - Cada request registra métricas de tokens en el ledger (metering, no
 *   descuenta unidades — el cobro por tarea lo hace /credits/consume).
 * - La API key vive solo en el servidor.
 *
 * URL final: POST /api/plugins/openrouter/chat
 */

import { isIntelligenceLevel, loadConfig, modelForLevel } from '../config.js';
import { recordUsageMetrics } from '../credits/ledger.js';
import {
  callOpenRouter,
  type ChatMessage,
  type ChatCompletionResult,
  type StructuredOutputSchema,
} from '../openrouter-client.js';

import type { JwtContext } from './_context.js';

interface ChatRequestBody {
  messages?: ChatMessage[];
  /** Nivel de inteligencia — el gateway lo mapea a modelo. */
  level?: string;
  /** Modelo explícito (compat). Si viene `level`, gana el nivel. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  responseSchema?: StructuredOutputSchema;
}

export async function chat(ctx: JwtContext): Promise<ChatCompletionResult> {
  if (!ctx.user?.tenantId) {
    throw new Error('Endpoint requiere autenticación.');
  }
  const body = (ctx.body ?? {}) as ChatRequestBody;
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new Error('Body requiere `messages` (array no vacío).');
  }

  const config = loadConfig();
  const level = isIntelligenceLevel(body.level) ? body.level : undefined;
  const model = level ? modelForLevel(config, level) : body.model;

  const result = await callOpenRouter(
    {
      messages: body.messages,
      model,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      json: body.json,
      responseSchema: body.responseSchema,
    },
    config
  );

  // Metering best-effort: un fallo del registro no rompe la respuesta al caller.
  if (ctx.database) {
    try {
      await recordUsageMetrics(ctx.database, {
        level,
        model: result.model,
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
        source: 'chat',
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[openrouter] no pude registrar métricas de uso:', error);
    }
  }

  return result;
}
