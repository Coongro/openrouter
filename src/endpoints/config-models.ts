/**
 * GET/PUT /config/models  (auth: 'none', pero SOLO operativo en modo dev)
 *
 * Herramienta de desarrollo: leer y repuntar el mapeo nivel→modelo desde el
 * dev panel sin reiniciar el API. En producción `isDevMode()` es false y ambos
 * handlers se niegan — ahí el mapeo se define exclusivamente por env vars.
 *
 * URL final: /api/plugins/openrouter/config/models
 */

import {
  clearModelOverrides,
  getModelOverrides,
  isDevMode,
  setModelOverrides,
  type ModelOverrides,
} from '../config-store.js';
import { loadConfig, type IntelligenceLevel } from '../config.js';

const LEVELS: IntelligenceLevel[] = ['fast', 'standard', 'advanced'];

export interface ModelsConfigResponse {
  /** false en producción: el mapeo NO es editable, manda el env. */
  dev: boolean;
  /**
   * Modelo efectivo por nivel (override > env). Cadena vacía = SIN configurar:
   * ya no existe un modelo por defecto que rellene el hueco, así que el vacío es
   * el estado real y no un dato que falta mostrar.
   */
  models: Record<IntelligenceLevel, string>;
  /** Niveles sin modelo: usarlos falla, y con un error que dice qué definir. */
  unset: IntelligenceLevel[];
  /** Niveles con override activo desde el dev panel. */
  overridden: IntelligenceLevel[];
  /** Costo en unidades por tarea, por nivel (informativo). */
  taskCost: Record<IntelligenceLevel, number>;
}

function snapshot(): ModelsConfigResponse {
  const cfg = loadConfig();
  const overrides = getModelOverrides();
  return {
    dev: isDevMode(),
    models: Object.fromEntries(LEVELS.map((l) => [l, cfg.models[l] ?? ''])) as Record<
      IntelligenceLevel,
      string
    >,
    unset: LEVELS.filter((l) => !cfg.models[l]),
    overridden: LEVELS.filter((l) => overrides[l] !== undefined),
    taskCost: cfg.taskCost,
  };
}

export function getModels(): ModelsConfigResponse {
  return snapshot();
}

interface SetModelsBody {
  models?: Partial<Record<string, string>>;
  reset?: boolean;
}

export function setModels(ctx: { body: unknown }): ModelsConfigResponse {
  if (!isDevMode()) {
    throw new Error(
      'La configuración de modelos solo puede editarse en modo desarrollo. En producción se define por variables de entorno.'
    );
  }
  const body = (ctx.body ?? {}) as SetModelsBody;

  if (body.reset) {
    clearModelOverrides();
    return snapshot();
  }

  const partial: ModelOverrides = {};
  for (const level of LEVELS) {
    const value = body.models?.[level];
    // string vacío = limpiar ese nivel (vuelve a env/default).
    if (typeof value === 'string') partial[level] = value;
  }
  setModelOverrides(partial);
  return snapshot();
}
