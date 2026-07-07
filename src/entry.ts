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
  // eslint-disable-next-line no-console
  console.log(`[openrouter] activo. Modelo por defecto: ${config.defaultModel}`);
}

export function deactivate(): void {
  // Sin estado que limpiar — el proxy es stateless.
}
