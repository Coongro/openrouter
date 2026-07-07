/**
 * Shape del contexto HTTP que el core pasa a los handlers del plugin.
 *
 * Refleja `HttpEndpointContext` del core (apps/api/src/plugins/http/types.ts)
 * sin importar el tipo del core (evita acoplar el plugin al apps/api).
 */

export interface HttpUser {
  id: string | number;
  tenantId: string;
  email: string;
}

/**
 * API mínima de DB que el core inyecta (subset de ModuleDatabaseAPI de
 * database-core). `ormQuery` corre dentro de una transacción con search_path
 * fijado al schema del tenant resuelto.
 */
export interface ModuleDatabaseAPI {
  // El tipo real vive en database-core; usamos un import de TIPO de drizzle
  // (sin dep de runtime) para que los handlers reciban un `tx` tipado y no
  // propaguen `any` a cada query (mismo patrón que HttpEndpointDatabaseAPI en
  // module-core).
  ormQuery: <T>(
    queryFn: (db: import('drizzle-orm/postgres-js').PostgresJsDatabase) => Promise<T>
  ) => Promise<T>;
  tenantId: string;
}

export interface JwtContext {
  body: unknown;
  query: Record<string, string>;
  headers: Record<string, string>;
  user?: HttpUser;
  /** Scope-aware al tenant (JWT del usuario). */
  database: ModuleDatabaseAPI | null;
}

/**
 * Contexto de endpoints `auth: 'platform'` (webhooks firmados): no hay user,
 * pero el core garantiza `database` scoped al tenant de X-Coongro-Tenant.
 */
export interface PlatformContext {
  body: unknown;
  query: Record<string, string>;
  headers: Record<string, string>;
  database: ModuleDatabaseAPI | null;
}
