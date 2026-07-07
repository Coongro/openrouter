/**
 * POST /credits/grant  (auth: 'platform')
 *
 * Acredita Unidades de trabajo compradas fuera de Coongro (WordPress/Woo).
 * El caller NO manda unidades: manda un SKU y el catálogo server-side del
 * gateway resuelve cuántas unidades acredita. Idempotente por `orderId` —
 * los reintentos del webhook devuelven `duplicate: true` sin duplicar.
 *
 * URL final: POST /api/plugins/openrouter/credits/grant
 * Headers (validados por el core): `x-api-key` (contra PLATFORM_WEBHOOK_SECRET /
 * WORDPRESS_API_KEY / API_KEY) + `X-Coongro-Tenant` — el mismo mecanismo que el
 * connector de WordPress ya usa con el core.
 */

import { loadConfig } from '../config.js';
import { grant, type GrantResult } from '../credits/ledger.js';

import type { PlatformContext } from './_context.js';

interface GrantRequestBody {
  sku?: string;
  orderId?: string;
  quantity?: number;
  source?: string;
}

export async function creditsGrant(ctx: PlatformContext): Promise<GrantResult> {
  if (!ctx.database) {
    throw new Error('Endpoint requiere tenant resuelto (auth platform).');
  }
  const body = (ctx.body ?? {}) as GrantRequestBody;

  const sku = body.sku?.trim();
  const orderId = body.orderId?.trim();
  if (!sku || !orderId) {
    throw new Error('Body requiere { sku, orderId }.');
  }

  const config = loadConfig();
  const unitsPerPack = config.skuCatalog[sku];
  if (!unitsPerPack) {
    throw new Error(`SKU desconocido: "${sku}".`);
  }

  const quantity =
    typeof body.quantity === 'number' && Number.isFinite(body.quantity) && body.quantity >= 1
      ? Math.min(Math.floor(body.quantity), 100)
      : 1;

  return grant(ctx.database, {
    orderId,
    sku,
    quantity,
    units: unitsPerPack * quantity,
    source: body.source?.trim() || 'wordpress',
  });
}
