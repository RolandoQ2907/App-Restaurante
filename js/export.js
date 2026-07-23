import { db, crearTablaPedidos } from './db.js';
import { showToast } from './ui.js';

export async function exportarBackup(){
  const backup = {
    fecha: new Date().toISOString(),
    version: "1.0",
    platos: await db.platos.toArray(),
    config: await db.config.toArray(),
    dias: await db.dias.toArray(),
    pedidos: {}
  };

  const tablasPedidos = db.tables.filter(t => t.name.startsWith('pedidos_'));
  for(const tabla of tablasPedidos){
    backup.pedidos[tabla.name] = await tabla.toArray();
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_pedidos_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Backup descargado");
}

export async function importarBackup(file){
  const text = await file.text();
  const backup = JSON.parse(text);

  await db.transaction('rw', db.platos, db.config, db.dias, async () => {
    await db.platos.clear();
    await db.config.clear();
    await db.dias.clear();
    await db.platos.bulkPut(backup.platos);
    await db.config.bulkPut(backup.config);
    if(backup.dias) await db.dias.bulkPut(backup.dias);
  });

  for(const [nombreTabla, datos] of Object.entries(backup.pedidos)){
    const fecha = nombreTabla.replace('pedidos_','');
    const tabla = await crearTablaPedidos(fecha);
    await tabla.clear();
    await tabla.bulkPut(datos);
    const registro = await db.dias.get(fecha);
    if(!registro) await db.dias.put({fecha, iniciado: true, timestamp: Date.now()});
  }

  showToast("Backup importado. Recargando...");
  setTimeout(() => location.reload(), 1500);
}