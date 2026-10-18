import { ESTILO } from './informe';

/**
 * En el navegador: se pone el informe en la propia página, solo visible al imprimir, y se abre
 * el diálogo de impresión. En el iPhone, desde ahí se guarda como PDF (botón Compartir › Guardar en Archivos).
 */
export async function exportarPdf(html: string): Promise<void> {
  document.getElementById('informe-impresion')?.remove();
  const cuerpo = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? html;
  const caja = document.createElement('div');
  caja.id = 'informe-impresion';
  caja.innerHTML = `<style>${ESTILO}
#informe-impresion { display: none; }
@media print {
  body > *:not(#informe-impresion) { display: none !important; }
  #informe-impresion { display: block; }
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
}</style>${cuerpo}`;
  document.body.appendChild(caja);
  const quitar = () => {
    caja.remove();
    window.removeEventListener('afterprint', quitar);
  };
  window.addEventListener('afterprint', quitar);
  window.print();
}
