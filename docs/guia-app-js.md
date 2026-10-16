# Guía paso a paso de `app.js`

Esta guía explica cómo funciona [`app.js`](../app.js), el archivo que coordina la interfaz de la web con Neon. Está escrita para personas que están empezando: primero se presenta la arquitectura de conexión y después se recorren los bloques de código y las funciones.

La aplicación está construida con JavaScript del navegador, sin un framework como React o Vue. Por eso verás que el código crea y modifica elementos HTML directamente usando el DOM.

## Antes de empezar: conceptos que aparecen en el archivo

- **DOM**: representación de la página HTML que JavaScript puede consultar y modificar.
- **Variable de estado**: variable que recuerda información necesaria mientras se usa la página, como el tema actualmente abierto.
- **`async` / `await`**: permiten esperar operaciones que tardan, como una petición a Neon, sin bloquear toda la página.
- **Neon Auth**: servicio de autenticación administrado por Neon. En esta aplicación autentica a los usuarios con email y contraseña.
- **Neon Data API**: interfaz HTTP compatible con PostgREST para consultar Postgres desde el navegador.
- **`@neondatabase/neon-js`**: SDK que conecta Neon Auth y Data API en un único cliente. Se configura en [`src/neon.js`](../src/neon.js).
- **RLS**: Row Level Security, reglas de PostgreSQL que limitan las operaciones permitidas por usuario. La Data API aplica los permisos SQL y las políticas RLS; no se debe dar acceso al rol `anonymous`.
- **`BetterAuthVanillaAdapter`**: adaptador del SDK de Neon que expone directamente la API de Better Auth (`signIn.email`, `getSession` y `signOut`).
- **CRUD**: siglas de crear (Create), leer (Read), actualizar (Update) y eliminar (Delete) datos.
- **Plantilla con backticks**: texto entre acentos graves, como `` `Tema ${numero}` ``. Permite insertar valores dentro de una cadena.

## Mapa del archivo

Para que resulte más sencillo aprenderlo, agruparemos el código en cuatro bloques funcionales:

1. Inicialización, conexión con la página y funciones auxiliares.
2. Inicio, mantenimiento y cierre de sesión.
3. Carga y representación de temas y de la vista de detalle.
4. Edición, creación y eliminación de vueltas y cantes.

El archivo no está ordenado exactamente en esos cuatro grupos: por ejemplo, algunos controladores de autenticación están al final. La guía los reúne por su propósito para explicar el flujo de forma más clara.

---

# 1. Inicialización y funciones auxiliares

## 1.1 Importar el cliente Neon y localizar los elementos HTML

```js
import { crearClienteNeon } from './src/neon.js';

const panelAcceso = document.getElementById('panel-acceso');
const formularioAcceso = document.getElementById('form-acceso');
const estadoAcceso = document.getElementById('estado-acceso');
const botonIniciarSesion = document.getElementById('btn-iniciar-sesion');
const botonCerrarSesion = document.getElementById('btn-cerrar-sesion');
const usuarioActivo = document.getElementById('usuario-activo');
const contenidoTemas = document.getElementById('temas');
const vistaLista = document.getElementById('vista-lista');
const vistaDetalle = document.getElementById('vista-detalle');
const contenedorMaterias = document.getElementById('materias');
const estadoDatos = document.getElementById('estado-datos');
const detalleTitulo = document.getElementById('detalle-titulo');
const tbodyVueltas = document.getElementById('tbody-vueltas');
const tbodyCantes = document.getElementById('tbody-cantes');
const botonVolver = document.getElementById('btn-volver');
const botonAnadirVuelta = document.getElementById('btn-anadir-vuelta');
const botonAnadirCante = document.getElementById('btn-anadir-cante');
const checkboxReformaDetalle = document.getElementById('chk-reforma-detalle');
const estadoVuelta = document.getElementById('estado-vuelta');
const estadoCante = document.getElementById('estado-cante');
```

La primera línea importa una función que crea el cliente de Neon. Las URL públicas de Neon Auth y Data API se leen en `src/neon.js` desde `VITE_NEON_AUTH_URL` y `VITE_NEON_DATA_API_URL`; no se repiten en `app.js`.

En desarrollo, configura ambas variables en `.env.local` (puedes partir de `.env.example`). `neon env pull` obtiene valores como `NEON_AUTH_BASE_URL` y `NEON_DATA_API_URL`; hay que asignarlos a los nombres `VITE_NEON_AUTH_URL` y `VITE_NEON_DATA_API_URL` que espera Vite. En GitHub Pages, esas mismas variables se proporcionan a Actions al compilar. Solo son públicas las URL de los servicios: `DATABASE_URL` y `DATABASE_URL_UNPOOLED` son credenciales de servidor y nunca deben tener el prefijo `VITE_` ni incluirse en el código del navegador.

La configuración de infraestructura está en [`neon.ts`](../neon.ts): declara Neon Auth y Data API en las ramas y aplica una caducidad a las ramas nuevas que no sean la predeterminada. Data API se utiliza aquí como compatibilidad con las consultas PostgREST que ya hace esta aplicación; no es la conexión recomendada para una aplicación nueva. La migración [`001_initial_schema.sql`](../database/migrations/001_initial_schema.sql) crea las tablas, activa RLS y concede permisos solo al rol `authenticated`. En esta configuración, cualquier usuario autenticado puede acceder a estos datos compartidos; RLS no separa los temas por usuario.

El cliente combina dos servicios:

- Neon Auth valida el email y la contraseña y administra la sesión.
- Neon Data API ejecuta las consultas `from(...).select()`, `insert()`, `update()` y `delete()` contra PostgreSQL.

El SDK añade el token de sesión a las consultas de datos. PostgreSQL aplica los permisos y las políticas RLS definidos para el rol `authenticated`.

Cada `document.getElementById(...)` busca en `index.html` el elemento que tiene ese identificador. Por ejemplo, `tbodyVueltas` apunta al cuerpo de la tabla de vueltas. Guardar la referencia en una constante permite reutilizarla luego.

Si un identificador no existe en el HTML, `getElementById` devuelve `null`. Por eso los nombres de estos identificadores tienen que coincidir con los de `index.html`.

## 1.2 Variables que conservan el estado de la aplicación

```js
let neon;
let usuarioActivoId;
let temaDetalleActual;
let botonTemaAnterior;

try {
    neon = crearClienteNeon();
} catch (error) {
    estadoAcceso.textContent = error.message;
    botonIniciarSesion.disabled = true;
}
```

Estas variables usan `let` porque su valor puede cambiar durante la ejecución:

- `neon` contendrá el cliente combinado de Neon Auth y Neon Data API.
- `usuarioActivoId` guarda el identificador del usuario conectado. También ayuda a no procesar dos veces la misma sesión.
- `temaDetalleActual` representa el tema que está abierto en la vista de detalle.
- `botonTemaAnterior` recuerda qué botón abrió el detalle, para devolverle el foco al regresar a la lista.

La creación del cliente se protege con `try...catch`. Si faltan variables de configuración o no se puede crear el cliente, se informa del error en la pantalla y se deshabilita el botón de iniciar sesión. De este modo no se permite continuar con una conexión que no está disponible.

## 1.3 Crear elementos y preparar una fecha

```js
function crearElemento(tag, className, texto) {
    const elemento = document.createElement(tag);
    if (className) elemento.className = className;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function fechaLocalActual() {
    const fecha = new Date();
    const ano = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}
```

`crearElemento` es una pequeña función reutilizable. Recibe el nombre de una etiqueta HTML, una clase CSS opcional y un texto opcional; crea el elemento y lo devuelve.

Se usa `textContent` en vez de insertar el texto como HTML. Así el contenido se trata como texto y no como etiquetas HTML.

`fechaLocalActual` crea la fecha de hoy en el formato que espera un campo HTML de tipo `date`: `AAAA-MM-DD`. Se suma uno al mes porque los meses de `Date` empiezan en cero (`0` es enero). `padStart(2, '0')` añade un cero inicial a valores de un dígito, por ejemplo `4` pasa a ser `04`.

## 1.4 Normalizar las relaciones que devuelve Neon Data API

```js
function obtenerVueltas(tema) {
    const vueltas = tema.temasVueltas;
    if (Array.isArray(vueltas)) return vueltas;
    return vueltas ? [vueltas] : [];
}

function obtenerCantes(tema) {
    const cantes = tema.temasCantes;
    if (Array.isArray(cantes)) return cantes;
    return cantes ? [cantes] : [];
}
```

Las relaciones anidadas pueden llegar como una lista, como un único objeto o como un valor vacío. Estas funciones convierten los casos posibles en un mismo formato: siempre devuelven un array.

El resto del programa puede recorrer el resultado de forma consistente, incluso si no hay ninguna vuelta o ningún cante.

## 1.5 Convertir el tiempo de un cante

```js
function formatearTiempoCante(segundos) {
    const totalSegundos = Number(segundos);
    if (!Number.isFinite(totalSegundos) || totalSegundos < 0) return '0:00';
    const minutos = Math.floor(totalSegundos / 60);
    const restoSegundos = String(Math.floor(totalSegundos % 60)).padStart(2, '0');
    return `${minutos}:${restoSegundos}`;
}

function parsearTiempoCante(tiempo) {
    const coincidencia = /^(\d+):([0-5]\d)$/.exec(tiempo);
    if (!coincidencia) return undefined;
    const totalSegundos = Number(coincidencia[1]) * 60 + Number(coincidencia[2]);
    return totalSegundos <= 32767 ? totalSegundos : undefined;
}
```

En la interfaz el tiempo se escribe y se muestra como `minutos:segundos`, por ejemplo `1:25`. En la base de datos `tiempoCante` se almacena como un número entero de segundos: `85`.

- `formatearTiempoCante` convierte segundos a texto. El operador `%` obtiene el resto de la división; aquí sirve para obtener los segundos que sobran después de contar los minutos.
- `parsearTiempoCante` hace la conversión inversa. La expresión regular exige uno o más dígitos para los minutos y dos dígitos entre `00` y `59` para los segundos.
- El máximo `32767` coincide con el valor máximo de un entero `smallint` con signo. Si el texto no es válido o supera el máximo, se devuelve `undefined` para que el formulario impida guardar.

## 1.6 Guardar el estado de “Reforma pendiente”

```js
async function guardarReforma(tema, checkbox) {
    const valorAnterior = Boolean(tema.tieneReformaPendiente);
    const nuevoValor = checkbox.checked;
    const checkboxes = [...document.querySelectorAll('[data-tema-id]')]
        .filter((elemento) => elemento.dataset.temaId === String(tema.temas_id));
    checkboxes.forEach((elemento) => {
        elemento.disabled = true;
    });
    estadoDatos.textContent = 'Guardando cambio…';

    try {
        const { error } = await neon
            .from('temas')
            .update({ tieneReformaPendiente: nuevoValor })
            .eq('temas_id', tema.temas_id)
            .select('temas_id')
            .single();

        if (error) throw error;

        tema.tieneReformaPendiente = nuevoValor;
        checkboxes.forEach((elemento) => {
            elemento.checked = nuevoValor;
        });
        estadoDatos.textContent = 'Cambio guardado.';
    } catch (error) {
        checkboxes.forEach((elemento) => {
            elemento.checked = valorAnterior;
        });
        estadoDatos.textContent = `No se pudo guardar el cambio: ${error.message}`;
    } finally {
        checkboxes.forEach((elemento) => {
            elemento.disabled = false;
        });
    }
}
```

Esta función se ejecuta cuando cambia el checkbox de reforma del detalle. Busca los checkbox cuyo `data-tema-id` corresponde al tema actual para bloquearlos mientras se guarda el cambio.

La petición a Neon Data API se lee de izquierda a derecha:

1. `from('temas')`: usar la tabla `temas`.
2. `update(...)`: cambiar el valor de `tieneReformaPendiente`.
3. `eq(...)`: limitar el cambio a la fila cuyo `temas_id` coincide.
4. `select(...).single()`: pedir la fila afectada y esperar un único resultado.

Mientras se guarda, los checkbox se deshabilitan para evitar cambios repetidos. Si la petición falla, la interfaz recupera el valor anterior. El bloque `finally` se ejecuta tanto si la operación tiene éxito como si falla, así que vuelve a habilitar los controles.

---

# 2. Inicio, mantenimiento y cierre de sesión

## 2.1 Mostrar el estado de acceso

```js
function mostrarAcceso(mensaje = '') {
    usuarioActivoId = undefined;
    panelAcceso.hidden = false;
    contenidoTemas.hidden = true;
    temaDetalleActual = undefined;
    botonCerrarSesion.hidden = true;
    usuarioActivo.hidden = true;
    usuarioActivo.textContent = '';
    contenedorMaterias.replaceChildren();
    estadoDatos.textContent = '';
    estadoAcceso.textContent = mensaje;
}
```

Esta función deja la aplicación en la pantalla de acceso. El parámetro `mensaje` tiene un valor por defecto (`''`), por lo que se puede llamar sin texto o pasando un error para mostrar.

También limpia los datos de la sesión anterior: se vacía la lista de materias y se elimina el tema seleccionado. `replaceChildren()` sin argumentos quita todos los elementos hijos del contenedor.

## 2.2 Mostrar el contenido después de autenticar

```js
async function mostrarTemas(user) {
    panelAcceso.hidden = true;
    contenidoTemas.hidden = false;
    botonCerrarSesion.hidden = false;
    usuarioActivo.hidden = false;
    usuarioActivo.textContent = user.email ?? 'Sesión activa';
    await cargarTemas();
}
```

Esta función cambia la interfaz al modo autenticado, muestra el correo del usuario y pide cargar los temas.

El operador `??` significa “usa el valor de la izquierda, salvo que sea `null` o `undefined`”. Si Neon Auth no devuelve un correo, se muestra `Sesión activa`.

Como `cargarTemas` es asíncrona, `await` espera a que termine. Si falla, el error se gestiona en el lugar desde donde se llama a `mostrarTemas`.

## 2.3 Enviar el formulario de inicio de sesión

```js
if (neon) {
    formularioAcceso.addEventListener('submit', async (event) => {
        event.preventDefault();
        botonIniciarSesion.disabled = true;
        estadoAcceso.textContent = 'Iniciando sesión…';

        const formData = new FormData(formularioAcceso);
        try {
            const { data, error } = await neon.auth.signIn.email({
                email: String(formData.get('email')),
                password: String(formData.get('password'))
            });

            if (error) {
                estadoAcceso.textContent = `No se pudo iniciar sesión: ${error.message}`;
                return;
            }

            if (!data?.session || !data.user) {
                throw new Error('Neon Auth no devolvió una sesión después de iniciar sesión.');
            }

            if (usuarioActivoId !== data.user.id) {
                usuarioActivoId = data.user.id;
                await mostrarTemas(data.user).catch((loadError) => {
                    estadoDatos.textContent = `No se pudieron cargar los temas: ${loadError.message}`;
                });
            }

            formularioAcceso.reset();
            estadoAcceso.textContent = '';
        } catch (error) {
            estadoAcceso.textContent = `No se pudo iniciar sesión: ${error.message}`;
        } finally {
            botonIniciarSesion.disabled = false;
        }
    });
}
```

Todo el bloque de conexión y autenticación está dentro de `if (neon)`. Si faltan las variables públicas de Neon y no se pudo inicializar el cliente, no se instalan controladores que intentarían usarlo.

Al enviar el formulario:

1. `preventDefault()` evita la recarga normal de la página.
2. Se deshabilita el botón y se muestra un mensaje de espera.
3. `FormData` lee los campos del formulario por sus atributos `name` (`email` y `password`).
4. `signIn.email` envía las credenciales a Neon Auth y devuelve los datos del usuario y la sesión.
5. Si hay un error, se muestra. Si no, la interfaz usa la sesión devuelta directamente, sin hacer una segunda consulta de sesión.
6. `finally` vuelve a habilitar el botón en ambos casos.

El bloque `catch` captura errores inesperados de la llamada. El objeto `error` que devuelve el SDK se comprueba por separado porque muchas respuestas de autenticación y de la Data API incluyen el error en el resultado.

## 2.4 Cerrar sesión

```js
botonCerrarSesion.addEventListener('click', async () => {
    botonCerrarSesion.disabled = true;
    try {
        const { error } = await neon.auth.signOut();
        if (error) {
            estadoDatos.textContent = `No se pudo cerrar sesión: ${error.message}`;
            return;
        }
        mostrarAcceso();
    } catch (error) {
        estadoDatos.textContent = `No se pudo cerrar sesión: ${error.message}`;
    } finally {
        botonCerrarSesion.disabled = false;
    }
});
```

El botón llama a `signOut()`. Si Neon Auth confirma el cierre, se llama a `mostrarAcceso()`; si ocurre un error, se conserva la sesión y se muestra el mensaje. Al igual que en el inicio de sesión, el botón se vuelve a habilitar en `finally`.

Si Neon Auth confirma el cierre de sesión, `mostrarAcceso()` devuelve explícitamente la interfaz al formulario. El estado de sesión del SDK también se actualiza y se escucha en el apartado siguiente.

## 2.5 Escuchar cambios de autenticación y recuperar sesiones existentes

```js
neon.auth.useSession.subscribe(({ data, isPending }) => {
    if (isPending) return;

    if (!data?.session || !data.user) {
        if (usuarioActivoId) mostrarAcceso();
        return;
    }

    if (usuarioActivoId !== data.user.id) {
        usuarioActivoId = data.user.id;
        window.setTimeout(() => {
            mostrarTemas(data.user).catch((error) => {
                estadoDatos.textContent = `No se pudieron cargar los temas: ${error.message}`;
            });
        }, 0);
    }
});

neon.auth.getSession().then(({ data, error }) => {
    if (error) {
        mostrarAcceso(`No se pudo comprobar la sesión: ${error.message}`);
        return;
    }

    if (data?.session && data.user && usuarioActivoId !== data.user.id) {
        usuarioActivoId = data.user.id;
        mostrarTemas(data.user).catch((loadError) => {
            estadoDatos.textContent = `No se pudieron cargar los temas: ${loadError.message}`;
        });
    } else if (!data?.session && !usuarioActivoId) {
        mostrarAcceso();
    }
}).catch((error) => {
    mostrarAcceso(`No se pudo comprobar la sesión: ${error.message}`);
});
```

Hay dos mecanismos complementarios:

- `useSession.subscribe` reacciona a cambios de sesión mientras la página está abierta, incluidos los cambios realizados desde otra pestaña.
- `getSession()` comprueba si ya había una sesión guardada al cargar o recargar la web.

La comparación con `usuarioActivoId` evita iniciar varias cargas para el mismo usuario. En la suscripción se usa `setTimeout(..., 0)` para aplazar la carga al siguiente ciclo del navegador; así se evita realizar parte de la lógica directamente dentro del callback de autenticación.

Los `.catch(...)` muestran en la interfaz los errores que puedan producirse al cargar los datos.

---

# 3. Carga y representación de temas y detalle

## 3.1 Construir la tabla de una materia

```js
function crearTabla(tipo, temas, indice) {
    const seccion = crearElemento('section', 'materia');
    const tituloId = `titulo-materia-${indice}`;
    seccion.setAttribute('aria-labelledby', tituloId);

    const encabezado = crearElemento('div', 'materia-encabezado');
    const indicador = crearElemento('span', 'materia-indicador indicador-lila');
    indicador.setAttribute('aria-hidden', 'true');
    encabezado.append(indicador);

    const titulo = crearElemento('h2', '', tipo);
    titulo.id = tituloId;
    encabezado.append(titulo);
    seccion.append(encabezado);

    const contenedorTabla = crearElemento('div', 'tabla-contenedor');
    const tabla = document.createElement('table');
    const thead = document.createElement('thead');
    const filaTitulos = document.createElement('tr');

    for (const texto of ['Tema', 'Vueltas']) {
        const celda = crearElemento('th', '', texto);
        celda.scope = 'col';
        filaTitulos.append(celda);
    }

    thead.append(filaTitulos);
    tabla.append(thead);
    // En este punto se crea el <tbody> y se añaden las filas de temas.
    // El fragmento de las filas se explica a continuación.

    // Al final se añaden la tabla y su contenedor a la sección.
    return seccion;
}
```

`crearTabla` construye una sección completa para una materia, por ejemplo una agrupación de temas del mismo tipo. En vez de escribir HTML como una cadena, crea cada nodo mediante `document.createElement` o `crearElemento`.

`aria-labelledby` conecta la sección con su título para tecnologías de asistencia. El indicador decorativo tiene `aria-hidden="true"` para que no se anuncie como contenido.

El `tbody` contiene una fila vacía si no hay temas; el mensaje ocupa las dos columnas. Para cada tema se crea una fila con:

- Un botón “Tema N” que abre el detalle.
- El número de vueltas.

## 3.2 Crear las filas de la lista

```js
for (const tema of temas) {
    const fila = document.createElement('tr');
    const celdaTema = document.createElement('td');
    const botonTema = crearElemento('button', 'enlace-tema', `Tema ${tema.numTema ?? ''}`);
    botonTema.type = 'button';
    botonTema.addEventListener('click', () => abrirDetalle(tema, botonTema));
    celdaTema.append(botonTema);
    fila.append(celdaTema);

    const celdaVueltas = crearElemento('td', '', String(obtenerVueltas(tema).length));
    celdaVueltas.dataset.contadorTema = String(tema.temas_id);
    fila.append(celdaVueltas);

    tbody.append(fila);
}
```

El evento `click` del botón llama a `abrirDetalle`. Se pasa tanto el tema como el botón de origen: el tema para mostrar su información y el botón para poder devolverle el foco luego.

`dataset` permite guardar datos auxiliares en atributos `data-*` del HTML. En este caso, el contador conserva el ID del tema para que pueda actualizarse después de añadir o eliminar una vuelta.

## 3.3 Formatear fechas, iconos y botones accesibles

```js
function formatearFecha(fecha) {
    if (!fecha) return '';
    const [year, month, day] = fecha.split('-').map(Number);
    return new Intl.DateTimeFormat('es-ES').format(new Date(year, month - 1, day));
}

function crearIcono(nombre) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Se configuran el tamaño, el trazo y la accesibilidad del SVG.
    const paths = {
        editar: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z'],
        eliminar: ['M3 6h18', 'M8 6V4h8v2', 'm19 6-1 14H6L5 6', 'M10 11v5', 'M14 11v5'],
        guardar: ['m5 12 4 4L19 6'],
        cancelar: ['M18 6 6 18', 'M6 6l12 12']
    };

    for (const d of paths[nombre]) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        svg.append(path);
    }
    return svg;
}

function crearBotonAccion(etiqueta, icono, clase, accion) {
    const boton = crearElemento('button', clase);
    boton.type = 'button';
    boton.setAttribute('aria-label', etiqueta);
    boton.title = etiqueta;
    boton.append(crearIcono(icono));
    boton.addEventListener('click', accion);
    return boton;
}
```

`formatearFecha` recibe una fecha en formato `AAAA-MM-DD` y la presenta según la configuración española del navegador. Se construye la fecha con componentes numéricos para evitar interpretar la cadena como una fecha UTC.

`crearIcono` dibuja SVG en JavaScript. Los datos de cada dibujo son instrucciones de trazado (`d`) de SVG. `crearBotonAccion` reutiliza esa función para hacer botones con icono y añade `aria-label` y `title`; aunque visualmente solo se vea el icono, un lector de pantalla puede anunciar la acción.

## 3.4 Dibujar una fila individual de vuelta o cante

```js
function renderizarFilaVuelta(vuelta, indice) {
    const fila = document.createElement('tr');
    fila.append(crearElemento('td', '', String(vuelta.numVuelta ?? '')));
    fila.append(crearElemento('td', '', formatearFecha(vuelta.fechaVuelta)));

    const acciones = document.createElement('td');
    acciones.className = 'acciones-vuelta';
    acciones.append(
        crearBotonAccion('Editar vuelta', 'editar', 'boton-accion', () => editarVuelta(vuelta, indice)),
        crearBotonAccion('Eliminar vuelta', 'eliminar', 'boton-accion boton-peligro', () => eliminarVuelta(vuelta))
    );
    fila.append(acciones);
    return fila;
}

function renderizarFilaCante(cante, indice) {
    const fila = document.createElement('tr');
    fila.append(crearElemento('td', '', String(cante.numCante ?? '')));
    fila.append(crearElemento('td', '', formatearTiempoCante(cante.tiempoCante)));
    fila.append(crearElemento('td', '', cante.observacionesCante ?? ''));

    const acciones = document.createElement('td');
    acciones.className = 'acciones-vuelta';
    acciones.append(
        crearBotonAccion('Editar cante', 'editar', 'boton-accion', () => editarCante(cante, indice)),
        crearBotonAccion('Eliminar cante', 'eliminar', 'boton-accion boton-peligro', () => eliminarCante(cante))
    );
    fila.append(acciones);
    return fila;
}
```

Cada función convierte un objeto de datos en una fila HTML. Las filas muestran los valores y añaden botones para modificar o borrar el registro.

En la fila de cante, `tiempoCante` pasa por `formatearTiempoCante`, y las observaciones vacías se muestran como texto vacío gracias a `?? ''`.

## 3.5 Dibujar las tablas del detalle

```js
function renderizarVueltas(tema) {
    const vueltas = obtenerVueltas(tema);
    tema.temasVueltas = vueltas;
    tbodyVueltas.replaceChildren();

    if (vueltas.length === 0) {
        const fila = crearElemento('tr', 'fila-vacia');
        const celda = crearElemento('td', '', 'Todavía no hay vueltas registradas para este tema.');
        celda.colSpan = 3;
        fila.append(celda);
        tbodyVueltas.append(fila);
        return;
    }

    vueltas.forEach((vuelta, indice) => tbodyVueltas.append(renderizarFilaVuelta(vuelta, indice)));
}

function renderizarCantes(tema) {
    const cantes = obtenerCantes(tema);
    tema.temasCantes = cantes;
    tbodyCantes.replaceChildren();

    if (cantes.length === 0) {
        const fila = crearElemento('tr', 'fila-vacia');
        const celda = crearElemento('td', '', 'Todavía no hay cantes registrados para este tema.');
        celda.colSpan = 4;
        fila.append(celda);
        tbodyCantes.append(fila);
        return;
    }

    cantes.forEach((cante, indice) => tbodyCantes.append(renderizarFilaCante(cante, indice)));
}
```

Estas funciones vacían el cuerpo de la tabla y lo reconstruyen con los datos actuales. Si la lista está vacía, colocan un mensaje que ocupa todas las columnas (`colSpan`).

Volver a crear las filas después de guardar o borrar es una estrategia sencilla de mantener: la interfaz se genera a partir del estado en memoria actualizado.

## 3.6 Cargar temas y agruparlos

```js
async function cargarTemas() {
    const { data, error } = await neon
        .from('temas')
        .select('temas_id,numTema,typeTema,tieneReformaPendiente,temasVueltas(vuelta_id,temas_id,fechaVuelta,numVuelta),temasCantes(cante_id,temas_id,numCante,tiempoCante,observacionesCante)')
        .order('typeTema')
        .order('numTema');

    if (error) {
        throw error;
    }

    contenedorMaterias.replaceChildren();
    const grupos = new Map();
    for (const temaOriginal of data ?? []) {
        const tema = {
            ...temaOriginal,
            temasVueltas: obtenerVueltas(temaOriginal),
            temasCantes: obtenerCantes(temaOriginal)
        };
        const tipo = tema.typeTema || 'Sin materia';
        if (!grupos.has(tipo)) grupos.set(tipo, []);
        grupos.get(tipo).push(tema);
    }

    if (grupos.size === 0) {
        estadoDatos.textContent = 'No hay temas registrados todavía.';
        volverALista();
        return;
    }

    let indice = 0;
    for (const [tipo, temas] of grupos) {
        contenedorMaterias.append(crearTabla(tipo, temas, indice));
        indice += 1;
    }
    estadoDatos.textContent = `Temas cargados desde Neon (${data.length}).`;
    volverALista();
}
```

Esta es la lectura principal de la base de datos. La consulta pide:

- Los campos básicos de `temas`.
- La relación `temasVueltas`, con sus columnas necesarias.
- La relación `temasCantes`, también con las columnas necesarias.
- Un orden primero por tipo de tema y después por número.

Si Neon Data API devuelve un error, `throw error` lo propaga a quien llamó a `cargarTemas`; allí se muestra un mensaje al usuario.

Después se normalizan las relaciones y se agrupan los temas en un `Map`. Un `Map` guarda pares clave/valor: aquí la clave es el tipo de tema y el valor es el array de temas que pertenecen a ese tipo. Finalmente se crea una tabla por grupo.

## 3.7 Abrir el detalle y volver a la lista

```js
function abrirDetalle(tema, botonOrigen) {
    temaDetalleActual = tema;
    botonTemaAnterior = botonOrigen;
    detalleTitulo.textContent = `Tema ${tema.numTema ?? ''} ${tema.typeTema ?? ''}`.trim();
    renderizarVueltas(tema);
    renderizarCantes(tema);
    estadoVuelta.textContent = '';
    estadoCante.textContent = '';
    checkboxReformaDetalle.checked = Boolean(tema.tieneReformaPendiente);
    checkboxReformaDetalle.dataset.temaId = String(tema.temas_id);
    checkboxReformaDetalle.setAttribute('aria-label', `Reforma pendiente para Tema ${tema.numTema ?? ''}`);
    vistaLista.hidden = true;
    vistaDetalle.hidden = false;
    detalleTitulo.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverALista() {
    vistaDetalle.hidden = true;
    vistaLista.hidden = false;
    temaDetalleActual = undefined;
    botonTemaAnterior?.focus();
    botonTemaAnterior = undefined;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

Al abrir el detalle se guarda el tema en `temaDetalleActual`, se rellenan las dos tablas y se sincroniza el checkbox de reforma. Después se oculta la lista y se muestra el detalle.

Al volver, se hace lo contrario y se borra el tema actual. `?.` es el encadenamiento opcional: `botonTemaAnterior?.focus()` llama a `focus()` solo si existe un botón guardado.

La llamada a `focus()` mejora la navegación con teclado. `scrollTo` lleva la página arriba con desplazamiento suave.

---

# 4. Crear, modificar y eliminar vueltas y cantes

## 4.1 Patrón común de edición

Las dos funciones de edición (`editarVuelta` y `editarCante`) siguen la misma secuencia:

1. Crear una fila HTML de edición con campos de formulario.
2. Validar los campos antes de guardar.
3. Preparar un objeto con los valores nuevos.
4. Insertar una fila nueva o actualizar la existente en Neon Data API.
5. Actualizar los datos que están en memoria.
6. Volver a dibujar la tabla y mostrar un mensaje.

El parámetro `nueva = false` permite reutilizar la misma función para ambos casos. Si se llama con `nueva` igual a `true`, la fila se inserta; de lo contrario, se actualiza.

## 4.2 Editar o añadir una vuelta

```js
function editarVuelta(vuelta, indice, nueva = false) {
    const tema = temaDetalleActual;
    const fila = document.createElement('tr');
    fila.className = 'fila-edicion';

    const campoNumero = document.createElement('input');
    campoNumero.type = 'number';
    campoNumero.min = '1';
    campoNumero.max = '32767';
    campoNumero.step = '1';
    campoNumero.required = true;
    campoNumero.value = String(vuelta.numVuelta ?? '');

    const campoFecha = document.createElement('input');
    campoFecha.type = 'date';
    campoFecha.required = true;
    campoFecha.value = vuelta.fechaVuelta ?? '';

    // Los campos se colocan en celdas de la fila.
    // Luego se crea el botón Guardar y se añade la fila a la tabla.
}
```

La fila de edición tiene un campo numérico con límites y un campo de fecha. `required` hace que el navegador no permita guardar si falta un valor; `min`, `max` y `step` restringen el número.

El manejador del botón Guardar hace la petición:

```js
const cambios = {
    numVuelta: Number(campoNumero.value),
    fechaVuelta: campoFecha.value
};

const consulta = nueva
    ? neon.from('temasVueltas').insert({
        ...cambios,
        temas_id: tema.temas_id
    })
    : neon.from('temasVueltas')
        .update(cambios)
        .eq('vuelta_id', vuelta.vuelta_id);

const { data, error } = await consulta
    .select('vuelta_id,temas_id,fechaVuelta,numVuelta')
    .single();
```

El operador ternario `condicion ? A : B` elige entre dos caminos:

- Si `nueva` es `true`, `insert` crea el registro y añade `temas_id` para relacionarlo con el tema actual.
- Si `nueva` es `false`, `update` modifica la vuelta cuyo `vuelta_id` coincide.

`...cambios` copia las propiedades del objeto `cambios` dentro del objeto que se inserta. La respuesta selecciona la fila afectada y exige que haya solo una (`single()`).

Si la operación termina correctamente, el resultado se incorpora al array del tema o se copian los cambios sobre el objeto existente. Después las vueltas se ordenan por número y se vuelve a dibujar la tabla. Al añadir, también se actualiza el contador de vueltas en la lista.

El botón Cancelar descarta la edición reconstruyendo la tabla a partir de los datos que ya estaban guardados en memoria. El campo numérico recibe foco al abrir el editor.

## 4.3 Editar o añadir un cante

El formulario de cante usa tres campos: número, duración y observaciones.

```js
const campoNumero = document.createElement('input');
campoNumero.type = 'number';
campoNumero.min = '1';
campoNumero.max = '32767';
campoNumero.step = '1';
campoNumero.required = true;

const campoTiempo = document.createElement('input');
campoTiempo.type = 'text';
campoTiempo.inputMode = 'numeric';
campoTiempo.required = true;
campoTiempo.pattern = '[0-9]+:[0-5][0-9]';
campoTiempo.title = 'Usa minutos:segundos, por ejemplo 1:25 (máximo 9:06:07)';

const campoObservaciones = document.createElement('textarea');
campoObservaciones.rows = 2;
campoObservaciones.value = cante.observacionesCante ?? '';
```

`pattern` añade una validación del navegador para exigir el formato `minutos:segundos`. `inputMode = 'numeric'` sugiere un teclado numérico en dispositivos móviles. Las observaciones usan un `textarea` porque pueden ocupar más de una línea.

Antes de guardar se convierten los datos y se comprueba el límite de `smallint`:

```js
const cambios = {
    numCante: Number(campoNumero.value),
    tiempoCante: parsearTiempoCante(campoTiempo.value),
    observacionesCante: campoObservaciones.value
};

if (cambios.tiempoCante === undefined) {
    campoTiempo.setCustomValidity('La duración debe ser como máximo 9:06:07.');
    campoTiempo.reportValidity();
    botonGuardar.disabled = false;
    return;
}
```

`setCustomValidity` permite mostrar un mensaje de validación propio. Se borra al volver a escribir en el campo mediante el evento `input`.

La inserción/actualización sigue el mismo patrón de las vueltas:

```js
const consulta = nueva
    ? neon.from('temasCantes').insert({
        ...cambios,
        temas_id: tema.temas_id
    })
    : neon.from('temasCantes')
        .update(cambios)
        .eq('cante_id', cante.cante_id);

const { data, error } = await consulta
    .select('cante_id,temas_id,numCante,tiempoCante,observacionesCante')
    .single();
```

El registro nuevo se vincula mediante la clave foránea `temas_id`. Para actualizar uno existente, la condición usa su clave primaria `cante_id`. Tras guardar, los cantes se ordenan por número y se vuelve a representar la tabla.

## 4.4 Eliminar una vuelta o un cante

```js
async function eliminarVuelta(vuelta) {
    if (!window.confirm(`¿Seguro que quieres eliminar la vuelta ${vuelta.numVuelta}? Esta acción no se puede deshacer.`)) {
        return;
    }

    estadoVuelta.textContent = 'Eliminando vuelta…';
    try {
        const { error } = await neon
            .from('temasVueltas')
            .delete()
            .eq('vuelta_id', vuelta.vuelta_id)
            .select('vuelta_id')
            .single();

        if (error) throw error;

        temaDetalleActual.temasVueltas = temaDetalleActual.temasVueltas
            .filter((item) => item.vuelta_id !== vuelta.vuelta_id);
        renderizarVueltas(temaDetalleActual);
        actualizarContadorVueltasLista(temaDetalleActual);
        estadoVuelta.textContent = 'Vuelta eliminada correctamente.';
    } catch (error) {
        estadoVuelta.textContent = `No se pudo eliminar la vuelta: ${error.message}`;
    }
}
```

Antes de borrar, `window.confirm` pide confirmación. Si el usuario cancela, `return` termina la función sin hacer la petición.

La consulta usa `delete()` y filtra por la clave primaria. Cuando Neon Data API confirma el borrado, `filter(...)` crea un nuevo array que excluye esa vuelta. Después se actualizan la tabla y el contador.

`eliminarCante` realiza el mismo proceso contra `temasCantes`, utilizando `cante_id`. Además conserva una referencia local al tema que se estaba mostrando; de esa manera puede comprobar si el usuario sigue en ese detalle antes de modificar la interfaz.

## 4.5 Actualizar el contador de vueltas

```js
function actualizarContadorVueltasLista(tema) {
    const contadorLista = document.querySelector(
        `[data-contador-tema="${CSS.escape(String(tema.temas_id))}"]`
    );
    if (contadorLista) contadorLista.textContent = String(obtenerVueltas(tema).length);
}
```

La función busca el elemento que se creó con `data-contador-tema`. `CSS.escape` protege el valor antes de usarlo dentro de un selector CSS. Si encuentra el contador, actualiza el texto con el número actual de vueltas.

## 4.6 Conectar los controles de la página con sus acciones

```js
botonVolver.addEventListener('click', volverALista);

checkboxReformaDetalle.addEventListener('change', () => {
    if (temaDetalleActual) guardarReforma(temaDetalleActual, checkboxReformaDetalle);
});
```

Los `addEventListener` conectan eventos de la página con funciones JavaScript. El checkbox del detalle comprueba que haya un tema seleccionado antes de pedir el guardado.

Al pulsar “Añadir cante”, el programa calcula el siguiente número disponible y abre una fila vacía:

```js
botonAnadirCante.addEventListener('click', () => {
    if (!temaDetalleActual) return;

    if (tbodyCantes.querySelector('.fila-edicion')) {
        estadoCante.textContent = 'Guarda o cancela el cante que estás editando antes de añadir otro.';
        return;
    }

    const cantes = obtenerCantes(temaDetalleActual);
    const maxNumCante = cantes.reduce((maximo, cante) => {
        const numero = Number(cante.numCante);
        return Number.isFinite(numero) ? Math.max(maximo, numero) : maximo;
    }, 0);
    estadoCante.textContent = '';
    editarCante({
        numCante: maxNumCante + 1,
        tiempoCante: 0,
        observacionesCante: ''
    }, cantes.length, true);
});
```

Solo se permite una fila de edición a la vez. `querySelector('.fila-edicion')` busca si ya existe una. Si no hay una, `reduce` recorre los números de cante para encontrar el máximo; el nuevo empieza en máximo más uno. Para una lista vacía, el valor inicial `0` hace que el primer cante sea el número `1`.

El botón “Añadir vuelta” repite este patrón con la fecha de hoy:

```js
const vueltas = obtenerVueltas(temaDetalleActual);
const maxNumVuelta = vueltas.reduce((maximo, vuelta) => {
    const numero = Number(vuelta.numVuelta);
    return Number.isFinite(numero) ? Math.max(maximo, numero) : maximo;
}, 0);

editarVuelta({
    numVuelta: maxNumVuelta + 1,
    fechaVuelta: fechaLocalActual()
}, vueltas.length, true);
```

En ambos casos, abrir el formulario no modifica todavía la base de datos. El registro se crea únicamente cuando se pulsa Guardar.

---

# Recorrido completo: qué sucede al usar la aplicación

1. El navegador carga `app.js`, que localiza elementos de la página y crea el cliente de Neon Auth y Neon Data API.
2. `getSession()` comprueba si el navegador conserva una sesión válida.
3. Si hay una sesión, `mostrarTemas()` muestra el contenido y llama a `cargarTemas()`.
4. `cargarTemas()` pide los temas y sus vueltas y cantes relacionados, agrupa los temas y construye la lista.
5. Al pulsar un tema, `abrirDetalle()` muestra la vista de detalle y representa sus tablas.
6. Crear o editar una fila abre controles HTML; Guardar envía los cambios a Neon Data API y redibuja la tabla.
7. Eliminar requiere confirmación, borra el registro remoto y después lo quita del estado en memoria.
8. Cerrar sesión notifica a Neon Auth; la suscripción de `useSession` llama a `mostrarAcceso()` y limpia la interfaz.

# Ideas clave para recordar

- `app.js` coordina tres cosas: los eventos del usuario, el contenido del DOM y las peticiones a Neon.
- La autenticación proviene de Neon Auth y los datos de Neon Data API; también se mantienen en objetos JavaScript para redibujar la interfaz después de un cambio.
- `temas` es la tabla principal; `temasVueltas` y `temasCantes` son listas de registros relacionados mediante `temas_id`.
- Las claves primarias (`vuelta_id` y `cante_id`) identifican qué fila modificar o eliminar; `temas_id` identifica a qué tema pertenece una fila nueva.
- `async` y `await` hacen que la interfaz pueda esperar a la base de datos y mostrar errores o confirmaciones.
- Las funciones `renderizar...` construyen la vista; las funciones `editar...`, `eliminar...` y los manejadores de botones cambian los datos.
