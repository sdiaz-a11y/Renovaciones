# Contexto del proyecto (para continuar en otro chat)

Resumen de lo hecho y lo pendiente. Sin claves ni códigos: esos viven en `.env.local` (ignorado por git) y en las variables de entorno de Vercel.

## Qué es

CRM para recuperar miembros del Club Sinergético con membresía vencida (sin acceso). Dos apps en el mismo proyecto (React + Vite):

- `/` — app de usuarios: cada persona entra con su código y solo ve sus contactos.
- `/admin` — app de administradores: panel, contactos, equipo, plantillas de WhatsApp, meta.

La interfaz (`src/`) es lo que más importa y no se ha tocado en la migración.

## Historia

1. Versión original sobre Vercel + Blob → bloqueada por "uso justo".
2. Migrada a Cloudflare Workers + Durable Object.
3. **Migrada a Supabase (Postgres) + Vercel** (estado actual). Se eliminó todo lo de Cloudflare.

## Arquitectura actual

- **Vercel**: estáticos (Vite) + funciones `api/*.ts` con forma `(Request) => Response`. `vercel.json` tiene el rewrite de `/admin` y cabeceras de seguridad (y el cron, ver abajo).
- **Supabase**: esquema en `supabase/schema.sql` (idempotente, se pega en SQL Editor). Tablas `contactos`, `notas`, `actividad`, `usuarios`, `config`, `intentos`, `solicitudes_acceso`. RLS activo sin políticas: solo la API con la clave secreta las toca.
- **Versionado**: funciones SQL con candado (`crm_editar`, `crm_nuevo`, `crm_actividad`) suben una versión global; el navegador sondea `/api/cambios?desde=N` cada 30 s.
- **Datos de origen vs. trabajo del equipo**: `contactos.estado/asignado/contacto` vienen de la importación; lo que cambia el equipo va en `estado_crm`, `asignado_crm`, `contacto_crm`, notas, seguimiento. Reimportar no lo pisa.
- **Login**: códigos personales (hash SHA-256) + `CODIGO_ADMIN` para el admin principal. Intentos fallidos por IP en la tabla `intentos`.
- `api/_lib.ts`: cliente Supabase, auth, mapeo fila → `Contacto`. `src/shared/modelo.ts`: tipos y lógica compartida.

## Despliegue

- Vercel, equipo **synergy-code (Pro)**, proyecto `renovaciones-club-sinergetico`, URL https://renovaciones-club-sinergetico.vercel.app (`/admin` para administradores).
- Variables de producción ya cargadas: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CODIGO_ADMIN`. Se borró `CRON_SECRET` (hay que regenerarlo).
- El despliegue en producción corresponde al código anterior a los últimos cambios (ver "Pendiente").
- `npm run dev` usa `.env.local` (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CODIGO_ADMIN`). `npm run deploy` = `vercel deploy --prod`.
- Datos actuales: 90 contactos de prueba (`scripts/datos-demo.mjs`, `... borrar` los quita) y una cuenta de prueba "Demo Ana".

## Decisiones tomadas

- Se abandona Google Sheets por completo; esta base es la única fuente en este CRM.
- **En este CRM solo aparecen clientes del CRM del Club (https://soporte.sinergeticos.com) que están sin acceso. Los REVOCADOS no deben aparecer.**
- Las notas del CRM del Club se copian al perfil del lead una sola vez (cuando el contacto llega por primera vez).
- Al marcar **¡Renovó!** se envía una solicitud al CRM del Club con los datos que ya tenemos de la persona y la etiqueta `renovacion`. No se cambian fechas ni se da acceso automáticamente: lo decide el equipo del Club.
- La aprobación se detecta sola: si un cliente con solicitud `enviada` deja de aparecer en `/api/inactivos`, se marca `aprobada` y queda una nota. Sin webhook.

## Lo construido para la conexión (código hecho, sin probar, sin commit previo)

- `api/_conector.ts`: `GET {CRM_API_URL}/api/inactivos` con cabecera `x-api-key`. Acepta `{clientes:[...], siguiente}` o un arreglo; alias de campos configurables al inicio del archivo. El id de contacto es sha1 del email (o teléfono), igual que `scripts/importar.py`.
- `api/sincronizar.ts`: cron/administrador. Reenvía solicitudes fallidas, trae inactivos, hace upsert, agrega notas solo a contactos nuevos, aprueba las que ya no son inactivas. Una lista vacía se trata como error (no toca nada).
- `api/_acceso.ts`: crea y envía solicitudes (`POST {CRM_API_URL}/api/solicitud-acceso`, con `Idempotency-Key`). 4xx (salvo 408/429) = error definitivo; lo demás se reintenta hasta 8 veces.
- `api/actualizar.ts`: al pasar un contacto a `renovado` crea y envía la solicitud (si `CRM_API_URL` y `CRM_API_KEY` están definidas).
- `api/solicitudes.ts`: `GET` lista solicitudes (admin); `POST {id}` reenvía una.
- Contrato exacto (cuerpo del POST y forma de `/api/inactivos`) en los comentarios de `_conector.ts` y `_acceso.ts`.

## Pendiente (en orden)

1. **Ejecutar de nuevo `supabase/schema.sql`** en el SQL Editor (agrega `contactos.ext_id` y recrea `solicitudes_acceso`).
2. **En el proyecto del CRM del Club** (otra sesión de Claude Code): construir `GET /api/inactivos` y `POST /api/solicitud-acceso` con el contrato de arriba. Ese CRM hoy usa un Google Sheet como base (index.html + Apps Script + `api/clientes-existe.js`); hay que decidir allí qué significa "sin acceso" y cómo excluir REVOCADOS. Su propia base está pendiente de definirse.
3. Cargar en Vercel (Production, como sensibles): `CRM_API_URL=https://soporte.sinergeticos.com`, `CRM_API_KEY=<clave>` y un nuevo `CRON_SECRET`.
4. Añadir a `vercel.json` el cron: `"crons": [{ "path": "/api/sincronizar", "schedule": "0 * * * *" }]` y `"functions": { "api/sincronizar.ts": { "maxDuration": 60 } }` (se perdieron al revertir; el cron horario requiere plan Pro).
5. Probar con un servidor de mentira que imite al CRM del Club; luego redesplegar y probar con un cliente de prueba real.
6. Borrar los 90 contactos demo cuando lleguen los reales; desactivar "Demo Ana".
7. Opcional: mostrar el estado de las solicitudes en la interfaz admin (hoy solo por API).

## Seguridad / pendientes de higiene

- **Rotar la clave secreta de Supabase** (`sb_secret_…`): se pegó en un chat. Después actualizarla en `.env.local` y en Vercel.
- Cambiar el código de administrador de producción si se compartió por chat.
- En el proyecto del CRM del Club hay claves de Google, un secreto de Apps Script y reglas de Firestore abiertas (`allow read, write: if true`) escritas en el código; conviene rotarlas y moverlas a variables de entorno.
- Si se usa `.mcp.json` (MCP de Supabase) hay que autenticarlo con `/mcp` en una sesión interactiva; no es necesario para trabajar.

## Notas de trabajo

- Scripts: `scripts/subir-base.mjs <json>` (importa un JSON de contactos a Supabase), `scripts/datos-demo.mjs`, `scripts/importar.py` (Excel → JSON; ya no se usa).
- Comprobar siempre con `npx tsc -b` y `npx oxlint src api`.
- Los commits anteriores del repo son de Daniel García; el repo no tiene identidad git configurada.
