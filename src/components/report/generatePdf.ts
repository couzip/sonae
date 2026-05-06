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

  // 上下に余白を入れることで、ページ境界に文字が掛かって見切れるのを軽減する。
  const MARGIN_TOP = 24;
  const MARGIN_BOTTOM = 24;
  const usableHeight = pageHeight - MARGIN_TOP - MARGIN_BOTTOM;
  // 連続ページの境界で行が真っ二つになるのを緩和するため、各ページに少し overlap を持たせる。
  const OVERLAP_PT = 12;

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= usableHeight) {
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.92),
      'JPEG',
      0,
      MARGIN_TOP,
      imgWidth,
      imgHeight,
      undefined,
      'FAST',
    );
  } else {
    const sliceHeightPx = (usableHeight * canvas.width) / pageWidth;
    const overlapPx = (OVERLAP_PT * canvas.width) / pageWidth;
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
        MARGIN_TOP,
        imgWidth,
        (h * imgWidth) / canvas.width,
        undefined,
        'FAST',
      );
      // 次ページの先頭は overlap 分だけ巻き戻して描画開始 (境界行の重複表示)
      y += h - overlapPx;
      if (h < sliceHeightPx) break;
      pageIndex += 1;
    }
  }

  pdf.save(filename);
}
