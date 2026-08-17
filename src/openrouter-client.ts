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
  /** Salida JSON validada por el proveedor contra este schema. Tiene precedencia sobre `json`. */
  responseSchema?: StructuredOutputSchema;
  /** Control explícito del razonamiento. `none` evita gastar el output en tareas mecánicas. */
  reasoning?: {
    enabled?: boolean;
    effort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
    exclude?: boolean;
  };
}

export interface StructuredOutputSchema {
  /** Identificador estable del contrato; OpenRouter acepta letras, números, guion y underscore. */
  name: string;
  schema: Record<string, unknown>;
  /** El Builder siempre usa true; queda configurable para otros consumidores server-side. */
  strict?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  /** `length` permite distinguir salida truncada de JSON mal formado. */
  finishReason?: string;
  /** Tokens reportados por OpenRouter (metering de costo real). */
  usage?: { promptTokens?: number; completionTokens?: number; reasoningTokens?: number };
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function responseFormatPayload(options: ChatCompletionOptions): Record<string, unknown> {
  if (!options.responseSchema) {
    return options.json ? { response_format: { type: 'json_object' } } : {};
  }
  const { name, schema, strict = true } = options.responseSchema;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) {
    throw new Error('responseSchema.name debe tener 1-64 letras, números, guiones o underscore.');
  }
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('responseSchema.schema debe ser un objeto JSON Schema.');
  }
  return {
    response_format: { type: 'json_schema', json_schema: { name, strict, schema } },
    // Evita que OpenRouter derive hacia un provider que ignore response_format.
    provider: { require_parameters: true },
  };
}

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

  // Sin modelo no se llama a nadie. Antes acá había un default hardcodeado y el
  // pedido salía igual hacia un modelo que nadie eligió; cuando ese modelo ya no
  // existía, OpenRouter contestaba 404 y el mensaje mandaba a revisar la API key,
  // que no tenía nada que ver.
  const model = options.model?.trim() || config.defaultModel;
  if (!model) {
    throw new Error(
      'No hay modelo configurado para esta llamada. Definí OPENROUTER_MODEL_FAST, ' +
        'OPENROUTER_MODEL_STANDARD u OPENROUTER_MODEL_ADVANCED según el nivel (o ' +
        'OPENROUTER_MODEL para todos) y reiniciá la API. En desarrollo también se ' +
        'carga desde /dev/copilot, sin reiniciar.'
    );
  }
  const payload: Record<string, unknown> = {
    model,
    messages: options.messages,
  };
  // Con `responseSchema` pedimos `require_parameters: true` (ver
  // responseFormatPayload) para que OpenRouter no derive a un provider que ignore
  // el schema. El costo es que descarta todo endpoint que no soporte CADA
  // parámetro enviado, y los modelos de razonamiento actuales no aceptan
  // `temperature` — mandarla los dejaba a todos fuera con un 404 «No endpoints
  // found that can handle the requested parameters», que se lee como si el modelo
  // no existiera.
  //
  // Se descarta acá y no en cada llamador porque la restricción la impone esta
  // función: quien pide una completion no tiene por qué saber qué parámetros
  // admite el modelo que hoy está configurado para su nivel. Con `strict: true`
  // el schema ya fija la forma de la salida, así que el sampling aporta poco.
  const temperature = options.responseSchema ? undefined : (options.temperature ?? 0.2);
  if (temperature !== undefined) payload.temperature = temperature;
  if (options.maxTokens) payload.max_tokens = options.maxTokens;
  if (options.reasoning) payload.reasoning = options.reasoning;
  Object.assign(payload, responseFormatPayload(options));

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
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  return {
    content,
    model,
    finishReason: data.choices?.[0]?.finish_reason,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          reasoningTokens: data.usage.completion_tokens_details?.reasoning_tokens,
        }
      : undefined,
  };
}
