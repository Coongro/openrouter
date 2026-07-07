/**
 * Cliente mínimo de OpenRouter (chat completions).
 *
 * Usa `fetch` nativo de Node 18+ → cero dependencias externas que bundlear
 * (importante: el plugin loader no resuelve deps no-@coongro/*, ver CLAUDE.md).
 */

import { loadConfig, type OpenRouterConfig } from './config.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Si es true, pide a OpenRouter response_format json_object (no todos los modelos lo soportan). */
  json?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  /** Tokens reportados por OpenRouter (metering de costo real). */
  usage?: { promptTokens?: number; completionTokens?: number };
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Ejecuta una completion contra OpenRouter y devuelve el texto del assistant.
 * Lanza Error con mensaje legible si falta la key o el upstream falla.
 */
export async function callOpenRouter(
  options: ChatCompletionOptions,
  config: OpenRouterConfig = loadConfig()
): Promise<ChatCompletionResult> {
  if (!config.apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY no está configurada en el servidor. Cargala en .env.docker y reiniciá la API.'
    );
  }
  if (!Array.isArray(options.messages) || options.messages.length === 0) {
    throw new Error('Se requiere `messages` (array no vacío).');
  }

  const model = options.model?.trim() || config.defaultModel;
  const payload: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.2,
  };
  if (options.maxTokens) payload.max_tokens = options.maxTokens;
  if (options.json) payload.response_format = { type: 'json_object' };

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': config.referer,
      'X-Title': config.title,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenRouter respondió ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  return {
    content,
    model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
        }
      : undefined,
  };
}
