# BadVanne

## Ejecutar localmente

1. Copia `.env.example` a `.env.local`.
2. En Supabase, abre **Project Settings → API Keys** y copia la clave `anon`/`publishable` a `VITE_SUPABASE_ANON_KEY` en `.env.local`. No uses una clave `service_role` ni `secret`.
3. Ejecuta `npm install` y `npm run dev`.

La app permite iniciar sesión con email y contraseña (no permite crear cuentas), consulta `temas` junto con la relación `temasVueltas`, y permite actualizar `temas.tieneReformaPendiente`. En el detalle se pueden añadir vueltas con fecha de hoy editable, modificar sus campos o eliminarlas. Añadir abre una fila editable y solo inserta el registro al guardar. Configura las políticas RLS para el rol `authenticated` con permisos de lectura, inserción, actualización y eliminación en `temasVueltas`, y lectura y actualización en `temas`. La relación de `temasVueltas` con `temas.temas_id` debe coincidir con la clave foránea configurada en la base de datos.

`npm run build` genera la versión de producción en `dist/`.

## Desplegar en GitHub Pages

El workflow de GitHub Actions compila y publica `dist/` al hacer push a `main`. En **Settings → Secrets and variables → Actions → Variables**, define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (la clave `publishable`/`anon`, nunca una `service_role`). Después, en **Settings → Pages**, selecciona GitHub Actions como fuente de despliegue. La web publicada es pública; Supabase Auth y las políticas RLS deben proteger los datos.
