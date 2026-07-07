/* =========================================================
   pdf-export.js — exportar a PDF e imprimir/compartir
   ========================================================= */

async function invoiceToPdfBlob(){
  const node = document.getElementById('invoice-paper');
  const canvas = await html2canvas(node, { scale:2, backgroundColor:'#FBF9F5' });
  const imgData = canvas.toDataURL('image/png');

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit:'pt', format:'letter' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgW = pageWidth - 60;
  const imgH = (canvas.height / canvas.width) * imgW;
  let renderH = imgH;
  if(renderH > pageHeight - 60) renderH = pageHeight - 60;

  pdf.addImage(imgData, 'PNG', 30, 30, imgW, renderH);
  return pdf.output('blob');
}

async function exportInvoicePdf(invoiceNumber){
  const blob = await invoiceToPdfBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (invoiceNumber || 'factura') + '.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
}

async function shareInvoice(invoiceNumber){
  try{
    const blob = await invoiceToPdfBlob();
    const file = new File([blob], (invoiceNumber||'factura') + '.pdf', {type:'application/pdf'});

    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({
        files:[file],
        title:'Factura ' + invoiceNumber,
        text:'Te comparto la factura ' + invoiceNumber
      });
      return;
    }
  }catch(e){
    console.warn('No se pudo compartir el archivo directamente, se descargará en su lugar.', e);
  }
  // Alternativa si el navegador no soporta compartir archivos (ej. escritorio)
  exportInvoicePdf(invoiceNumber);
}

function printInvoice(){
  window.print();
}
