export const db = new Dexie("appRestaurant");

function nombreTablaPedidos(fecha) {
  return `pedidos_${fecha}`;
}

db.version(1).stores({
  platos: '++id, nombre, tipo, cantidad, precio',
  config: 'key',
  dias: 'fecha, iniciado, timestamp'
});

async function reconstruirEsquema() {
  if (!indexedDB.databases) return;

  let versionReal = 1;
  try {
    const bases = await indexedDB.databases();
    const info = bases.find(b => b.name === "appRestaurant");
    if (info && info.version) versionReal = info.version;
  } catch {
    return;
  }

  if (versionReal <= 1) return;

  let raw;
  try {
    raw = await new Promise((resolve, reject) => {
      const req = indexedDB.open("appRestaurant", versionReal);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("appRestaurant bloqueada"));
    });
  } catch {
    return;
  }

  let dias = [];
  try {
    dias = await new Promise((resolve, reject) => {
      const tx = raw.transaction("dias", "readonly");
      const store = tx.objectStore("dias");
      const out = [];
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { out.push(cursor.value); cursor.continue(); }
        else resolve(out);
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } finally {
    raw.close();
  }

  const fechasOrdenadas = dias
    .filter(d => d.iniciado)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(d => d.fecha);

  fechasOrdenadas.forEach((fecha, i) => {
    const stores = {};
    stores[nombreTablaPedidos(fecha)] = '++id, cliente, items, entregado, pagado, timestamp';
    db.version(2 + i).stores(stores);
  });
}

await reconstruirEsquema();

db.on("populate", () => {
  db.platos.bulkAdd([
    {nombre: "Sopa", tipo: "plato", cantidad: 10, precio: 8},
    {nombre: "Pollo", tipo: "plato", cantidad: 5, precio: 15},
    {nombre: "Lomo", tipo: "plato", cantidad: 4, precio: 18},
    {nombre: "Arroz", tipo: "plato", cantidad: 20, precio: 5},
    {nombre: "Coca Cola", tipo: "bebida", cantidad: 15, precio: 3},
    {nombre: "Agua", tipo: "bebida", cantidad: 20, precio: 2},
    {nombre: "Jugo", tipo: "bebida", cantidad: 10, precio: 4},
  ]);
  db.config.put({key: "bloqueado", value: false});
});

export function getFechaHoy() {
  return new Date().toISOString().split('T')[0];
}

export function getTablaPedidosSiExiste(fecha) {
  const nombre = nombreTablaPedidos(fecha);
  if (!db.isOpen()) return null;
  return db.tables.some(t => t.name === nombre) ? db.table(nombre) : null;
}

export async function crearTablaPedidos(fecha) {
  const nombre = nombreTablaPedidos(fecha);

  if (!db.isOpen()) await db.open();

  if (!db.tables.some(t => t.name === nombre)) {
    const newVersion = db.verno + 1;
    const stores = {};
    stores[nombre] = '++id, cliente, items, entregado, pagado, timestamp';

    try {
      await db.close();
      db.version(newVersion).stores(stores);
      await db.open();
    } catch (err) {
      if (!db.isOpen()) await db.open().catch(() => {});
      throw new Error(`No se pudo crear la tabla de pedidos de ${fecha}: ${err.message || err}`);
    }
  }

  return db.table(nombre);
}

export async function iniciarDia(fecha) {
  const registro = await db.dias.get(fecha);
  if (!registro) {
    await db.dias.put({ fecha, iniciado: true, timestamp: Date.now() });
  }
  const tabla = await crearTablaPedidos(fecha);
  return tabla;
}

export async function estaIniciado(fecha) {
  if (!db.isOpen()) await db.open();
  const registro = await db.dias.get(fecha);
  return !!registro;
}

export async function getTablaPedidos(fecha) {
  const existente = getTablaPedidosSiExiste(fecha);
  if (existente) return existente;
  return await crearTablaPedidos(fecha);
}
