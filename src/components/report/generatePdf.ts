'use client';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function generateReportPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= pageHeight) {
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.92),
      'JPEG',
      0,
      0,
      imgWidth,
      imgHeight,
      undefined,
      'FAST',
    );
  } else {
    // 高さがページを超えるので、canvas を縦に切り出してページ毎に貼る
    const sliceHeightPx = (pageHeight * canvas.width) / pageWidth;
    let y = 0;
    let pageIndex = 0;
    while (y < canvas.height) {
      const sliceCanvas = document.createElement('canvas');
      const h = Math.min(sliceHeightPx, canvas.height - y);
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = h;
      const sctx = sliceCanvas.getContext('2d');
      if (!sctx) break;
      sctx.fillStyle = '#ffffff';
      sctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sctx.drawImage(canvas, 0, -y);
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(
        sliceCanvas.toDataURL('image/jpeg', 0.92),
        'JPEG',
        0,
        0,
        imgWidth,
        (h * imgWidth) / canvas.width,
        undefined,
        'FAST',
      );
      y += h;
      pageIndex += 1;
    }
  }

  pdf.save(filename);
}
