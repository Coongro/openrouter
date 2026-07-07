import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Auto-discovery de schemas: todos los .ts de src/schema/ menos el barrel index.
  schema: './src/schema/!(index).ts',
  out: './drizzle',
  dialect: 'postgresql',
  verbose: true,
  strict: true,
});
