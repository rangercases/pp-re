// Main Application Logic
import { LOGO_WHITE, LOGO_BLACK } from './logo.js';
import { FONT_ROBOTO, FONT_ROBOTO_BOLD } from './font.js';

// Gắn logo & font vào window scope để các hàm render/pdf hiện có sử dụng mượt mà
window.LOGO_WHITE = LOGO_WHITE;
window.LOGO_BLACK = LOGO_BLACK;
window.FONT_ROBOTO = FONT_ROBOTO;
window.FONT_ROBOTO_BOLD = FONT_ROBOTO_BOLD;


    // ═══════════════ PDF & HEADER VISUAL STYLER CONTROLLER ═══════════════
    const DEFAULT_PDF_CONFIG = {
      reportTitle: 'PP SAMPLE REVIEW REPORT',
      themeColor: '#1a3a2a',
      headerTextColor: '#ffffff',
      bannerH: 24,
      logoW_p1: 44,
      logoX_p1: 14,
      logoY_p1: 6.2,
      titleFontSize: 16,
      titleY: 16,
      logoW_sub: 36,
      logoX_sub: 14,
      logoY_sub: 4.2
    };

    let pdfConfig = loadPdfConfig();
    let stylerActiveTab = 'p1';
    let cachedLogoWhiteImg = null;
    let cachedLogoBlackImg = null;

    function initCachedLogos() {
      if (!cachedLogoWhiteImg) {
        cachedLogoWhiteImg = new Image();
        cachedLogoWhiteImg.src = LOGO_WHITE;
        cachedLogoWhiteImg.onload = () => { if (stylerModalOpen) drawLiveHeaderPreview(); };
      }
      if (!cachedLogoBlackImg) {
        cachedLogoBlackImg = new Image();
        cachedLogoBlackImg.src = LOGO_BLACK;
        cachedLogoBlackImg.onload = () => { if (stylerModalOpen) drawLiveHeaderPreview(); };
      }
    }

    function loadPdfConfig() {
      try {
        const saved = localStorage.getItem('SOFACOMPANY_PDF_SETTINGS');
        if (saved) {
          return Object.assign({}, DEFAULT_PDF_CONFIG, JSON.parse(saved));
        }
      } catch (e) {
        console.error('Error loading PDF config', e);
      }
      return Object.assign({}, DEFAULT_PDF_CONFIG);
    }

    function savePdfConfig(cfg) {
      try {
        localStorage.setItem('SOFACOMPANY_PDF_SETTINGS', JSON.stringify(cfg));
      } catch (e) {}
    }

    function hexToRgbArr(hex) {
      const h = (hex || '#1a3a2a').replace('#', '');
      if (h.length === 6) {
        return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
      }
      return [26, 58, 42];
    }

    function isColorDark(hex) {
      const rgb = hexToRgbArr(hex);
      return (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) < 140;
    }

    let stylerModalOpen = false;

    function openPdfStyler() {
      stylerModalOpen = true;
      initCachedLogos();
      populateStylerUI();
      switchStylerTab(stylerActiveTab || 'p1');
      document.getElementById('pdfStylerModal').classList.remove('hidden');
      setTimeout(drawLiveHeaderPreview, 60);
    }

    function closePdfStyler() {
      stylerModalOpen = false;
      document.getElementById('pdfStylerModal').classList.add('hidden');
    }

    function populateStylerUI() {
      const c = pdfConfig;
      setVal('cfg_reportTitle', c.reportTitle || 'PP SAMPLE REVIEW REPORT');
      setVal('cfg_themeColor', c.themeColor);
      setText('val_themeColor', c.themeColor);
      setVal('cfg_headerTextColor', c.headerTextColor);
      setText('val_headerTextColor', c.headerTextColor);

      setVal('cfg_logoW_p1', c.logoW_p1);
      setText('val_logoW_p1', parseFloat(c.logoW_p1).toFixed(1) + ' mm');
      setVal('cfg_logoX_p1', c.logoX_p1);
      setText('val_logoX_p1', parseFloat(c.logoX_p1).toFixed(1) + ' mm');
      setVal('cfg_logoY_p1', c.logoY_p1);
      setText('val_logoY_p1', parseFloat(c.logoY_p1).toFixed(1) + ' mm');
      setVal('cfg_titleFontSize', c.titleFontSize);
      setText('val_titleFontSize', parseFloat(c.titleFontSize).toFixed(1) + ' pt');
      setVal('cfg_titleY', c.titleY);
      setText('val_titleY', parseFloat(c.titleY).toFixed(1) + ' mm');
      setVal('cfg_bannerH', c.bannerH);
      setText('val_bannerH', parseFloat(c.bannerH).toFixed(1) + ' mm');

      setVal('cfg_logoW_sub', c.logoW_sub);
      setText('val_logoW_sub', parseFloat(c.logoW_sub).toFixed(1) + ' mm');
      setVal('cfg_logoX_sub', c.logoX_sub);
      setText('val_logoX_sub', parseFloat(c.logoX_sub).toFixed(1) + ' mm');
      setVal('cfg_logoY_sub', c.logoY_sub);
      setText('val_logoY_sub', parseFloat(c.logoY_sub).toFixed(1) + ' mm');
    }

    function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
    function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }

    function switchStylerTab(tab) {
      stylerActiveTab = tab;
      const b1 = document.getElementById('btnTabP1');
      const bs = document.getElementById('btnTabSub');
      if (b1) b1.classList.toggle('active', tab === 'p1');
      if (bs) bs.classList.toggle('active', tab === 'sub');
      const secP1 = document.getElementById('section_p1_settings');
      const secSub = document.getElementById('section_sub_settings');
      if (secP1) secP1.style.display = tab === 'p1' ? 'block' : 'none';
      if (secSub) secSub.style.display = tab === 'sub' ? 'block' : 'none';
      drawLiveHeaderPreview();
    }

    function onStylerTitleChange(val) {
      pdfConfig.reportTitle = val;
      drawLiveHeaderPreview();
    }

    function onStylerColorChange(prop, val) {
      pdfConfig[prop] = val;
      setText('val_' + prop, val);
      if (prop === 'themeColor') {
        const isDark = isColorDark(val);
        const isHeaderDark = isColorDark(pdfConfig.headerTextColor || '#ffffff');
        if (!isDark && !isHeaderDark) {
          pdfConfig.headerTextColor = '#1a1916';
          setVal('cfg_headerTextColor', '#1a1916');
          setText('val_headerTextColor', '#1a1916');
        } else if (isDark && isHeaderDark) {
          pdfConfig.headerTextColor = '#ffffff';
          setVal('cfg_headerTextColor', '#ffffff');
          setText('val_headerTextColor', '#ffffff');
        }
      }
      drawLiveHeaderPreview();
    }

    function onStylerSliderChange(prop, val, unit) {
      pdfConfig[prop] = parseFloat(val);
      setText('val_' + prop, parseFloat(val).toFixed(1) + unit);
      drawLiveHeaderPreview();
    }

    function applyThemeToWeb() {
      // Giữ nguyên giao diện và nút bấm web app luôn rõ ràng, không bị đổi theo màu PDF
      const brandLogo = document.getElementById('topbarBrandLogo');
      if (brandLogo && typeof LOGO_WHITE !== 'undefined') {
        brandLogo.src = LOGO_WHITE;
      }
    }

    function drawLiveHeaderPreview() {
      const canvas = document.getElementById('pdfPreviewCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W_mm = 210;
      const scale = canvas.width / W_mm; // 3.0 px/mm

      if (stylerActiveTab === 'p1') {
        // TRANG BÌA 1: Render mô phỏng 65mm đầu trang A4 (Header + Khung thông tin + Ô tick)
        const H_mm = 65;
        canvas.height = Math.round(H_mm * scale);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Nền giấy trắng A4
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Dải màu Header
        const bannerH_mm = pdfConfig.bannerH || 24;
        const bannerH_px = Math.round(bannerH_mm * scale);
        ctx.fillStyle = pdfConfig.themeColor || '#1a3a2a';
        ctx.fillRect(0, 0, canvas.width, bannerH_px);

        const isDark = isColorDark(pdfConfig.themeColor || '#1a3a2a');
        if (!isDark) {
          ctx.strokeStyle = '#d7dce1';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, bannerH_px);
          ctx.lineTo(canvas.width, bannerH_px);
          ctx.stroke();
        }

        // Logo Trang 1
        const logoImg = isDark ? cachedLogoWhiteImg : cachedLogoBlackImg;
        const logoW_mm = pdfConfig.logoW_p1 || 44;
        const logoH_mm = logoW_mm / 10.1587;
        const logoX_mm = pdfConfig.logoX_p1 || 14;
        const logoY_mm = pdfConfig.logoY_p1 || 6.2;
        if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
          ctx.drawImage(logoImg, logoX_mm * scale, logoY_mm * scale, logoW_mm * scale, logoH_mm * scale);
        }

        // Tiêu đề Trang 1 (căn giữa theo vertical middle đồng bộ 100% với jsPDF)
        const isHeaderDark = isColorDark(pdfConfig.headerTextColor || '#ffffff');
        const textFill = (!isDark && !isHeaderDark) ? '#1a1916' : (pdfConfig.headerTextColor || '#ffffff');
        ctx.fillStyle = textFill;
        const titlePt = parseFloat(pdfConfig.titleFontSize || 16);
        const fontPx = Math.round(titlePt * (25.4 / 72) * scale);
        ctx.font = `bold ${fontPx}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displayTitle = (D && D.reportTitle && D.reportTitle.trim()) ? D.reportTitle.trim() : (pdfConfig.reportTitle || 'PP SAMPLE REVIEW REPORT');
        ctx.fillText(displayTitle, canvas.width / 2, (pdfConfig.titleY || 16) * scale);

        // Render mô phỏng phần thông tin sản phẩm và ô tick bên dưới giống hệt PDF thực tế
        const M_px = 14 * scale;
        const py1 = (bannerH_mm + 6) * scale;
        const hw = ((W_mm - 28) / 2 - 2) * scale;
        const rowH = 9 * scale;

        ctx.fillStyle = '#f8f6f2';
        ctx.strokeStyle = '#e2dfd9';
        ctx.lineWidth = 1;
        ctx.fillRect(M_px, py1, hw, rowH);
        ctx.strokeRect(M_px, py1, hw, rowH);
        ctx.fillRect(M_px + hw + 4 * scale, py1, hw, rowH);
        ctx.strokeRect(M_px + hw + 4 * scale, py1, hw, rowH);

        const cellTextSize = Math.round(8.5 * (25.4 / 72) * scale);
        ctx.font = `bold ${cellTextSize}px Helvetica, Arial, sans-serif`;
        ctx.fillStyle = '#645f5a';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Model No.:', M_px + 2 * scale, py1 + 5.9 * scale);
        ctx.fillText('Description:', M_px + hw + 6 * scale, py1 + 5.9 * scale);

        ctx.font = `normal ${cellTextSize}px Helvetica, Arial, sans-serif`;
        ctx.fillStyle = '#141414';
        ctx.fillText(D.model || 'MD 2754', M_px + 24 * scale, py1 + 5.9 * scale);
        ctx.fillText(D.desc || 'Side Table (Komo)', M_px + hw + 28 * scale, py1 + 5.9 * scale);

        const py2 = py1 + 10 * scale;
        ctx.fillStyle = '#f8f6f2';
        ctx.fillRect(M_px, py2, hw, rowH);
        ctx.strokeRect(M_px, py2, hw, rowH);
        ctx.fillRect(M_px + hw + 4 * scale, py2, hw, rowH);
        ctx.strokeRect(M_px + hw + 4 * scale, py2, hw, rowH);

        ctx.font = `bold ${cellTextSize}px Helvetica, Arial, sans-serif`;
        ctx.fillStyle = '#645f5a';
        ctx.fillText('Dimension:', M_px + 2 * scale, py2 + 5.9 * scale);
        ctx.fillText('Date:', M_px + hw + 6 * scale, py2 + 5.9 * scale);

        ctx.font = `normal ${cellTextSize}px Helvetica, Arial, sans-serif`;
        ctx.fillStyle = '#141414';
        ctx.fillText(D.dim || '—', M_px + 24 * scale, py2 + 5.9 * scale);
        ctx.fillText(D.date || '17-Sep-26', M_px + hw + 28 * scale, py2 + 5.9 * scale);

        const py3 = py2 + 13 * scale;
        ctx.font = `bold ${cellTextSize}px Helvetica, Arial, sans-serif`;
        ctx.fillStyle = '#504b46';
        ctx.fillText('Stage:', M_px, py3);

        const cbFill = isDark ? (pdfConfig.themeColor || '#1a3a2a') : '#1e1e1e';
        const cbSize = 3 * scale;
        let cx = M_px + 18 * scale;
        const checks = [{ l: 'Frame', c: true }, { l: 'Foam', c: false }, { l: 'Upholstery', c: false }];
        checks.forEach(item => {
          const cbY = py3 - cbSize / 2;
          if (item.c) {
            ctx.fillStyle = cbFill;
            ctx.fillRect(cx, cbY, cbSize, cbSize);
            ctx.strokeStyle = isDark ? cbFill : '#1e1e1e';
            ctx.lineWidth = 1;
            ctx.strokeRect(cx, cbY, cbSize, cbSize);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(cx + 0.65 * scale, cbY + 1.45 * scale);
            ctx.lineTo(cx + 1.3 * scale, cbY + 2.05 * scale);
            ctx.lineTo(cx + 2.45 * scale, cbY + 0.55 * scale);
            ctx.stroke();
          } else {
            ctx.strokeStyle = '#b4afa9';
            ctx.lineWidth = 1;
            ctx.strokeRect(cx, cbY, cbSize, cbSize);
          }
          ctx.font = `normal ${Math.round(8 * (25.4 / 72) * scale)}px Helvetica, Arial, sans-serif`;
          ctx.fillStyle = '#282828';
          ctx.fillText(item.l, cx + 4.5 * scale, py3);
          cx += ctx.measureText(item.l).width + 11 * scale;
        });

      } else {
        // CÁC TRANG SAU (Page 2+)
        const H_mm = 48;
        canvas.height = Math.round(H_mm * scale);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const bannerH_px = Math.round(24 * scale);
        ctx.fillStyle = pdfConfig.themeColor || '#1a3a2a';
        ctx.fillRect(0, 0, canvas.width, bannerH_px);

        const isDark = isColorDark(pdfConfig.themeColor || '#1a3a2a');
        if (!isDark) {
          ctx.strokeStyle = '#d7dce1';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, bannerH_px);
          ctx.lineTo(canvas.width, bannerH_px);
          ctx.stroke();
        }

        // Logo Trang sau
        const logoImg = isDark ? cachedLogoWhiteImg : cachedLogoBlackImg;
        const logoW_mm = pdfConfig.logoW_sub || 36;
        const logoH_mm = logoW_mm / 10.1587;
        const logoX_mm = pdfConfig.logoX_sub || 14;
        const logoY_mm = pdfConfig.logoY_sub || 4.2;
        if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
          ctx.drawImage(logoImg, logoX_mm * scale, logoY_mm * scale, logoW_mm * scale, logoH_mm * scale);
        }

        // Tiêu đề & Thông tin trang sau
        const isHeaderDark = isColorDark(pdfConfig.headerTextColor || '#ffffff');
        const textFill = (!isDark && !isHeaderDark) ? '#1a1916' : (pdfConfig.headerTextColor || '#ffffff');
        ctx.fillStyle = textFill;

        const titlePt = 14;
        const fontPx = Math.round(titlePt * (25.4 / 72) * scale);
        ctx.font = `bold ${fontPx}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PRODUCT PHOTOS', canvas.width / 2, 17 * scale);

        // Top info bên phải với thông tin thực tế từ report
        const topInfoText = [D.model, D.desc, D.reviewer ? 'Reviewer: ' + D.reviewer : ''].filter(Boolean).join('  |  ') || 'Model | Description | Reviewer';
        ctx.font = `normal ${Math.round(7 * (25.4 / 72) * scale)}px Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.75;
        ctx.fillText(topInfoText, canvas.width - (14 * scale), 7 * scale);
        ctx.globalAlpha = 1.0;

        // Khung nội dung ảnh phía dưới
        const M_px = 14 * scale;
        const py = bannerH_px + 6 * scale;
        const gw = ((W_mm - 28 - 6) / 2) * scale;
        const gh = 14 * scale;
        ctx.fillStyle = '#f8f9fa';
        ctx.strokeStyle = '#e2e4e8';
        ctx.lineWidth = 1;
        ctx.fillRect(M_px, py, gw, gh);
        ctx.strokeRect(M_px, py, gw, gh);
        ctx.fillRect(M_px + gw + 6 * scale, py, gw, gh);
        ctx.strokeRect(M_px + gw + 6 * scale, py, gw, gh);

        ctx.fillStyle = '#9ca3af';
        ctx.font = `normal ${Math.round(7.5 * (25.4 / 72) * scale)}px Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Ảnh 1', M_px + gw / 2, py + gh / 2);
        ctx.fillText('Ảnh 2', M_px + gw + 6 * scale + gw / 2, py + gh / 2);
      }
    }

    function resetPdfConfig() {
      if (!confirm('Đặt lại tất cả thông số căn chỉnh về mặc định ban đầu?')) return;
      pdfConfig = Object.assign({}, DEFAULT_PDF_CONFIG);
      savePdfConfig(pdfConfig);
      populateStylerUI();
      applyThemeToWeb();
      drawLiveHeaderPreview();
      showToast('✓ Đã khôi phục cài đặt mặc định');
    }

    function savePdfConfigAndClose() {
      savePdfConfig(pdfConfig);
      applyThemeToWeb();
      closePdfStyler();
      showToast('✓ Đã lưu cấu hình căn chỉnh PDF!');
    }

    // Tự động áp dụng theme khi tải trang
    document.addEventListener('DOMContentLoaded', () => {
      applyThemeToWeb();
      initCachedLogos();
    });



    // ═══════════════ THEME COLOR RGB CHO PDF ═══════════════
    function getThemeRgb() {
      const dummy = document.createElement('div');
      dummy.style.color = 'var(--brand-theme)';
      dummy.style.display = 'none';
      document.body.appendChild(dummy);
      const computed = window.getComputedStyle(dummy).color;
      document.body.removeChild(dummy);

      const match = computed.match(/\d+/g);
      if (match && match.length >= 3) {
        return [parseInt(match[0], 10), parseInt(match[1], 10), parseInt(match[2], 10)];
      }
      return [26, 58, 42];
    }

    function getHeaderFooterTextRgb() {
      const dummy = document.createElement('div');
      dummy.style.color = 'var(--brand-header-footer-text)';
      dummy.style.display = 'none';
      document.body.appendChild(dummy);
      const computed = window.getComputedStyle(dummy).color;
      document.body.removeChild(dummy);

      const match = computed.match(/\d+/g);
      if (match && match.length >= 3) {
        return [parseInt(match[0], 10), parseInt(match[1], 10), parseInt(match[2], 10)];
      }
      return [255, 255, 255];
    }

    function getCompanyTextRgb() {
      const dummy = document.createElement('div');
      dummy.style.color = 'var(--brand-company-text)';
      dummy.style.display = 'none';
      document.body.appendChild(dummy);
      const computed = window.getComputedStyle(dummy).color;
      document.body.removeChild(dummy);

      const match = computed.match(/\d+/g);
      if (match && match.length >= 3) {
        return [parseInt(match[0], 10), parseInt(match[1], 10), parseInt(match[2], 10)];
      }
      return [255, 255, 255];
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // ═══════════════ INDEXED DB STORAGE ═══════════════
    const DB_NAME = 'SofaCompanyPP_DB_Lite';
    const STORE_NAME = 'reports';
    let db = null;

    function initDB() {
      // Yêu cầu quyền lưu trữ bền vững (Persistent Storage) trên Safari iOS & Chrome để tránh bị tự động xóa
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(granted => {
          if (granted) console.log('[Storage] Trình duyệt đã cấp quyền lưu trữ bền vững (Persistent Storage).');
        }).catch(err => console.warn('[Storage] Không thể yêu cầu persistent storage:', err));
      }

      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => {
          if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
            e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = e => { db = e.target.result; resolve(db); };
        req.onerror = e => reject(e);
      });
    }
    
    function dbGetAll() { 
      return new Promise((res, rej) => { 
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll(); 
        req.onsuccess = () => res(req.result || []); 
        req.onerror = () => rej(req.error); 
      }); 
    }

    function dbGetAllMetadata() {
      return new Promise((res, rej) => {
        if (!db) {
          initDB().then(() => dbGetAllMetadata()).then(res).catch(rej);
          return;
        }
        const list = [];
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();
        req.onsuccess = e => {
          const cursor = e.target.result;
          if (cursor) {
            const r = cursor.value;
            if (r) {
              let coverCount = 0;
              let firstThumb = '';
              if (r.coverPhotos && typeof r.coverPhotos === 'object') {
                const vals = Object.values(r.coverPhotos);
                for (let i = 0; i < vals.length; i++) {
                  const val = vals[i];
                  const img = (typeof val === 'string') ? val : (val && val.img);
                  if (img) {
                    coverCount++;
                    if (!firstThumb && typeof img === 'string' && img.startsWith('data:image')) {
                      firstThumb = img;
                    }
                  }
                }
              }
              let prodCount = 0;
              if (Array.isArray(r.prodPhotos)) {
                for (let i = 0; i < r.prodPhotos.length; i++) {
                  const p = r.prodPhotos[i];
                  const img = (typeof p === 'string') ? p : (p && (p.data || p.img));
                  if (img) {
                    prodCount++;
                    if (!firstThumb && typeof img === 'string' && img.startsWith('data:image')) {
                      firstThumb = img;
                    }
                  }
                }
              }
              list.push({
                id: r.id,
                moduleType: r.moduleType || 'pre-production',
                reportTitle: r.reportTitle || '',
                model: r.model || '',
                desc: r.desc || '',
                date: r.date || '',
                factory: r.factory || '',
                reviewer: r.reviewer || '',
                updatedAt: r.updatedAt || r.date || '',
                photoCount: coverCount + prodCount,
                thumbSrc: firstThumb
              });
            }
            cursor.continue();
          } else {
            res(list);
          }
        };
        req.onerror = () => rej(req.error);
      });
    }

    function dbGet(id) { 
      return new Promise((res, rej) => { 
        if (!db) {
          initDB().then(() => dbGet(id)).then(res).catch(rej);
          return;
        }
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id); 
        req.onsuccess = () => {
          if (req.result) {
            res(req.result);
            return;
          }
          let altId = null;
          if (typeof id === 'string' && !isNaN(Number(id)) && id.trim() !== '') {
            altId = Number(id);
          } else if (typeof id === 'number') {
            altId = String(id);
          }
          if (altId !== null) {
            const altReq = store.get(altId);
            altReq.onsuccess = () => res(altReq.result || null);
            altReq.onerror = () => res(null);
          } else {
            res(null);
          }
        }; 
        req.onerror = () => rej(req.error); 
      }); 
    }
    
    function dbPut(report) { 
      return new Promise((res, rej) => { 
        const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(report); 
        req.onsuccess = () => res(); 
        req.onerror = () => rej(req.error); 
      }); 
    }
    
    function dbDelete(id) { 
      return new Promise((res, rej) => { 
        const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id); 
        req.onsuccess = () => res(); 
        req.onerror = () => rej(req.error); 
      }); 
    }

    const APP_VERSION = 'v3.0.0';

    // ── SAO LƯU TOÀN BỘ CƠ SỞ DỮ LIỆU (BACKUP ALL) ──
    async function backupDatabase() {
      try {
        const allReports = await dbGetAll();
        if (!allReports || allReports.length === 0) {
          showToast('Chưa có báo cáo nào trong hệ thống để sao lưu!');
          return;
        }
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const backupPackage = {
          app: 'PPSampleReview',
          version: APP_VERSION,
          backupAt: now.toISOString(),
          totalReports: allReports.length,
          reports: allReports
        };
        const blob = new Blob([JSON.stringify(backupPackage, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `PP_Review_Backup_FullDB_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        showToast(`✓ Đã sao lưu thành công ${allReports.length} báo cáo!`);
      } catch (err) {
        console.error('Lỗi khi sao lưu dữ liệu:', err);
        alert('Lỗi sao lưu cơ sở dữ liệu: ' + err.message);
      }
    }

    // ── PHỤC HỒI DỮ LIỆU TỪ FILE BACKUP (RESTORE DB) ──
    async function restoreDatabase(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      event.target.value = '';

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const raw = JSON.parse(e.target.result);
          let reportsToRestore = [];
          if (Array.isArray(raw)) {
            reportsToRestore = raw;
          } else if (raw && Array.isArray(raw.reports)) {
            reportsToRestore = raw.reports;
          } else if (raw && typeof raw === 'object' && (raw.id || raw.model || raw.desc)) {
            reportsToRestore = [raw];
          }

          if (!reportsToRestore.length) {
            alert('File sao lưu không chứa dữ liệu báo cáo hợp lệ!');
            return;
          }

          const confirmMsg = `Tìm thấy ${reportsToRestore.length} báo cáo trong file sao lưu.
` +
                             `Nhấn OK để gộp/cập nhật vào hệ thống (các báo cáo trùng ID sẽ được cập nhật mới nhất).`;
          if (!confirm(confirmMsg)) return;

          showToast('Đang phục hồi dữ liệu...');
          let count = 0;
          for (const rep of reportsToRestore) {
            if (!rep.id) rep.id = 'pp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            const normalizedRep = await normalizeReportPhotos(rep);
            await dbPut(normalizedRep);
            count++;
          }
          await renderHome();
          showToast(`✓ Phục hồi thành công ${count} báo cáo!`);
        } catch (err) {
          console.error('Lỗi khi phục hồi file backup:', err);
          alert('Không thể đọc file sao lưu. Vui lòng kiểm tra lại định dạng JSON!');
        }
      };
      reader.readAsText(file);
    }

    // ═══════════════ DATA CONSTANTS ═══════════════
    const TABS = ['Overall', 'Photos', 'Dimensions', 'Product Assembly', 'Quality Watch Out', 'Testing', 'Checklist'];
    const COVER_SLOTS = ['FRONT VIEW', 'SIDE VIEW', 'ANGLE VIEW', 'BOTTOM VIEW'];
    const CHECK_OPTS = {
      stage: ['Frame', 'Foam', 'Upholstery'], sample: ['Initial', 'Repaired', 'Final'],
      comfort: ['Normal', 'Soft', 'Super Soft', 'Luxury Comfort'], rating: ['Repair', 'New Sample', 'To send for final approval', 'Approved']
    };
    
    const DIM_MAPPING = {
      'Overall Width': 'ow', 'Overall Depth': 'od', 'Overall Height': 'oh',
      'Seat Width': 'sw', 'Seat Depth': 'sd', 'Seat Height': 'sh',
      'Arm Height': 'ah', 'Back Height': 'bh', 'Middle Height': 'mh',
      'Arm Thickness': 'at', 'Back Thickness': 'bt', 'Arm to Seat': 'as2',
      'Back to Seat': 'bs', 'Net Weight': 'nw'
    };
    
    const DEFAULT_DIM_FIELDS = Object.keys(DIM_MAPPING).map(function(k) { return { name: k }; });
    const DEFAULT_BV = [
      { test: 'ANSI/BIFMA X5.1 Sec. 12', result: '', remark: '' }, { test: 'ANSI/BIFMA X5.1 Sec. 13', result: '', remark: '' },
      { test: 'ANSI/BIFMA X5.4 Sec. 15', result: '', remark: '' }, { test: 'BS EN 12520:2024', result: '', remark: '' },
      { test: 'BS EN 1022:2023', result: '', remark: '' }, { test: 'EN 16139:2013 Level 1', result: '', remark: '' }
    ];

    const DEFAULT_CHECKLIST_CONFIG = [
      {
        id: 'cg_photos',
        title: 'Product Photos',
        items: [
          { id: 'ci_1_1', text: 'Four Views: Front / Side / Back / Bottom', status: null },
          { id: 'ci_1_2', text: 'Comparing Prototype Sample', status: null }
        ]
      },
      {
        id: 'cg_dim',
        title: 'Overall Dimension',
        items: [
          { id: 'ci_2_1', text: '2D Drawing (Factory to provide)', status: null },
          { id: 'ci_2_2', text: 'AI Drawing (Factory to provide)', status: null }
        ]
      },
      {
        id: 'cg_carcass',
        title: 'Carcass Frame',
        items: [
          { id: 'ci_3_1', text: 'Frame/sub frames Classification & Identification/Dimension', status: null },
          { id: 'ci_3_2', text: 'Carcass Construction and Joinery', status: null },
          { id: 'ci_3_3', text: 'Critical & Functional Dimension', status: null },
          { id: 'ci_3_4', text: 'Suspension and Support (Nozag/Webbing)', status: null },
          { id: 'ci_3_5', text: 'Legs and Base Location', status: null },
          { id: 'ci_3_6', text: 'Weight', status: null }
        ]
      },
      {
        id: 'cg_foaming',
        title: 'Foaming',
        items: [
          { id: 'ci_4_1', text: 'Foam Quality & Quantity', status: null },
          { id: 'ci_4_2', text: 'Foam Specification', status: null },
          { id: 'ci_4_3', text: 'Fiber Matting / Padding on Surfaces', status: null },
          { id: 'ci_4_4', text: 'Weight', status: null }
        ]
      },
      {
        id: 'cg_upholstered',
        title: 'Upholstered Sofa',
        items: [
          { id: 'ci_5_1', text: 'Overall Dimension', status: null },
          { id: 'ci_5_2', text: 'Functional Dimension', status: null },
          { id: 'ci_5_3', text: 'Comfort', status: null },
          { id: 'ci_5_4', text: 'Fabric Specification, Direction & Quality (fabric swatch)', status: null },
          { id: 'ci_5_5', text: 'Seat and Back Cushion Function', status: null },
          { id: 'ci_5_6', text: 'Stitching Details', status: null },
          { id: 'ci_5_7', text: 'Weight', status: null }
        ]
      },
      {
        id: 'cg_cushion',
        title: 'Back & Seat Cushion',
        items: [
          { id: 'ci_6_1', text: 'Comfort & Filling of Cushion', status: null },
          { id: 'ci_6_2', text: 'Size / Dimension & Weight', status: null }
        ]
      },
      {
        id: 'cg_legs',
        title: 'Legs & Base Frame',
        items: [
          { id: 'ci_7_1', text: 'Wood Specification & Verification', status: null },
          { id: 'ci_7_2', text: 'Construction & Joinery', status: null },
          { id: 'ci_7_3', text: 'Finishing (color swatch)', status: null }
        ]
      },
      {
        id: 'cg_hardware',
        title: 'Hardware & Assembly',
        items: [
          { id: 'ci_8_1', text: 'Verify with AI drawing', status: null }
        ]
      },
      {
        id: 'cg_quality_test',
        title: 'Quality Test',
        items: [
          { id: 'ci_9_1', text: 'BV Testing / In-house Testing', status: null }
        ]
      },
      {
        id: 'cg_packaging',
        title: 'Packaging',
        items: [
          { id: 'ci_10_1', text: 'Gross Weight', status: null },
          { id: 'ci_10_2', text: 'Box Size Verification', status: null },
          { id: 'ci_10_3', text: 'Packaging material and cushioning', status: null }
        ]
      },
      {
        id: 'cg_droptest',
        title: 'Drop Test',
        items: [
          { id: 'ci_11_1', text: '3A (BV Testing)', status: null }
        ]
      },
      {
        id: 'cg_watchouts',
        title: 'Quality Watchouts',
        items: [
          { id: 'ci_12_1', text: 'Production Watchout', status: null }
        ]
      },
      {
        id: 'cg_approval',
        title: 'Final Approval',
        items: [
          { id: 'ci_13_1', text: 'After passed BV test (Green label with signature)', status: null }
        ]
      }
    ];

    const FREE_PHOTO_KEYS = ['prodPhotos', 'assemblyPhotos', 'watchoutPhotos', 'testingPhotos', 'checklistPhotos'];

    let reports = [];
    let currentId = null, curSec = 0;
    let D = {}; 
    let camTarget = null;
    let hoveredPasteTarget = null;
    let saveTimeout = null;

    // History Manager (Undo / Redo)
    let undoStack = [];
    let redoStack = [];
    const MAX_HISTORY = 30;
    let isHistoryNavigating = false;
    let textInputUndoTimeout = null;
    let preTypingSnapshot = null;

    let cropper = null;
    let currentOriginalImg = null; 
    let baseRotateAngle = 0;
    let lastStraightenAngle = 0;
    let scaleX = 1;
    let scaleY = 1;

    let isSelectMode = false;
    let selectedReportIds = new Set();
    let isDimSelectMode = false;
    let selectedDimIndices = new Set();

    function getReportTitle(r) {
      const parts = [r.model, r.desc].filter(Boolean);
      if (r.reportTitle && r.reportTitle.trim()) {
        return parts.length ? `${r.reportTitle.trim()} (${parts.join(' - ')})` : r.reportTitle.trim();
      }
      return parts.length ? parts.join(' ') : 'Untitled Report';
    }

    // Chuẩn hóa trần ảnh gốc (Master Photo): Khống chế tối đa 1600px với chất lượng 0.7
    // Tiết kiệm hơn 85% dung lượng bộ nhớ mà vẫn bảo toàn đầy đủ khung cảnh để bấm cắt lại (re-crop) bất kỳ lúc nào
    async function normalizeMasterPhoto(dataUrl, maxDimension = 1600, quality = 0.7) {
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return dataUrl;
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          img.onload = null;
          img.onerror = null;
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          // Nếu ảnh đã dưới 1600px VÀ dung lượng đã gọn gàng (< 350KB) thì giữ nguyên
          if (w <= maxDimension && h <= maxDimension && dataUrl.length < 450000 && !dataUrl.startsWith('data:image/png')) {
            resolve(dataUrl);
            return;
          }
          let targetW = w, targetH = h;
          if (w > maxDimension || h > maxDimension) {
            if (w > h) {
              targetH = Math.round((h * maxDimension) / w);
              targetW = maxDimension;
            } else {
              targetW = Math.round((w * maxDimension) / h);
              targetH = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          let ctx = null;
          if (window.matchMedia && window.matchMedia('(color-gamut: p3)').matches) {
            try { ctx = canvas.getContext('2d', { colorSpace: 'display-p3' }); } catch (e) { ctx = null; }
          }
          if (!ctx) ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetW, targetH);
            const res = canvas.toDataURL('image/jpeg', quality);
            canvas.width = 0; canvas.height = 0; // Giải phóng ngay lập tức buffer GPU của Canvas
            resolve(res);
          } else {
            resolve(dataUrl);
          }
        };
        img.onerror = () => {
          img.onload = null;
          img.onerror = null;
          resolve(dataUrl);
        };
        img.src = dataUrl;
      });
    }

    // Chuẩn hóa toàn bộ ảnh trong một báo cáo (khi nhập JSON / khôi phục) để tránh vượt quá hạn mức quota lưu trữ
    async function normalizeReportPhotos(rep) {
      if (!rep || typeof rep !== 'object') return rep;
      try {
        // 1. Chuẩn hóa ảnh trang bìa (coverPhotos)
        if (rep.coverPhotos && typeof rep.coverPhotos === 'object') {
          for (const k of Object.keys(rep.coverPhotos)) {
            const p = rep.coverPhotos[k];
            if (p && typeof p === 'object') {
              if (p.original && typeof p.original === 'string' && p.original.length > 400000) {
                p.original = await normalizeMasterPhoto(p.original);
              }
              if (p.img && typeof p.img === 'string' && p.img.length > 400000) {
                p.img = await resizeImage(p.img, 1280, 0.75);
              }
            }
          }
        }

        // 2. Chuẩn hóa toàn bộ các danh sách ảnh tự do, ảnh kép (3:1, 1:1) và Dimensions
        const photoArrayKeys = [
          'prodPhotos',
          'assemblyPhotos',
          'watchoutPhotos',
          'testingPhotos',
          'checklistPhotos',
          'dimensions'
        ];

        for (const arrKey of photoArrayKeys) {
          if (Array.isArray(rep[arrKey])) {
            for (const p of rep[arrKey]) {
              if (p && typeof p === 'object') {
                if (p.original && typeof p.original === 'string' && p.original.length > 400000) {
                  p.original = await normalizeMasterPhoto(p.original);
                }
                if (p.img && typeof p.img === 'string' && p.img.length > 400000) {
                  p.img = await resizeImage(p.img, 1280, 0.75);
                }
                if (p.originalSub && typeof p.originalSub === 'string' && p.originalSub.length > 400000) {
                  p.originalSub = await normalizeMasterPhoto(p.originalSub);
                }
                if (p.imgSub && typeof p.imgSub === 'string' && p.imgSub.length > 400000) {
                  p.imgSub = await resizeImage(p.imgSub, 1280, 0.75);
                }
                // Hỗ trợ trường cũ nếu có (master/src)
                if (p.master && typeof p.master === 'string' && p.master.length > 400000) {
                  p.master = await normalizeMasterPhoto(p.master);
                }
                if (p.src && typeof p.src === 'string' && p.src.length > 400000) {
                  p.src = await normalizeMasterPhoto(p.src);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Lỗi chuẩn hóa ảnh báo cáo:', err);
      }
      return rep;
    }


    function resizeImage(imageSource, maxDimension = 1280, quality = 0.88) {
      return new Promise((resolve) => {
        if (!imageSource) {
          resolve('');
          return;
        }

        const isBlobOrFile = (typeof Blob !== 'undefined' && imageSource instanceof Blob) ||
                             (typeof File !== 'undefined' && imageSource instanceof File);
        let objectUrl = null;

        const img = new Image();
        img.onload = () => {
          img.onload = null;
          img.onerror = null;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (!w || !h) {
            resolve(typeof imageSource === 'string' ? imageSource : '');
            return;
          }
          if (w > maxDimension || h > maxDimension) {
            if (w > h) { h = Math.round((h * maxDimension) / w); w = maxDimension; } 
            else { w = Math.round((w * maxDimension) / h); h = maxDimension; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;

          // Cấu hình không gian màu Display P3 chuẩn màn hình iPhone Retina/OLED
          let ctx = null;
          const isP3 = window.matchMedia && window.matchMedia('(color-gamut: p3)').matches;
          if (isP3) {
            try {
              ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
            } catch (e) {
              ctx = null;
            }
          }
          if (!ctx) ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);

            const isPng = (isBlobOrFile && imageSource.type === 'image/png') ||
                          (typeof imageSource === 'string' && imageSource.startsWith('data:image/png'));
            try {
              const res = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);
              canvas.width = 0; canvas.height = 0; // Giải phóng ngay GPU Texture
              resolve(res);
            } catch (err) {
              const res = canvas.toDataURL('image/png');
              canvas.width = 0; canvas.height = 0;
              resolve(res);
            }
          } else {
            resolve(typeof imageSource === 'string' ? imageSource : '');
          }
        };

        img.onerror = (err) => {
          img.onload = null;
          img.onerror = null;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          console.warn('resizeImage load failed', err);
          resolve(typeof imageSource === 'string' ? imageSource : '');
        };

        if (isBlobOrFile) {
          try {
            objectUrl = URL.createObjectURL(imageSource);
            img.src = objectUrl;
          } catch (e) {
            console.error('URL.createObjectURL failed', e);
            resolve('');
          }
        } else if (typeof imageSource === 'string') {
          img.src = imageSource;
        } else {
          resolve('');
        }
      });
    }

    // ═══════════════ XỬ LÝ DRAG & DROP TỪ FOLDER & DECODE ẢNH ═══════════════
    function isImageFile(file) {
      if (!file) return false;
      if (file.type && file.type.startsWith('image/')) return true;
      return /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i.test(file.name || '');
    }

    function isHeicFile(file) {
      return /\.(heic|heif)$/i.test(file && file.name ? file.name : '') ||
        Boolean(file && /image\/hei[cf]/i.test(file.type || ''));
    }

    // Kiểm tra xem trình duyệt có hỗ trợ giải mã phần cứng HEIC gốc (như iOS Safari/macOS) hay không
    async function canDecodeNatively(blob) {
      if (!blob) return false;
      if (!isHeicFile(blob)) return true;

      if (typeof createImageBitmap === 'function') {
        try {
          const bmp = await createImageBitmap(blob);
          bmp.close();
          return true;
        } catch (e) {}
      }

      return new Promise((resolve) => {
        let url = null;
        try {
          url = URL.createObjectURL(blob);
        } catch (e) {
          resolve(false);
          return;
        }
        const testImg = new Image();
        testImg.onload = () => {
          testImg.onload = null;
          testImg.onerror = null;
          URL.revokeObjectURL(url);
          resolve(true);
        };
        testImg.onerror = () => {
          testImg.onload = null;
          testImg.onerror = null;
          URL.revokeObjectURL(url);
          resolve(false);
        };
        testImg.src = url;
      });
    }

    function getDroppedImageFiles(dataTransfer) {
      const files = Array.from((dataTransfer && dataTransfer.files) || []);
      if (files.length) return files.filter(isImageFile);

      return Array.from((dataTransfer && dataTransfer.items) || [])
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile())
        .filter(isImageFile);
    }

    let libheifModulePromise = null;

    async function getLibheifModule() {
      if (!libheifModulePromise) {
        if (typeof window.libheif !== 'function') {
          throw new Error('Updated HEIF decoder is unavailable');
        }
        libheifModulePromise = window.libheif();
      }
      return await libheifModulePromise;
    }

    async function convertHeicWithLibheif(file) {
      const libheif = await getLibheifModule();
      if (!libheif || typeof libheif.HeifDecoder !== 'function') {
        throw new Error('Updated HEIF decoder is unavailable');
      }

      const decoder = new libheif.HeifDecoder();
      const images = decoder.decode(new Uint8Array(await file.arrayBuffer()));
      if (!images || !images.length) {
        throw new Error('Updated HEIF decoder found no image');
      }

      const image = images[0];
      const width = image.get_width();
      const height = image.get_height();
      const imageData = new ImageData(width, height);
      await new Promise((resolve, reject) => {
        image.display(imageData, result => {
          if (!result) {
            reject(new Error('Updated HEIF decoder could not render image'));
            return;
          }
          resolve();
        });
      });

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').putImageData(imageData, 0, 0);
      return await new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode JPEG')), 'image/jpeg', 0.9);
      });
    }

    async function readImageFileAsDataUrl(file) {
      if (!file) return null;

      let imageBlob = file;
      if (isHeicFile(file)) {
        // Nếu trình duyệt (như iOS Safari) giải mã HEIC bằng phần cứng Apple gốc được -> không cần dùng libheif
        const canNative = await canDecodeNatively(file);
        if (!canNative) {
          try {
            imageBlob = await convertHeicWithLibheif(file);
          } catch (error) {
            console.error('HEIF fallback conversion failed', {
              name: error && error.name,
              message: error && error.message,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size
            });
            showToast('Ảnh HEIC này không được hỗ trợ. Hãy đổi sang JPG/PNG trên iPhone hoặc Windows rồi thử lại.');
            return null;
          }
        }
      }

      // Xử lý nén và bảo tồn màu Display P3 trực tiếp từ blob mà không tạo chuỗi Base64 khổng lồ
      try {
        const optimizedDataUrl = await resizeImage(imageBlob, 1920, 0.90);
        if (optimizedDataUrl) return optimizedDataUrl;
      } catch (err) {
        console.warn('Direct blob resize fallback to FileReader', err);
      }

      return await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target.result);
        reader.onerror = () => {
          showToast('Không thể đọc file ảnh này. Hãy dùng JPG, PNG hoặc HEIC hợp lệ.');
          resolve(null);
        };
        try {
          reader.readAsDataURL(imageBlob);
        } catch (error) {
          console.error('Image file read failed', error);
          showToast('Không thể đọc dữ liệu ảnh này. Hãy thử lại với JPG, PNG hoặc HEIC khác.');
          resolve(null);
        }
      });
    }

    function attachDropZone(element, target, isMulti = false) {
      if (!element) return;

      element._dropTarget = { target, isMulti };

      element.addEventListener('pointerenter', () => {
        hoveredPasteTarget = { target, element, isMulti };
      });

      element.addEventListener('pointerleave', () => {
        if (hoveredPasteTarget && hoveredPasteTarget.element === element) {
          hoveredPasteTarget = null;
        }
      });

      function isFileDrag(e) {
        if (!e.dataTransfer || !e.dataTransfer.types) return false;
        const types = Array.from(e.dataTransfer.types);
        return types.includes('Files') || types.includes('application/x-moz-file');
      }

      ['dragenter', 'dragover'].forEach(eventName => {
        element.addEventListener(eventName, (e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          e.stopPropagation();
          element.classList.add('drag-over');
        }, false);
      });

      ['dragleave', 'dragend'].forEach(eventName => {
        element.addEventListener(eventName, (e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          e.stopPropagation();
          element.classList.remove('drag-over');
        }, false);
      });

      element.addEventListener('drop', (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        element.classList.remove('drag-over');

        const files = getDroppedImageFiles(e.dataTransfer);
        if (!files.length) return;

        if (isMulti) {
          handleMultipleDroppedFiles(files, target.key);
        } else {
          camTarget = target;
          showToast('Đang áp dụng ảnh...');
          readImageFileAsDataUrl(files[0]).then(async dataUrl => {
            if (!dataUrl) return;
            currentOriginalImg = dataUrl;
            const compressed = await resizeImage(dataUrl, 1280, 0.85);
            savePhoto(compressed, dataUrl);
            highlightTarget(target, element);
          });
        }
      }, false);
    }

    async function handleMultipleDroppedFiles(files, key) {
      showToast(`Đang thêm ${files.length} ảnh...`);
      pushHistory(`Thêm ${files.length} ảnh`);
      if (!D[key]) D[key] = [];
      let addedCount = 0;

      for (const file of files) {
        const dataUrl = await readImageFileAsDataUrl(file);
        if (!dataUrl) continue;
        const compressed = await resizeImage(dataUrl, 1280, 0.85);
        D[key].push({
          img: compressed,
          original: dataUrl,
          caption: ''
        });
        addedCount++;
      }
      renderFreePhotos(key);
      as();
      highlightTarget({ type: 'free', key });
      showToast(addedCount
        ? `✓ Đã thêm ${addedCount} ảnh vào danh sách!`
        : 'Không có ảnh nào được thêm.');
    }

    // ═══════════════ CLIPBOARD PASTE SUPPORT (CTRL+V & DÁN) ═══════════════
    function getClipboardImageFiles(clipboardData) {
      if (!clipboardData) return [];
      const files = [];

      if (clipboardData.items) {
        for (let i = 0; i < clipboardData.items.length; i++) {
          const item = clipboardData.items[i];
          if (item.type && item.type.startsWith('image/')) {
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        }
      }

      if (files.length === 0 && clipboardData.files) {
        for (let i = 0; i < clipboardData.files.length; i++) {
          const f = clipboardData.files[i];
          if (isImageFile(f)) files.push(f);
        }
      }

      return files;
    }

    function highlightTarget(target, element = null) {
      let el = element;
      if (!el && target) {
        if (target.type === 'slot') {
          el = document.getElementById(`ps_${target.containerId}_${target.key}`);
        } else if (target.type === 'dim') {
          el = document.getElementById(`dph_${target.subType}_${target.index}`);
        } else if (target.type === 'free') {
          if ((target.key === 'watchoutPhotos' || target.key === 'testingPhotos' || target.key === 'assemblyPhotos') && target.subType) {
            const prefix = target.key === 'watchoutPhotos' ? 'wph_' : (target.key === 'assemblyPhotos' ? 'asph_' : 'tph_');
            el = document.getElementById(`${prefix}${target.subType}_${target.index}`);
          }
          if (!el) {
            const container = document.getElementById(target.key);
            if (container) {
              if (target.index !== undefined && container.children[target.index]) {
                el = container.children[target.index];
              } else {
                const items = container.querySelectorAll('.free-photo-item, .watchout-slot, .testing-slot, .assembly-slot');
                if (items.length) el = items[items.length - 1];
              }
            }
          }
        }
      }
      if (el) {
        el.classList.remove('paste-highlight');
        void el.offsetWidth;
        el.classList.add('paste-highlight');
        setTimeout(() => {
          if (el) el.classList.remove('paste-highlight');
        }, 1200);
      }
    }

    function resolvePasteTarget() {
      if (hoveredPasteTarget && hoveredPasteTarget.target) {
        return hoveredPasteTarget;
      }

      const camModal = document.getElementById('camModal');
      if (camModal && !camModal.classList.contains('hidden') && camTarget) {
        return { target: camTarget, isCropperOpen: true };
      }

      const editScreen = document.getElementById('editScreen');
      if (!editScreen || !editScreen.classList.contains('active')) {
        return null;
      }

      const secFreeMap = {
        1: 'prodPhotos',
        3: 'assemblyPhotos',
        4: 'watchoutPhotos',
        5: 'testingPhotos',
        6: 'checklistPhotos'
      };

      if (curSec === 3) {
        if (D.assemblyPhotos && D.assemblyPhotos.length > 0) {
          for (let i = 0; i < D.assemblyPhotos.length; i++) {
            const p = D.assemblyPhotos[i];
            const layout = (p && p.photoLayout) || (p && p.imgSub ? '3:1' : 'single');
            if (!p || (!p.img && typeof p !== 'string')) {
              const el = document.getElementById(`asph_main_${i}`);
              return { target: { type: 'free', key: 'assemblyPhotos', index: i, subType: 'main' }, element: el };
            }
            if (layout !== 'single' && !p.imgSub) {
              const el = document.getElementById(`asph_sub_${i}`);
              return { target: { type: 'free', key: 'assemblyPhotos', index: i, subType: 'sub' }, element: el };
            }
          }
        }
      }

      if (curSec === 4) {
        if (D.watchoutPhotos && D.watchoutPhotos.length > 0) {
          for (let i = 0; i < D.watchoutPhotos.length; i++) {
            const p = D.watchoutPhotos[i];
            const layout = (p && p.photoLayout) || (p && p.imgSub ? '3:1' : 'single');
            if (!p || !p.img) {
              const el = document.getElementById(`wph_main_${i}`);
              return { target: { type: 'free', key: 'watchoutPhotos', index: i, subType: 'main' }, element: el };
            }
            if (layout !== 'single' && !p.imgSub) {
              const el = document.getElementById(`wph_sub_${i}`);
              return { target: { type: 'free', key: 'watchoutPhotos', index: i, subType: 'sub' }, element: el };
            }
          }
        }
      }

      if (curSec === 5) {
        if (D.testingPhotos && D.testingPhotos.length > 0) {
          for (let i = 0; i < D.testingPhotos.length; i++) {
            const p = D.testingPhotos[i];
            const layout = (p && p.photoLayout) || (p && p.imgSub ? '3:1' : 'single');
            if (!p || !p.img) {
              const el = document.getElementById(`tph_main_${i}`);
              return { target: { type: 'free', key: 'testingPhotos', index: i, subType: 'main' }, element: el };
            }
            if (layout !== 'single' && !p.imgSub) {
              const el = document.getElementById(`tph_sub_${i}`);
              return { target: { type: 'free', key: 'testingPhotos', index: i, subType: 'sub' }, element: el };
            }
          }
        }
      }

      if (secFreeMap[curSec]) {
        const key = secFreeMap[curSec];
        return { target: { type: 'free', key }, isMulti: true, sectionName: TABS[curSec] };
      }

      if (curSec === 0) {
        const slots = COVER_SLOTS.map(s => s.replace(/ /g, '_'));
        const emptySlot = slots.find(s => !D.coverPhotos || !D.coverPhotos[s]);
        if (emptySlot) {
          const el = document.getElementById(`ps_coverGrid_${emptySlot}`);
          return { target: { type: 'slot', key: emptySlot, containerId: 'coverGrid', section: 'cover' }, element: el };
        }
        const firstSlot = slots[0];
        const el = document.getElementById(`ps_coverGrid_${firstSlot}`);
        return { target: { type: 'slot', key: firstSlot, containerId: 'coverGrid', section: 'cover' }, element: el };
      }

      if (curSec === 2) {
        if (D.dimensions && D.dimensions.length > 0) {
          for (let i = 0; i < D.dimensions.length; i++) {
            if (!D.dimensions[i].img) {
              const el = document.getElementById(`dph_main_${i}`);
              return { target: { type: 'dim', index: i, subType: 'main' }, element: el };
            }
            if (!D.dimensions[i].imgSub) {
              const el = document.getElementById(`dph_sub_${i}`);
              return { target: { type: 'dim', index: i, subType: 'sub' }, element: el };
            }
          }
        }
      }

      return null;
    }

    let _appCopiedPhoto = null;

    function getPhotoDataByTarget(target) {
      if (!target) return null;
      if (target.type === 'slot') {
        const val = D.coverPhotos && D.coverPhotos[target.key];
        if (!val) return null;
        const orig = typeof val === 'string' ? val : (val.original || val.img);
        const cropped = typeof val === 'object' && val.img ? val.img : orig;
        return { original: orig, img: cropped };
      } else if (target.type === 'dim') {
        const d = D.dimensions && D.dimensions[target.index];
        if (!d) return null;
        if (target.subType === 'sub') {
          return { original: d.originalSub || d.imgSub, img: d.imgSub };
        }
        return { original: d.original || d.img, img: d.img };
      } else if (target.type === 'free') {
        const arr = D[target.key];
        const p = arr && arr[target.index];
        if (!p) return null;
        if (typeof p === 'string') return { original: p, img: p };
        if (target.subType === 'sub') {
          return { original: p.originalSub || p.imgSub, img: p.imgSub };
        }
        return { original: p.original || p.img, img: p.img };
      }
      return null;
    }

    function resolveHoveredPhotoTarget() {
      if (hoveredPasteTarget && hoveredPasteTarget.target) {
        return hoveredPasteTarget;
      }
      const hoveredEl = document.querySelector('.dim-main-photo:hover, .dim-sub-photo:hover, .free-photo-item:hover, .photo-slot:hover, .testing-slot:hover, .watchout-slot:hover, .assembly-slot:hover');
      if (hoveredEl && hoveredEl._dropTarget) {
        return { target: hoveredEl._dropTarget.target, element: hoveredEl };
      }
      return null;
    }

    async function copyDataUrlToClipboard(dataUrl) {
      if (!navigator.clipboard || !navigator.clipboard.write) return false;
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        let pngBlob = blob;
        if (blob.type !== 'image/png') {
          pngBlob = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/png');
            };
            img.onerror = reject;
            img.src = dataUrl;
          });
        }
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob })
        ]);
        return true;
      } catch (err) {
        console.warn('System clipboard image write error:', err);
        return false;
      }
    }

    async function copyPhotoFromTarget(target, element = null) {
      const data = getPhotoDataByTarget(target);
      if (!data || (!data.original && !data.img)) {
        showToast('Ô này chưa có ảnh để sao chép!');
        return false;
      }
      const masterPhoto = data.original || data.img;
      _appCopiedPhoto = {
        original: masterPhoto,
        img: data.img || masterPhoto,
        timestamp: Date.now()
      };
      try {
        sessionStorage.setItem('app_copied_photo', JSON.stringify(_appCopiedPhoto));
      } catch (e) {}

      // Ghi ảnh gốc sang Clipboard hệ thống
      copyDataUrlToClipboard(masterPhoto);

      highlightTarget(target, element);
      showToast('✓ Đã sao chép toàn bộ ảnh gốc (Ctrl+C)! Sẵn sàng dán vào ô khác.');
      return true;
    }

    async function applyImageFileToTarget(file, target, element = null) {
      if (!file || !target) return;
      showToast('Đang áp dụng ảnh từ Clipboard...');
      const dataUrl = await readImageFileAsDataUrl(file);
      if (!dataUrl) return;

      // Ưu tiên dùng lại master photo gốc nếu vừa được sao chép trong app
      let masterPhoto = null;
      let displayCropped = null;
      let copied = _appCopiedPhoto;
      if (!copied) {
        try {
          const stored = sessionStorage.getItem('app_copied_photo');
          if (stored) copied = JSON.parse(stored);
        } catch (e) {}
      }

      if (copied && copied.original && (Date.now() - (copied.timestamp || 0) < 15 * 60 * 1000)) {
        masterPhoto = copied.original;
        displayCropped = copied.img || (await resizeImage(masterPhoto, 1280, 0.88));
      } else {
        masterPhoto = await normalizeMasterPhoto(dataUrl);
        displayCropped = await resizeImage(masterPhoto, 1280, 0.88);
      }

      currentOriginalImg = masterPhoto;
      camTarget = target;
      savePhoto(displayCropped, masterPhoto);
      highlightTarget(target, element);
      showToast('✓ Đã dán ảnh thành công (giữ nguyên toàn bộ ảnh gốc)!');
    }

    async function triggerPasteToTarget(target, element = null) {
      if (isDimSelectMode) return;
      if (!navigator.clipboard || !navigator.clipboard.read) {
        showToast('Hãy nhấn Ctrl+V trên bàn phím để dán ảnh!');
        return;
      }
      try {
        const items = await navigator.clipboard.read();
        let imgBlob = null;
        for (const item of items) {
          const imgType = item.types.find(t => t.startsWith('image/'));
          if (imgType) {
            imgBlob = await item.getType(imgType);
            break;
          }
        }
        if (!imgBlob) {
          showToast('Clipboard chưa có ảnh! Hãy sao chép ảnh trước hoặc nhấn Ctrl+V.');
          return;
        }
        await applyImageFileToTarget(imgBlob, target, element);
      } catch (err) {
        console.warn('Clipboard read permission error:', err);
        showToast('Hãy nhấn phím Ctrl+V để dán ảnh trực tiếp!');
      }
    }

    window.addEventListener('paste', async (e) => {
      // 1. If other modals are open, do not intercept
      const camModal = document.getElementById('camModal');
      const stylerModal = document.getElementById('pdfStylerModal');
      const conflictModal = document.getElementById('importConflictModal');

      if ((stylerModal && !stylerModal.classList.contains('hidden')) ||
          (conflictModal && !conflictModal.classList.contains('hidden'))) {
        return;
      }

      // NẾU ĐANG MỞ CROPPER MODAL: Ctrl+V để dán ảnh mới vào bộ cắt
      if (camModal && !camModal.classList.contains('hidden')) {
        const files = getClipboardImageFiles(e.clipboardData);
        if (files.length > 0) {
          e.preventDefault();
          const rawDataUrl = await readImageFileAsDataUrl(files[0]);
          if (rawDataUrl) {
            const dataUrl = await normalizeMasterPhoto(rawDataUrl);
            currentOriginalImg = dataUrl;
            initCropper(dataUrl);
            showToast('✓ Đã dán ảnh mới từ Clipboard vào bộ cắt!');
          }
        }
        return;
      }

      const isHomeActive = document.getElementById('homeScreen') && document.getElementById('homeScreen').classList.contains('active');

      // NẾU ĐANG Ở MÀN HÌNH HOME: Ưu tiên bắt file / text JSON để nhập
      if (isHomeActive) {
        // A. File JSON trong clipboard
        if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
          const files = Array.from(e.clipboardData.files);
          const jsonFile = files.find(f => (f.name && f.name.toLowerCase().endsWith('.json')) || f.type === 'application/json');
          if (jsonFile) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = async (ev) => {
              try {
                const data = JSON.parse(ev.target.result);
                await processJsonData(data);
              } catch (err) {
                alert('Lỗi: File JSON dán vào không hợp lệ!');
              }
            };
            reader.readAsText(jsonFile);
            return;
          }
        }

        // B. Chuỗi text JSON trong clipboard
        if (e.clipboardData) {
          const text = e.clipboardData.getData('text');
          if (text && text.trim().startsWith('{') && text.trim().endsWith('}')) {
            try {
              const data = JSON.parse(text.trim());
              if (data && typeof data === 'object' && (data.model !== undefined || data.desc !== undefined || data.checks !== undefined || data.coverPhotos !== undefined)) {
                e.preventDefault();
                await processJsonData(data);
                return;
              }
            } catch (err) {}
          }
        }
      }

      // 2. Extract image files
      const imgFiles = getClipboardImageFiles(e.clipboardData);
      if (!imgFiles || imgFiles.length === 0) {
        // Normal text paste, do not preventDefault
        return;
      }

      // Image found on clipboard! Prevent default browser action
      e.preventDefault();

      // 3. Resolve destination
      const resolved = resolvePasteTarget();
      if (!resolved || !resolved.target) {
        if (!isHomeActive) {
          showToast('Di chuột vào ô ảnh cần dán hoặc chuyển sang trang ảnh tương ứng.');
        }
        return;
      }

      if (resolved.isMulti || (resolved.target.type === 'free' && resolved.target.index === undefined)) {
        await handleMultipleDroppedFiles(imgFiles, resolved.target.key);
      } else {
        await applyImageFileToTarget(imgFiles[0], resolved.target, resolved.element);
      }
    });

    // ═══════════════ LIGHTWEIGHT HISTORY MANAGER (PHOTO VAULT & UNDO/REDO) ═══════════════
    const photoVault = new Map();

    function getVaultKey(base64Str) {
      const len = base64Str.length;
      const p1 = base64Str.slice(30, 60);
      const p2 = base64Str.slice(Math.floor(len / 2), Math.floor(len / 2) + 30);
      const p3 = base64Str.slice(-30);
      const fp = (p1 + p2 + p3).replace(/[^a-zA-Z0-9]/g, '');
      return `__vault_img_${len}_${fp}`;
    }

    function dehydrateReportForHistory(reportObj) {
      if (!reportObj) return null;
      try {
        return JSON.stringify(reportObj, (key, value) => {
          if (typeof value === 'string' && value.length > 200 && value.startsWith('data:image')) {
            const vKey = getVaultKey(value);
            if (!photoVault.has(vKey)) {
              photoVault.set(vKey, value);
            }
            return vKey;
          }
          return value;
        });
      } catch (err) {
        console.warn('Dehydrate failed', err);
        return null;
      }
    }

    function hydrateReportFromHistory(snapshotJson) {
      if (!snapshotJson) return null;
      try {
        return JSON.parse(snapshotJson, (key, value) => {
          if (typeof value === 'string' && value.startsWith('__vault_img_')) {
            const original = photoVault.get(value);
            return original !== undefined ? original : value;
          }
          return value;
        });
      } catch (err) {
        console.error('Hydrate failed', err);
        return null;
      }
    }

    function resetHistory() {
      undoStack = [];
      redoStack = [];
      preTypingSnapshot = null;
      clearTimeout(textInputUndoTimeout);
      photoVault.clear();
      updateUndoRedoUI();
    }

    function flushPendingTextUndo() {
      if (preTypingSnapshot && D && currentId) {
        clearTimeout(textInputUndoTimeout);
        const currentSnap = dehydrateReportForHistory(D);
        if (currentSnap && currentSnap !== preTypingSnapshot) {
          pushHistorySnapshot(preTypingSnapshot, 'Nhập văn bản');
        }
        preTypingSnapshot = null;
      }
    }

    function pushHistorySnapshot(snapshotData, desc = 'Thao tác') {
      if (isHistoryNavigating || !currentId) return;
      undoStack.push({ data: snapshotData, desc });
      if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
      }
      redoStack = [];
      updateUndoRedoUI();
    }

    function pushHistory(desc = 'Thao tác') {
      if (isHistoryNavigating || !currentId || !D) return;
      flushPendingTextUndo();
      try {
        const snapshot = dehydrateReportForHistory(D);
        if (!snapshot) return;
        undoStack.push({ data: snapshot, desc });
        if (undoStack.length > MAX_HISTORY) {
          undoStack.shift();
        }
        redoStack = [];
        updateUndoRedoUI();
      } catch (err) {
        console.warn('History snapshot failed', err);
      }
    }

    function updateUndoRedoUI() {
      const btnUndo = document.getElementById('btnUndo');
      const btnRedo = document.getElementById('btnRedo');
      if (btnUndo) {
        btnUndo.disabled = undoStack.length === 0;
        btnUndo.title = undoStack.length > 0 
          ? `Hoàn tác: ${undoStack[undoStack.length - 1].desc} (Ctrl+Z)` 
          : 'Hoàn tác (Ctrl+Z)';
      }
      if (btnRedo) {
        btnRedo.disabled = redoStack.length === 0;
        btnRedo.title = redoStack.length > 0 
          ? `Làm lại: ${redoStack[redoStack.length - 1].desc} (Ctrl+Y)` 
          : 'Làm lại (Ctrl+Y)';
      }
    }

    async function undo() {
      if (isDimSelectMode) return;
      flushPendingTextUndo();
      if (!undoStack.length || !currentId) {
        showToast('Không có thao tác nào để hoàn tác');
        return;
      }

      isHistoryNavigating = true;
      try {
        const currentSnap = dehydrateReportForHistory(D);
        const item = undoStack.pop();
        if (currentSnap) {
          redoStack.push({ data: currentSnap, desc: item.desc });
        }

        const restored = hydrateReportFromHistory(item.data);
        if (restored) {
          D = restored;
          loadData();
          updateTopbar();
          await dbPut(D);
          showToast(`↩️ Đã hoàn tác: ${item.desc}`);
        }
      } catch (err) {
        console.error('Undo failed', err);
        showToast('Lỗi khi hoàn tác dữ liệu');
      } finally {
        isHistoryNavigating = false;
        updateUndoRedoUI();
      }
    }

    async function redo() {
      if (isDimSelectMode) return;
      flushPendingTextUndo();
      if (!redoStack.length || !currentId) {
        showToast('Không có thao tác nào để làm lại');
        return;
      }

      isHistoryNavigating = true;
      try {
        const currentSnap = dehydrateReportForHistory(D);
        const item = redoStack.pop();
        if (currentSnap) {
          undoStack.push({ data: currentSnap, desc: item.desc });
        }

        const restored = hydrateReportFromHistory(item.data);
        if (restored) {
          D = restored;
          loadData();
          updateTopbar();
          await dbPut(D);
          showToast(`↪️ Đã làm lại: ${item.desc}`);
        }
      } catch (err) {
        console.error('Redo failed', err);
        showToast('Lỗi khi làm lại dữ liệu');
      } finally {
        isHistoryNavigating = false;
        updateUndoRedoUI();
      }
    }

    // Global Keybinding for Undo / Redo & Modal Shortcuts
    window.addEventListener('keydown', (e) => {
      // Enter để lưu ảnh khi đang mở Cropper modal
      if (e.key === 'Enter') {
        const camModal = document.getElementById('camModal');
        if (camModal && !camModal.classList.contains('hidden')) {
          e.preventDefault();
          usePhoto();
          return;
        }
      }
      if (e.key === 'Escape') {
        const camModal = document.getElementById('camModal');
        if (camModal && !camModal.classList.contains('hidden')) {
          e.preventDefault();
          closeCamera();
          return;
        }
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      const key = e.key.toLowerCase();

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((isCtrl && key === 'y') || (isCtrl && e.shiftKey && key === 'z')) {
        const camModal = document.getElementById('camModal');
        const stylerModal = document.getElementById('pdfStylerModal');
        if ((camModal && !camModal.classList.contains('hidden')) || 
            (stylerModal && !stylerModal.classList.contains('hidden'))) {
          return;
        }
        
        const editScreen = document.getElementById('editScreen');
        if (currentId && editScreen && editScreen.classList.contains('active')) {
          e.preventDefault();
          redo();
        }
        return;
      }

      // Undo: Ctrl+Z (without Shift)
      if (isCtrl && !e.shiftKey && key === 'z') {
        const camModal = document.getElementById('camModal');
        const stylerModal = document.getElementById('pdfStylerModal');
        if ((camModal && !camModal.classList.contains('hidden')) || 
            (stylerModal && !stylerModal.classList.contains('hidden'))) {
          return;
        }

        const editScreen = document.getElementById('editScreen');
        if (currentId && editScreen && editScreen.classList.contains('active')) {
          e.preventDefault();
          if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            document.activeElement.blur();
          }
          undo();
        }
        return;
      }

      // Copy Photo: Ctrl+C / Cmd+C khi rê chuột vào ô ảnh bất kỳ
      if (isCtrl && key === 'c') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
          const selStart = active.selectionStart;
          const selEnd = active.selectionEnd;
          if (selStart !== undefined && selEnd !== undefined && selStart !== selEnd) {
            return; // Người dùng đang bôi đen chữ để copy văn bản
          }
        }
        const winSel = window.getSelection ? window.getSelection().toString() : '';
        if (winSel && winSel.trim().length > 0) {
          return; // Có đoạn văn bản đang được bôi đen
        }

        const hov = resolveHoveredPhotoTarget();
        if (hov && hov.target) {
          const photoData = getPhotoDataByTarget(hov.target);
          if (photoData && (photoData.original || photoData.img)) {
            e.preventDefault();
            copyPhotoFromTarget(hov.target, hov.element);
          }
        }
      }
    });

    // Auto-capture text changes for input and textarea (Lightweight Dehydrated Snapshots)
    document.addEventListener('input', (e) => {
      if (!currentId || isHistoryNavigating) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        if (!preTypingSnapshot && D) {
          preTypingSnapshot = dehydrateReportForHistory(D);
        }
        clearTimeout(textInputUndoTimeout);
        textInputUndoTimeout = setTimeout(() => {
          if (preTypingSnapshot) {
            const currentSnap = dehydrateReportForHistory(D);
            if (currentSnap && currentSnap !== preTypingSnapshot) {
              pushHistorySnapshot(preTypingSnapshot, 'Nhập văn bản');
            }
            preTypingSnapshot = null;
          }
        }, 1200);
      }
    }, true);

    document.addEventListener('focusout', (e) => {
      if (!currentId || isHistoryNavigating) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        if (preTypingSnapshot) {
          clearTimeout(textInputUndoTimeout);
          const currentSnap = dehydrateReportForHistory(D);
          if (currentSnap && currentSnap !== preTypingSnapshot) {
            pushHistorySnapshot(preTypingSnapshot, 'Nhập văn bản');
          }
          preTypingSnapshot = null;
        }
      }
    }, true);

    // ═══════════════ CAMERA & ALBUM FLOW ═══════════════
    function triggerNativeCamera(target) {
      if (isDimSelectMode) return;
      camTarget = target;
      if (cropper) { cropper.destroy(); cropper = null; closeCamera(); }
      const camInput = document.getElementById('cameraInput');
      if (camInput) {
        camInput.value = '';
        camInput.click();
      }
    }

    function triggerPickLibrary(target) {
      if (isDimSelectMode) return;
      camTarget = target;
      if (cropper) { cropper.destroy(); cropper = null; closeCamera(); }
      const libInput = document.getElementById('libraryInput');
      if (libInput) {
        libInput.value = '';
        libInput.multiple = Boolean(target && target.type === 'free');
        libInput.click();
      }
    }

    function retakeFromCamera() {
      const camInput = document.getElementById('cameraInput');
      if (camInput) {
        camInput.value = '';
        camInput.click();
      }
    }

    function retakeFromLibrary() {
      const libInput = document.getElementById('libraryInput');
      if (libInput) {
        libInput.value = '';
        libInput.multiple = false;
        libInput.click();
      }
    }

    async function retakeFromPaste() {
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            const imgType = item.types.find(t => t.startsWith('image/'));
            if (imgType) {
              const blob = await item.getType(imgType);
              const dataUrl = await readImageFileAsDataUrl(blob);
              if (dataUrl) {
                currentOriginalImg = dataUrl;
                initCropper(dataUrl);
                showToast('✓ Đã nạp ảnh từ Clipboard!');
                return;
              }
            }
          }
          showToast('Clipboard chưa có ảnh! Hãy sao chép ảnh trước.');
        } catch(err) {
          showToast('Hãy nhấn phím Ctrl+V để dán ảnh!');
        }
      } else {
        showToast('Hãy nhấn phím Ctrl+V để dán ảnh!');
      }
    }

    async function handleFile(e) {
      const files = Array.from(e.target.files || []);
      if (!files.length || !camTarget) return;
      e.target.value = '';

      const modal = document.getElementById('camModal');
      const isModalOpen = modal && !modal.classList.contains('hidden');

      if (isModalOpen) {
        const rawDataUrl = await readImageFileAsDataUrl(files[0]);
        if (!rawDataUrl) return;
        const dataUrl = await normalizeMasterPhoto(rawDataUrl);
        currentOriginalImg = dataUrl;
        initCropper(dataUrl);
        return;
      }

      if (camTarget.type === 'free' && files.length > 1) {
        showToast(`Đang thêm ${files.length} ảnh...`);
        let addedCount = 0;
        for (const file of files) {
          const dataUrl = await readImageFileAsDataUrl(file);
          if (!dataUrl) continue;
          const compressed = await resizeImage(dataUrl, 1280, 0.88);
          if (camTarget.index !== undefined && addedCount === 0) {
            if (!D[camTarget.key][camTarget.index]) D[camTarget.key][camTarget.index] = { caption: '' };
            D[camTarget.key][camTarget.index].img = compressed;
            D[camTarget.key][camTarget.index].original = compressed;
          } else {
            if (!D[camTarget.key]) D[camTarget.key] = [];
            D[camTarget.key].push({ img: compressed, original: compressed, caption: '' });
          }
          addedCount++;
        }
        renderFreePhotos(camTarget.key);
        as();
        showToast(`✓ Đã thêm ${addedCount} ảnh!`);
        return;
      }

      showToast('Đang áp dụng ảnh...');
      const rawDataUrl = await readImageFileAsDataUrl(files[0]);
      if (!rawDataUrl) return;
      const masterPhoto = await normalizeMasterPhoto(rawDataUrl);
      const compressed = await resizeImage(masterPhoto, 1280, 0.88);
      currentOriginalImg = masterPhoto;
      savePhoto(compressed, masterPhoto);
    }

    function editSlotPhoto(containerId, key, section) {
      const store = D.coverPhotos;
      const data = store && store[key];
      if (!data) return;
      const orig = typeof data === 'string' ? data : (data.original || data.img);
      const fallback = typeof data === 'object' && data.img ? data.img : null;
      if (!orig && !fallback) return;
      camTarget = {type: 'slot', key, containerId, section};
      currentOriginalImg = orig || fallback;
      initCropper(orig || fallback, fallback !== orig ? fallback : null);
    }

    function editDimPhoto(index, subType = 'main') {
      if (isDimSelectMode) return;
      const data = D.dimensions && D.dimensions[index];
      if (!data) return;
      const imgKey = subType === 'sub' ? 'imgSub' : 'img';
      const origKey = subType === 'sub' ? 'originalSub' : 'original';
      const orig = data[origKey] || data[imgKey];
      const fallback = data[imgKey] || null;
      if (!orig && !fallback) return;

      camTarget = {type: 'dim', index, subType};
      currentOriginalImg = orig || fallback;
      initCropper(orig || fallback, fallback !== orig ? fallback : null);
    }

    function editFreePhoto(key, index) {
      const data = D[key] && D[key][index];
      if (!data) return;
      const orig = data.original || data.img;
      const fallback = data.img || null;
      if (!orig && !fallback) return;
      camTarget = {type: 'free', key, index};
      currentOriginalImg = orig || fallback;
      initCropper(orig || fallback, fallback !== orig ? fallback : null);
    }

    function initCropper(imgSrc, fallbackSrc = null) {
        if (!imgSrc) {
          showToast('Không có dữ liệu ảnh để hiển thị');
          return;
        }

        if (typeof Cropper === 'undefined') {
          showToast('Lỗi: Thư viện cắt ảnh Cropper chưa sẵn sàng (vui lòng kiểm tra kết nối mạng).');
          closeCamera();
          return;
        }

        let title = 'Chỉnh sửa ảnh';
        if (camTarget.type === 'dim') {
          title = camTarget.subType === 'sub' ? 'ẢNH PHỤ (CHI TIẾT) - KÍCH THƯỚC' : 'ẢNH CHÍNH (TOÀN CẢNH) - KÍCH THƯỚC';
        } else if (camTarget.type === 'free' && camTarget.key === 'assemblyPhotos') {
          title = camTarget.subType === 'sub' ? 'ẢNH PHỤ (CHI TIẾT) - LẮP RÁP (ASSEMBLY)' : 'ẢNH CHÍNH (TOÀN CẢNH) - LẮP RÁP (ASSEMBLY)';
        } else if (camTarget.type === 'free' && camTarget.key === 'watchoutPhotos') {
          title = camTarget.subType === 'sub' ? 'ẢNH PHỤ (CHI TIẾT) - QUALITY WATCH OUT' : 'ẢNH CHÍNH (TOÀN CẢNH) - QUALITY WATCH OUT';
        } else if (camTarget.type === 'free' && camTarget.key === 'testingPhotos') {
          title = camTarget.subType === 'sub' ? 'ẢNH PHỤ (CHI TIẾT) - TESTING' : 'ẢNH CHÍNH (TOÀN CẢNH) - TESTING';
        } else if (camTarget.type === 'slot') {
          const customName = D.coverTitles && D.coverTitles[camTarget.key];
          title = customName || camTarget.key.replace(/_/g, ' ');
        }

        document.getElementById('camTitle').textContent = '✏️ ' + title;
        document.getElementById('camModal').classList.remove('hidden');

        document.querySelectorAll('.cropper-tools .tools-row:first-child .tool-btn').forEach(b => b.classList.remove('active'));
        
        let defaultRatio = 4 / 3;
        let defaultRatioBtn = document.getElementById('ratio_4_3');

        if (camTarget.type === 'dim' || (camTarget.type === 'free' && (camTarget.key === 'watchoutPhotos' || camTarget.key === 'testingPhotos' || camTarget.key === 'assemblyPhotos'))) {
          const item = camTarget.type === 'dim'
            ? (D.dimensions && D.dimensions[camTarget.index])
            : (D[camTarget.key] && D[camTarget.key][camTarget.index]);
          const layout = (item && item.photoLayout) || '3:1';
          if (layout !== '1:1' && camTarget.subType === 'sub') {
            defaultRatio = 4 / 9;
            defaultRatioBtn = document.getElementById('ratio_4_9');
          } else {
            defaultRatio = 4 / 3;
            defaultRatioBtn = document.getElementById('ratio_4_3');
          }
        }

        if (defaultRatioBtn) defaultRatioBtn.classList.add('active');

        baseRotateAngle = 0; lastStraightenAngle = 0; scaleX = 1; scaleY = 1;
        const slider = document.getElementById('straightenRange'); if(slider) slider.value = 0;
        const valText = document.getElementById('straightenVal'); if(valText) valText.textContent = '0.0°';

        const image = document.getElementById('cropperImage');
        if (cropper) {
          cropper.destroy();
          cropper = null;
        }

        // Gỡ bỏ listener cũ trước khi bind mới
        image.onload = null;
        image.onerror = null;

        image.onload = () => {
          if (cropper) cropper.destroy();
          cropper = new Cropper(image, {
            aspectRatio: defaultRatio,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.95,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
            zoomOnWheel: true,
            zoomOnTouch: true,
            background: false
          });
        };

        image.onerror = () => {
          // Ngắt listener ngay lập tức để tránh vòng lặp đệ quy sự kiện
          image.onload = null;
          image.onerror = null;
          if (cropper) {
            cropper.destroy();
            cropper = null;
          }

          if (fallbackSrc && fallbackSrc !== imgSrc) {
            console.warn('Ảnh gốc bị lỗi, tự động thử fallback sang ảnh nén...');
            currentOriginalImg = fallbackSrc;
            initCropper(fallbackSrc, null);
            return;
          }

          image.removeAttribute('src');
          closeCamera();
          showToast('Chrome không thể đọc ảnh này. Hãy dùng ảnh JPG hoặc PNG.');
        };

        image.src = imgSrc;
    }

    function setCropRatio(ratio, btnEl) {
        if (!cropper) return;
        cropper.setAspectRatio(ratio);
        document.querySelectorAll('.cropper-tools .tools-row:first-child .tool-btn').forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');
    }

    function rotate90() {
        if (!cropper) return;
        cropper.rotate(90);
        baseRotateAngle = (baseRotateAngle + 90) % 360;
    }

    function flipImage(axis) {
        if (!cropper) return;
        if (axis === 'x') { scaleX = -scaleX; cropper.scaleX(scaleX); } 
        else if (axis === 'y') { scaleY = -scaleY; cropper.scaleY(scaleY); }
    }

    function applyStraighten(val) {
        if (!cropper) return;
        const newAngle = parseFloat(val);
        const delta = newAngle - lastStraightenAngle;
        cropper.rotate(delta);
        lastStraightenAngle = newAngle;
        document.getElementById('straightenVal').textContent = (newAngle > 0 ? '+' : '') + newAngle.toFixed(1) + '°';
    }

    function resetTransforms() {
        if (!cropper) return;
        baseRotateAngle = 0; lastStraightenAngle = 0; scaleX = 1; scaleY = 1;
        cropper.reset();
        document.getElementById('straightenRange').value = 0;
        document.getElementById('straightenVal').textContent = '0.0°';
        if (camTarget && camTarget.subType === 'sub') {
          setCropRatio(4 / 9, document.getElementById('ratio_4_9'));
        } else {
          setCropRatio(4 / 3, document.getElementById('ratio_4_3'));
        }
    }

    // ═══════════════ PHOTO MARKUP ENGINE (ARROW, CIRCLE, RECT, TEXT) ═══════════════
    let isMarkupMode = false;
    let markupTool = 'arrow'; // 'arrow' | 'circle' | 'rect' | 'text'
    let markupColor = '#e24b4b';
    let markupShapes = [];
    let markupBaseCanvas = null;
    let isDrawingMarkup = false;
    let currentDraftShape = null;
    let markupEventsBound = false;

    function toggleMarkupMode() {
      if (!cropper) return;
      isMarkupMode = !isMarkupMode;

      const btnToggle = document.getElementById('btnToggleMarkup');
      const toolbar = document.getElementById('markupToolbar');
      const ratioSeg = document.getElementById('ratioSegmented');
      const strBox = document.getElementById('straightenBox');
      const canvas = document.getElementById('markupCanvas');
      const cropHint = document.getElementById('cropHint');

      if (isMarkupMode) {
        if (btnToggle) {
          btnToggle.classList.add('active');
          btnToggle.textContent = '📐 CROP';
        }
        if (toolbar) toolbar.style.display = 'block';
        if (ratioSeg) ratioSeg.style.display = 'none';
        if (strBox) strBox.style.display = 'none';
        if (cropHint) cropHint.textContent = 'Chạm/Kéo để vẽ mũi tên, khoanh tròn, chữ. Bấm APPLY để lưu.';

        markupBaseCanvas = cropper.getCroppedCanvas({
          maxWidth: 1280,
          maxHeight: 1280,
          fillColor: '#ffffff',
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high'
        });

        const cropperContainer = document.querySelector('.cropper-container');
        if (cropperContainer) cropperContainer.style.display = 'none';

        const wrapper = document.getElementById('cropperWrapper');
        const wrapW = wrapper.clientWidth;
        const wrapH = wrapper.clientHeight;

        canvas.style.display = 'block';
        canvas.width = markupBaseCanvas.width;
        canvas.height = markupBaseCanvas.height;

        const scale = Math.min(wrapW / canvas.width, wrapH / canvas.height);
        const dispW = canvas.width * scale;
        const dispH = canvas.height * scale;
        canvas.style.width = `${dispW}px`;
        canvas.style.height = `${dispH}px`;
        canvas.style.position = 'absolute';
        canvas.style.left = `${(wrapW - dispW) / 2}px`;
        canvas.style.top = `${(wrapH - dispH) / 2}px`;

        initMarkupPointerEvents(canvas);
        redrawMarkup();
      } else {
        if (btnToggle) {
          btnToggle.classList.remove('active');
          btnToggle.textContent = '✏️ MARKUP';
        }
        if (toolbar) toolbar.style.display = 'none';
        if (ratioSeg) ratioSeg.style.display = 'flex';
        if (strBox) strBox.style.display = 'flex';
        if (cropHint) cropHint.textContent = 'Cuộn / Kẹp hai ngón để phóng to. Kéo để cắt ảnh.';

        canvas.style.display = 'none';
        const cropperContainer = document.querySelector('.cropper-container');
        if (cropperContainer) cropperContainer.style.display = 'block';
      }
    }

    function setMarkupTool(tool, btn) {
      markupTool = tool;
      document.querySelectorAll('#markupToolbar .tools-row .tool-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
    }

    function setMarkupColor(color, btn) {
      markupColor = color;
      document.querySelectorAll('.markup-color-dot').forEach(d => d.classList.remove('active'));
      if (btn) btn.classList.add('active');
    }

    function undoMarkupShape() {
      if (markupShapes.length > 0) {
        markupShapes.pop();
        redrawMarkup();
      }
    }

    function clearMarkupShapes() {
      if (markupShapes.length > 0) {
        markupShapes = [];
        redrawMarkup();
      }
    }

    function getMarkupCanvasCoords(canvas, e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    function initMarkupPointerEvents(canvas) {
      if (markupEventsBound) return;
      markupEventsBound = true;

      const onStart = (e) => {
        if (!isMarkupMode) return;
        e.preventDefault();
        const pos = getMarkupCanvasCoords(canvas, e);
        if (markupTool === 'text') {
          const text = prompt('Nhập nội dung ghi chú / Remark:');
          if (text && text.trim()) {
            markupShapes.push({
              type: 'text',
              x: pos.x,
              y: pos.y,
              text: text.trim(),
              color: markupColor
            });
            redrawMarkup();
          }
          return;
        }
        isDrawingMarkup = true;
        currentDraftShape = {
          type: markupTool,
          color: markupColor,
          x1: pos.x,
          y1: pos.y,
          x2: pos.x,
          y2: pos.y
        };
      };

      const onMove = (e) => {
        if (!isDrawingMarkup || !currentDraftShape) return;
        e.preventDefault();
        const pos = getMarkupCanvasCoords(canvas, e);
        currentDraftShape.x2 = pos.x;
        currentDraftShape.y2 = pos.y;
        redrawMarkup(currentDraftShape);
      };

      const onEnd = (e) => {
        if (!isDrawingMarkup || !currentDraftShape) return;
        isDrawingMarkup = false;
        const dist = Math.hypot(currentDraftShape.x2 - currentDraftShape.x1, currentDraftShape.y2 - currentDraftShape.y1);
        if (dist > 8) {
          markupShapes.push(currentDraftShape);
        }
        currentDraftShape = null;
        redrawMarkup();
      };

      canvas.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      canvas.addEventListener('touchstart', onStart, { passive: false });
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    }

    function redrawMarkup(draftShape = null) {
      const canvas = document.getElementById('markupCanvas');
      if (!canvas || !markupBaseCanvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(markupBaseCanvas, 0, 0);

      const allShapes = draftShape ? [...markupShapes, draftShape] : markupShapes;
      const baseScale = Math.max(1, Math.min(canvas.width, canvas.height) / 600);

      allShapes.forEach(shape => {
        ctx.save();
        ctx.strokeStyle = shape.color;
        ctx.fillStyle = shape.color;
        ctx.lineWidth = 4 * baseScale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (shape.type === 'arrow') {
          const dx = shape.x2 - shape.x1;
          const dy = shape.y2 - shape.y1;
          const angle = Math.atan2(dy, dx);
          const headLen = Math.max(16 * baseScale, Math.min(36 * baseScale, Math.hypot(dx, dy) * 0.28));

          ctx.beginPath();
          ctx.moveTo(shape.x1, shape.y1);
          ctx.lineTo(shape.x2, shape.y2);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(shape.x2, shape.y2);
          ctx.lineTo(
            shape.x2 - headLen * Math.cos(angle - Math.PI / 7),
            shape.y2 - headLen * Math.sin(angle - Math.PI / 7)
          );
          ctx.lineTo(
            shape.x2 - headLen * Math.cos(angle + Math.PI / 7),
            shape.y2 - headLen * Math.sin(angle + Math.PI / 7)
          );
          ctx.closePath();
          ctx.fill();
        } else if (shape.type === 'circle') {
          const rx = Math.abs(shape.x2 - shape.x1) / 2;
          const ry = Math.abs(shape.y2 - shape.y1) / 2;
          const cx = (shape.x1 + shape.x2) / 2;
          const cy = (shape.y1 + shape.y2) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (shape.type === 'rect') {
          const x = Math.min(shape.x1, shape.x2);
          const y = Math.min(shape.y1, shape.y2);
          const w = Math.abs(shape.x2 - shape.x1);
          const h = Math.abs(shape.y2 - shape.y1);
          ctx.strokeRect(x, y, w, h);
        } else if (shape.type === 'text') {
          const fontSize = Math.round(18 * baseScale);
          ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          const textMetrics = ctx.measureText(shape.text);
          const padX = 8 * baseScale;
          const padY = 5 * baseScale;
          const boxW = textMetrics.width + padX * 2;
          const boxH = fontSize + padY * 2;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(shape.x - padX, shape.y - fontSize, boxW, boxH, 4 * baseScale);
          } else {
            ctx.rect(shape.x - padX, shape.y - fontSize, boxW, boxH);
          }
          ctx.fill();

          ctx.strokeStyle = shape.color;
          ctx.lineWidth = 1.5 * baseScale;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(shape.text, shape.x, shape.y + (padY / 2));
        }
        ctx.restore();
      });
    }

    async function usePhoto() {
      if (!cropper) { showToast('Lỗi: Chưa có dữ liệu ảnh!'); return; }
      let finalDataUrl;
      if (markupShapes && markupShapes.length > 0 && markupBaseCanvas) {
        redrawMarkup();
        const canvas = document.getElementById('markupCanvas');
        finalDataUrl = canvas.toDataURL('image/jpeg', 0.80);
      } else {
        const croppedCanvas = cropper.getCroppedCanvas({ maxWidth: 1280, maxHeight: 1280, fillColor: '#ffffff', imageSmoothingEnabled: true, imageSmoothingQuality: 'high' });
        finalDataUrl = croppedCanvas.toDataURL('image/jpeg', 0.75);
        croppedCanvas.width = 0; croppedCanvas.height = 0;
      }

      savePhoto(finalDataUrl, currentOriginalImg);
      closeCamera();
    }

    function savePhoto(imgData, originalData, explicitTarget = null) {
      const t = explicitTarget || camTarget;
      if (!t) return;
      setTargetLoading(t, false);
      pushHistory('Lưu ảnh');
      if (t.type === 'slot') {
        const payload = { img: imgData, original: originalData };
        if (t.section === 'cover') { D.coverPhotos[t.key] = payload; refreshSlot(t.containerId, t.key, 'cover'); }
      } else if (t.type === 'free') {
        const isMulti = t.key === 'watchoutPhotos' || t.key === 'testingPhotos' || t.key === 'assemblyPhotos';
        if (t.index !== undefined) {
          if (!D[t.key]) D[t.key] = [];
          if (!D[t.key][t.index]) D[t.key][t.index] = { caption: '', photoLayout: isMulti ? 'single' : undefined };
          if (t.subType === 'sub') {
            D[t.key][t.index].imgSub = imgData;
            D[t.key][t.index].originalSub = originalData;
          } else {
            D[t.key][t.index].img = imgData;
            D[t.key][t.index].original = originalData;
          }
        } else {
          if (!D[t.key]) D[t.key] = [];
          D[t.key].push({ img: imgData, original: originalData, caption: '', photoLayout: isMulti ? 'single' : undefined });
        }
        renderFreePhotos(t.key);
      } else if (t.type === 'dim') {
        if (!D.dimensions) D.dimensions = [];
        if (!D.dimensions[t.index]) D.dimensions[t.index] = {};
        if (t.subType === 'sub') {
          D.dimensions[t.index].imgSub = imgData;
          D.dimensions[t.index].originalSub = originalData;
        } else {
          D.dimensions[t.index].img = imgData;
          D.dimensions[t.index].original = originalData;
        }
        buildDimGrid();
      }
      as(); showToast('✓ Đã áp dụng ảnh');
    }

    function closeCamera() {
      unlockBodyScroll();
      if (cropper) { cropper.destroy(); cropper = null; }
      currentOriginalImg = null;
      markupShapes = [];
      isMarkupMode = false;
      if (markupBaseCanvas) {
        markupBaseCanvas.width = 0;
        markupBaseCanvas.height = 0;
        markupBaseCanvas = null;
      }
      const canvas = document.getElementById('markupCanvas');
      if (canvas) canvas.style.display = 'none';
      const toolbar = document.getElementById('markupToolbar');
      if (toolbar) toolbar.style.display = 'none';
      const btnToggle = document.getElementById('btnToggleMarkup');
      if (btnToggle) {
        btnToggle.classList.remove('active');
        btnToggle.textContent = '✏️ MARKUP';
      }
      const ratioSeg = document.getElementById('ratioSegmented');
      if (ratioSeg) ratioSeg.style.display = 'flex';
      const strBox = document.getElementById('straightenBox');
      if (strBox) strBox.style.display = 'flex';

      const image = document.getElementById('cropperImage');
      if (image) {
        image.onload = null;
        image.onerror = null;
        image.removeAttribute('src');
      }
      const modal = document.getElementById('camModal');
      if (modal) modal.classList.add('hidden');
    }

    async function copyDimensionsFromLatestReport() {
      try {
        const metadataList = await dbGetAllMetadata();
        if (!metadataList || metadataList.length === 0) {
          showToast('Chưa có báo cáo nào khác');
          return;
        }

        const otherReports = metadataList.filter(r => String(r.id) !== String(currentId));
        if (otherReports.length === 0) {
          showToast('Không có báo cáo khác để sao chép');
          return;
        }

        otherReports.sort((a, b) => {
          const timeA = a.updatedAt || parseInt(a.id) || 0;
          const timeB = b.updatedAt || parseInt(b.id) || 0;
          return timeB - timeA;
        });

        let sourceReport = null;
        for (const meta of otherReports) {
          const fullRep = await dbGet(meta.id);
          if (fullRep && Array.isArray(fullRep.dimensions) && fullRep.dimensions.length > 0) {
            sourceReport = fullRep;
            break;
          }
        }

        if (!sourceReport) {
          showToast('Không tìm thấy báo cáo có dữ liệu kích thước');
          return;
        }

        const sourceTitle = getReportTitle(sourceReport);
        const countDims = sourceReport.dimensions.length;

        const confirmed = confirm(
          `Tìm thấy báo cáo gần nhất:\n"${sourceTitle}" (${countDims} kích thước).\n\n` +
          `Bạn có muốn sao chép tên kích thước và thông số bản vẽ sang báo cáo hiện tại không?`
        );
        if (!confirmed) return;

        pushHistory('Sao chép mẫu kích thước');
        D.dimensions = sourceReport.dimensions.map(d => ({
          name: d.name || '',
          drawing: d.drawing || '',
          drawingUnit: d.drawingUnit || 'cm',
          actual: '',
          actualUnit: d.actualUnit || 'cm',
          color: 'color-blue',
          img: null,
          imgSub: null,
          photoLayout: d.photoLayout || '3:1'
        }));

        buildDimGrid();
        as();
        showToast(`✓ Đã sao chép ${D.dimensions.length} kích thước từ "${sourceTitle}"`);
      } catch (err) {
        console.error('Lỗi sao chép kích thước:', err);
        showToast('Lỗi khi sao chép kích thước: ' + err.message);
      }
    }

    
