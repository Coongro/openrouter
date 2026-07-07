/**
 * Override de configuración editable en tiempo de ejecución — SOLO modo dev.
 *
 * Permite repuntar el mapeo nivel→modelo desde el dev panel sin reiniciar el
 * API ni tocar `.env.docker`. En producción `isDevMode()` es false y los
 * endpoints que escriben acá se niegan: ahí manda exclusivamente el entorno.
 *
 * Persistencia best-effort a un JSON (sobrevive `docker restart` dentro del
 * mismo contenedor). Si el archivo no se puede escribir, el override sigue
 * viviendo en memoria hasta el próximo reinicio — aceptable para una
 * herramienta de desarrollo.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { IntelligenceLevel } from './config.js';

const CONFIG_FILE =
  process.env.OPENROUTER_CONFIG_PATH?.trim() || join(tmpdir(), 'coongro-openrouter-config.json');

const LEVELS: IntelligenceLevel[] = ['fast', 'standard', 'advanced'];

export type ModelOverrides = Partial<Record<IntelligenceLevel, string>>;

let cache: ModelOverrides | null = null;
/** undefined = todavía no cargado del archivo; null = cargado, sin override. */
let apiKeyCache: string | null | undefined = undefined;

/** Normaliza una key: string no vacío o null. */
function normalizeKey(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** Lee el archivo de config crudo (tolerante a ausencia/corrupción). */
function readRaw(): { models?: ModelOverrides; apiKey?: unknown } {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as {
        models?: ModelOverrides;
        apiKey?: unknown;
      };
    }
  } catch {
    // corrupto → tratamos como vacío
  }
  return {};
}

function sanitize(raw: ModelOverrides): ModelOverrides {
  const out: ModelOverrides = {};
  for (const level of LEVELS) {
    const value = raw[level];
    if (typeof value === 'string' && value.trim().length > 0) {
      out[level] = value.trim();
    }
  }
  return out;
}

function load(): ModelOverrides {
  if (cache) return cache;
  const raw = readRaw();
  cache = sanitize(raw.models ?? {});
  if (apiKeyCache === undefined) apiKeyCache = normalizeKey(raw.apiKey);
  return cache;
}

function loadApiKey(): string | null {
  if (apiKeyCache !== undefined) return apiKeyCache;
  const raw = readRaw();
  if (cache === null) cache = sanitize(raw.models ?? {});
  apiKeyCache = normalizeKey(raw.apiKey);
  return apiKeyCache;
}

/**
 * Persiste el estado completo (models + apiKey) en un solo archivo. Asegura que
 * ambos caches estén cargados antes de escribir para no pisar el campo que no se
 * está editando.
 */
function persist(): void {
  load();
  loadApiKey();
  try {
    writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ models: cache ?? {}, apiKey: apiKeyCache ?? null }, null, 2),
      'utf8'
    );
  } catch {
    // Best-effort: si no se puede escribir, el override queda solo en memoria.
  }
}

export function getModelOverrides(): ModelOverrides {
  return { ...load() };
}

/**
 * Aplica un override parcial. Un valor vacío/whitespace en un nivel LO LIMPIA
 * (vuelve a env/default para ese nivel).
 */
export function setModelOverrides(partial: ModelOverrides): ModelOverrides {
  const merged = sanitize({ ...load(), ...partial });
  cache = merged;
  persist();
  return { ...merged };
}

export function clearModelOverrides(): void {
  cache = {};
  persist();
}

/** Override de la API key de OpenRouter (solo dev). null = sin override. */
export function getApiKeyOverride(): string | null {
  return loadApiKey();
}

/** Aplica un override de API key. Un valor vacío/whitespace la limpia. */
export function setApiKeyOverride(key: string): void {
  apiKeyCache = normalizeKey(key);
  persist();
}

export function clearApiKeyOverride(): void {
  apiKeyCache = null;
  persist();
}

/** true salvo en producción — gatea la escritura de config desde el dev panel. */
export function isDevMode(): boolean {
  return (process.env.NODE_ENV ?? '').toLowerCase() !== 'production';
}
