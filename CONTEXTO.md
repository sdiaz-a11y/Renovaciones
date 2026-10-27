# Contexto del proyecto (para continuar en otro chat)

Resumen de lo hecho y lo pendiente. Sin claves ni códigos: esos viven en las variables de entorno de Vercel (y en `.env.local`, ignorado por git, si se trabaja en local).

## Qué es

CRM para recuperar miembros del Club Sinergético con membresía vencida (sin acceso). Dos apps en el mismo proyecto (React + Vite):

- `/` — app de usuarios: cada persona entra con su código y solo ve sus contactos.
- `/admin` — app de administradores: panel, contactos, equipo, plantillas de WhatsApp, meta, y el botón **Actualizar desde el Club**.

## Arquitectura

- **Vercel** (equipo synergy-code, plan Pro), proyecto `renovaciones-club-sinergetico`: https://renovaciones-club-sinergetico.vercel.app. Estáticos (Vite) + funciones `api/*.ts` con forma `(Request) => Response`.
- **Supabase** (Postgres): esquema en `supabase/schema.sql` (idempotente: se puede volver a pegar completo en el SQL Editor; hay que hacerlo tras cada cambio de esquema, **antes** de desplegar). RLS activo sin políticas: solo la API con la clave secreta toca las tablas.
- **Versionado**: funciones SQL con candado (`crm_editar`, `crm_nuevo`, `crm_actividad`) suben una versión global; el navegador sondea `/api/cambios?desde=N` cada 30 s. **La sincronización con el Club no sube la versión**, por eso el botón recarga la lista completa.
- **Datos de origen vs. trabajo del equipo**: lo que viene del Club (nombre, correo, teléfono, ciudad, evento, fecha de vencimiento) se sobrescribe en cada sincronización; lo que hace el equipo (`estado_crm`, `asignado_crm`, `contacto_crm`, motivo, "no contactar", seguimiento, notas) vive en columnas aparte y **nunca se toca**. `api/sincronizar.ts` tiene un seguro (`PROTEGIDAS`) que aborta si alguien añade esas columnas al upsert.
- **Login**: códigos personales (hash SHA-256) + `CODIGO_ADMIN` para el admin principal. Intentos fallidos por IP en la tabla `intentos`.
- `/api/contactos` responde **por partes** (`jsonEnPartes`): con ~15 700 contactos pasa del límite de 4,5 MB de Vercel para respuestas completas.

## Conexión con el CRM del Club (https://soporte.sinergeticos.com)

Variables de producción en Vercel: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CODIGO_ADMIN`, `CRM_API_URL` (`https://soporte.sinergeticos.com`), `CRM_API_KEY` (= el `RENOVACIONES_API_TOKEN` del Club), `CRON_SECRET`.

Auth hacia el Club: `Authorization: Bearer <CRM_API_KEY>`. `api/_conector.ts` es el único archivo que conoce el formato de sus respuestas.

### Traer clientes inactivos
- `GET /api/externo/renovaciones/inactivos?pagina=N`: páginas de 500, **cada una tarda 15–60 s**. Hoy hay **15 678 clientes** (32 páginas); las páginas que no existen dan 500. Los REVOCADOS no aparecen. `asignado` siempre viene null.
- **Sincronización por tandas** (`api/sincronizar.ts`): no cabe en una ejecución, así que cada llamada avanza por páginas hasta ~160 s (`maxDuration` 300) y anota en `config.sync_pagina` dónde se quedó; al llegar a la última cierra el "ciclo" (`sync_ciclo`, `sync_fin`). Un candado (`config.sync_bloqueo`, caduca a 6 min) evita dos ejecuciones a la vez.
- El **cron** corre cada 10 min la versión **rápida** (`/api/sincronizar?rapido=1`): solo las primeras páginas (el Club entrega primero a los que vencieron más recientemente) y se detiene tras 2 páginas seguidas sin nadie nuevo (~1–2 min). **El cron no hace el ciclo completo.** El ciclo completo (todas las páginas, por tandas) lo arranca un administrador con el enlace "Sincronización completa" junto al botón, o con `GET /api/sincronizar` + cabecera `x-codigo`. (Queda en el código la lógica de descanso de 1 h entre ciclos, pero solo aplicaría si el cron llamara al completo.)
- El botón **Actualizar desde el Club** (`src/components/BotonClub.tsx`, en Contactos, solo admin) hace la versión rápida (~1–2 min); el enlace "Sincronización completa" repite la llamada hasta `completo:true` (~10–20 min). Ambos esperan si hay otra sincronización en curso y al final recargan la lista.
- Las notas del Club se copian una sola vez, cuando el contacto llega por primera vez. El id de contacto es sha1 del correo (o teléfono), estable entre sincronizaciones. Los errores de hoja de cálculo del Club (`#REF!`, `#N/A`…) se tratan como vacío.
- Un cliente que deja de aparecer en el Club **no se borra** de aquí.

### Avisar que alguien renovó
- Al marcar **¡Renovó!** se crea una solicitud (`solicitudes_renovacion`) y se envía a `POST /api/externo/renovaciones/solicitud-acceso` con `solicitud_id` fijo (idempotente), `renovado_por`, fecha, correo y la nota escrita. El Club **no renueva solo**: un administrador suyo la aprueba o rechaza a mano en su panel de Solicitudes.
- **Doble verificación**: ventana "Confirma la renovación" con casilla obligatoria (`ConfirmarRenovacion.tsx`), aplicada en el punto central `actualizar` de `src/lib/crm.tsx` (cubre el botón, las etiquetas de estado de la ficha y la edición en lote). El servidor también la exige (`confirmado:true`, si no responde 400 `confirmar`).
- Estados del aviso: `pendiente` → `enviada` → `aprobada`; `fallida` (400/404 o 8 intentos); `cancelada` (se quitó Renovado antes de que saliera); `revertida` (se quitó Renovado pero el Club ya la tenía: hay que avisarles a mano; el botón "Ya les avisé" la cierra). Si se vuelve a marcar Renovado, una revertida se reactiva sin duplicar.
- La ficha muestra la tarjeta **Aviso al Club** con el estado y botones Enviar ahora / Reintentar / Ya les avisé (`/api/solicitudes`: `GET` lista, solo admin; `POST {id, accion: 'reenviar'|'cerrar'}`).
- La aprobación se detecta **solo al cerrar un ciclo completo** (que ahora solo arranca a mano): al cerrarlo, una solicitud `enviada` (o `revertida`) cuyo cliente ya no apareció entre los inactivos pasa a `aprobada` y queda una nota.

## Decisiones tomadas

- Se abandona Google Sheets; esta base es la única fuente en este CRM. Solo aparecen clientes del CRM del Club sin acceso; los REVOCADOS no.
- Marcar Renovado no cambia fechas ni da acceso: lo decide el equipo del Club.

## Pendiente

1. **Detectar rechazos del Club.** Hoy, si un administrador del Club **rechaza** una solicitud, aquí no nos enteramos: la tarjeta queda en "enviada" para siempre y el contacto sigue como Renovado (infla panel, tasa, meta y rendimiento). Hace falta que el Club exponga el estado de sus solicitudes, p. ej. `GET /api/externo/renovaciones/solicitudes?ids=...` (mismo token) que devuelva por `solicitud_id` si está `pendiente`, `aprobada` o `rechazada`. Del lado de aquí: consultarlo al cerrar el ciclo y, si viene rechazada, mostrar "El Club rechazó esta renovación", sacar al contacto de Renovado (volver al estado anterior), dejar nota y permitir reenviar. (En el Club, `rechazarSolicitudRenovacionExterna` solo marca `rechazada`; no avisa a nadie.)
2. **Probar el aviso de renovación de punta a punta** con un cliente de prueba real (y avisar al Club que es de prueba para que no lo aprueben).
3. Pulsar de nuevo **Actualizar desde el Club** para que se limpien los `#REF!` ya guardados en Ciudad.
4. Desactivar "Demo Ana" en `/admin` → Equipo (los contactos demo ya se borraron con SQL), crear las cuentas del equipo y repartir los contactos (todos están "Sin asignar").
5. Datos raros que vienen del Club (nombres como "22080069", teléfonos como nombre, símbolos al inicio): corregirlos allá.
6. Opcionales: lista de solicitudes en la interfaz admin; la tarjeta de la ficha no se actualiza sola cuando un reintento automático logra enviar (hasta recargar); con más de 1 000 contactos en lote la confirmación se pide por bloque; si la carga de ~15 700 contactos se siente lenta, paginar/filtrar en el servidor.

## Seguridad / higiene

- **Rotar la clave secreta de Supabase** (`sb_secret_…`; se pegó en un chat) y actualizarla en Vercel (y en `.env.local` si se usa).
- **Revocar el token personal de GitHub** que se pegó en un chat (se usó para subir el repo; crear otro cuando haga falta).
- Cambiar el código de administrador de producción si se compartió por chat.
- En el proyecto del CRM del Club hay claves de Google, un secreto de Apps Script y reglas de Firestore abiertas escritas en el código; conviene rotarlas y moverlas a variables de entorno.
- Si se usa `.mcp.json` (MCP de Supabase) hay que autenticarlo con `/mcp` en una sesión interactiva; no es necesario para trabajar.

## Notas de trabajo

- Comprobar siempre con `npx tsc -b`, `npx oxlint src api` y `npx vite build`.
- Despliegue: push a `main` en https://github.com/sdiaz-a11y/Renovaciones (Vercel despliega solo). Después de un push que cambie el esquema, pegar `supabase/schema.sql` en Supabase **antes** del deploy.
- Scripts: `scripts/subir-base.mjs <json>` (importa contactos), `scripts/datos-demo.mjs` (`... borrar` quita los demo), `scripts/importar.py` (Excel → JSON; ya no se usa). Con `node --env-file=.env.local`.
- Historia: Vercel + Blob (bloqueado por "uso justo") → Cloudflare Workers → **Supabase + Vercel** (actual).
- Los commits anteriores del repo son de Daniel García; el repo no tiene identidad git configurada (los commits recientes usan Samuel Diaz).
