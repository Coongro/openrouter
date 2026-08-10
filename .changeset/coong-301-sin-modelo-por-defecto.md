---
'@coongro/openrouter': minor
---

Sin modelo por defecto: si un nivel no está configurado, la llamada falla con un error que dice qué definir en vez de salir hacia un modelo que nadie eligió.

Antes, el nivel sin configurar caía a un modelo hardcodeado (`claude-3.5-haiku`, `claude-3.5-sonnet`, `claude-sonnet-4`), y un nivel vaciado a mano heredaba `OPENROUTER_MODEL`. Los dos caminos convertían un problema de configuración en uno ajeno: el pedido salía igual, y si ese modelo ya no existía OpenRouter contestaba `404 No endpoints found`, que se lee como credencial vencida — se llegaron a rotar cinco API keys persiguiendo eso.

Ahora cada nivel usa solo su override de dev o su env var (`OPENROUTER_MODEL_FAST` / `_STANDARD` / `_ADVANCED`); `OPENROUTER_MODEL` queda para los pedidos sin nivel y no rellena a nadie. `GET /config/models` informa los niveles sin configurar en `unset`, y el plugin avisa al activarse.

**Al actualizar:** un entorno que dependía del default deja de funcionar hasta definir el modelo de cada nivel que use. Es el punto — ese default se cobraba solo.
