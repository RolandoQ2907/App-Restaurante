import { db, getFechaHoy, getTablaPedidos, getTablaPedidosSiExiste, iniciarDia, estaIniciado } from './db.js';
import { showToast, openModal } from './ui.js';

let fechaActual = localStorage.getItem('fechaSeleccionada') || getFechaHoy();
let pedidosIniciados = false;



function panelFechaHTML(){
  const hoy = getFechaHoy();
  const esHoy = fechaActual === hoy;

  return `
    <div class="fecha-panel glass">
      <span class="eyebrow">Fecha del servicio</span>
      <div class="fecha-picker-row">
        <button type="button" class="btn-fecha-picker" id="btnAbrirCalendario">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          <span id="tituloFecha">${formatearFechaLarga(fechaActual)}</span>
        </button>
        <button type="button" class="btn-hoy" id="btnHoy" ${esHoy ? 'disabled' : ''}>Hoy</button>
      </div>
      <input type="date" id="inputFecha" value="${fechaActual}" max="${hoy}" style="position:fixed;opacity:0;pointer-events:none;top:-100px;">
    </div>
  `;
}

export async function renderPedidos(){
  return `
  <div class="section">
    ${panelFechaHTML()}

    <div class="form-group" id="bloqueIniciar">
      <button class="btn btn-primary" id="btnIniciar" style="width:100%;">Iniciar pedidos del dia</button>
    </div>

    <div id="formPedido" class="form-group form-nuevo" style="display:none;">
      <h3 class="form-titulo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        Nuevo Pedido
      </h3>

      <label class="campo-label" for="nombreCliente">Nombre del cliente</label>
      <input type="text" id="nombreCliente" placeholder="Ej: Carlos Mendoza">

      <div id="itemsPedido"></div>

      <div class="form-actions-add">
        <button class="btn btn-small btn-outline-dashed" id="addPlatoPedido">+ Plato</button>
        <button class="btn btn-small btn-outline-dashed" id="addBebidaPedido">+ Bebida</button>
      </div>

      <div class="total-row">
        <div>
          <span class="eyebrow">Total estimado</span>
          <div class="total-valor num" id="totalEstimado">$0</div>
        </div>
        <button class="btn btn-primary" id="guardarPedido">Guardar</button>
      </div>
    </div>

    <div class="lista-header">
      <span class="eyebrow">Pedidos Activos</span>
      <span class="badge-count num" id="contadorPedidos">0</span>
    </div>
    <div id="listaPedidos"></div>
  </div>
  `;
}

export async function initPedidos(){
  pedidosIniciados = await estaIniciado(fechaActual);

  document.getElementById('formPedido').style.display = pedidosIniciados ? 'block' : 'none';
  document.getElementById('bloqueIniciar').style.display = pedidosIniciados ? 'none' : 'block';

  document.getElementById('btnIniciar').onclick = async () => {
    await iniciarDia(fechaActual);
    pedidosIniciados = true;
    document.getElementById('formPedido').style.display = 'block';
    document.getElementById('bloqueIniciar').style.display = 'none';
    showToast('Pedidos del dia iniciados');
    cargarPedidos();
  };

  document.getElementById('btnHoy').onclick = () => fijarFecha(getFechaHoy());
  document.getElementById('btnAbrirCalendario').onclick = () => abrirCalendario();

  document.getElementById('addPlatoPedido').onclick = () => agregarItem('plato');
  document.getElementById('addBebidaPedido').onclick = () => agregarItem('bebida');
  document.getElementById('guardarPedido').onclick = guardarPedido;

  const itemsPedido = document.getElementById('itemsPedido');
  itemsPedido.addEventListener('click', (e) => {
    const btnMenos = e.target.closest('.item-menos');
    const btnMas = e.target.closest('.item-mas');
    const btnQuitar = e.target.closest('.btn-eliminar');
    if(btnMenos) ajustarCantidad(btnMenos.closest('.form-row'), -1);
    if(btnMas) ajustarCantidad(btnMas.closest('.form-row'), 1);
    if(btnQuitar){ btnQuitar.closest('.form-row').remove(); recalcularTotal(); }
  });
  itemsPedido.addEventListener('change', (e) => {
    if(e.target.classList.contains('item-select')) recalcularTotal();
  });

  recalcularTotal();
  cargarPedidos();
}

async function agregarItem(tipo){
  const platos = await db.platos.where('tipo').equals(tipo).toArray();
  const options = platos
    .filter(p => p.cantidad > 0)
    .map(p => `<option value="${p.id}">${p.nombre}</option>`)
    .join('');

  document.getElementById('itemsPedido').insertAdjacentHTML('beforeend', `
    <div class="form-row">
      <select class="item-select">${options}</select>
      <div class="item-stepper">
        <button type="button" class="item-menos" aria-label="Restar">−</button>
        <input type="number" class="item-cant" value="1" min="1" readonly>
        <button type="button" class="item-mas" aria-label="Sumar">+</button>
      </div>
      <button type="button" class="btn btn-small btn-eliminar" aria-label="Quitar item">✕</button>
    </div>
  `);
  recalcularTotal();
}

function ajustarCantidad(row, delta){
  const input = row.querySelector('.item-cant');
  const nuevo = Math.max(1, (parseInt(input.value) || 1) + delta);
  input.value = nuevo;
  recalcularTotal();
}

async function recalcularTotal(){
  const totalEl = document.getElementById('totalEstimado');
  if(!totalEl) return;

  const filas = [...document.querySelectorAll('#itemsPedido .form-row')];
  if(filas.length === 0){ totalEl.textContent = '$0'; return; }

  let total = 0;
  for(const row of filas){
    const id = Number(row.querySelector('.item-select').value);
    const cant = Number(row.querySelector('.item-cant').value) || 0;
    if(!id) continue;
    const plato = await db.platos.get(id);
    if(plato) total += plato.precio * cant;
  }
  totalEl.textContent = `$${total}`;
}

async function guardarPedido(){
  const btn = document.getElementById('guardarPedido');
  btn.disabled = true;
  try {
    const cliente = document.getElementById('nombreCliente').value;
    if(!cliente){ showToast("Pone nombre del cliente"); return; }

    const items = [];
    document.querySelectorAll('#itemsPedido .form-row').forEach(row => {
      const id = Number(row.querySelector('.item-select').value);
      const cant = Number(row.querySelector('.item-cant').value);
      items.push({id, cant});
    });

    if(items.length === 0){ showToast("Agrega al menos un plato o bebida"); return; }

    const cantidadPedidaPorId = new Map();
    for(const item of items){
      cantidadPedidaPorId.set(item.id, (cantidadPedidaPorId.get(item.id) || 0) + item.cant);
    }

    const tabla = await getTablaPedidos(fechaActual);

    let stockInsuficiente = null;
    await db.transaction('rw', db.platos, tabla, async () => {
      for(const [id, cantPedida] of cantidadPedidaPorId.entries()){
        const plato = await db.platos.get(id);
        const disponible = plato ? plato.cantidad : 0;
        if(cantPedida > disponible){
          stockInsuficiente = { nombre: plato ? plato.nombre : 'de ese plato', disponible };
          throw new Error('STOCK_INSUFICIENTE');
        }
      }
      for(const [id, cantPedida] of cantidadPedidaPorId.entries()){
        const plato = await db.platos.get(id);
        await db.platos.update(id, { cantidad: plato.cantidad - cantPedida });
      }
      await tabla.add({cliente, items, entregado: false, pagado: false, timestamp: Date.now()});
    }).catch(err => {
      if(!stockInsuficiente) throw err;
    });

    if(stockInsuficiente){
      showToast(`Solo quedan ${stockInsuficiente.disponible} ${stockInsuficiente.nombre}`);
      return;
    }

    document.getElementById('nombreCliente').value = '';
    document.getElementById('itemsPedido').innerHTML = '';
    recalcularTotal();
    cargarPedidos();
    showToast("Pedido guardado");
  } finally {
    btn.disabled = false;
  }
}

export async function cargarPedidos(){
  const tabla = getTablaPedidosSiExiste(fechaActual);
  const pedidos = tabla ? await tabla.reverse().toArray() : [];
  const htmls = await Promise.all(pedidos.map(p => cardHTML(p)));
  document.getElementById('listaPedidos').innerHTML = htmls.join('');
  const contador = document.getElementById('contadorPedidos');
  if(contador) contador.textContent = pedidos.filter(p => !p.entregado).length;
}

async function agruparItems(items){
  const cantidades = new Map();
  for(const item of items){
    cantidades.set(item.id, (cantidades.get(item.id) || 0) + item.cant);
  }

  const resultado = [];
  let total = 0;
  for(const [id, cant] of cantidades.entries()){
    const plato = await db.platos.get(id);
    const nombre = plato ? plato.nombre : '(eliminado)';
    const precio = plato ? plato.precio : 0;
    const subtotal = precio * cant;
    total += subtotal;
    resultado.push({ id, nombre, precio, cant, subtotal });
  }
  return { items: resultado, total };
}

function formatearHora(timestamp){
  const d = new Date(timestamp);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h < 12 ? 'am' : 'pm';
  h = h % 12;
  if(h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

async function cardHTML(p){
  const { items, total } = await agruparItems(p.items);
  const listaTexto = items.map(i => `${i.nombre}${i.cant > 1 ? ` x${i.cant}` : ''}`).join(', ');
  const hora = p.timestamp ? formatearHora(p.timestamp) : '';

  return `
  <div class="card-pedido ${p.entregado? 'entregado' : ''}">
    <div class="card-header">
      <div>
        <b>${p.cliente}</b>
        <span class="card-orden-meta">Orden #${p.id}${hora ? ` · ${hora}` : ''}</span>
      </div>
      <div class="pills-estado">
        <span class="pill-estado ${p.entregado ? 'entregado' : 'pendiente'}">${p.entregado ? 'Entregado' : 'Pendiente'}</span>
        <span class="pill-estado ${p.pagado ? 'entregado' : 'pendiente'}">${p.pagado ? 'Pagado' : 'Sin pagar'}</span>
      </div>
    </div>
    <div class="card-items">
      <span class="card-items-lista">${listaTexto}</span>
      <span class="card-items-total num">$${total}</span>
    </div>
    <div class="card-toggles">
      <label class="toggle">
        <input type="checkbox" ${p.entregado? 'checked' : ''} onchange="toggleEntregado(${p.id}, this.checked)">
        Entregado?
      </label>
      <label class="toggle">
        <input type="checkbox" ${p.pagado? 'checked' : ''} onchange="togglePago(${p.id}, this.checked)">
        Pagado?
      </label>
    </div>
    <div class="card-actions">
      <button class="btn btn-small" onclick="verPedido(${p.id})">Ver</button>
      <button class="btn btn-small btn-eliminar" onclick="eliminarPedido(${p.id})">Eliminar</button>
    </div>
  </div>
  `;
}

window.verPedido = async (id) => {
  const tabla = await getTablaPedidos(fechaActual);
  const p = await tabla.get(id);
  const { items, total } = await agruparItems(p.items);

  const rows = items.map(i => `
    <div class="modal-item-row">
      <span class="modal-item-nombre">${i.nombre}</span>
      <span class="modal-item-precio">$${i.precio}${i.cant > 1 ? ` <span class="cant-badge">x${i.cant}</span>` : ''}</span>
    </div>
  `).join('');

  openModal(`
    <h3>Pedido de ${p.cliente}</h3>
    <div class="modal-items">
      <div class="modal-item-row modal-item-header"><b>Plato</b><b>Precio</b></div>
      ${rows}
    </div>
    <div class="modal-resumen">
      <span>Total</span>
      <b class="num">$${total}</b>
    </div>
    <button id="btn-close" class="btn" onclick="document.getElementById('modal').classList.add('modal-hidden')">Cerrar</button>
  `);
}

window.eliminarPedido = async (id) => {
  if(!confirm('¿Eliminar este pedido? Esta accion no se puede deshacer.')) return;

  const tabla = await getTablaPedidos(fechaActual);
  const p = await tabla.get(id);
  if(p){
    for(const item of p.items){
      const plato = await db.platos.get(item.id);
      if(plato) await db.platos.update(item.id, { cantidad: plato.cantidad + item.cant });
    }
    await tabla.delete(id);
  }
  showToast('Pedido eliminado');
  cargarPedidos();
}

window.toggleEntregado = async (id, val) => {
  const tabla = await getTablaPedidos(fechaActual);
  await tabla.update(id, {entregado: val});
  cargarPedidos();
}

window.togglePago = async (id, val) => {
  const tabla = await getTablaPedidos(fechaActual);
  await tabla.update(id, {pagado: val});
  cargarPedidos();
}

function fijarFecha(nuevaFecha){
  fechaActual = nuevaFecha;
  localStorage.setItem('fechaSeleccionada', fechaActual);
  rerenderPagina();
}

async function rerenderPagina(){
  const content = document.getElementById('content');
  content.innerHTML = await renderPedidos();
  initPedidos();
}

function abrirCalendario(){
  const input = document.getElementById('inputFecha');
  input.onchange = e => {
    if(e.target.value) fijarFecha(e.target.value);
  };
  if(input.showPicker){
    input.showPicker();
  } else {
    input.click();
  }
}

function quitarTildes(s){
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parsearFechaLocal(f){
  const [anio, mes, dia] = f.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}
function formatearFecha(f){ return quitarTildes(parsearFechaLocal(f).toLocaleDateString('es-AR')); }
function formatearFechaLarga(f){
  return quitarTildes(parsearFechaLocal(f).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }));
}