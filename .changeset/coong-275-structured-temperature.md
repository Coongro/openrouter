---
'@coongro/openrouter': patch
---

Las completions con schema estricto dejan de mandar `temperature`

Con `responseSchema` se pide `provider: { require_parameters: true }` para que
OpenRouter no derive a un proveedor que ignore el schema. El costo es que descarta
todo endpoint que no soporte CADA parámetro enviado, y los modelos de razonamiento
actuales no aceptan `temperature`: mandarla los dejaba a todos afuera con un
`404 No endpoints found that can handle the requested parameters`, que se lee como
si el modelo no existiera.

Se descarta en el cliente y no en cada llamador porque la restricción la impone el
cliente: quien pide una completion no tiene por qué saber qué admite el modelo que
hoy está configurado para su nivel. Con `strict: true` el schema ya fija la forma de
la salida.
