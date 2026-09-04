import * as pdfjsLib from 'pdfjs-dist';

// Configure worker for Vite using explicit URL resolution
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
}

/**
 * Extracts plain text from an ArrayBuffer of a PDF file
 */
export const extractTextFromPdfBuffer = async (arrayBuffer) => {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    });

    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      let lastY = null;
      let pageText = '';
      
      for (const item of textContent.items) {
        if (!item.str) continue;
        
        // If vertical position changed substantially, insert newline
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n';
        } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
          pageText += ' ';
        }
        
        pageText += item.str;
        lastY = item.transform[5];
      }

      fullText += (pageNum > 1 ? '\n\n' : '') + pageText.trim();
    }

    return fullText.trim();
  } catch (err) {
    console.error('Error extracting text with PDF.js:', err);
    throw new Error(`Failed to parse PDF: ${err.message}`);
  }
};

/**
 * If raw PDF text was pasted into textarea (starts with %PDF),
 * convert binary string back to ArrayBuffer and extract text.
 */
export const extractTextFromPastedPdfString = async (rawString) => {
  if (!rawString || !rawString.trim().startsWith('%PDF')) {
    return rawString;
  }

  try {
    const len = rawString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = rawString.charCodeAt(i) & 0xff;
    }
    return await extractTextFromPdfBuffer(bytes.buffer);
  } catch (e) {
    console.warn('Could not recover pasted PDF binary string:', e);
    return rawString;
  }
};

/**
 * Universal Document Parser for File object
 * Supports: PDF, DOCX, TXT, MD, JSON, HTML
 */
export const extractTextFromFile = async (file) => {
  if (!file) return '';

  const fileName = (file.name || '').toLowerCase();
  const fileType = (file.type || '').toLowerCase();

  // 1. PDF
  if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    return await extractTextFromPdfBuffer(arrayBuffer);
  }

  // 2. Plain Text / Markdown / JSON / HTML / RTF
  const rawText = await file.text();

  // If someone uploaded a binary PDF saved as .txt or misnamed, check signature
  if (rawText.startsWith('%PDF')) {
    return await extractTextFromPastedPdfString(rawText);
  }

  return rawText;
};
