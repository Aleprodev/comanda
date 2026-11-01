# Comanda · Todo Chévere

**Un asistente con IA que atiende por chat los pedidos de una pizzería, para que ningún mensaje se pierda, ningún pedido se anote mal y ningún cliente espere.**

Proyecto para el hackatón *"Del problema al servidor"* · DonWeb Day Rosario 2026.

> **La consigna:** un negocio local pierde ventas porque atiende consultas y pedidos a mano, por WhatsApp o por teléfono: mensajes que se pierden, pedidos mal anotados, clientes que esperan.

**🌐 Sitio en vivo:** https://201-32-132-192.sslip.io  
**🔐 Panel del dueño:** https://201-32-132-192.sslip.io/panel (usuario `admin`, contraseña `admin`)  
**📦 Repositorio:** https://github.com/Aleprodev/comanda

---

## La idea

Una pizzería recibe decenas de pedidos en hora pico. Quien atiende tiene las manos ocupadas, escribe con apuro y mezcla conversaciones. El resultado: pedidos duplicados, aclaraciones que nadie hizo y clientes que se van a otro lado.

**Comanda pone un asistente a atender el chat.** Entiende pedidos escritos "como se hablan" (*"una grande mitad muzza mitad napo y media docena de empanadas, para mandar a Córdoba 1234"*), pregunta lo que falta, calcula el total con los precios reales, cobra y manda el pedido ya ordenado a la cocina, en tiempo real. Lo que el asistente no puede resolver, lo pasa a una persona.

## Filosofía

1. **El cliente no tiene que aprender nada.** Escribe, habla o saca una foto, como lo haría con una persona. Sin formularios, sin registros, sin descargar una app.
2. **La IA conversa; el servidor decide.** El modelo entiende el lenguaje, pero **nunca decide un importe ni inventa un producto**. Los precios, los totales y la validación de cada ítem los hace el servidor contra el menú real. Si el modelo se equivoca, el servidor lo rechaza.
3. **Menos tipeo, más botones.** Cuando la pregunta tiene pocas respuestas posibles, el asistente las ofrece como botones.
4. **Una persona siempre tiene la última palabra.** Ante un reclamo, una duda o un pago que no coincide, el asistente deriva la conversación al local y se aparta.
5. **Simple y claro.** Pocas pantallas, diseño limpio y minimalista, inspirado en las apps de Apple.

## Accesibilidad e inclusión

Las funciones de voz y los botones no son decoración: están para que **más personas puedan pedir sin barreras**.

- **Audios (hablar en lugar de escribir):** el cliente graba una nota de voz y el asistente la transcribe y arma el pedido. Ayuda a quien tiene dificultad para escribir (discapacidad motriz, baja visión, poca alfabetización digital), a quien tiene las manos ocupadas, y a cualquiera que simplemente prefiere hablar.
- **Escuchar al asistente (voz de OpenAI):** cada mensaje del asistente tiene un botón 🔊 que lo lee en voz alta, con acento rioplatense. Si el cliente manda un audio, el asistente le responde también hablando. Es útil para personas con **discapacidad visual**, dislexia o dificultad de lectura.
- **Botones de respuesta rápida:** preguntas como *"¿al horno o fritas?"*, *"¿delivery o retiro?"* o *"¿lo confirmo?"* se contestan con un toque. Reducen el esfuerzo para personas con **movilidad reducida o temblores**, para quien escribe despacio, y evitan errores de tipeo.
- **Fotos:** se puede sacar una foto o adjuntar una imagen (una lista escrita a mano, un comprobante de transferencia), sin transcribir nada.
- **Pantallas pensadas para el celular y la PC**, con contrastes cuidados, textos legibles y gráficos que no dependen solo del color (leyendas, etiquetas y tabla alternativa).

## Qué hace

### Para el cliente (`/` y `/pedir`)
- **Landing** con el menú, tomado de la misma base que usa el asistente: si cambia un precio, cambia todo. El botón *Pedir* abre el chat con el mensaje ya armado.
- **Chat** que simula WhatsApp: texto, audio en vivo, cámara y adjuntos.
- **Resumen del pedido** con el total exacto, antes de confirmar.
- **Pago:** link de **Mercado Pago** (se confirma solo, sin que el cliente avise), transferencia (la IA lee la foto del comprobante) o efectivo.
- **Seguimiento en vivo:** el cliente recibe en el chat los avisos *"ya está en cocina"*, *"salió tu pedido"*.

### Para el dueño (`/panel`)
- **Tablero de pedidos en tiempo real:** Nuevos → En cocina → Listos → Entregados, con tiempos de espera y estado de pago.
- **Conversaciones:** el dueño puede leer cada chat, ver las fotos y audios, responder como el local y devolverle la conversación al asistente. Las que piden atención humana aparecen primero.
- **Análisis:** ventas del período con comparación contra el período anterior, ticket promedio, tiempo hasta "listo", conversión de chats, porcentaje resuelto sin intervención humana, **horas pico** (mapa de calor), productos más vendidos, ingresos por categoría, medios de pago y delivery vs retiro.

## Acceso al panel del dueño

| | |
|---|---|
| **Ruta** | `/panel` (te lleva a `/login`) |
| **Usuario** | `admin` |
| **Contraseña** | `admin` |

> Son credenciales **de demostración**. Se cambian con las variables `ADMIN_USER` y `ADMIN_PASSWORD` del servidor (ver más abajo). El login lo valida el servidor y las acciones del panel (mover pedidos, marcar pagos, responder clientes) exigen sesión.

## Probar el pago con Mercado Pago

El proyecto usa credenciales de **prueba** de Mercado Pago (modo sandbox): **no se mueve dinero real**. Para completar un pago en la demo hay que entrar al checkout con este **usuario comprador de prueba** (no con una cuenta personal):

| | |
|---|---|
| **Usuario** | `TESTUSER2747740741411149242` |
| **Contraseña** | `X7b1xIODV5` |
| **ID de usuario** | `3809512294` |
| **Código de verificación** | `512294` |

- El código de verificación es el que Mercado Pago pide al ingresar con un usuario de prueba (son los últimos 6 dígitos del ID).
- Para pagar con tarjeta hay que usar una **tarjeta de prueba** de la [documentación de Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards). Para que el pago salga aprobado, el nombre del titular debe ser `APRO`, y el **código de seguridad** de las tarjetas de prueba es `123`.
- Cuando el pago se acredita, el pedido pasa solo a **Pagado** en el panel y el chat muestra "Pago confirmado", sin que el cliente avise.

> Es una cuenta de prueba creada solo para este proyecto. No usar estas credenciales para nada más.

## Cómo está hecho

**Stack:** React 19 + Vite + Tailwind · Node.js + Express · Supabase (Postgres + Realtime + Storage) · OpenAI · Mercado Pago · GitHub.

```
client/   React: landing, chat del cliente, panel y análisis (gráficos propios en SVG)
server/   Express: agente de IA, pedidos, pagos, audio, imágenes, login
supabase/ Migraciones SQL (esquema, menú de ejemplo, tiempos de cada pedido)
deploy/   Script de instalación para el Cloud Server (Node, PM2, Caddy con HTTPS)
```

**El agente de IA** (`server/src/ai/agent.js`) usa llamadas a herramientas con salida estructurada:

| Herramienta | Qué hace |
|---|---|
| `calcular_pedido` | Calcula el total exacto con los precios del menú. El asistente usa siempre ese número. |
| `crear_pedido` | Registra el pedido confirmado. El servidor valida cada producto, cocción, dirección y medio de pago. |
| `estado_pedido` | Informa cómo va el último pedido. |
| `derivar_a_humano` | Pasa la conversación al local, con el motivo. |

Además, el servidor detecta lo que el cliente ya dijo (delivery o retiro, medio de pago) y se lo marca al asistente para que no lo vuelva a preguntar.

**Audio, voz e imágenes** (`server/src/media.js`): transcripción con `gpt-4o-mini-transcribe`, lectura de imágenes con visión (comprobante / lista escrita / otra cosa) y voz con `gpt-4o-mini-tts`. El audio del asistente se genera solo a partir de mensajes ya guardados y queda en caché.

**Tiempo real:** el chat y el panel se actualizan solos con Supabase Realtime, sin recargar.

## Correr el proyecto

Requisitos: Node 20+ y un proyecto de Supabase.

```bash
npm install
cp server/.env.example server/.env   # completar las claves
npm run dev                          # cliente en :5173 y servidor en :3000
```

Variables de `server/.env`:

| Variable | Para qué |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Base de datos (la clave secreta nunca va al navegador) |
| `OPENAI_API_KEY` | IA, transcripción, visión y voz |
| `OPENAI_MODEL`, `OPENAI_TTS_VOICE` | Modelo del agente (por defecto `gpt-4.1-mini`) y voz (`marin`) |
| `MP_ACCESS_TOKEN` | Mercado Pago. Si falta, ese medio de pago no se ofrece |
| `PUBLIC_URL` | URL pública del sitio, para el retorno y el webhook de Mercado Pago |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Acceso al panel (por defecto `admin` / `admin`) |

La base se crea aplicando las migraciones de [`supabase/migrations/`](supabase/migrations).

**Datos de ejemplo para el panel de análisis:**

```bash
npm run seed:demo -w server             # carga 14 días de pedidos de ejemplo
npm run seed:demo -w server -- --clear  # los borra (no toca pedidos reales)
```

## Despliegue

`deploy/setup.sh` instala Node, PM2 y Caddy en un servidor Ubuntu/Debian, y publica la app con **HTTPS automático** (`<ip>.sslip.io`). El HTTPS es necesario para usar el **micrófono y la cámara** desde el celular.

## Límites conocidos

Para ser transparentes sobre lo que es y lo que no es todavía:

- **El comprobante de transferencia lo lee la IA, no el banco.** Si el monto coincide con el pedido, se marca como pagado; si no, se avisa al local. Una captura falsa pasaría el control. El dueño debería confirmar las transferencias en su cuenta.
- **El login del panel es básico.** Protege la interfaz y las acciones, pero el panel lee los pedidos directo de Supabase con una clave pública de solo lectura. Para un uso real habría que mover esas lecturas al servidor y cerrar el acceso público a esas tablas.
- **No hay integración real con WhatsApp.** El chat lo simula. Conectarlo requiere la API oficial de Meta (verificación y aprobación), que no entra en una tarde.
- **La reproducción automática de la voz** puede estar bloqueada por algunos navegadores (por ejemplo Safari en iPhone). El botón 🔊 siempre funciona.

## Cómo se ve la demo

1. En la landing, tocar **Pedir** en una pizza.
2. Mandar un audio con el resto del pedido; el asistente pregunta lo que falta con botones y responde hablando.
3. Confirmar el resumen con el total exacto y pagar con Mercado Pago.
4. En `/panel` el pedido aparece solo y se pone en verde como **Pagado**.
5. Pasarlo a **Listo**: el cliente recibe el aviso en su chat.
6. Abrir **Análisis** para ver ventas, horas pico y productos más vendidos.
