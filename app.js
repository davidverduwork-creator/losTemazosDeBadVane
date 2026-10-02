import { crearClienteSupabase } from './src/supabase.js';

const panelAcceso = document.getElementById('panel-acceso');
const formularioAcceso = document.getElementById('form-acceso');
const estadoAcceso = document.getElementById('estado-acceso');
const botonIniciarSesion = document.getElementById('btn-iniciar-sesion');
const botonCerrarSesion = document.getElementById('btn-cerrar-sesion');
const usuarioActivo = document.getElementById('usuario-activo');
const contenidoTemas = document.getElementById('temas');
const contenedorMaterias = document.getElementById('materias');
const estadoDatos = document.getElementById('estado-datos');
let supabase;
let usuarioActivoId;

try {
    supabase = crearClienteSupabase();
} catch (error) {
    estadoAcceso.textContent = error.message;
    botonIniciarSesion.disabled = true;
}

function crearElemento(tag, className, texto) {
    const elemento = document.createElement(tag);
    if (className) elemento.className = className;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

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

    for (const texto of ['Tema', 'Vueltas', 'Reforma']) {
        const celda = crearElemento('th', '', texto);
        celda.scope = 'col';
        filaTitulos.append(celda);
    }

    thead.append(filaTitulos);
    tabla.append(thead);

    const tbody = document.createElement('tbody');
    if (temas.length === 0) {
        const fila = crearElemento('tr', 'fila-vacia');
        const celda = crearElemento('td', '', 'Aún no hay temas para mostrar.');
        celda.colSpan = 3;
        fila.append(celda);
        tbody.append(fila);
    }

    for (const tema of temas) {
        const fila = document.createElement('tr');
        fila.append(crearElemento('td', '', String(tema.numTema ?? '')));
        fila.append(crearElemento('td', '', String(tema.temasVueltas?.length ?? 0)));

        const celdaReforma = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = Boolean(tema.tieneReformaPendiente);
        checkbox.setAttribute('aria-label', `Reforma pendiente para ${tema.numTema ?? 'este tema'}`);
        checkbox.addEventListener('change', async () => {
            const valorAnterior = tema.tieneReformaPendiente;
            checkbox.disabled = true;
            estadoDatos.textContent = 'Guardando cambio…';

            try {
                const { error } = await supabase
                    .from('temas')
                    .update({ tieneReformaPendiente: checkbox.checked })
                    .eq('temas_id', tema.temas_id)
                    .select('temas_id')
                    .single();

                if (error) throw error;

                tema.tieneReformaPendiente = checkbox.checked;
                estadoDatos.textContent = 'Cambio guardado.';
            } catch (error) {
                checkbox.checked = Boolean(valorAnterior);
                estadoDatos.textContent = `No se pudo guardar el cambio: ${error.message}`;
            } finally {
                checkbox.disabled = false;
            }
        });
        celdaReforma.append(checkbox);
        fila.append(celdaReforma);
        tbody.append(fila);
    }

    tabla.append(tbody);
    contenedorTabla.append(tabla);
    seccion.append(contenedorTabla);
    return seccion;
}

async function cargarTemas() {
    const { data, error } = await supabase
        .from('temas')
        .select('temas_id,numTema,typeTema,tieneReformaPendiente,temasVueltas(vuelta_id,fechaVuelta,numVuelta)')
        .order('typeTema')
        .order('numTema');

    if (error) {
        throw error;
    }

    contenedorMaterias.replaceChildren();
    const grupos = new Map();
    for (const tema of data ?? []) {
        const tipo = tema.typeTema || 'Sin materia';
        if (!grupos.has(tipo)) grupos.set(tipo, []);
        grupos.get(tipo).push(tema);
    }

    if (grupos.size === 0) {
        estadoDatos.textContent = 'No hay temas registrados todavía.';
        return;
    }

    let indice = 0;
    for (const [tipo, temas] of grupos) {
        contenedorMaterias.append(crearTabla(tipo, temas, indice));
        indice += 1;
    }
    estadoDatos.textContent = `Temas cargados desde Supabase (${data.length}).`;
}

function mostrarAcceso(mensaje = '') {
    usuarioActivoId = undefined;
    panelAcceso.hidden = false;
    contenidoTemas.hidden = true;
    botonCerrarSesion.hidden = true;
    usuarioActivo.hidden = true;
    usuarioActivo.textContent = '';
    contenedorMaterias.replaceChildren();
    estadoDatos.textContent = '';
    estadoAcceso.textContent = mensaje;
}

async function mostrarTemas(user) {
    panelAcceso.hidden = true;
    contenidoTemas.hidden = false;
    botonCerrarSesion.hidden = false;
    usuarioActivo.hidden = false;
    usuarioActivo.textContent = user.email ?? 'Sesión activa';
    await cargarTemas();
}

if (supabase) {
    formularioAcceso.addEventListener('submit', async (event) => {
        event.preventDefault();
        botonIniciarSesion.disabled = true;
        estadoAcceso.textContent = 'Iniciando sesión…';

        const formData = new FormData(formularioAcceso);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: String(formData.get('email')),
                password: String(formData.get('password'))
            });

            if (error) {
                estadoAcceso.textContent = `No se pudo iniciar sesión: ${error.message}`;
                return;
            }

            formularioAcceso.reset();
            estadoAcceso.textContent = '';
        } catch (error) {
            estadoAcceso.textContent = `No se pudo iniciar sesión: ${error.message}`;
        } finally {
            botonIniciarSesion.disabled = false;
        }
    });

    botonCerrarSesion.addEventListener('click', async () => {
        botonCerrarSesion.disabled = true;
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                estadoDatos.textContent = `No se pudo cerrar sesión: ${error.message}`;
            }
        } catch (error) {
            estadoDatos.textContent = `No se pudo cerrar sesión: ${error.message}`;
        } finally {
            botonCerrarSesion.disabled = false;
        }
    });

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            mostrarAcceso();
            return;
        }

        if (event === 'SIGNED_IN' && session && usuarioActivoId !== session.user.id) {
            usuarioActivoId = session.user.id;
            window.setTimeout(() => {
                mostrarTemas(session.user).catch((error) => {
                    estadoDatos.textContent = `No se pudieron cargar los temas: ${error.message}`;
                });
            }, 0);
        }
    });

    supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
            mostrarAcceso(`No se pudo comprobar la sesión: ${error.message}`);
            return;
        }

        if (data.session && usuarioActivoId !== data.session.user.id) {
            usuarioActivoId = data.session.user.id;
            mostrarTemas(data.session.user).catch((loadError) => {
                estadoDatos.textContent = `No se pudieron cargar los temas: ${loadError.message}`;
            });
        } else if (!data.session && !usuarioActivoId) {
            mostrarAcceso();
        }
    }).catch((error) => {
        mostrarAcceso(`No se pudo comprobar la sesión: ${error.message}`);
    });
}
