// TC-AMG — ATTACH-MERGE (Hung, 2026-11-20): pages of attached files in the
// Technical Documents (Drawing) and BV Test sections are merged into the
// exported PDF as bare full pages — the file page becomes a page of the
// export as-is, with NO section header on top and NO footer bottom bar.
// Everything else in the report keeps the standard frame.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');

function sliceFrom(marker, length, label) {
  const i = indexHtml.indexOf(marker);
  assert.ok(i !== -1, `${label} must be present in index.html`);
  return indexHtml.slice(i, i + length);
}

// The documents/bvtest branch of the PDF section dispatcher.
const docBranch = sliceFrom("if (modType === 'documents' || modType === 'bvtest') {", 4200, 'documents/bvtest PDF branch');
// The final footer pass.
const footerPass = sliceFrom('// Đánh số trang & Footer', 500, 'footer pass');

describe('TC-AMG: attached file pages merge into the PDF bare — no header, no footer bar', () => {
  it('TC-AMG.1: exportPdfCore collects bare attachment page numbers in a Set', () => {
    assert.ok(indexHtml.includes('const bareAttachPages = new Set();'),
      'a Set of bare attachment pages must be declared in exportPdfCore');
    const declAt = indexHtml.indexOf('const bareAttachPages = new Set();');
    const branchAt = indexHtml.indexOf("if (modType === 'documents' || modType === 'bvtest') {");
    assert.ok(declAt !== -1 && branchAt !== -1 && declAt < branchAt,
      'the Set must be declared before the section dispatcher runs');
  });

  it('TC-AMG.2: a readable attachment page opens a bare page and registers it — no addHeader', () => {
    const imgBlock = docBranch.slice(docBranch.indexOf('if (pageImg) {'), docBranch.indexOf('} else {'));
    assert.ok(imgBlock.includes('doc.addPage();'), 'each attachment page starts a fresh page');
    assert.ok(imgBlock.includes('bareAttachPages.add(doc.getNumberOfPages());'),
      'the new page number is registered as bare');
    assert.ok(!imgBlock.includes('addHeader('), 'a merged page must NOT get the section header');
  });

  it('TC-AMG.3: the merged page image is fitted to the FULL A4 page, centred both ways', () => {
    const imgBlock = docBranch.slice(docBranch.indexOf('if (pageImg) {'), docBranch.indexOf('} else {'));
    assert.ok(imgBlock.includes('const maxDrawW = W;'), 'fit width is the full page width');
    assert.ok(imgBlock.includes('const maxDrawH = 297;'), 'fit height is the full A4 height');
    assert.ok(imgBlock.includes('const posX = (W - drawW) / 2;'), 'centred horizontally on the page');
    assert.ok(imgBlock.includes('const posY = (297 - drawH) / 2;'), 'centred vertically on the page');
    assert.ok(!imgBlock.includes('W - M * 2'), 'the old framed content-box fit is gone from the image path');
    assert.ok(imgBlock.includes('y = 297;'), 'after a bare page the cursor is past the end, so following content opens a fresh page');
  });

  it('TC-AMG.4: the unreadable-file fallback keeps the framed info card', () => {
    const elseBlock = docBranch.slice(docBranch.indexOf('} else {'), docBranch.indexOf('});', docBranch.indexOf('} else {')));
    assert.ok(elseBlock.includes('addHeader(modTitle);'), 'fallback card still gets a framed page');
    assert.ok(elseBlock.includes('doc.text(attName, M + 4, y + 6);'), 'fallback card still shows the file name');
  });

  it('TC-AMG.5: the footer pass skips bare attachment pages', () => {
    assert.ok(footerPass.includes('if (bareAttachPages.has(p)) continue;'),
      'the footer loop must skip registered bare pages');
    assert.ok(footerPass.includes('const totalPages = doc.getNumberOfPages();'),
      'total page count still covers every page, bare ones included');
  });

  it('TC-AMG.6: section Remarks notes keep the framed treatment after merged pages', () => {
    assert.ok(docBranch.includes('if (y + 30 > BOTTOM_LIMIT) {'), 'notes overflow check is unchanged');
    assert.ok(docBranch.includes('addHeader(`${modTitle} Remarks`);'), 'notes still open a framed page when needed');
  });
});
