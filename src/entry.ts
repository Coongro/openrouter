/**
 * Lifecycle del plugin (entry del manifest, runtime: "eager").
 *
 * `eager` hace que el loader llame `activate()` en el boot del API y en cada
 * install/update — así el httpEndpoint `/chat` queda registrado siempre, sin
 * depender de que se navegue a una vista (el plugin no tiene vistas).
 *
 * No falla si falta la key: el plugin igual bootea y el endpoint devuelve un
 * error claro cuando se lo invoca sin key (mismo criterio que telegram).
 */

import { loadConfig } from './config.js';

export function activate(): void {
  const config = loadConfig();
  if (!config.apiKey) {
    // eslint-disable-next-line no-console
    console.warn(
      '[openrouter] OPENROUTER_API_KEY no configurada — /chat devolverá error hasta que la cargues en .env.docker.'
    );
    return;
  }
  const sinModelo = (['fast', 'standard', 'advanced'] as const).filter((l) => !config.models[l]);
  if (sinModelo.length) {
    // Se avisa al arrancar y no cuando falla la primera llamada: ya no hay
    // ningún modelo por defecto que disimule el hueco hasta que alguien pague
    // por él.
    // eslint-disable-next-line no-console
    console.warn(
      `[openrouter] activo, pero sin modelo para: ${sinModelo.join(', ')}. ` +
        'Definí OPENROUTER_MODEL_FAST / _STANDARD / _ADVANCED (o OPENROUTER_MODEL para todos), ' +
        'o cargalos desde /dev/copilot.'
    );
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[openrouter] activo. Modelos: ${JSON.stringify(config.models)}`);
}

export function deactivate(): void {
  // Sin estado que limpiar — el proxy es stateless.
}
