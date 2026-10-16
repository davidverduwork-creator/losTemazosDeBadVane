# BadVanne

## Ejecutar localmente

1. Copia `.env.example` a `.env.local`.
2. Ejecuta `npx neon@latest env pull` y copia los valores de `NEON_AUTH_BASE_URL` y `NEON_DATA_API_URL` a `VITE_NEON_AUTH_URL` y `VITE_NEON_DATA_API_URL` en `.env.local`. Son URL públicas; no expongas `DATABASE_URL` ni `DATABASE_URL_UNPOOLED` en variables `VITE_*`.
3. Ejecuta `npm install` y `npm run dev`.

La autenticación y las consultas usan Neon Auth y Neon Data API con `@neondatabase/neon-js`. La app permite iniciar sesión con email y contraseña y no permite crear cuentas. Consulta `temas` junto con las relaciones `temasVueltas` y `temasCantes`, permite actualizar `temas.tieneReformaPendiente` y añadir, modificar y eliminar vueltas y cantes.

Inicializa el esquema y sus políticas con:

```sh
npx neon@latest psql production -- -f database/migrations/001_initial_schema.sql
```

La migración habilita RLS y concede al rol `authenticated` solo lectura y actualización en `temas`, y lectura, inserción, actualización y eliminación en `temasVueltas` y `temasCantes`. La política permite acceder únicamente a usuarios autenticados. No concede permisos al rol `anonymous`.

Las contraseñas del proveedor de autenticación anterior no se pueden reutilizar en Neon Auth; las cuentas deben tener credenciales creadas en Neon. El registro público de la app permanece desactivado.

`npm run build` genera la versión de producción en `dist/`.

## Desplegar en GitHub Pages

El workflow de GitHub Actions compila y publica `dist/` al hacer push a `main`. En **Settings → Secrets and variables → Actions → Variables**, define `VITE_NEON_AUTH_URL` y `VITE_NEON_DATA_API_URL` con las URL públicas del branch de Neon de producción. Añade el origen `https://davidverduwork-creator.github.io` a los dominios de confianza de Neon Auth. Después, en **Settings → Pages**, selecciona GitHub Actions como fuente de despliegue. La web publicada es pública; Neon Auth, los permisos SQL y las políticas RLS deben proteger los datos.
