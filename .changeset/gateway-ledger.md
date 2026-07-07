---
'@coongro/openrouter': minor
---

feat: gateway LLM con niveles de inteligencia y ledger de Unidades de trabajo

- Niveles Rápido/Estándar/Avanzado mapeados a modelos por env (el cliente nunca
  nombra modelos); `/chat` acepta `level` y registra métricas de tokens.
- Ledger append-only de Unidades de trabajo por tenant (saldo = SUM).
- `POST /credits/grant` (auth platform): acredita compras externas por SKU
  (catálogo server-side), idempotente por `orderId`.
- `POST /credits/consume` (jwt): cobra una tarea (atómico, sin sobregiro).
- `GET /credits/balance` (jwt): saldo + costo por nivel.
