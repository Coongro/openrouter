/**
 * GET/PUT /config/apikey  (auth: 'none', pero SOLO operativo en modo dev)
 *
 * Herramienta de desarrollo: cargar/pisar la API key de OpenRouter desde el dev
 * panel sin tocar `.env.docker` ni reiniciar el API. En producción `isDevMode()`
 * es false y la escritura se niega — ahí la key se define exclusivamente por la
 * env var `OPENROUTER_API_KEY`.
 *
 * SEGURIDAD: el GET NUNCA devuelve la key completa. Solo informa si hay una
 * configurada, de dónde viene (override de dev vs env) y una versión
 * enmascarada (últimos 4 caracteres) para reconocerla.
 *
 * URL final: /api/plugins/openrouter/config/apikey
 */

import {
  clearApiKeyOverride,
  getApiKeyOverride,
  isDevMode,
  setApiKeyOverride,
} from '../config-store.js';
import { loadConfig } from '../config.js';

export interface ApiKeyConfigResponse {
  /** false en producción: la key NO es editable, manda la env var. */
  dev: boolean;
  /** Hay una key efectiva (override o env). */
  configured: boolean;
  /** De dónde sale la key efectiva. */
  source: 'override' | 'env' | 'none';
  /** Versión enmascarada de la key efectiva (nunca la completa). */
  masked: string | null;
}

/** Enmascara una key mostrando solo los últimos 4 caracteres. */
function mask(key: string): string {
  const tail = key.slice(-4);
  return `••••••••${tail}`;
}

function snapshot(): ApiKeyConfigResponse {
  const override = getApiKeyOverride();
  const effective = loadConfig().apiKey;
  const source: ApiKeyConfigResponse['source'] = override ? 'override' : effective ? 'env' : 'none';
  return {
    dev: isDevMode(),
    configured: effective !== null,
    source,
    masked: effective ? mask(effective) : null,
  };
}

export function getApiKey(): ApiKeyConfigResponse {
  return snapshot();
}

interface SetApiKeyBody {
  apiKey?: string;
  reset?: boolean;
}

export function setApiKey(ctx: { body: unknown }): ApiKeyConfigResponse {
  if (!isDevMode()) {
    throw new Error(
      'La API key solo puede editarse en modo desarrollo. En producción se define por la variable de entorno OPENROUTER_API_KEY.'
    );
  }
  const body = (ctx.body ?? {}) as SetApiKeyBody;

  if (body.reset) {
    clearApiKeyOverride();
    return snapshot();
  }

  if (typeof body.apiKey !== 'string') {
    throw new Error('Se requiere { apiKey: string } o { reset: true }.');
  }

  // Un string vacío limpia el override (vuelve a la env var).
  setApiKeyOverride(body.apiKey);
  return snapshot();
}
