/* =========================================================
   storage.js — capa de datos (todo se guarda en este navegador)
   ========================================================= */

const DB_KEY = 'facturafacil_db_v1';

const ACCENT_PRESETS = ['#2F6F4E', '#B3423A', '#2E4E8F', '#8A5A2E', '#6B4E9E', '#1B2431'];

function defaultDB(){
  return {
    settings:{
      businessName:'Mi Negocio',
      businessPhone:'',
      businessAddress:'',
      businessRnc:'',
      logo:'',
      accent:'#2F6F4E',
      nextNumber:1,
      prefix:'FAC-'
    },
    clients:[],
    invoices:[],
    user:null
  };
}

function loadDB(){
  try{
    const raw = localStorage.getItem(DB_KEY);
    if(!raw) return defaultDB();
    const parsed = JSON.parse(raw);
    // aseguramos que existan todas las llaves aunque la versión guardada sea vieja
    return Object.assign(defaultDB(), parsed, {
      settings: Object.assign(defaultDB().settings, parsed.settings || {})
    });
  }catch(e){
    console.error('Error leyendo datos guardados, se inicia una base vacía.', e);
    return defaultDB();
  }
}

function saveDB(db){
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

let DB = loadDB();

/* ---------------- Sincronización en la nube (Firestore) ---------------- */
let CLOUD_MODE = false;
let CLOUD_UID = null;
let cloudUnsubscribe = null;
let suppressNextCloudEcho = false;

function startCloudSync(uid){
  CLOUD_MODE = true;
  CLOUD_UID = uid;
  if(cloudUnsubscribe) cloudUnsubscribe();

  cloudUnsubscribe = firestore.collection('facturafacil_users').doc(uid)
    .onSnapshot((doc)=>{
      if(doc.exists){
        const remote = doc.data();
        DB = Object.assign(defaultDB(), remote, {
          settings: Object.assign(defaultDB().settings, remote.settings || {}),
          user: DB.user // el usuario se maneja aparte, vía auth
        });
      } else {
        // primer inicio de sesión en la nube: subimos lo que haya localmente
        firestore.collection('facturafacil_users').doc(uid).set(stripUser(DB));
      }
      if(typeof onCloudDataChange === 'function') onCloudDataChange();
    }, (err)=>{
      console.error('Error de sincronización con Firestore:', err);
    });
}

function stopCloudSync(){
  if(cloudUnsubscribe) cloudUnsubscribe();
  cloudUnsubscribe = null;
  CLOUD_MODE = false;
  CLOUD_UID = null;
}

function stripUser(db){
  const copy = Object.assign({}, db);
  delete copy.user;
  return copy;
}

function saveDBCloud(){
  if(!CLOUD_UID) return;
  firestore.collection('facturafacil_users').doc(CLOUD_UID)
    .set(stripUser(DB))
    .catch(err=> console.error('No se pudo guardar en la nube:', err));
}

function persist(){
  if(CLOUD_MODE){ saveDBCloud(); }
  else { saveDB(DB); }
}

function uid(prefix){
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

/* ---------------- Clientes ---------------- */
function upsertClient(client){
  if(client.id){
    const i = DB.clients.findIndex(c=>c.id===client.id);
    if(i>-1) DB.clients[i] = client;
  } else {
    client.id = uid('cli');
    DB.clients.push(client);
  }
  persist();
  return client;
}
function deleteClient(id){
  DB.clients = DB.clients.filter(c=>c.id!==id);
  persist();
}

/* ---------------- Facturas ---------------- */
function nextInvoiceNumber(){
  const n = DB.settings.nextNumber || 1;
  return DB.settings.prefix + String(n).padStart(4,'0');
}
function upsertInvoice(invoice){
  if(invoice.id){
    const i = DB.invoices.findIndex(v=>v.id===invoice.id);
    if(i>-1) DB.invoices[i] = invoice;
  } else {
    invoice.id = uid('inv');
    invoice.number = nextInvoiceNumber();
    DB.settings.nextNumber = (DB.settings.nextNumber || 1) + 1;
    DB.invoices.push(invoice);
  }
  persist();
  return invoice;
}
function deleteInvoice(id){
  DB.invoices = DB.invoices.filter(v=>v.id!==id);
  persist();
}
function invoiceTotal(invoice){
  return (invoice.items||[]).reduce((sum,it)=> sum + (Number(it.qty)||0) * (Number(it.price)||0), 0);
}

/* ---------------- Ajustes ---------------- */
function saveSettings(patch){
  DB.settings = Object.assign(DB.settings, patch);
  persist();
}
