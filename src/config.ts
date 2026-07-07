/**
 * Configuración del plugin OpenRouter, leída de env vars del proceso API.
 *
 * La API key NUNCA llega al frontend: solo se lee acá, server-side.
 *
 * El gateway no expone modelos al cliente: expone NIVELES de inteligencia
 * (fast/standard/advanced) con nombres comerciales. El mapeo nivel → modelo
 * y el costo en Unidades de trabajo por tarea se cambian por env sin tocar
 * código ni el plugin ai-copilot. En modo dev, además, se pueden pisar los
 * modelos desde el dev panel (ver config-store).
 */

import { getApiKeyOverride, getModelOverrides } from './config-store.js';

export type IntelligenceLevel = 'fast' | 'standard' | 'advanced';

export interface OpenRouterConfig {
  /** API key de OpenRouter. `null` si no está configurada todavía. */
  apiKey: string | null;
  /** Modelo por defecto (compat: requests sin nivel ni modelo explícito). */
  defaultModel: string;
  /** Mapeo nivel de inteligencia → slug de modelo de OpenRouter. */
  models: Record<IntelligenceLevel, string>;
  /** Costo en Unidades de trabajo de UNA tarea, por nivel. */
  taskCost: Record<IntelligenceLevel, number>;
  /** Catálogo SKU → unidades que acredita (compras de WordPress). */
  skuCatalog: Record<string, number>;
  /** Header HTTP-Referer que OpenRouter usa para atribución (opcional). */
  referer: string;
  /** Header X-Title que aparece en el dashboard de OpenRouter (opcional). */
  title: string;
}

const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';

const DEFAULT_MODELS: Record<IntelligenceLevel, string> = {
  fast: 'anthropic/claude-3.5-haiku',
  standard: DEFAULT_MODEL,
  advanced: 'anthropic/claude-sonnet-4',
};

/** Costo por tarea: los niveles altos consumen más unidades. */
const DEFAULT_TASK_COST: Record<IntelligenceLevel, number> = {
  fast: 1,
  standard: 1,
  advanced: 2,
};

/**
 * Catálogo por defecto. Las unidades por SKU viven ACÁ (server-side): el
 * webhook externo solo manda el SKU — un caller comprometido no puede
 * inventar montos arbitrarios.
 */
const DEFAULT_SKU_CATALOG: Record<string, number> = {
  'addon-copilot': 200,
  'topup-100': 100,
  'topup-500': 500,
};

function parseJsonRecord(raw: string | undefined): Record<string, number> | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const record: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        record[key] = Math.floor(value);
      }
    }
    return Object.keys(record).length > 0 ? record : null;
  } catch {
    return null;
  }
}

export function isIntelligenceLevel(value: unknown): value is IntelligenceLevel {
  return value === 'fast' || value === 'standard' || value === 'advanced';
}

/** Costo por tarea desde env, con fallback al default si no es un número > 0. */
function taskCostFromEnv(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return n > 0 ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): OpenRouterConfig {
  const envApiKey = env.OPENROUTER_API_KEY?.trim();
  const defaultModel = env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  // Override editable desde el dev panel (solo dev) — pisa a las env vars.
  const ov = getModelOverrides();
  // La API key también es pisable desde el dev panel (solo dev); si no, env.
  const apiKey = getApiKeyOverride() ?? (envApiKey && envApiKey.length > 0 ? envApiKey : null);
  return {
    apiKey,
    defaultModel,
    models: {
      fast: ov.fast || env.OPENROUTER_MODEL_FAST?.trim() || DEFAULT_MODELS.fast,
      standard: ov.standard || env.OPENROUTER_MODEL_STANDARD?.trim() || defaultModel,
      advanced: ov.advanced || env.OPENROUTER_MODEL_ADVANCED?.trim() || DEFAULT_MODELS.advanced,
    },
    taskCost: {
      fast: taskCostFromEnv(env.COPILOT_TASK_COST_FAST, DEFAULT_TASK_COST.fast),
      standard: taskCostFromEnv(env.COPILOT_TASK_COST_STANDARD, DEFAULT_TASK_COST.standard),
      advanced: taskCostFromEnv(env.COPILOT_TASK_COST_ADVANCED, DEFAULT_TASK_COST.advanced),
    },
    skuCatalog: parseJsonRecord(env.COPILOT_SKU_CATALOG) ?? DEFAULT_SKU_CATALOG,
    referer: env.OPENROUTER_REFERER?.trim() || 'https://coongro.local',
    title: env.OPENROUTER_TITLE?.trim() || 'Coongro AI Copilot',
  };
}
