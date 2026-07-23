import { renderPedidos, initPedidos } from './pedidos.js';
import { renderPlatos, initPlatos } from './platos.js';

const content = document.getElementById('content');
const navBtns = document.querySelectorAll('.nav-btn');

async function cargarPagina(page){
  navBtns.forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`).classList.add('active');

  if(page === 'pedidos'){
    content.innerHTML = await renderPedidos();
    initPedidos();
  }
  if(page === 'platos'){
    content.innerHTML = await renderPlatos();
    initPlatos();
  }
}

navBtns.forEach(btn => {
  btn.onclick = () => cargarPagina(btn.dataset.page);
});

cargarPagina('pedidos');