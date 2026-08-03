/** Completion estructurada interna para herramientas de desarrollo. */

import { isDevMode } from '../config-store.js';
import { isIntelligenceLevel, loadConfig } from '../config.js';
import {
  callOpenRouter,
  type ChatCompletionOptions,
  type ChatCompletionResult,
} from '../openrouter-client.js';

function assertDeveloperAccess(headers: Record<string, string>): void {
  if (!isDevMode()) {
    const error = new Error(
      'La completion estructurada interna solo está disponible en desarrollo.'
    ) as Error & {
      statusCode?: number;
    };
    error.statusCode = 404;
    throw error;
  }
  const expected = process.env.COONGRO_BUILDER_AI_TOKEN?.trim();
  const actual = headers['x-coongro-builder-token'] ?? headers['X-Coongro-Builder-Token'];
  if (expected && actual !== expected) {
    const error = new Error('Credencial interna del Builder inválida.') as Error & {
      statusCode?: number;
    };
    error.statusCode = 401;
    throw error;
  }
}

export function developerStructuredStatus(ctx: { headers: Record<string, string> }) {
  assertDeveloperAccess(ctx.headers ?? {});
  const config = loadConfig();
  return { dev: true, configured: Boolean(config.apiKey), models: config.models };
}

interface DeveloperStructuredBody extends ChatCompletionOptions {
  level?: string;
}

export async function developerStructured(ctx: {
  body: unknown;
  headers: Record<string, string>;
}): Promise<ChatCompletionResult> {
  assertDeveloperAccess(ctx.headers ?? {});
  const body = (ctx.body ?? {}) as DeveloperStructuredBody;
  const config = loadConfig();
  const level = isIntelligenceLevel(body.level) ? body.level : 'standard';
  return callOpenRouter({ ...body, model: config.models[level] }, config);
}
