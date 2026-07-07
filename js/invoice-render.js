/* =========================================================
   invoice-render.js — pinta la "hoja" de la factura
   ========================================================= */

function money(n){
  return 'RD$ ' + (Number(n)||0).toLocaleString('es-DO', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function renderInvoicePaper(invoice){
  const client = DB.clients.find(c=>c.id===invoice.clientId) || {name:'Cliente', phone:'', address:''};
  const s = DB.settings;

  document.getElementById('paper-biz-name').textContent = s.businessName || 'Mi Negocio';
  document.getElementById('paper-biz-phone').textContent = s.businessPhone || '';
  document.getElementById('paper-biz-address').textContent = s.businessAddress || '';

  const logoImg = document.getElementById('paper-logo');
  if(s.logo){ logoImg.src = s.logo; logoImg.classList.remove('hidden'); }
  else { logoImg.classList.add('hidden'); }

  document.getElementById('paper-invoice-number').textContent = invoice.number;
  document.getElementById('paper-invoice-date').textContent = invoice.date ? 'Fecha: ' + invoice.date : '';
  document.getElementById('paper-invoice-delivery').textContent = invoice.delivery ? 'Entrega: ' + invoice.delivery : '';

  const stamp = document.getElementById('paper-stamp');
  stamp.className = 'paper-stamp stamp-' + invoice.status;
  stamp.textContent = invoice.status.toUpperCase();

  document.getElementById('paper-client-name').textContent = client.name;
  document.getElementById('paper-client-sub').textContent = [client.phone, client.address].filter(Boolean).join(' · ');

  const body = document.getElementById('paper-items-body');
  body.innerHTML = '';
  (invoice.items||[]).forEach(it=>{
    const tr = document.createElement('tr');
    const importe = (Number(it.qty)||0) * (Number(it.price)||0);
    tr.innerHTML = `<td>${escapeHtml(it.desc||'')}</td><td>${it.qty||0}</td><td>${money(it.price)}</td><td>${money(importe)}</td>`;
    body.appendChild(tr);
  });

  document.getElementById('paper-total').textContent = money(invoiceTotal(invoice));
  document.getElementById('paper-notes').textContent = invoice.notes || '';
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
