let toastTimeout = null;

export function showToast(msg, accion){
  const toast = document.getElementById('toast');
  clearTimeout(toastTimeout);
  toast.innerHTML = '';

  const texto = document.createElement('span');
  texto.textContent = msg;
  toast.appendChild(texto);

  if(accion){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-btn';
    btn.textContent = accion.texto;
    btn.onclick = () => {
      toast.classList.remove('show');
      accion.onClick();
    };
    toast.appendChild(btn);
  }

  toast.classList.add('show');

  if(!accion){
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
  }
}

export function openModal(html){
  const modal = document.getElementById('modal');
  modal.innerHTML = `<div class="modal glass modal-content">${html}</div>`;
  modal.classList.remove('modal-hidden');
  modal.onclick = (e) => { if(e.target.id === 'modal') modal.classList.add('modal-hidden'); }
}