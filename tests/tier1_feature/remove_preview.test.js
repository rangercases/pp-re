// TC-NOPREV — the PDF PREVIEW command was removed entirely in v4.6.3
// (Hung: no review step on any device — PDF export goes straight to download).
// Guards against accidental resurrection and against over-removal: the PDF
// export itself and the Styler's separate header live-preview must survive.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', '..', 'index.html'), 'utf8');

describe('TC-NOPREV: PDF preview command removed (v4.6.3)', () => {
  it('TC-NOPREV1: no preview button, modal, or preview functions remain', () => {
    for (const token of ['id="btnPreview"', 'pdfLivePreviewModal', 'function previewPDF',
      'openPdfPreviewModal', 'closePdfPreviewModal', 'downloadPdfFromPreview',
      'btnPreviewDownload', "options.preview", "'btnPreview'"]) {
      assert.ok(!html.includes(token), `removed preview remnant still present: ${token}`);
    }
  });

  it('TC-NOPREV2: direct PDF export is intact', () => {
    assert.ok(html.includes('id="btnExport"'), 'PDF export button must remain');
    assert.ok(html.includes('async function exportPDF'), 'exportPDF must remain');
    assert.ok(html.includes('fsSavePdfBlob(blob, safeFileName)'), 'export must save the blob directly');
  });

  it('TC-NOPREV3: unrelated previews survive (Styler header preview, doc thumbs)', () => {
    assert.ok(html.includes('id="pdfPreviewCanvas"'), 'Styler live header preview canvas must remain');
    assert.ok(html.includes('drawLiveHeaderPreview'), 'Styler live header preview must remain');
  });
});
