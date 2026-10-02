// Datos de ejemplo
const temasData = [
    {
        id: 1,
        tipo: 'Derecho Constitucional',
        titulo: 'Tema 1: La Constitución Española de 1978',
        pendienteReforma: false,
        vueltas: [
            { id: 1, fecha: '2026-09-05', notas: 'Primera lectura comprensiva' },
            { id: 2, fecha: '2026-09-20', notas: 'Subrayado y esquema completado' }
        ]
    },
    {
        id: 2,
        tipo: 'Derecho Constitucional',
        titulo: 'Tema 2: Derechos y Deberes Fundamentales',
        pendienteReforma: true,
        vueltas: [
            { id: 1, fecha: '2026-10-01', notas: 'Atención especial al artículo 14' }
        ]
    },
    {
        id: 3,
        tipo: 'Derecho Administrativo',
        titulo: 'Tema 15: El Acto Administrativo',
        pendienteReforma: false,
        vueltas: []
    }
];

// Elementos del DOM
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const vistaLista = document.getElementById('vista-lista');
const vistaDetalle = document.getElementById('vista-detalle');
const contenedorTemas = document.getElementById('contenedor-temas');
const btnVolver = document.getElementById('btn-volver');

// Elementos del Detalle
const detalleTitulo = document.getElementById('detalle-titulo');
const chkReforma = document.getElementById('chk-reforma');
const contadorVueltas = document.getElementById('contador-vueltas');
const tbodyVueltas = document.getElementById('tbody-vueltas');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    inicializarPestañas();
    renderizarListaTemas();
});

// Lógica de Pestañas
function inicializarPestañas() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Quitar clase active de todos
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.add('oculto'));

            // Añadir clase active al seleccionado
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('oculto');
        });
    });
}

// Renderizar la lista principal agrupada por "tipo"
function renderizarListaTemas() {
    contenedorTemas.innerHTML = '';
    
    // Agrupar los temas por tipo
    const temasAgrupados = temasData.reduce((acc, tema) => {
        if (!acc[tema.tipo]) acc[tema.tipo] = [];
        acc[tema.tipo].push(tema);
        return acc;
    }, {});

    // Crear el HTML para cada grupo
    for (const [tipo, temas] of Object.entries(temasAgrupados)) {
        const grupoDiv = document.createElement('div');
        grupoDiv.className = 'grupo-tipo';
        grupoDiv.innerHTML = `<h3>${tipo}</h3>`;

        temas.forEach(tema => {
            const temaDiv = document.createElement('div');
            temaDiv.className = 'tema-item';
            temaDiv.innerHTML = `
                <span>${tema.titulo}</span>
                <span style="color: var(--text-muted)">Vueltas: ${tema.vueltas.length}</span>
            `;
            
            // Evento para abrir el detalle
            temaDiv.addEventListener('click', () => abrirDetalle(tema.id));
            grupoDiv.appendChild(temaDiv);
        });

        contenedorTemas.appendChild(grupoDiv);
    }
}

// Abrir la vista detallada de un tema
function abrirDetalle(idTema) {
    const tema = temasData.find(t => t.id === idTema);
    if (!tema) return;

    // Rellenar datos
    detalleTitulo.textContent = tema.titulo;
    chkReforma.checked = tema.pendienteReforma;
    contadorVueltas.textContent = tema.vueltas.length;

    // Rellenar tabla de vueltas
    tbodyVueltas.innerHTML = '';
    if (tema.vueltas.length === 0) {
        tbodyVueltas.innerHTML = '<tr><td colspan="3" style="text-align: center;">No hay vueltas registradas aún.</td></tr>';
    } else {
        tema.vueltas.forEach((vuelta, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${vuelta.fecha}</td>
                <td>${vuelta.notas}</td>
            `;
            tbodyVueltas.appendChild(tr);
        });
    }

    // Cambiar vistas
    vistaLista.classList.add('oculto');
    vistaDetalle.classList.remove('oculto');
}

// Botón para volver a la lista principal
btnVolver.addEventListener('click', () => {
    vistaDetalle.classList.add('oculto');
    vistaLista.classList.remove('oculto');
});

// Evento para actualizar el estado del checkbox en el objeto de datos
chkReforma.addEventListener('change', (e) => {
    const tituloActual = detalleTitulo.textContent;
    const tema = temasData.find(t => t.titulo === tituloActual);
    if (tema) {
        tema.pendienteReforma = e.target.checked;
    }
});