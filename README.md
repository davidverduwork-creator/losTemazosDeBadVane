# BadVanne

## Ejecutar localmente

1. Copia `.env.example` a `.env.local`.
2. En Supabase, abre **Project Settings → API Keys** y copia la clave `anon`/`publishable` a `VITE_SUPABASE_ANON_KEY` en `.env.local`. No uses una clave `service_role` ni `secret`.
3. Ejecuta `npm install` y `npm run dev`.

La app permite iniciar sesión con email y contraseña (no permite crear cuentas), consulta `temas` junto con la relación `temasVueltas` y permite actualizar `temas.tieneReformaPendiente`. Configura las políticas RLS para el rol `authenticated` con los permisos necesarios en ambas tablas. La relación debe estar definida como clave foránea desde `temasVueltas.vueltas_id` hacia `temas.temas_id`.

`npm run build` genera la versión de producción en `dist/`.
