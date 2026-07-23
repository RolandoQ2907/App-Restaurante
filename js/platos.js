import { db } from './db.js';
import { showToast } from './ui.js';
import { exportarBackup } from './export.js';

async function getBloqueado(){
  const cfg = await db.config.get('bloqueado');
  return cfg ? cfg.value : false;
}

async function setBloqueado(val){
  await db.config.put({ key: 'bloqueado', value: val });
}

function filaHTML(p, bloqueado){
  const dis = bloqueado ? 'disabled' : '';
  return `
    <div class="plato-item" data-nombre="${p.nombre.toLowerCase()}">
      <input value="${p.nombre}" data-id="${p.id}" data-field="nombre" placeholder="Nombre" ${dis}>
      <input type="number" step="0.01" value="${p.precio}" data-id="${p.id}" data-field="precio" ${dis}>
      <input type="number" value="${p.cantidad}" data-id="${p.id}" data-field="cantidad" ${dis}>
      <button class="btn-delete" data-id="${p.id}" ${dis} title="Eliminar">✕</button>
    </div>
  `;
}

export async function renderPlatos() {
  const bloqueado = await getBloqueado();
  const platos = await db.platos.where('tipo').equals('plato').toArray();
  const bebidas = await db.platos.where('tipo').equals('bebida').toArray();

  return `
    <div class="section">
      <div class="platos-wrapper">
        <div class="platos-wrapper-head">
          <div>
            <h2>Gestion de Inventario</h2>
            <span class="eyebrow">Control de stock y precios</span>
          </div>
        </div>

        <div class="buscador">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" id="buscarItem" placeholder="Buscar plato o bebida">
        </div>

        <div class="form-section">
          <h3>Platos</h3>
          <div class="platos-header">
            <span>Nombre</span><span>Precios</span><span>Cantidad</span><span></span>
          </div>
          <div class="platos-container" id="platosContainer">
            ${platos.map(p => filaHTML(p, bloqueado)).join('')}
          </div>
          <button id="addPlato" class="btn btn-small btn-outline-dashed" style="margin-top:10px;" ${bloqueado ? 'disabled' : ''}>+ Agregar plato</button>
          ${bloqueado ? '<div class="overlay-bloqueo"></div>' : ''}
        </div>

        <div class="form-section">
          <h3>Bebidas</h3>
          <div class="platos-header">
            <span>Nombre</span><span>Precios</span><span>Cantidad</span><span></span>
          </div>
          <div class="platos-container" id="bebidasContainer">
            ${bebidas.map(p => filaHTML(p, bloqueado)).join('')}
          </div>
          <button id="addBebida" class="btn btn-small btn-outline-dashed" style="margin-top:10px;" ${bloqueado ? 'disabled' : ''}>+ Agregar bebida</button>
          ${bloqueado ? '<div class="overlay-bloqueo"></div>' : ''}
        </div>

        <button id="btn-guardar" class="btn btn-primary" style="margin-top:16px; width:100%;">
          ${bloqueado ? 'Editar' : 'Guardar'}
        </button>
        <button id="btn-reset" class="btn-danger" ${bloqueado ? 'disabled' : ''}>Restablecer platos</button>
        <button id="btn-exportar" class="btn btn-exportar" style="margin-top:8px; width:100%;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
          Exportar todos los datos
        </button>
      </div>
    </div>
  `;
}

export function initPlatos() {
  document.querySelectorAll('.plato-item input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const id = parseInt(e.target.dataset.id);
      const field = e.target.dataset.field;
      let value = e.target.value;

      let corregido = null;
      if(field === 'precio'){
        value = parseFloat(value) || 0;
        if(value < 0){ value = 0; e.target.value = 0; corregido = 'El precio no puede ser negativo'; }
      }
      if(field === 'cantidad'){
        value = parseInt(value) || 0;
        if(value < 0){ value = 0; e.target.value = 0; corregido = 'La cantidad no puede ser negativa'; }
      }
      if(field === 'nombre'){
        e.target.closest('.plato-item').dataset.nombre = value.toLowerCase();
      }

      await db.platos.update(id, { [field]: value });
      showToast(corregido || 'Guardado');
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = async () => {
      const id = parseInt(btn.dataset.id);
      if(confirm('¿Eliminar este item? Esta accion no se puede deshacer.')){
        await db.platos.delete(id);
        showToast('Eliminado');
        recargar();
      }
    };
  });

  document.getElementById('addPlato')?.addEventListener('click', async () => {
    await db.platos.add({ nombre: '', tipo: 'plato', precio: 0, cantidad: 0 });
    recargar();
  });

  document.getElementById('addBebida')?.addEventListener('click', async () => {
    await db.platos.add({ nombre: '', tipo: 'bebida', precio: 0, cantidad: 0 });
    recargar();
  });

  document.getElementById('btn-guardar')?.addEventListener('click', async () => {
    const bloqueado = await getBloqueado();
    await setBloqueado(!bloqueado);
    showToast(bloqueado ? 'Ahora podes editar' : 'Platos y bebidas guardados');
    recargar();
  });

  document.getElementById('btn-reset')?.addEventListener('click', async () => {
    if(confirm('¿Borrar todo y restablecer platos y bebidas por defecto?')){
      await db.platos.clear();
      await db.platos.bulkAdd([
        {nombre: 'Sopa', tipo: 'plato', precio: 8, cantidad: 10},
        {nombre: 'Pollo', tipo: 'plato', precio: 15, cantidad: 5},
        {nombre: 'Lomo', tipo: 'plato', precio: 18, cantidad: 4},
        {nombre: 'Arroz', tipo: 'plato', precio: 5, cantidad: 20},
        {nombre: 'Coca Cola', tipo: 'bebida', precio: 3, cantidad: 15},
        {nombre: 'Agua', tipo: 'bebida', precio: 2, cantidad: 20},
        {nombre: 'Jugo', tipo: 'bebida', precio: 4, cantidad: 10},
      ]);
      showToast('Restablecido');
      recargar();
    }
  });

  document.getElementById('btn-exportar')?.addEventListener('click', () => exportarBackup());

  document.getElementById('buscarItem')?.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.plato-item').forEach(fila => {
      const coincide = !q || fila.dataset.nombre.includes(q);
      fila.classList.toggle('oculto', !coincide);
    });
  });
}

async function recargar(){
  const content = document.getElementById('content');
  content.innerHTML = await renderPlatos();
  initPlatos();
}
