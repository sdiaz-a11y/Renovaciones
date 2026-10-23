# Renovaciones · Club Sinergético

CRM para recuperar a los miembros con membresía vencida. Dos apps en el mismo proyecto:

- **`/`** — app de usuarios (equipo): cada persona entra con su código personal y solo ve sus contactos asignados: *Mi día*, cola de llamadas, seguimientos y sus contactos. Se puede instalar en el celular.
- **`/admin`** — app de administradores: panel general, todos los contactos (filtros, asignación en lote, exportar CSV), equipo (cuentas, códigos, repartir contactos, rendimiento), plantillas de WhatsApp y meta.

En línea: https://renovaciones-club-sinergetico.vercel.app

## Cómo está hecho

- **Vercel**: la app (Vite + React) se sirve como archivos estáticos y `api/*.ts` son funciones serverless `(Request) => Response`.
- **Supabase (Postgres)**: tablas `contactos`, `notas`, `actividad`, `usuarios`, `config` e `intentos` (esquema en `supabase/schema.sql`). Todas con RLS y sin políticas: solo la API, con la clave secreta en el servidor, las toca.
- **Versiones**: cada cambio pasa por una función SQL con candado (`crm_editar`, `crm_nuevo`, `crm_actividad`) que sube una versión global. El navegador pregunta cada 30 s "¿qué cambió desde la versión N?" (`/api/cambios`).
- **Datos del origen vs. trabajo del equipo**: `contactos` guarda lo que viene del CRM externo (`estado`, `asignado`, `contacto`...) y, aparte, lo que cambia el equipo (`estado_crm`, `asignado_crm`, notas, seguimiento). Sincronizar o reimportar nunca pisa lo segundo.
- Los ids de contacto salen del email (o del teléfono), así que no cambian entre sincronizaciones.

## Contactos reales (cron) y renovaciones

`api/sincronizar.ts` trae de `GET {CRM_API_URL}/api/externo/renovaciones/inactivos` a los clientes sin acceso (los revocados no aparecen) y hace *upsert* en Supabase. Las notas del Club se copian solo cuando el contacto llega por primera vez. Vercel lo llama cada hora (`vercel.json` → `crons`, requiere plan Pro); un administrador también puede lanzarlo a mano con `GET /api/sincronizar`.

Al marcar **¡Renovó!**, `api/actualizar.ts` crea una solicitud (tabla `solicitudes_renovacion`) y la envía a `POST .../solicitud-acceso` (`api/_acceso.ts`). El Club no renueva solo: un administrador suyo la aprueba. Los fallos de red o 5xx se reintentan en cada sincronización (hasta 8); 400/404 son definitivos. Cuando un cliente con solicitud enviada deja de aparecer entre los inactivos, se marca `aprobada` y queda una nota. `GET /api/solicitudes` las lista; `POST {id}` reenvía una.

`api/_conector.ts` es el único archivo que conoce el formato del CRM del Club.

## Acceso

- `CODIGO_ADMIN` (variable de Vercel): código del administrador principal.
- Las cuentas personales se crean desde `/admin` → Equipo. Su código se muestra una sola vez y se guarda como hash.
- El servidor filtra los contactos por persona: un usuario no puede descargar contactos que no son suyos.
- Los intentos fallidos por IP se guardan en la tabla `intentos` (12 en 10 minutos bloquean).

## Variables de entorno

| Variable | Para qué |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | conexión a la base (solo servidor) |
| `CODIGO_ADMIN` | código del administrador principal |
| `CRON_SECRET` | autoriza al cron de Vercel |
| `CRM_API_URL`, `CRM_API_KEY` | CRM del Club: su URL base y su `RENOVACIONES_API_TOKEN` |

## Desarrollo

```bash
npm run dev      # Vite + API (lee .env.local; necesita las variables de arriba)
npm run deploy   # vercel deploy --prod
```

Scripts (con `node --env-file=.env.local`):

- `scripts/datos-demo.mjs` — carga 90 contactos inventados (`... borrar` los quita).
- `scripts/subir-base.mjs <contactos.json>` — sube un JSON de contactos (p. ej. el generado por `scripts/importar.py` desde el Excel).

El JSON de contactos tiene datos personales: no lo guardes dentro del proyecto.
