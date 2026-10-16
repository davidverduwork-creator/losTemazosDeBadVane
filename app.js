import { crearClienteSupabase } from './src/supabase.js';

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
let supabase;
let usuarioActivoId;
let temaDetalleActual;
let botonTemaAnterior;

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

function fechaLocalActual() {
    const fecha = new Date();
    const ano = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

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
        const { error } = await supabase
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
        const celdaTema = document.createElement('td');
        const botonTema = crearElemento('button', 'enlace-tema', `Tema ${tema.numTema ?? ''}`);
        botonTema.type = 'button';
        botonTema.addEventListener('click', () => abrirDetalle(tema, botonTema));
        celdaTema.append(botonTema);
        fila.append(celdaTema);
        const celdaVueltas = crearElemento('td', '', String(obtenerVueltas(tema).length));
        celdaVueltas.dataset.contadorTema = String(tema.temas_id);
        fila.append(celdaVueltas);

        const celdaReforma = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = Boolean(tema.tieneReformaPendiente);
        checkbox.dataset.temaId = String(tema.temas_id);
        checkbox.setAttribute('aria-label', `Reforma pendiente para ${tema.numTema ?? 'este tema'}`);
        checkbox.addEventListener('change', () => guardarReforma(tema, checkbox));
        celdaReforma.append(checkbox);
        fila.append(celdaReforma);
        tbody.append(fila);
    }

    tabla.append(tbody);
    contenedorTabla.append(tabla);
    seccion.append(contenedorTabla);
    return seccion;
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    const [year, month, day] = fecha.split('-').map(Number);
    return new Intl.DateTimeFormat('es-ES').format(new Date(year, month - 1, day));
}

function crearIcono(nombre) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

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

function editarCante(cante, indice, nueva = false) {
    const tema = temaDetalleActual;
    const fila = document.createElement('tr');
    fila.className = 'fila-edicion';

    const celdaNumero = document.createElement('td');
    const campoNumero = document.createElement('input');
    campoNumero.type = 'number';
    campoNumero.min = '1';
    campoNumero.max = '32767';
    campoNumero.step = '1';
    campoNumero.required = true;
    campoNumero.value = String(cante.numCante ?? '');
    campoNumero.setAttribute('aria-label', 'Número de cante');
    celdaNumero.append(campoNumero);
    fila.append(celdaNumero);

    const celdaTiempo = document.createElement('td');
    const campoTiempo = document.createElement('input');
    campoTiempo.type = 'text';
    campoTiempo.inputMode = 'numeric';
    campoTiempo.required = true;
    campoTiempo.pattern = '[0-9]+:[0-5][0-9]';
    campoTiempo.title = 'Usa minutos:segundos, por ejemplo 1:25 (máximo 9:06:07)';
    campoTiempo.value = formatearTiempoCante(cante.tiempoCante ?? 0);
    campoTiempo.setAttribute('aria-label', 'Duración del cante en minutos y segundos');
    campoTiempo.addEventListener('input', () => campoTiempo.setCustomValidity(''));
    celdaTiempo.append(campoTiempo);
    fila.append(celdaTiempo);

    const celdaObservaciones = document.createElement('td');
    const campoObservaciones = document.createElement('textarea');
    campoObservaciones.rows = 2;
    campoObservaciones.value = cante.observacionesCante ?? '';
    campoObservaciones.setAttribute('aria-label', 'Observaciones del cante');
    celdaObservaciones.append(campoObservaciones);
    fila.append(celdaObservaciones);

    const acciones = document.createElement('td');
    acciones.className = 'acciones-vuelta';
    const botonGuardar = crearBotonAccion('Guardar cante', 'guardar', 'boton-accion', async () => {
        if (!campoNumero.reportValidity() || !campoTiempo.reportValidity()) return;
        botonGuardar.disabled = true;
        estadoCante.textContent = 'Guardando cambios…';

        try {
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
            const consulta = nueva
                ? supabase.from('temasCantes').insert({
                    ...cambios,
                    temas_id: tema.temas_id
                })
                : supabase.from('temasCantes')
                    .update(cambios)
                    .eq('cante_id', cante.cante_id);
            const { data, error } = await consulta
                .select('cante_id,temas_id,numCante,tiempoCante,observacionesCante')
                .single();

            if (error) throw error;

            if (nueva) {
                tema.temasCantes.push(data);
            } else {
                Object.assign(cante, cambios);
            }
            tema.temasCantes.sort((a, b) => Number(a.numCante) - Number(b.numCante));
            if (temaDetalleActual === tema) {
                renderizarCantes(tema);
                estadoCante.textContent = nueva
                    ? 'Cante añadido correctamente.'
                    : 'Cante actualizado correctamente.';
            }
        } catch (error) {
            const mensaje = `No se pudo ${nueva ? 'añadir' : 'actualizar'} el cante: ${error.message}`;
            if (temaDetalleActual === tema) estadoCante.textContent = mensaje;
            else estadoDatos.textContent = mensaje;
            botonGuardar.disabled = false;
        }
    });
    acciones.append(
        botonGuardar,
        crearBotonAccion('Cancelar edición', 'cancelar', 'boton-accion', () => {
            if (temaDetalleActual === tema) renderizarCantes(tema);
        })
    );
    fila.append(acciones);

    const cantes = obtenerCantes(temaDetalleActual);
    const filas = cantes.map((item, itemIndice) =>
        !nueva && itemIndice === indice ? fila : renderizarFilaCante(item, itemIndice)
    );
    if (nueva) filas.push(fila);
    tbodyCantes.replaceChildren(...filas);
    campoNumero.focus();
}

function editarVuelta(vuelta, indice, nueva = false) {
    const tema = temaDetalleActual;
    const fila = document.createElement('tr');
    fila.className = 'fila-edicion';
    const celdaNumero = document.createElement('td');
    const campoNumero = document.createElement('input');
    campoNumero.type = 'number';
    campoNumero.min = '1';
    campoNumero.max = '32767';
    campoNumero.step = '1';
    campoNumero.required = true;
    campoNumero.value = String(vuelta.numVuelta ?? '');
    campoNumero.setAttribute('aria-label', 'Número de vuelta');
    celdaNumero.append(campoNumero);
    fila.append(celdaNumero);

    const celdaFecha = document.createElement('td');
    const campoFecha = document.createElement('input');
    campoFecha.type = 'date';
    campoFecha.required = true;
    campoFecha.value = vuelta.fechaVuelta ?? '';
    campoFecha.setAttribute('aria-label', 'Fecha de la vuelta');
    celdaFecha.append(campoFecha);
    fila.append(celdaFecha);

    const acciones = document.createElement('td');
    acciones.className = 'acciones-vuelta';
    const botonGuardar = crearBotonAccion('Guardar vuelta', 'guardar', 'boton-accion', async () => {
        if (!campoNumero.reportValidity() || !campoFecha.reportValidity()) return;
        botonGuardar.disabled = true;
        estadoVuelta.textContent = 'Guardando cambios…';

        try {
            const cambios = {
                numVuelta: Number(campoNumero.value),
                fechaVuelta: campoFecha.value
            };
            const consulta = nueva
                ? supabase.from('temasVueltas').insert({
                    ...cambios,
                    temas_id: tema.temas_id
                })
                : supabase.from('temasVueltas')
                    .update(cambios)
                    .eq('vuelta_id', vuelta.vuelta_id);
            const { data, error } = await consulta
                .select('vuelta_id,temas_id,fechaVuelta,numVuelta')
                .single();

            if (error) throw error;

            if (nueva) {
                tema.temasVueltas.push(data);
            } else {
                Object.assign(vuelta, cambios);
            }
            tema.temasVueltas.sort((a, b) => Number(a.numVuelta) - Number(b.numVuelta));
            if (temaDetalleActual === tema) {
                renderizarVueltas(tema);
                actualizarContadorVueltasLista(tema);
                estadoVuelta.textContent = nueva
                    ? 'Vuelta añadida correctamente.'
                    : 'Vuelta actualizada correctamente.';
            }
        } catch (error) {
            const mensaje = `No se pudo ${nueva ? 'añadir' : 'actualizar'} la vuelta: ${error.message}`;
            if (temaDetalleActual === tema) estadoVuelta.textContent = mensaje;
            else estadoDatos.textContent = mensaje;
            botonGuardar.disabled = false;
        }
    });
    acciones.append(
        botonGuardar,
        crearBotonAccion('Cancelar edición', 'cancelar', 'boton-accion', () => {
            if (temaDetalleActual !== tema) return;
            if (nueva) {
                estadoVuelta.textContent = '';
                renderizarVueltas(tema);
            } else {
                renderizarVueltas(tema);
            }
        })
    );
    fila.append(acciones);
    const vueltas = obtenerVueltas(tema);
    const filas = vueltas.map((item, itemIndice) =>
        !nueva && itemIndice === indice ? fila : renderizarFilaVuelta(item, itemIndice)
    );
    if (nueva) filas.push(fila);
    tbodyVueltas.replaceChildren(...filas);
    campoNumero.focus();
}

function actualizarContadorVueltasLista(tema) {
    const contadorLista = document.querySelector(
        `[data-contador-tema="${CSS.escape(String(tema.temas_id))}"]`
    );
    if (contadorLista) contadorLista.textContent = String(obtenerVueltas(tema).length);
}

async function eliminarVuelta(vuelta) {
    if (!window.confirm(`¿Seguro que quieres eliminar la vuelta ${vuelta.numVuelta}? Esta acción no se puede deshacer.`)) {
        return;
    }

    estadoVuelta.textContent = 'Eliminando vuelta…';
    try {
        const { error } = await supabase
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

async function eliminarCante(cante) {
    const tema = temaDetalleActual;
    if (!window.confirm(`¿Seguro que quieres eliminar el cante ${cante.numCante}? Esta acción no se puede deshacer.`)) {
        return;
    }

    estadoCante.textContent = 'Eliminando cante…';
    try {
        const { error } = await supabase
            .from('temasCantes')
            .delete()
            .eq('cante_id', cante.cante_id)
            .select('cante_id')
            .single();

        if (error) throw error;

        tema.temasCantes = tema.temasCantes
            .filter((item) => item.cante_id !== cante.cante_id);
        if (temaDetalleActual === tema) {
            renderizarCantes(tema);
            estadoCante.textContent = 'Cante eliminado correctamente.';
        }
    } catch (error) {
        const mensaje = `No se pudo eliminar el cante: ${error.message}`;
        if (temaDetalleActual === tema) estadoCante.textContent = mensaje;
        else estadoDatos.textContent = mensaje;
    }
}

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

async function cargarTemas() {
    const { data, error } = await supabase
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
    estadoDatos.textContent = `Temas cargados desde Supabase (${data.length}).`;
    volverALista();
}

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

async function mostrarTemas(user) {
    panelAcceso.hidden = true;
    contenidoTemas.hidden = false;
    botonCerrarSesion.hidden = false;
    usuarioActivo.hidden = false;
    usuarioActivo.textContent = user.email ?? 'Sesión activa';
    await cargarTemas();
}

botonVolver.addEventListener('click', volverALista);

checkboxReformaDetalle.addEventListener('change', () => {
    if (temaDetalleActual) guardarReforma(temaDetalleActual, checkboxReformaDetalle);
});

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

botonAnadirVuelta.addEventListener('click', () => {
    if (!temaDetalleActual) return;

    if (tbodyVueltas.querySelector('.fila-edicion')) {
        estadoVuelta.textContent = 'Guarda o cancela la vuelta que estás editando antes de añadir otra.';
        return;
    }

    const vueltas = obtenerVueltas(temaDetalleActual);
    const maxNumVuelta = vueltas.reduce((maximo, vuelta) => {
        const numero = Number(vuelta.numVuelta);
        return Number.isFinite(numero) ? Math.max(maximo, numero) : maximo;
    }, 0);
    estadoVuelta.textContent = '';
    editarVuelta({
        numVuelta: maxNumVuelta + 1,
        fechaVuelta: fechaLocalActual()
    }, vueltas.length, true);
});

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
