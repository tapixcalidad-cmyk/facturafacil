/* =========================================================
   app.js — controlador principal de la aplicación
   ========================================================= */

let currentView = 'dashboard';
let itemRowCount = 0;

function initAppData(){
  applyAccent(DB.settings.accent);
  applyBrand();
  renderColorPresets();
  fillConfigForm();
  goView('dashboard');
  setupNav();
  setupModals();
  setupClientForm();
  setupInvoiceForm();
  setupInvoiceViewActions();
  setupConfigForm();
}

/* Se llama cuando llegan datos nuevos desde Firestore (otro dispositivo) */
function refreshCurrentView(){
  applyAccent(DB.settings.accent);
  applyBrand();
  if(currentView==='dashboard') renderDashboard();
  if(currentView==='facturas') renderInvoiceList();
  if(currentView==='clientes') renderClientList();
  if(currentView==='pedidos') renderPedidos();
  if(currentView==='config'){ fillConfigForm(); renderColorPresets(); }
}

/* ---------------- Navegación ---------------- */
function setupNav(){
  document.querySelectorAll('.nav-item').forEach(btn=>{
    btn.addEventListener('click', ()=> goView(btn.dataset.view));
  });
}

function goView(view){
  currentView = view;
  document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden'));
  document.getElementById('panel-' + view).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(b=>{
    b.classList.toggle('active', b.dataset.view === view);
  });
  if(view==='dashboard') renderDashboard();
  if(view==='facturas') renderInvoiceList();
  if(view==='clientes') renderClientList();
  if(view==='pedidos') renderPedidos();
}

/* ---------------- Marca / color ---------------- */
function applyAccent(hex){
  document.documentElement.style.setProperty('--accent', hex);
  // ajustamos un tono suave derivado para fondos
  document.documentElement.style.setProperty('--accent-soft', hexToSoft(hex));
}
function hexToSoft(hex){
  const {r,g,b} = hexToRgb(hex);
  return `rgba(${r},${g},${b},0.14)`;
}
function hexToRgb(hex){
  const m = hex.replace('#','');
  const bigint = parseInt(m.length===3 ? m.split('').map(c=>c+c).join('') : m, 16);
  return { r:(bigint>>16)&255, g:(bigint>>8)&255, b:bigint&255 };
}

function applyBrand(){
  document.getElementById('brand-name').textContent = DB.settings.businessName || 'FacturaFácil';
  const logoImg = document.getElementById('brand-logo-img');
  const mark = document.getElementById('brand-mark');
  if(DB.settings.logo){
    logoImg.src = DB.settings.logo;
    logoImg.classList.remove('hidden');
    mark.classList.add('hidden');
  } else {
    logoImg.classList.add('hidden');
    mark.classList.remove('hidden');
  }
}

function renderColorPresets(){
  const row = document.getElementById('color-row');
  row.innerHTML = '';
  ACCENT_PRESETS.forEach(hex=>{
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'color-swatch' + (hex.toLowerCase()===DB.settings.accent.toLowerCase() ? ' selected' : '');
    sw.style.background = hex;
    sw.addEventListener('click', ()=>{
      saveSettings({accent:hex});
      applyAccent(hex);
      renderColorPresets();
    });
    row.appendChild(sw);
  });
}

/* ---------------- Dashboard ---------------- */
function renderDashboard(){
  const pendientes = DB.invoices.filter(i=>i.status==='pendiente').length;
  const aceptadas = DB.invoices.filter(i=>i.status==='aceptada').length;
  document.getElementById('stat-pendientes').textContent = pendientes;
  document.getElementById('stat-aceptadas').textContent = aceptadas;
  document.getElementById('stat-clientes').textContent = DB.clients.length;

  const now = new Date();
  const weekAhead = new Date(); weekAhead.setDate(now.getDate()+7);
  const upcoming = DB.invoices.filter(i=>{
    if(!i.delivery) return false;
    const d = new Date(i.delivery + 'T00:00:00');
    return d >= stripTime(now) && d <= weekAhead;
  }).sort((a,b)=> a.delivery.localeCompare(b.delivery));

  document.getElementById('stat-entregas').textContent = upcoming.length;

  const list = document.getElementById('upcoming-list');
  list.innerHTML = '';
  if(upcoming.length===0){
    list.innerHTML = '<p class="empty-note">No tienes entregas programadas para los próximos 7 días.</p>';
  } else {
    upcoming.forEach(i=> list.appendChild(orderRow(i)));
  }
}
function stripTime(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function orderRow(invoice){
  const client = DB.clients.find(c=>c.id===invoice.clientId);
  const row = document.createElement('div');
  row.className = 'order-row';
  row.innerHTML = `
    <div><div class="who">${escapeHtml(client ? client.name : 'Cliente')}</div>
    <div class="muted small">${escapeHtml(invoice.number)} · ${statusLabel(invoice.status)}</div></div>
    <div class="when">${invoice.delivery || 'Sin fecha'}</div>
  `;
  row.addEventListener('click', ()=> openViewInvoice(invoice.id));
  row.style.cursor = 'pointer';
  return row;
}
function statusLabel(s){
  return {pendiente:'Pendiente', aceptada:'Aceptada', pagada:'Pagada'}[s] || s;
}

/* ---------------- Pedidos (todas las órdenes con fecha de entrega) ---------------- */
function renderPedidos(){
  const list = document.getElementById('pedidos-list');
  list.innerHTML = '';
  const withDelivery = DB.invoices
    .filter(i=>i.delivery)
    .sort((a,b)=> a.delivery.localeCompare(b.delivery));
  if(withDelivery.length===0){
    list.innerHTML = '<p class="empty-note">Aún no has asignado fechas de entrega a ningún trabajo. Agrega una fecha de entrega al crear o editar una factura.</p>';
    return;
  }
  withDelivery.forEach(i=> list.appendChild(orderRow(i)));
}

/* ---------------- Clientes ---------------- */
function renderClientList(){
  const term = (document.getElementById('client-search').value || '').toLowerCase();
  const grid = document.getElementById('client-list');
  grid.innerHTML = '';
  const filtered = DB.clients.filter(c => c.name.toLowerCase().includes(term));
  if(filtered.length===0){
    grid.innerHTML = '<p class="empty-note">No hay clientes todavía. Usa "+ Nuevo cliente" para agregar el primero.</p>';
    return;
  }
  filtered.forEach(c=>{
    const card = document.createElement('div');
    card.className = 'client-card';
    card.innerHTML = `
      <div class="name">${escapeHtml(c.name)}</div>
      ${c.phone ? `<div class="sub">📞 ${escapeHtml(c.phone)}</div>` : ''}
      ${c.email ? `<div class="sub">✉️ ${escapeHtml(c.email)}</div>` : ''}
      ${c.address ? `<div class="sub">📍 ${escapeHtml(c.address)}</div>` : ''}
      <div class="card-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${c.id}">Editar</button>
        <button class="btn btn-ghost btn-sm" data-del="${c.id}">Eliminar</button>
      </div>
    `;
    card.querySelector('[data-edit]').addEventListener('click', ()=> openClientModal(c));
    card.querySelector('[data-del]').addEventListener('click', ()=>{
      if(confirm('¿Eliminar a ' + c.name + '? Esto no borra sus facturas existentes.')){
        deleteClient(c.id);
        renderClientList();
      }
    });
    grid.appendChild(card);
  });
}

function openClientModal(client){
  document.getElementById('client-modal-title').textContent = client ? 'Editar cliente' : 'Nuevo cliente';
  document.getElementById('client-id').value = client ? client.id : '';
  document.getElementById('client-name').value = client ? client.name : '';
  document.getElementById('client-phone').value = client ? client.phone||'' : '';
  document.getElementById('client-email').value = client ? client.email||'' : '';
  document.getElementById('client-address').value = client ? client.address||'' : '';
  document.getElementById('client-notes').value = client ? client.notes||'' : '';
  openModal('modal-client');
}

function setupClientForm(){
  document.getElementById('btn-new-client').addEventListener('click', ()=> openClientModal(null));
  document.getElementById('client-search').addEventListener('input', renderClientList);
  document.getElementById('btn-save-client').addEventListener('click', ()=>{
    const name = document.getElementById('client-name').value.trim();
    if(!name){ alert('El nombre del cliente es obligatorio.'); return; }
    const client = {
      id: document.getElementById('client-id').value || null,
      name,
      phone: document.getElementById('client-phone').value.trim(),
      email: document.getElementById('client-email').value.trim(),
      address: document.getElementById('client-address').value.trim(),
      notes: document.getElementById('client-notes').value.trim()
    };
    upsertClient(client);
    closeModal('modal-client');
    renderClientList();
  });
}

/* ---------------- Facturas: lista ---------------- */
function renderInvoiceList(){
  const term = (document.getElementById('invoice-search').value||'').toLowerCase();
  const statusFilter = document.getElementById('invoice-filter-status').value;
  const container = document.getElementById('invoice-list');
  container.innerHTML = '';

  let list = DB.invoices.slice().sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  list = list.filter(i=>{
    const client = DB.clients.find(c=>c.id===i.clientId);
    const clientName = client ? client.name.toLowerCase() : '';
    const matchesTerm = clientName.includes(term) || i.number.toLowerCase().includes(term);
    const matchesStatus = statusFilter==='todas' || i.status===statusFilter;
    return matchesTerm && matchesStatus;
  });

  if(list.length===0){
    container.innerHTML = '<p class="empty-note">No hay facturas que coincidan. Crea una con "+ Nueva factura".</p>';
    return;
  }

  list.forEach(inv=>{
    const client = DB.clients.find(c=>c.id===inv.clientId);
    const row = document.createElement('div');
    row.className = 'invoice-row';
    row.innerHTML = `
      <span class="num">${escapeHtml(inv.number)}</span>
      <span>${escapeHtml(client ? client.name : 'Cliente eliminado')}</span>
      <span class="status-pill status-${inv.status}">${statusLabel(inv.status)}</span>
      <span class="amount">${money(invoiceTotal(inv))}</span>
      <span class="row-actions">
        <button class="icon-btn" title="Ver / imprimir" data-view="${inv.id}">👁️</button>
        <button class="icon-btn" title="Editar" data-edit="${inv.id}">✏️</button>
        <button class="icon-btn" title="Eliminar" data-del="${inv.id}">🗑️</button>
      </span>
    `;
    row.querySelector('[data-view]').addEventListener('click', ()=> openViewInvoice(inv.id));
    row.querySelector('[data-edit]').addEventListener('click', ()=> openInvoiceModal(inv));
    row.querySelector('[data-del]').addEventListener('click', ()=>{
      if(confirm('¿Eliminar la factura ' + inv.number + '?')){
        deleteInvoice(inv.id);
        renderInvoiceList();
      }
    });
    container.appendChild(row);
  });
}

/* ---------------- Facturas: modal crear/editar ---------------- */
function fillClientSelect(){
  const sel = document.getElementById('invoice-client');
  sel.innerHTML = '';
  if(DB.clients.length===0){
    sel.innerHTML = '<option value="">Primero agrega un cliente</option>';
    return;
  }
  DB.clients.forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function addItemRow(item){
  itemRowCount++;
  const wrap = document.getElementById('invoice-items');
  const row = document.createElement('div');
  row.className = 'invoice-item-row';
  row.dataset.rowId = itemRowCount;
  row.innerHTML = `
    <input type="text" placeholder="Descripción" class="item-desc" value="${item ? escapeHtml(item.desc) : ''}">
    <input type="number" placeholder="Cant." class="item-qty" min="0" step="1" value="${item ? item.qty : 1}">
    <input type="number" placeholder="Precio" class="item-price" min="0" step="0.01" value="${item ? item.price : ''}">
    <button type="button" class="icon-btn" title="Quitar">✕</button>
  `;
  row.querySelector('button').addEventListener('click', ()=>{ row.remove(); updateInvoiceTotalPreview(); });
  row.querySelectorAll('input').forEach(inp=> inp.addEventListener('input', updateInvoiceTotalPreview));
  wrap.appendChild(row);
}

function readItemsFromForm(){
  return Array.from(document.querySelectorAll('#invoice-items .invoice-item-row')).map(row=>({
    desc: row.querySelector('.item-desc').value.trim(),
    qty: Number(row.querySelector('.item-qty').value) || 0,
    price: Number(row.querySelector('.item-price').value) || 0
  })).filter(it=> it.desc || it.qty || it.price);
}

function updateInvoiceTotalPreview(){
  const total = readItemsFromForm().reduce((s,it)=> s + it.qty*it.price, 0);
  document.getElementById('invoice-total-preview').textContent = money(total);
}

function openInvoiceModal(invoice){
  fillClientSelect();
  document.getElementById('invoice-modal-title').textContent = invoice ? 'Editar factura' : 'Nueva factura';
  document.getElementById('invoice-id').value = invoice ? invoice.id : '';
  document.getElementById('invoice-client').value = invoice ? invoice.clientId : (DB.clients[0]?.id || '');
  document.getElementById('invoice-status').value = invoice ? invoice.status : 'pendiente';
  document.getElementById('invoice-date').value = invoice ? invoice.date : new Date().toISOString().slice(0,10);
  document.getElementById('invoice-delivery').value = invoice ? (invoice.delivery||'') : '';
  document.getElementById('invoice-notes').value = invoice ? (invoice.notes||'') : '';

  document.getElementById('invoice-items').innerHTML = '';
  itemRowCount = 0;
  if(invoice && invoice.items && invoice.items.length){
    invoice.items.forEach(addItemRow);
  } else {
    addItemRow(null);
  }
  updateInvoiceTotalPreview();
  openModal('modal-invoice');
}

function setupInvoiceForm(){
  document.getElementById('btn-new-invoice').addEventListener('click', ()=>{
    if(DB.clients.length===0){
      alert('Agrega al menos un cliente antes de crear una factura.');
      goView('clientes');
      return;
    }
    openInvoiceModal(null);
  });
  document.getElementById('btn-add-item').addEventListener('click', ()=> addItemRow(null));
  document.getElementById('invoice-search').addEventListener('input', renderInvoiceList);
  document.getElementById('invoice-filter-status').addEventListener('change', renderInvoiceList);

  document.getElementById('btn-save-invoice').addEventListener('click', ()=>{
    const clientId = document.getElementById('invoice-client').value;
    if(!clientId){ alert('Selecciona un cliente.'); return; }
    const items = readItemsFromForm();
    if(items.length===0){ alert('Agrega al menos un artículo o servicio.'); return; }

    const invoice = {
      id: document.getElementById('invoice-id').value || null,
      clientId,
      status: document.getElementById('invoice-status').value,
      date: document.getElementById('invoice-date').value,
      delivery: document.getElementById('invoice-delivery').value,
      notes: document.getElementById('invoice-notes').value.trim(),
      items
    };
    if(invoice.id){
      const existing = DB.invoices.find(i=>i.id===invoice.id);
      invoice.number = existing.number;
    }
    upsertInvoice(invoice);
    closeModal('modal-invoice');
    renderInvoiceList();
    if(currentView==='dashboard') renderDashboard();
    if(currentView==='pedidos') renderPedidos();
  });
}

/* ---------------- Ver / imprimir / exportar factura ---------------- */
let viewingInvoiceId = null;

function openViewInvoice(id){
  viewingInvoiceId = id;
  const invoice = DB.invoices.find(i=>i.id===id);
  if(!invoice) return;
  renderInvoicePaper(invoice);
  openModal('modal-view-invoice');
}

function setupInvoiceViewActions(){
  document.getElementById('btn-print-invoice').addEventListener('click', printInvoice);
  document.getElementById('btn-pdf-invoice').addEventListener('click', ()=>{
    const invoice = DB.invoices.find(i=>i.id===viewingInvoiceId);
    exportInvoicePdf(invoice ? invoice.number : 'factura');
  });
  document.getElementById('btn-share-invoice').addEventListener('click', ()=>{
    const invoice = DB.invoices.find(i=>i.id===viewingInvoiceId);
    shareInvoice(invoice ? invoice.number : 'factura');
  });
}

/* ---------------- Configuración ---------------- */
function fillConfigForm(){
  const s = DB.settings;
  document.getElementById('cfg-business-name').value = s.businessName || '';
  document.getElementById('cfg-business-phone').value = s.businessPhone || '';
  document.getElementById('cfg-business-address').value = s.businessAddress || '';
  document.getElementById('cfg-business-rnc').value = s.businessRnc || '';
  document.getElementById('cfg-next-number').value = s.nextNumber || 1;
  document.getElementById('cfg-prefix').value = s.prefix || 'FAC-';
  document.getElementById('cfg-color-custom').value = s.accent || '#2F6F4E';

  const preview = document.getElementById('logo-preview');
  const placeholder = document.getElementById('logo-placeholder');
  if(s.logo){ preview.src = s.logo; preview.classList.remove('hidden'); placeholder.classList.add('hidden'); }
  else { preview.classList.add('hidden'); placeholder.classList.remove('hidden'); }
}

function setupConfigForm(){
  const saveField = (id, key, transform)=>{
    document.getElementById(id).addEventListener('change', (e)=>{
      const val = transform ? transform(e.target.value) : e.target.value;
      saveSettings({[key]: val});
      applyBrand();
    });
  };
  saveField('cfg-business-name', 'businessName');
  saveField('cfg-business-phone', 'businessPhone');
  saveField('cfg-business-address', 'businessAddress');
  saveField('cfg-business-rnc', 'businessRnc');
  saveField('cfg-next-number', 'nextNumber', v=> Number(v)||1);
  saveField('cfg-prefix', 'prefix');

  document.getElementById('cfg-color-custom').addEventListener('input', (e)=>{
    saveSettings({accent: e.target.value});
    applyAccent(e.target.value);
    renderColorPresets();
  });

  document.getElementById('cfg-logo-input').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      saveSettings({logo: reader.result});
      fillConfigForm();
      applyBrand();
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-remove-logo').addEventListener('click', ()=>{
    saveSettings({logo:''});
    fillConfigForm();
    applyBrand();
  });
}

/* ---------------- Modales genéricos ---------------- */
function setupModals(){
  document.querySelectorAll('.modal-close, [data-close]').forEach(btn=>{
    btn.addEventListener('click', ()=> closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal').forEach(modal=>{
    modal.addEventListener('click', (e)=>{
      if(e.target === modal) closeModal(modal.id);
    });
  });
}
function openModal(id){ document.getElementById(id).classList.remove('hidden'); }
function closeModal(id){ document.getElementById(id).classList.add('hidden'); }
