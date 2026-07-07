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

function persist(){ saveDB(DB); }

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
