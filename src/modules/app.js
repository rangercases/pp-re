// Main Application Logic
import { LOGO_WHITE, LOGO_BLACK } from './logo.js';
import { FONT_ROBOTO } from './font.js';

// Gắn logo & font vào window scope để các hàm render/pdf hiện có sử dụng mượt mà
window.LOGO_WHITE = LOGO_WHITE;
window.LOGO_BLACK = LOGO_BLACK;
window.FONT_ROBOTO = FONT_ROBOTO;


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

    function dbGet(id) { 
      return new Promise((res, rej) => { 
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id); 
        req.onsuccess = () => res(req.result || null); 
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
    const MAX_HISTORY = 8;
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
        if (rep.coverPhotos && typeof rep.coverPhotos === 'object') {
          for (const k of Object.keys(rep.coverPhotos)) {
            const p = rep.coverPhotos[k];
            if (p && typeof p === 'object') {
              if (p.original && typeof p.original === 'string' && p.original.length > 400000) {
                p.original = await normalizeMasterPhoto(p.original);
              }
              if (p.img && typeof p.img === 'string' && p.img.length > 400000) {
                p.img = await resizeImage(p.img, 1280, 0.72);
              }
            }
          }
        }
        const photoKeys = ['prodPhotos', 'hardwarePhotos', 'cartonPhotos', 'markingPhotos', 'internalPhotos', 'testingPhotos', 'watchoutPhotos', 'assemblyPhotos'];
        for (const arrKey of photoKeys) {
          if (Array.isArray(rep[arrKey])) {
            for (const p of rep[arrKey]) {
              if (p && typeof p === 'object') {
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

    // ═══════════════ HISTORY MANAGER (UNDO / REDO) ═══════════════
    function resetHistory() {
      undoStack = [];
      redoStack = [];
      preTypingSnapshot = null;
      clearTimeout(textInputUndoTimeout);
      updateUndoRedoUI();
    }

    function flushPendingTextUndo() {
      if (preTypingSnapshot && D && currentId) {
        clearTimeout(textInputUndoTimeout);
        const currentSnap = JSON.stringify(D);
        if (currentSnap !== preTypingSnapshot) {
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
        const snapshot = JSON.stringify(D);
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
        const currentSnap = JSON.stringify(D);
        const item = undoStack.pop();
        redoStack.push({ data: currentSnap, desc: item.desc });

        D = JSON.parse(item.data);
        loadData();
        updateTopbar();
        await dbPut(D);
        showToast(`↩️ Đã hoàn tác: ${item.desc}`);
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
        const currentSnap = JSON.stringify(D);
        const item = redoStack.pop();
        undoStack.push({ data: currentSnap, desc: item.desc });

        D = JSON.parse(item.data);
        loadData();
        updateTopbar();
        await dbPut(D);
        showToast(`↪️ Đã làm lại: ${item.desc}`);
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

    // Auto-capture text changes for input and textarea
    document.addEventListener('input', (e) => {
      if (!currentId || isHistoryNavigating) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        if (!preTypingSnapshot && D) {
          preTypingSnapshot = JSON.stringify(D);
        }
        clearTimeout(textInputUndoTimeout);
        textInputUndoTimeout = setTimeout(() => {
          if (preTypingSnapshot) {
            const currentSnap = JSON.stringify(D);
            if (currentSnap !== preTypingSnapshot) {
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
          const currentSnap = JSON.stringify(D);
          if (currentSnap !== preTypingSnapshot) {
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

    async function usePhoto() {
      if (!cropper) { showToast('Lỗi: Chưa có dữ liệu ảnh!'); return; }
      const croppedCanvas = cropper.getCroppedCanvas({ maxWidth: 1280, maxHeight: 1280, fillColor: '#ffffff', imageSmoothingEnabled: true, imageSmoothingQuality: 'high' });
      const finalDataUrl = croppedCanvas.toDataURL('image/jpeg', 0.75);
      croppedCanvas.width = 0; croppedCanvas.height = 0; // Giải phóng ngay bộ nhớ Canvas
      savePhoto(finalDataUrl, currentOriginalImg);
      closeCamera();
    }

    function savePhoto(imgData, originalData) {
      const t = camTarget;
      if (!t) return;
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
      as(); showToast('✓ Đã lưu ảnh');
    }

    function closeCamera() { 
        if (cropper) { cropper.destroy(); cropper = null; }
        currentOriginalImg = null;
        const image = document.getElementById('cropperImage');
        if (image) {
          image.onload = null;
          image.onerror = null;
          image.removeAttribute('src');
          image.src = '';
        }
        document.getElementById('camModal').classList.add('hidden'); 
    }

    // ═══════════════ BATCH SELECT CHO REPORT ═══════════════
    function toggleSelectMode() {
      isSelectMode = !isSelectMode;
      const btn = document.getElementById('btnSelectMode');
      const batchBar = document.getElementById('batchBar');
      const btnNew = document.getElementById('btnNewReport');
      const btnImp = document.getElementById('btnImport');
      const btnPasteJson = document.getElementById('btnPasteJson');
      
      selectedReportIds.clear();
      
      if (isSelectMode) {
        btn.textContent = 'Xong';
        batchBar.style.display = 'flex';
        btnNew.style.display = 'none';
        btnImp.style.display = 'none';
        if (btnPasteJson) btnPasteJson.style.display = 'none';
      } else {
        btn.textContent = 'Chọn';
        batchBar.style.display = 'none';
        btnNew.style.display = 'block';
        btnImp.style.display = 'block';
        if (btnPasteJson) btnPasteJson.style.display = '';
      }
      updateBatchUI();
      renderHome();
    }

    function updateBatchUI() {
      document.getElementById('selectedCountText').textContent = `Đã chọn: ${selectedReportIds.size}`;
      document.querySelectorAll('.report-card').forEach(card => {
        const id = card.dataset.id;
        card.classList.toggle('selecting', isSelectMode);
        card.classList.toggle('selected', selectedReportIds.has(id));
      });
    }

    function selectAllReports() {
      if (selectedReportIds.size === reports.length) {
        selectedReportIds.clear();
      } else {
        reports.forEach(r => selectedReportIds.add(String(r.id)));
      }
      updateBatchUI();
    }

    async function deleteSelectedReports() {
      if (selectedReportIds.size === 0) {
        showToast('Chưa chọn report nào!');
        return;
      }
      if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedReportIds.size} báo cáo đã chọn không?`)) return;
      
      for (const id of selectedReportIds) {
        await dbDelete(id);
      }
      showToast(`✓ Đã xóa ${selectedReportIds.size} báo cáo`);
      toggleSelectMode();
      renderHome();
    }

    // ═══════════════ BATCH SELECT CHO DIMENSIONS ═══════════════
    function toggleDimSelectMode() {
      isDimSelectMode = !isDimSelectMode;
      const btn = document.getElementById('btnDimSelectMode');
      const bar = document.getElementById('dimBatchBar');
      selectedDimIndices.clear();

      if (isDimSelectMode) {
        btn.textContent = 'Xong';
        bar.style.display = 'flex';
      } else {
        btn.textContent = 'Chọn';
        bar.style.display = 'none';
      }
      buildDimGrid();
      updateDimBatchUI();
    }

    function updateDimBatchUI() {
      const counter = document.getElementById('dimSelectedCountText');
      if (counter) counter.textContent = `Đã chọn: ${selectedDimIndices.size}`;
      document.querySelectorAll('.dim-slot').forEach(slot => {
        const idx = parseInt(slot.dataset.dimIndex, 10);
        if (!isNaN(idx)) {
          slot.classList.toggle('dim-selecting', isDimSelectMode);
          slot.classList.toggle('dim-selected', selectedDimIndices.has(idx));
        }
      });
    }

    function toggleSelectDimIndex(index) {
      if (selectedDimIndices.has(index)) selectedDimIndices.delete(index);
      else selectedDimIndices.add(index);
      updateDimBatchUI();
    }

    function selectAllDims() {
      const total = (D.dimensions || []).length;
      if (selectedDimIndices.size === total) {
        selectedDimIndices.clear();
      } else {
        for (let i = 0; i < total; i++) selectedDimIndices.add(i);
      }
      updateDimBatchUI();
    }

    function deleteSelectedDims() {
      if (selectedDimIndices.size === 0) {
        showToast('Chưa chọn ô kích thước nào!');
        return;
      }
      if (!confirm(`Bạn có chắc muốn xóa ${selectedDimIndices.size} ô kích thước đã chọn?`)) return;
      pushHistory(`Xóa ${selectedDimIndices.size} ô kích thước`);
      
      const sorted = Array.from(selectedDimIndices).sort((a, b) => b - a);
      sorted.forEach(idx => {
        D.dimensions.splice(idx, 1);
      });

      selectedDimIndices.clear();
      toggleDimSelectMode();
      as();
      showToast('✓ Đã xóa các kích thước đã chọn');
    }

    // ═══════════════ APP LOGIC & IMPORT JSON ═══════════════
    let pendingImportData = null;
    let pendingExistingReport = null;
    let pendingCopySuffix = '(1)';

    function closeImportConflictModal() {
      const m = document.getElementById('importConflictModal');
      if (m) m.classList.add('hidden');
      pendingImportData = null;
      pendingExistingReport = null;
      pendingCopySuffix = '(1)';
    }

    async function handleConflictAction(isReplace) {
      if (!pendingImportData) return;
      await applyImportData(pendingImportData, isReplace);
    }

    async function applyImportData(data, isReplace) {
      try {
        const normalizedData = await normalizeReportPhotos(data);
        if (isReplace && pendingExistingReport) {
          normalizedData.id = pendingExistingReport.id;
          await dbPut(normalizedData);
          showToast('✓ Đã ghi đè báo cáo thành công!');
        } else {
          normalizedData.id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
          if (pendingExistingReport) {
            const suffix = pendingCopySuffix || '(1)';
            if (normalizedData.desc && normalizedData.desc.trim()) {
              normalizedData.desc = `${normalizedData.desc.trim()} ${suffix}`;
            } else if (normalizedData.reportTitle && normalizedData.reportTitle.trim()) {
              normalizedData.reportTitle = `${normalizedData.reportTitle.trim()} ${suffix}`;
            } else if (normalizedData.model && normalizedData.model.trim()) {
              normalizedData.model = `${normalizedData.model.trim()} ${suffix}`;
            } else {
              normalizedData.desc = `Bản sao ${suffix}`;
            }
            showToast(`✓ Đã tạo báo cáo mới ${suffix}!`);
          } else {
            showToast('✓ Nhập báo cáo thành công!');
          }
          await dbPut(normalizedData);
        }
        closeImportConflictModal();
        await renderHome();
        openReport(normalizedData.id);
      } catch (err) {
        console.error(err);
        alert('Lỗi khi lưu báo cáo: ' + err.message);
      }
    }

    function findNextCopySuffix(targetTitle, allReports) {
      const cleanBase = targetTitle.replace(/\s*\(\d+\)$/, '').trim();
      const existingTitles = allReports.map(r => getReportTitle(r).trim().toLowerCase());
      let n = 1;
      let candidate = `${cleanBase} (${n})`.toLowerCase();
      while (existingTitles.includes(candidate)) {
        n++;
        candidate = `${cleanBase} (${n})`.toLowerCase();
      }
      return `(${n})`;
    }

    async function duplicateReportById(id) {
      try {
        const allReps = await dbGetAll();
        const source = allReps.find(r => String(r.id) === String(id));
        if (!source) {
          showToast('Không tìm thấy báo cáo để nhân bản!');
          return;
        }
        await doDuplicateReport(source);
      } catch (err) {
        console.error(err);
        alert('Lỗi khi nhân bản báo cáo: ' + err.message);
      }
    }

    async function doDuplicateReport(source) {
      const cloned = JSON.parse(JSON.stringify(source));
      cloned.id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);

      const allReports = await dbGetAll();
      const baseTitle = getReportTitle(cloned).trim();
      const suffix = findNextCopySuffix(baseTitle, allReports);

      if (cloned.desc && cloned.desc.trim()) {
        const cleanDesc = cloned.desc.replace(/\s*\(\d+\)$/, '').trim();
        cloned.desc = `${cleanDesc} ${suffix}`;
      } else if (cloned.reportTitle && cloned.reportTitle.trim()) {
        const cleanTitle = cloned.reportTitle.replace(/\s*\(\d+\)$/, '').trim();
        cloned.reportTitle = `${cleanTitle} ${suffix}`;
      } else if (cloned.model && cloned.model.trim()) {
        const cleanModel = cloned.model.replace(/\s*\(\d+\)$/, '').trim();
        cloned.model = `${cleanModel} ${suffix}`;
      } else {
        cloned.desc = `Bản sao ${suffix}`;
      }

      await dbPut(cloned);
      showToast(`✓ Đã nhân bản báo cáo ${suffix}!`);
      await renderHome();
    }

    async function duplicateSelectedReports() {
      if (selectedReportIds.size === 0) {
        showToast('Chưa chọn báo cáo nào để nhân bản!');
        return;
      }
      try {
        const allReports = await dbGetAll();
        const ids = Array.from(selectedReportIds);
        for (const id of ids) {
          const source = allReports.find(r => String(r.id) === String(id));
          if (source) {
            await doDuplicateReport(source);
          }
        }
        selectedReportIds.clear();
        toggleSelectMode();
        showToast(`✓ Đã nhân bản ${ids.length} báo cáo thành công!`);
        await renderHome();
      } catch (err) {
        console.error(err);
        alert('Lỗi nhân bản hàng loạt: ' + err.message);
      }
    }

    function downloadReportJson(rep) {
      const fileName = [rep.model, rep.desc].filter(Boolean).join('_') || 'report';
      const data = JSON.stringify(rep, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PP_${fileName}_${rep.date || 'draft'}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function shareReportById(id) {
      try {
        const reports = await dbGetAll();
        const rep = reports.find(r => String(r.id) === String(id));
        if (!rep) {
          showToast('Không tìm thấy báo cáo!');
          return;
        }
        downloadReportJson(rep);
        showToast('✓ Đã tải file JSON báo cáo!');
      } catch (err) {
        console.error(err);
        alert('Lỗi chia sẻ báo cáo: ' + err.message);
      }
    }

    async function shareSelectedReports() {
      if (selectedReportIds.size === 0) {
        showToast('Chưa chọn báo cáo nào để chia sẻ!');
        return;
      }
      try {
        const allReports = await dbGetAll();
        const selectedReps = allReports.filter(r => selectedReportIds.has(String(r.id)));
        if (selectedReps.length === 0) return;

        showToast(`Đang tải ${selectedReps.length} file JSON...`);
        for (let i = 0; i < selectedReps.length; i++) {
          setTimeout(() => {
            downloadReportJson(selectedReps[i]);
            if (i === selectedReps.length - 1) {
              showToast(`✓ Đã tải xong ${selectedReps.length} file JSON!`);
            }
          }, i * 300);
        }
      } catch (err) {
        console.error(err);
        alert('Lỗi khi chia sẻ hàng loạt: ' + err.message);
      }
    }

    async function processJsonData(data) {
      try {
        const existingReports = await dbGetAll();

        const targetTitle = getReportTitle(data).trim();
        const isNamed = targetTitle && targetTitle.toLowerCase() !== 'untitled report';

        // 1. Kiểm tra nếu trùng cả NAME với báo cáo đang có
        let conflictReport = null;
        if (isNamed) {
          conflictReport = existingReports.find(r => getReportTitle(r).trim().toLowerCase() === targetTitle.toLowerCase());
        }

        if (conflictReport) {
          // Trùng cả name -> Hiển thị hộp thoại hỏi Replace hay Tạo bản (1)
          pendingImportData = data;
          pendingExistingReport = conflictReport;
          pendingCopySuffix = findNextCopySuffix(targetTitle, existingReports);

          const nameEl = document.getElementById('conflictReportName');
          const newNameEl = document.getElementById('conflictNewName');
          const btnCopy = document.getElementById('btnConflictCopy');
          if (nameEl) nameEl.textContent = `"${targetTitle}"`;
          if (newNameEl) newNameEl.textContent = `bản ${pendingCopySuffix}`;
          if (btnCopy) btnCopy.textContent = `Tạo bản ${pendingCopySuffix}`;

          const m = document.getElementById('importConflictModal');
          if (m) m.classList.remove('hidden');
          return;
        }

        // 2. Nếu KHÔNG trùng name nhưng trùng ID (hoặc chưa có ID) -> Tự động cấp ID mới
        const isIdConflict = data.id && existingReports.some(r => String(r.id) === String(data.id));
        if (!data.id || isIdConflict) {
          data.id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
        }

        const normalizedData = await normalizeReportPhotos(data);
        await dbPut(normalizedData);
        showToast('✓ Nhập báo cáo thành công!');
        await renderHome();
        openReport(normalizedData.id);
      } catch (err) {
        console.error(err);
        alert('Lỗi nhập dữ liệu: File JSON không hợp lệ!');
      }
    }

    async function pasteJsonFromClipboard() {
      try {
        // 1. Thử đọc dạng text
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && text.trim().startsWith('{') && text.trim().endsWith('}')) {
            try {
              const data = JSON.parse(text.trim());
              if (data && typeof data === 'object') {
                await processJsonData(data);
                return;
              }
            } catch (e) {}
          }
        }
        // 2. Thử đọc dạng files qua clipboard.read()
        if (navigator.clipboard && navigator.clipboard.read) {
          try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
              for (const type of item.types) {
                if (type === 'application/json' || type === 'text/plain') {
                  const blob = await item.getType(type);
                  const text = await blob.text();
                  if (text && text.trim().startsWith('{') && text.trim().endsWith('}')) {
                    const data = JSON.parse(text.trim());
                    if (data && typeof data === 'object') {
                      await processJsonData(data);
                      return;
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn(e);
          }
        }
        showToast('Clipboard chưa có dữ liệu JSON! Hãy copy nội dung hoặc file JSON rồi bấm Dán.');
      } catch (err) {
        console.error(err);
        showToast('Nhấn Ctrl+V để dán dữ liệu JSON trực tiếp!');
      }
    }

    function initHomeDragAndDrop() {
      const home = document.getElementById('homeScreen');
      if (!home) return;
      home.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      home.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer.files || []);
        const jsonFiles = files.filter(f => (f.name && f.name.toLowerCase().endsWith('.json')) || f.type === 'application/json');
        if (jsonFiles.length > 0) {
          for (const file of jsonFiles) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
              try {
                const data = JSON.parse(ev.target.result);
                await processJsonData(data);
              } catch (err) {
                console.error(err);
                alert(`Lỗi đọc file ${file.name}: Không phải JSON hợp lệ!`);
              }
            };
            reader.readAsText(file);
          }
        }
      });
    }

    function importReport(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          await processJsonData(data);
        } catch (err) {
          console.error(err);
          alert('Lỗi nhập dữ liệu: File JSON không hợp lệ!');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }

    async function goHome() {
      currentId = null; curSec = 0;
      D = {}; // Thu hồi toàn bộ bộ nhớ của báo cáo cũ khi ra trang chủ
      document.getElementById('homeScreen').classList.add('active');
      document.getElementById('editScreen').classList.remove('active');
      ['tabsWrap', 'progressBar', 'saveBar', 'btnHome', 'btnExport', 'btnShare', 'btnUndo', 'btnRedo', 'saveIndicator', 'topbarDivider'].forEach(elemId => {
        const el = document.getElementById(elemId);
        if (el) el.style.display = 'none';
      });
      const btnStyler = document.getElementById('btnStyler');
      if (btnStyler) btnStyler.style.display = 'inline-flex';
      document.getElementById('topTitle').textContent = 'DIGITAL REPORT';
      resetHistory();
      await renderHome();
    }

    async function renderHome() {
      try {
        reports = await dbGetAll();
        const list = document.getElementById('reportsList');
        const empty = document.getElementById('emptyState');
        list.innerHTML = '';
        if (!reports.length) { 
          empty.style.display = 'block'; 
          document.getElementById('btnSelectMode').style.display = 'none';
          return; 
        }
        empty.style.display = 'none';
        document.getElementById('btnSelectMode').style.display = 'block';
        
        [...reports].reverse().forEach(r => {
          const photos = Object.keys(r.coverPhotos || {}).length + (r.prodPhotos || []).length;
          const done = photos >= 4;
          const d = document.createElement('div');
          d.className = 'report-card';
          d.dataset.id = String(r.id);
          
          if (isSelectMode) d.classList.add('selecting');
          if (selectedReportIds.has(String(r.id))) d.classList.add('selected');

          const reportTitle = getReportTitle(r);
          const safeTitle = escapeHtml(reportTitle);
          const safeDate = escapeHtml(r.date || '');
          const safeFactory = escapeHtml(r.factory || '');
          const safeReviewer = escapeHtml(r.reviewer || '');

          d.innerHTML = `
            <div class="rc-left">
              <div class="rc-select-circle"></div>
              <div>
                <div class="rc-title">${safeTitle}<span class="rc-badge ${done ? 'badge-done' : 'badge-wip'}">${done ? 'Done' : 'In Progress'}</span></div>
                <div class="rc-sub">${safeDate} · ${safeFactory} · ${safeReviewer}</div>
              </div>
            </div>
            <div class="rc-right" style="${isSelectMode ? 'display:none' : 'display:flex; align-items:center; gap:6px;'}">
              <button class="rc-action-btn btn-share-report" title="Chia sẻ file JSON">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </button>
              <button class="rc-action-btn btn-dup-report" title="Nhân bản báo cáo">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
              <div class="rc-arrow" style="color:var(--muted); font-size:18px; line-height:1;">›</div>
            </div>
          `;

          const shareBtn = d.querySelector('.btn-share-report');
          if (shareBtn) {
            shareBtn.onclick = (e) => {
              e.stopPropagation();
              shareReportById(r.id);
            };
          }
          const dupBtn = d.querySelector('.btn-dup-report');
          if (dupBtn) {
            dupBtn.onclick = (e) => {
              e.stopPropagation();
              duplicateReportById(r.id);
            };
          }
          
          d.onclick = (e) => {
            if (isSelectMode) {
              const id = String(r.id);
              if (selectedReportIds.has(id)) selectedReportIds.delete(id);
              else selectedReportIds.add(id);
              updateBatchUI();
            } else {
              openReport(r.id);
            }
          };
          
          list.appendChild(d);
        });
      } catch (err) {
          alert("Lỗi tải màn hình chính: " + err.message);
      }
    }

    function buildUI() {
      const tabsRow = document.getElementById('tabsRow');
      tabsRow.innerHTML = '';
      TABS.forEach((t, i) => {
        const d = document.createElement('div');
        d.className = 'tab'; d.id = `tab${i}`; d.innerHTML = `${t}`;
        d.onclick = () => showSection(i); tabsRow.appendChild(d);
      });
      buildSlotGrid('coverPhotos', COVER_SLOTS.map(s => ({ key: s.replace(/ /g, '_'), label: s })), 'slot', 'cover');
      Object.entries(CHECK_OPTS).forEach(([g, opts]) => {
        const el = document.getElementById('ck_' + g); if (!el) return; el.innerHTML = '';
        opts.forEach(o => el.appendChild(makeCheck(g, o)));
      });
      buildDimGrid(); 
      renderBVTable();
      FREE_PHOTO_KEYS.forEach(k => renderFreePhotos(k));
    }

    function makeCheck(group, opt) {
      const label = document.createElement('label'); label.className = 'chk';
      const box = document.createElement('div'); box.className = 'chkbox'; box.id = `ck_${group}_${opt}`;
      label.appendChild(box); label.appendChild(document.createTextNode(opt));
      label.onclick = () => toggleCheck(group, opt); return label;
    }

    function buildSlotGrid(containerId, slots, type, section) {
      const el = document.getElementById(containerId); if (!el) return; el.innerHTML = '';
      slots.forEach(s => {
        const div = document.createElement('div');
        div.className = 'photo-slot';
        div.id = `ps_${containerId}_${s.key}`;
        div.dataset.key = s.key;
        div.innerHTML = renderSlotHTML(containerId, s.key, s.label, type, section);
        attachDropZone(div, { type: 'slot', key: s.key, containerId, section });
        el.appendChild(div);
      });

      if (typeof Sortable !== 'undefined' && containerId === 'coverPhotos') {
        if (el._sortable) el._sortable.destroy();
        el._sortable = new Sortable(el, {
          animation: 180,
          delay: 150,
          delayOnTouchOnly: true,
          touchStartThreshold: 5,
          draggable: '.photo-slot',
          handle: '.free-drag-handle, .photo-slot',
          filter: 'input, textarea, select, button, .pact, .tap-option, .dual-tap-box, .ignore-drag',
          preventOnFilter: false,
          swap: true,
          swapClass: 'sortable-swap-highlight',
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          dragClass: 'sortable-chosen',
          onEnd: function (evt) {
            if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
            if (evt.oldIndex === evt.newIndex) return;
            const ckeys = COVER_SLOTS.map(s => s.replace(/ /g, '_'));
            let from = evt.oldIndex;
            let to = evt.newIndex;
            if (from >= ckeys.length || to >= ckeys.length) return;
            const keyFrom = ckeys[from];
            const keyTo = ckeys[to];

            if (!D.coverPhotos) D.coverPhotos = {};
            const tempPhoto = D.coverPhotos[keyFrom];
            if (D.coverPhotos[keyTo] !== undefined) {
              D.coverPhotos[keyFrom] = D.coverPhotos[keyTo];
            } else {
              delete D.coverPhotos[keyFrom];
            }
            if (tempPhoto !== undefined) {
              D.coverPhotos[keyTo] = tempPhoto;
            } else {
              delete D.coverPhotos[keyTo];
            }

            if (!D.coverTitles) D.coverTitles = {};
            const tempTitle = D.coverTitles[keyFrom];
            if (D.coverTitles[keyTo] !== undefined) {
              D.coverTitles[keyFrom] = D.coverTitles[keyTo];
            } else {
              delete D.coverTitles[keyFrom];
            }
            if (tempTitle !== undefined) {
              D.coverTitles[keyTo] = tempTitle;
            } else {
              delete D.coverTitles[keyTo];
            }

            pushHistory('Hoán đổi vị trí ảnh Overview');
            as();
            buildSlotGrid(containerId, slots, type, section);
          }
        });
      }
    }

    function updateCoverLabel(key, val) {
      if (!D.coverTitles) D.coverTitles = {};
      D.coverTitles[key] = val;
      as();
    }

    function renderSlotHTML(containerId, key, label, type, section) {
      const store = D.coverPhotos;
      const data = store && store[key];
      const displayImg = data ? (typeof data === 'string' ? data : data.img) : null;
      const targetObj = `{type:'${type}',key:'${key}',containerId:'${containerId}',section:'${section}'}`;
      const currentTitle = (D.coverTitles && D.coverTitles[key]) ? D.coverTitles[key] : label;
      
      let inner = '';
      if (displayImg) {
        inner = `
        <div class="free-drag-handle" title="Kéo để hoán đổi vị trí">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
        </div>
        <img class="pimg" src="${displayImg}" draggable="false" onclick="editSlotPhoto('${containerId}','${key}','${section}');event.stopPropagation()" style="cursor:pointer;" title="Bấm để chỉnh sửa/cắt ảnh">
        <div class="pactions">
          <button class="pact copy" title="Sao chép toàn bộ ảnh gốc (Ctrl+C)" onclick="copyPhotoFromTarget(${targetObj});event.stopPropagation()">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="pact del" title="Xóa ảnh" onclick="delSlotPhoto('${containerId}','${key}','${section}');event.stopPropagation()">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>`;
      } else {
        inner = `
        <div class="dual-tap-box">
          <div class="tap-option" onclick="triggerNativeCamera(${targetObj})">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-theme)" stroke-width="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span>Chụp</span>
          </div>
          <div class="tap-option" onclick="triggerPickLibrary(${targetObj})">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a3a6a" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>Album</span>
          </div>
          <div class="tap-option" onclick="triggerPasteToTarget(${targetObj})">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.8"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>
            <span>Dán</span>
          </div>
        </div>`;
      }
      inner += `
        <div class="pbar">
          <input type="text" value="${currentTitle}" placeholder="TÊN GÓC CHỤP..." onclick="event.stopPropagation()" oninput="updateCoverLabel('${key}', this.value)">
        </div>`; 
      return inner;
    }

    function refreshSlot(containerId, key, section) {
      const slots = COVER_SLOTS.map(s => s.replace(/ /g, '_'));
      const label = COVER_SLOTS[slots.indexOf(key)] || key.replace(/_/g, ' ');
      const el = document.getElementById(`ps_${containerId}_${key}`);
      if (el) el.innerHTML = renderSlotHTML(containerId, key, label, 'slot', section);
    }

    function delSlotPhoto(containerId, key, section) {
      if (!confirm('Bạn có chắc muốn xóa ảnh này không?')) return;
      pushHistory('Xóa ảnh Cover');
      delete D.coverPhotos[key];
      refreshSlot(containerId, key, section); as();
    }

    // ═══════════════ DYNAMIC DIMENSIONS (2 CỘT & BỐ CỤC ẢNH LINH HOẠT) ═══════════════
    function buildDimGrid() {
      const grid = document.getElementById('dimGrid'); if (!grid) return; grid.innerHTML = '';
      
      (D.dimensions || []).forEach((d, i) => {
        const div = document.createElement('div');
        div.className = 'dim-slot';
        div.dataset.dimIndex = String(i);

        if (isDimSelectMode) div.classList.add('dim-selecting');
        if (selectedDimIndices.has(i)) div.classList.add('dim-selected');

        const layout = d.photoLayout || '3:1';
        const targetMain = `{type:'dim', index:${i}, subType:'main'}`;
        const targetSub = `{type:'dim', index:${i}, subType:'sub'}`;
        
        const displayImg = d.img || null;
        const displayImgSub = d.imgSub || null;
        
        div.innerHTML = `
        <div class="dim-select-circle"></div>

        <!-- THANH TOPBAR VỚI DRAG-HANDLE VÀ CHỌN BỐ CỤC ẢNH (3:1, 1:1, 1 ẢNH) -->
        <div class="dim-slot-topbar" title="Kéo thả hoặc nhấn giữ thanh này để sắp xếp lại vị trí">
          <span class="dim-drag-handle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
            #${i + 1}
          </span>
          <div class="dim-layout-pills ignore-drag">
            <button type="button" class="dim-pill-btn ${layout === '3:1' ? 'active' : ''}" onclick="setDimPhotoLayout(${i}, '3:1');event.stopPropagation()" title="Bố cục 3:1 (Ảnh chính 75% + Phụ 25%)">
              <svg width="11" height="8" viewBox="0 0 14 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="8.5" height="9" rx="1"/><rect x="10" y="0.5" width="3.5" height="9" rx="1"/></svg>
              3:1
            </button>
            <button type="button" class="dim-pill-btn ${layout === '1:1' ? 'active' : ''}" onclick="setDimPhotoLayout(${i}, '1:1');event.stopPropagation()" title="Bố cục 1:1 (2 ảnh bằng nhau 50% - 50%)">
              <svg width="11" height="8" viewBox="0 0 14 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="6" height="9" rx="1"/><rect x="7.5" y="0.5" width="6" height="9" rx="1"/></svg>
              1:1
            </button>
            <button type="button" class="dim-pill-btn ${layout === 'single' ? 'active' : ''}" onclick="setDimPhotoLayout(${i}, 'single');event.stopPropagation()" title="Bố cục 1 ảnh to (100% - Xóa/ẩn ô phụ)">
              <svg width="11" height="8" viewBox="0 0 14 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="13" height="9" rx="1"/></svg>
              1 ảnh
            </button>
          </div>
        </div>

        <!-- CỤM ẢNH: 3:1, 1:1 HOẶC SINGLE (100%) -->
        <div class="dim-photo-container" data-layout="${layout}">
          
          <!-- ẢNH CHÍNH -->
          <div class="dim-main-photo" id="dph_main_${i}" title="Kéo thả hoặc nhấn Ctrl+V để dán ảnh">
            ${displayImg ? `<img src="${displayImg}" onclick="editDimPhoto(${i}, 'main');event.stopPropagation()" style="cursor:pointer;" title="Bấm để chỉnh sửa/cắt ảnh">` : `
            <div class="dual-tap-box">
              <div class="tap-option" onclick="triggerNativeCamera(${targetMain})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-theme)" stroke-width="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>Chụp</span>
              </div>
              <div class="tap-option" onclick="triggerPickLibrary(${targetMain})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a3a6a" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Album</span>
              </div>
              <div class="tap-option" onclick="triggerPasteToTarget(${targetMain})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.8"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>
                <span>Dán</span>
              </div>
            </div>`}
            ${displayImg ? `<div class="pactions">
              <button class="pact copy" title="Sao chép toàn bộ ảnh gốc (Ctrl+C)" onclick="copyPhotoFromTarget(${targetMain});event.stopPropagation()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="pact del" title="Xóa ảnh" onclick="delDimPhoto(${i}, 'main');event.stopPropagation()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
            </div>` : ''}
          </div>

          <!-- ẢNH PHỤ CHI TIẾT (ẨN KHI Ở CHẾ ĐỘ SINGLE) -->
          ${layout !== 'single' ? `
          <div class="dim-sub-photo" id="dph_sub_${i}" title="Kéo thả hoặc nhấn Ctrl+V để dán ảnh">
            ${displayImgSub ? `<img src="${displayImgSub}" onclick="editDimPhoto(${i}, 'sub');event.stopPropagation()" style="cursor:pointer;" title="Bấm để chỉnh sửa/cắt ảnh">` : `
            <div class="dual-tap-box" ${layout === '3:1' ? 'style="flex-direction:column;"' : ''}>
              <div class="tap-option" ${layout === '3:1' ? 'style="border-right:none; border-bottom:1px dashed var(--border-light);"' : ''} title="Chụp ảnh mới" onclick="triggerNativeCamera(${targetSub})">
                <svg width="${layout === '1:1' ? '16' : '14'}" height="${layout === '1:1' ? '16' : '14'}" viewBox="0 0 24 24" fill="none" stroke="var(--brand-theme)" stroke-width="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                ${layout === '1:1' ? '<span style="font-size:10px; margin-left:2px;">Chụp</span>' : ''}
              </div>
              <div class="tap-option" title="Chọn từ Album" onclick="triggerPickLibrary(${targetSub})">
                <svg width="${layout === '1:1' ? '16' : '14'}" height="${layout === '1:1' ? '16' : '14'}" viewBox="0 0 24 24" fill="none" stroke="#1a3a6a" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                ${layout === '1:1' ? '<span style="font-size:10px; margin-left:2px;">Album</span>' : ''}
              </div>
              <div class="tap-option" title="Dán ảnh từ Clipboard (Ctrl+V)" onclick="triggerPasteToTarget(${targetSub})">
                <svg width="${layout === '1:1' ? '16' : '14'}" height="${layout === '1:1' ? '16' : '14'}" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.8"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>
                ${layout === '1:1' ? '<span style="font-size:10px; margin-left:2px;">Dán</span>' : ''}
              </div>
            </div>`}
            ${displayImgSub ? `<div class="pactions">
              <button class="pact copy" title="Sao chép toàn bộ ảnh gốc (Ctrl+C)" onclick="copyPhotoFromTarget(${targetSub});event.stopPropagation()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="pact del" title="Xóa ảnh phụ" onclick="delDimPhoto(${i}, 'sub');event.stopPropagation()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
            </div>` : ''}
          </div>` : ''}

        </div>

        <!-- KHỐI DỮ LIỆU ĐÁY -->
        <div class="dim-fields">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:6px;">
            <input class="dim-name-input" value="${d.name}" placeholder="TÊN KÍCH THƯỚC..." oninput="updateDimField(${i}, 'name', this.value)" style="margin-bottom:0;">
            <span class="dim-status-icon-badge" id="dimStatusBadge_${i}">
              ${renderDimStatusShape(d.color || 'color-blue')}
            </span>
          </div>
          <div class="dim-row"><label>Actual</label><div class="dim-measure-group"><input class="dim-value-input" value="${d.actual || ''}" placeholder="0" oninput="updateDimField(${i},'actual',this.value)"><input class="dim-unit-input" value="${d.actualUnit || 'mm'}" aria-label="Actual unit" oninput="updateDimField(${i},'actualUnit',this.value)"></div></div>
          <div class="dim-row"><label>Drawing</label><div class="dim-measure-group"><input class="dim-value-input" value="${d.drawing || ''}" placeholder="0" oninput="updateDimField(${i},'drawing',this.value)"><input class="dim-unit-input" value="${d.drawingUnit || 'mm'}" aria-label="Drawing unit" oninput="updateDimField(${i},'drawingUnit',this.value)"></div></div>
          <div class="dim-row"><label>Status</label>
            <select onchange="updateDimField(${i},'color',this.value)">
              <option value="color-blue" ${(d.color || 'color-blue') === 'color-blue' ? 'selected' : ''}>✓ OK</option>
              <option value="color-red" ${d.color === 'color-red' ? 'selected' : ''}>✗ Not OK</option>
              <option value="color-orange" ${d.color === 'color-orange' ? 'selected' : ''}>↻ Update Dwg</option>
            </select>
          </div>
        </div>`;

        div.onclick = (e) => {
          if (isDimSelectMode) {
            e.preventDefault();
            e.stopPropagation();
            toggleSelectDimIndex(i);
          }
        };

        // Gắn lắng nghe kéo-thả riêng cho từng ô ảnh nhỏ
        const mainPhotoEl = div.querySelector('.dim-main-photo');
        const subPhotoEl = div.querySelector('.dim-sub-photo');
        if (mainPhotoEl) attachDropZone(mainPhotoEl, { type: 'dim', index: i, subType: 'main' });
        if (subPhotoEl && layout !== 'single') attachDropZone(subPhotoEl, { type: 'dim', index: i, subType: 'sub' });

        grid.appendChild(div);
      });

      if (!isDimSelectMode) {
        const addBtn = document.createElement('div'); addBtn.className = 'dim-slot add-dim-btn ignore-drag';
        addBtn.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span style="color:var(--accent); font-weight:600; margin-top:4px;">THÊM ĐO ĐẠC</span>`;
        addBtn.onclick = () => addDimSlot();
        grid.appendChild(addBtn);
      }

      // Khởi tạo tính năng nhấn giữ để di chuyển sắp xếp (SortableJS giống Product Photo)
      if (typeof Sortable !== 'undefined') {
        if (grid._sortable) {
          grid._sortable.destroy();
          grid._sortable = null;
        }
        if (!isDimSelectMode) {
          grid._sortable = new Sortable(grid, {
            animation: 180,
            delay: 200,
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            draggable: '.dim-slot:not(.add-dim-btn)',
            handle: '.dim-slot-topbar, .dim-drag-handle',
            filter: 'input, textarea, select, button, .dim-layout-pills, .dim-pill-btn, .dim-close-sub-btn, .ignore-drag',
            preventOnFilter: false,
            swap: true,
            swapClass: 'sortable-swap-highlight',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-chosen',
            onEnd: function (evt) {
              if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
              if (evt.oldIndex === evt.newIndex) return;
              if (!D.dimensions || !D.dimensions.length) return;
              const total = D.dimensions.length;
              let from = evt.oldIndex;
              let to = evt.newIndex;
              if (from >= total) from = total - 1;
              if (to >= total) to = total - 1;
              if (from === to) {
                buildDimGrid();
                return;
              }
              pushHistory('Hoán đổi vị trí kích thước');
              const temp = D.dimensions[from];
              D.dimensions[from] = D.dimensions[to];
              D.dimensions[to] = temp;
              as();
              buildDimGrid();
            }
          });
        }
      }
    }

    function setDimPhotoLayout(index, layout) {
      if (!D.dimensions || !D.dimensions[index]) return;
      pushHistory('Đổi bố cục ảnh kích thước');
      D.dimensions[index].photoLayout = layout;
      as();
      buildDimGrid();
    }

    function removeDimSubPhoto(index) {
      if (!D.dimensions || !D.dimensions[index]) return;
      if (D.dimensions[index].imgSub) {
        if (!confirm('Bạn có muốn xóa ô ảnh phụ và chuyển sang bố cục 1 ảnh không? (Ảnh phụ sẽ được ẩn đi)')) return;
      }
      setDimPhotoLayout(index, 'single');
    }

    function getAutomaticDimensionColor(dimension) {
      const actual = Number.parseFloat(dimension.actual);
      const drawing = Number.parseFloat(dimension.drawing);
      if (!Number.isFinite(actual) || !Number.isFinite(drawing)) return null;
      return Math.abs(actual - drawing) > 10 ? 'color-red' : 'color-blue';
    }

    function normalizeDimensionMeasurement(dimension, field) {
      const unitField = field + 'Unit';
      const rawValue = String(dimension[field] || '').trim();
      const match = rawValue.match(/^([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s*([a-zA-Z]+)?$/);

      if (match) {
        dimension[field] = match[1];
        if (!dimension[unitField]) dimension[unitField] = match[2] || 'mm';
      } else if (!dimension[unitField]) {
        dimension[unitField] = 'mm';
      }
    }

    function renderDimStatusShape(color) {
      if (color === 'color-red') {
        return `<span class="dim-status-icon shape-not-ok" title="Not OK"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e24b4b" stroke-width="3.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></span>`;
      }
      if (color === 'color-orange') {
        return `<span class="dim-status-icon shape-update" title="Update Drawing"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e89020" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg></span>`;
      }
      return `<span class="dim-status-icon shape-ok" title="OK"><span class="color-dot color-blue"></span></span>`;
    }

    function formatDimensionMeasurement(dimension, field) {
      const value = dimension[field];
      if (!value) return '—';
      const unit = dimension[field + 'Unit'];
      return unit ? `${value} ${unit}` : value;
    }

    function updateDimField(index, field, val) {
      const dimension = D.dimensions[index];
      dimension[field] = val;

      if (field === 'actual' || field === 'drawing') {
        const automaticColor = getAutomaticDimensionColor(dimension);
        if (automaticColor) {
          dimension.color = automaticColor;
          const statusBadge = document.getElementById(`dimStatusBadge_${index}`);
          if (statusBadge) {
            statusBadge.innerHTML = renderDimStatusShape(automaticColor);
          }
          const statusSelect = document.querySelector(`[data-dim-index="${index}"] .dim-fields select`);
          if (statusSelect) statusSelect.value = automaticColor;
        }
      }

      if (field === 'color') {
        pushHistory('Đổi trạng thái kích thước');
        buildDimGrid();
      }
      as();
    }

    function addDimSlot() {
      pushHistory('Thêm ô kích thước');
      if(!D.dimensions) D.dimensions = [];
      D.dimensions.push({ 
        id: 'dim_' + Math.random().toString(36).substr(2, 9), 
        name: 'DIMENSION NAME', 
        actual: '', 
        drawing: '', 
        actualUnit: 'mm',
        drawingUnit: 'mm',
        color: 'color-blue', 
        photoLayout: '3:1',
        img: null, 
        original: null,
        imgSub: null,
        originalSub: null
      });
      buildDimGrid(); as();
    }

    function delDimPhoto(index, subType = 'main') { 
      if (!confirm('Xóa ảnh này?')) return; 
      pushHistory(subType === 'sub' ? 'Xóa ảnh phụ kích thước' : 'Xóa ảnh chính kích thước');
      if (subType === 'sub') {
        D.dimensions[index].imgSub = null;
        D.dimensions[index].originalSub = null;
      } else {
        D.dimensions[index].img = null; 
        D.dimensions[index].original = null; 
      }
      buildDimGrid(); as(); 
    }

    // ═══════════════ PHOTO SIZING & DYNAMIC GRID HELPERS (NORMAL 50%, FULL 100%) ═══════════════
    function getPhotoSize(p) {
      if (!p) return 'normal';
      if (p.fullWidth === true || p.photoSize === 'full') {
        return 'full';
      }
      return 'normal';
    }

    function togglePhotoFullWidth(key, index) {
      if (!D[key]) D[key] = [];
      if (!D[key][index]) {
        D[key][index] = { fullWidth: false };
      } else if (typeof D[key][index] === 'string') {
        D[key][index] = { img: D[key][index], fullWidth: false };
      }
      const isFull = (D[key][index].fullWidth === true || D[key][index].photoSize === 'full');
      const nextFull = !isFull;
      pushHistory(`Đổi bố cục ô ảnh (${nextFull ? 'Toàn hàng 100%' : '2 ô / hàng 50%'})`);
      D[key][index].fullWidth = nextFull;
      D[key][index].photoSize = nextFull ? 'full' : 'normal';
      as();
      renderFreePhotos(key);
    }
    function togglePhotoSize(key, index) {
      togglePhotoFullWidth(key, index);
    }

    function getPhotoSizeActionBtnHtml(key, index, size) {
      const isFull = (size === 'full');
      const activeClass = isFull ? 'active' : '';
      const title = isFull 
        ? 'Đang: 1 ô toàn hàng (100%) — Bấm để thu về 2 ô / hàng (50%)' 
        : 'Đang: 2 ô / hàng (50%) — Bấm để mở rộng 1 ô toàn hàng (100%)';
      const svg = isFull
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14L3 21"/></svg>`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
      return `
        <button class="pact expand ${activeClass}" type="button" title="${title}" onclick="togglePhotoFullWidth('${key}', ${index});event.stopPropagation()">
          ${svg}
        </button>
      `;
    }

    function getPhotoSizePillHtml(key, index, size) {
      const isFull = (size === 'full');
      const label = isFull ? '1 ô/hàng' : '2 ô/hàng';
      const icon = isFull
        ? '<rect x="0.5" y="0.5" width="13" height="9" rx="1.5" fill="currentColor"/>'
        : '<rect x="0.5" y="0.5" width="5.5" height="9" rx="1"/><rect x="8" y="0.5" width="5.5" height="9" rx="1"/>';
      const title = isFull
        ? 'Đang: 1 ô toàn hàng (100%) — Bấm để thu về 2 ô / hàng'
        : 'Đang: 2 ô / hàng (50%) — Bấm để mở rộng 1 ô toàn hàng (100%)';
      const activeClass = isFull ? 'active' : '';
      return `
        <button type="button" class="dim-pill-btn fullwidth-toggle ${activeClass}" onclick="togglePhotoFullWidth('${key}', ${index});event.stopPropagation()" title="${title}">
          <svg width="11" height="8" viewBox="0 0 14 10" fill="none" stroke="currentColor">${icon}</svg> ${label}
        </button>
      `;
    }

    // ═══════════════ FREE PHOTOS UNIVERSAL HANDLER ═══════════════
    function renderFreePhotos(key) {
      if (key === 'assemblyPhotos') {
        renderAssemblyPhotos();
        return;
      }
      if (key === 'watchoutPhotos') {
        renderWatchoutPhotos();
        return;
      }
      if (key === 'testingPhotos') {
        renderTestingPhotos();
        return;
      }

      const el = document.getElementById(key); if (!el) return; el.innerHTML = '';
      const arr = D[key] || [];
      
      arr.forEach((p, i) => {
        const size = getPhotoSize(p);
        const isFull = (size === 'full');
        const div = document.createElement('div');
        div.className = 'free-photo-item' + (p && p.img ? '' : ' is-empty') + (isFull ? ' is-fullwidth' : '');
        div.title = 'Kéo hoặc nhấn giữ để sắp xếp lại vị trí';
        const targetObj = `{type:'free',key:'${key}',index:${i}}`;
        
        const dragHandleHtml = `
          <div class="free-drag-handle" title="Kéo hoặc nhấn giữ để di chuyển vị trí">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
            <span>#${i + 1}</span>
          </div>`;
        
        if (p && p.img) {
            div.innerHTML = `
            ${dragHandleHtml}
            <img src="${p.img}" draggable="false" onclick="editFreePhoto('${key}', ${i})" style="cursor:pointer;" title="Bấm để chỉnh sửa/cắt ảnh">
            <div class="pactions">
              ${getPhotoSizeActionBtnHtml(key, i, size)}
              <button class="pact copy" title="Sao chép toàn bộ ảnh gốc (Ctrl+C)" onclick="copyPhotoFromTarget(${targetObj});event.stopPropagation()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="pact del" title="Xóa" onclick="delFreePhoto('${key}',${i})"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
            </div>
            <div class="free-caption ignore-drag"><textarea class="ignore-drag" rows="1" placeholder="Caption..." oninput="updateCaption('${key}',${i},this.value, this)">${escapeHtml(p.caption || '')}</textarea></div>`;
            const ta = div.querySelector('.free-caption textarea');
            if (ta && p.caption) autoGrowTextarea(ta);
        } else {
            div.innerHTML = `
              ${dragHandleHtml}
              <div class="dual-tap-box">
                <div class="tap-option" onclick="triggerNativeCamera(${targetObj})">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-theme)" stroke-width="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <span>Chụp mới</span>
                </div>
                <div class="tap-option" onclick="triggerPickLibrary(${targetObj})">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a3a6a" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span>Album</span>
                </div>
                <div class="tap-option" onclick="triggerPasteToTarget(${targetObj})">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.8"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>
                  <span>Dán</span>
                </div>
              </div>
              <div class="pactions" style="position:absolute; top:4px; right:4px;">
                ${getPhotoSizeActionBtnHtml(key, i, size)}
                <button class="pact del" title="Xóa ô" onclick="delFreeSlot('${key}',${i})"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
              </div>
            `;
        }
        attachDropZone(div, { type: 'free', key, index: i });
        el.appendChild(div);
      });
      
      const addBtn = document.createElement('div'); addBtn.className = 'add-photo-btn ignore-drag';
      addBtn.title = 'Bấm để thêm ô, kéo thả hoặc nhấn Ctrl+V để dán ảnh';
      addBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span style="color:var(--accent); font-weight:600; margin-top:2px;">THÊM ẢNH</span><span style="font-size:9px; color:var(--muted); font-weight:normal;">Kéo thả hoặc Ctrl+V để dán</span>`;
      addBtn.onclick = () => { pushHistory('Thêm ô ảnh'); if(!D[key]) D[key] = []; D[key].push(null); as(); renderFreePhotos(key); };

      attachDropZone(addBtn, { type: 'free', key }, true);
      el.appendChild(addBtn);

      if(typeof Sortable !== 'undefined') {
          if(el._sortable) el._sortable.destroy();
          el._sortable = new Sortable(el, {
             animation: 180,
             delay: 200,
             delayOnTouchOnly: true,
             touchStartThreshold: 5,
             draggable: '.free-photo-item',
             handle: '.free-drag-handle, .free-photo-item',
             filter: 'input, textarea, select, button, .pact, .free-caption, .free-caption input, .ignore-drag',
             preventOnFilter: false,
             swap: true,
             swapClass: 'sortable-swap-highlight',
             ghostClass: 'sortable-ghost',
             chosenClass: 'sortable-chosen',
             dragClass: 'sortable-chosen',
             onEnd: function (evt) {
                if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
                if (evt.oldIndex === evt.newIndex) return;
                if (!D[key] || !D[key].length) return;
                const total = D[key].length;
                let from = evt.oldIndex;
                let to = evt.newIndex;
                if (from >= total) from = total - 1;
                if (to >= total) to = total - 1;
                if (from === to) {
                  renderFreePhotos(key);
                  return;
                }
                pushHistory('Hoán đổi vị trí ảnh');
                const temp = D[key][from];
                D[key][from] = D[key][to];
                D[key][to] = temp;
                as(); renderFreePhotos(key);
             }
          });
      }
    }

    function renderWatchoutPhotos() {
      const el = document.getElementById('watchoutPhotos'); if (!el) return; el.innerHTML = '';
      const arr = D.watchoutPhotos || [];

      arr.forEach((p, i) => {
        const size = getPhotoSize(p);
        const isFull = (size === 'full');
        const div = document.createElement('div');
        div.className = 'watchout-slot' + (isFull ? ' is-fullwidth' : '');
        div.dataset.index = String(i);

        const layout = (p && p.photoLayout) || (p && p.imgSub ? '3:1' : 'single');
        const targetMain = `{type:'free',key:'watchoutPhotos',index:${i},subType:'main'}`;
        const targetSub = `{type:'free',key:'watchoutPhotos',index:${i},subType:'sub'}`;

        const displayImg = p && p.img ? p.img : null;
        const displayImgSub = p && p.imgSub ? p.imgSub : null;

        div.innerHTML = `
        <!-- THANH TOPBAR VỚI DRAG-HANDLE VÀ CHỌN BỐ CỤC ẢNH (3:1, 1:1, 1 ẢNH) -->
        <div class="dim-slot-topbar" title="Kéo thả thanh này để sắp xếp lại vị trí">
          <span class="dim-drag-handle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
            #${i + 1}
          </span>
          <div style="display:inline-flex; align-items:center; gap:6px;">
            <div class="dim-layout-pills ignore-drag">
              <button type="button" class="dim-pill-btn ${layout === '3:1' ? 'active' : ''}" onclick="setWatchoutPhotoLayout(${i}, '3:1');event.stopPropagation()" title="Bố cục 3:1 (Ảnh chính 75% + Phụ 25%)">
                <svg width="11" height="8" viewBox="0 0 14 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="8.5" height="9" rx="1"/><rect x="10" y="0.5" width="3.5" height="9" rx="1"/></svg>
                3:1
              </button>
              <button type="button" class="dim-pill-btn ${layout === '1:1' ? 'active' : ''}" onclick="setWatchoutPhotoLayout(${i}, '1:1');event.stopPropagation()" title="Bố cục 1:1 (2 ảnh bằng nhau 50% - 50%)">
                <svg width="11" height="8" viewBox="0 0 14 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="6" height="9" rx="1"/><rect x="7.5" y="0.5" width="6" height="9" rx="1"/></svg>
                1:1
              </button>
              <button type="button" class="dim-pill-btn ${layout === 'single' ? 'active' : ''}" onclick="setWatchoutPhotoLayout(${i}, 'single');event.stopPropagation()" title="Bố cục 1 ảnh to (100% - Xóa/ẩn ô phụ)">
                <svg width="11" height="8" viewBox="0 0 14 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="13" height="9" rx="1"/></svg>
                1 ảnh
              </button>
              <span style="display:inline-block; width:1px; height:10px; background:#d0d7d2; margin:0 1px;"></span>
              ${getPhotoSizePillHtml('watchoutPhotos', i, size)}
            </div>
            <button type="button" class="pact del ignore-drag" style="position:static; width:19px; height:19px; border-radius:4px; display:inline-flex; align-items:center; justify-content:center;" title="Xóa ô Watch Out này" onclick="delFreeSlot('watchoutPhotos', ${i});event.stopPropagation()">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </div>

        <!-- CỤM ẢNH: 3:1, 1:1 HOẶC SINGLE (16:9 FIXED HEIGHT) -->
        <div class="dim-photo-container" data-layout="${layout}">
          <!-- ẢNH CHÍNH -->
          <div class="dim-main-photo" id="wph_main_${i}" title="Kéo thả hoặc nhấn Ctrl+V để dán ảnh">
            ${displayImg ? `<img src="${displayImg}" onclick="editWatchoutPhoto(${i}, 'main');event.stopPropagation()" style="cursor:pointer;" title="Bấm để chỉnh sửa/cắt ảnh">
            <div class="pactions">
              ${getPhotoSizeActionBtnHtml('watchoutPhotos', i, size)}
              <button class="pact copy" title="Sao chép toàn bộ ảnh gốc (Ctrl+C)" onclick="copyPhotoFromTarget(${targetMain});event.stopPropagation()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="pact del" title="Xóa ảnh" onclick="delWatchoutPhoto(${i}, 'main');event.stopPropagation()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
            </div>` : `
            <div class="dual-tap-box">
              <div class="tap-option" onclick="triggerNativeCamera(${targetMain})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-theme)" stroke-width="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>Chụp</span>
              </div>
              <div class="tap-option" onclick="triggerPickLibrary(${targetMain})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a3a6a" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Album</span>
              </div>
              <div class="tap-option" onclick="triggerPasteToTarget(${targetMain})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.8"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>
                <span>Dán</span>
              </div>
            </div>`}
          </div>

          <!-- ẢNH PHỤ CHI TIẾT (ẨN KHI Ở CHẾ ĐỘ SINGLE) -->
          ${layout !== 'single' ? `
          <div class="dim-sub-photo" id="wph_sub_${i}" title="Kéo thả hoặc nhấn Ctrl+V để dán ảnh">
            ${displayImgSub ? `<img src="${displayImgSub}" onclick="editWatchoutPhoto(${i}, 'sub');event.stopPropagation()" style="cursor:pointer;" title="Bấm để chỉnh sửa/cắt ảnh">
            <div class="pactions">
              <button class="pact copy" title="Sao chép toàn bộ ảnh gốc (Ctrl+C)" onclick="copyPhotoFromTarget(${targetSub});event.stopPropagation()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="pact del" title="Xóa ảnh phụ" onclick="delWatchoutPhoto(${i}, 'sub');event.stopPropagation()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
            </div>` : `
            <div class="dual-tap-box" ${layout === '3:1' ? 'style="flex-direction:column;"' : ''}>
              <div class="tap-option" ${layout === '3:1' ? 'style="border-right:none; border-bottom:1px dashed var(--border-light);"' : ''} title="Chụp ảnh mới" onclick="triggerNativeCamera(${targetSub})">
                <svg width="${layout === '1:1' ? '16' : '14'}" height="${layout === '1:1' ? '16' : '14'}" viewBox="0 0 24 24" fill="none" stroke="var(--brand-theme)" stroke-width="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                ${layout === '1:1' ? '<span style="font-size:10px; margin-left:2px;">Chụp</span>' : ''}
              </div>
              <div class="tap-option" title="Chọn từ Album" onclick="triggerPickLibrary(${targetSub})">
                <svg width="${layout === '1:1' ? '16' : '14'}" height="${layout === '1:1' ? '16' : '14'}" viewBox="0 0 24 24" fill="none" stroke="#1a3a6a" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                ${layout === '1:1' ? '<span style="font-size:10px; margin-left:2px;">Album</span>' : ''}
              </div>
              <div class="tap-option" title="Dán ảnh từ Clipboard (Ctrl+V)" onclick="triggerPasteToTarget(${targetSub})">
                <svg width="${layout === '1:1' ? '16' : '14'}" height="${layout === '1:1' ? '16' : '14'}" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.8"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>
                ${layout === '1:1' ? '<span style="font-size:10px; margin-left:2px;">Dán</span>' : ''}
              </div>
            </div>`}
          </div>` : ''}
        </div>

        <!-- PHẦN CHÚ THÍCH (CAPTION) BÊN DƯỚI -->
        <div class="watchout-caption-box ignore-drag">
          <textarea class="watchout-caption-input ignore-drag" rows="2" placeholder="Ghi chú điểm lưu ý chất lượng (Quality Watch Out)..." oninput="updateCaption('watchoutPhotos', ${i}, this.value, this)">${escapeHtml(p ? (p.caption || '') : '')}</textarea>
        </div>`;

        const mainPhotoEl = div.querySelector('.dim-main-photo');
        const subPhotoEl = div.querySelector('.dim-sub-photo');
        if (mainPhotoEl) attachDropZone(mainPhotoEl, { type: 'free', key: 'watchoutPhotos', index: i, subType: 'main' });
        if (subPhotoEl && layout !== 'single') attachDropZone(subPhotoEl, { type: 'free', key: 'watchoutPhotos', index: i, subType: 'sub' });

        el.appendChild(div);

        const wta = div.querySelector('textarea.watchout-caption-input');
        if (wta && p && p.caption) autoGrowTextarea(wta);
      });

      const addBtn = document.createElement('div');
      addBtn.className = 'add-photo-btn ignore-drag';
      addBtn.title = 'Bấm để thêm ô Quality Watch Out, kéo thả hoặc nhấn Ctrl+V để dán ảnh';
      addBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span style="color:var(--accent); font-weight:600; margin-top:2px;">THÊM ĐIỂM WATCH OUT</span><span style="font-size:9px; color:var(--muted); font-weight:normal;">Kéo thả hoặc Ctrl+V để dán</span>`;
      addBtn.onclick = () => {
        pushHistory('Thêm ô Quality Watch Out');
        if (!D.watchoutPhotos) D.watchoutPhotos = [];
        D.watchoutPhotos.push({ img: null, original: null, imgSub: null, originalSub: null, photoLayout: 'single', caption: '' });
        as();
        renderWatchoutPhotos();
      };
      attachDropZone(addBtn, { type: 'free', key: 'watchoutPhotos' }, true);
      el.appendChild(addBtn);

      if (typeof Sortable !== 'undefined') {
        if (el._sortable) el._sortable.destroy();
        el._sortable = new Sortable(el, {
          animation: 180,
          delay: 200,
          delayOnTouchOnly: true,
          touchStartThreshold: 5,
          draggable: '.watchout-slot',
          handle: '.dim-slot-topbar, .dim-drag-handle',
          filter: 'input, textarea, select, button, .dim-layout-pills, .dim-pill-btn, .dim-close-sub-btn, .ignore-drag, .watchout-caption-box, .watchout-caption-input',
          preventOnFilter: false,
          swap: true,
          swapClass: 'sortable-swap-highlight',
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          dragClass: 'sortable-chosen',
          onEnd: function (evt) {
            if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
            if (evt.oldIndex === evt.newIndex) return;
            if (!D.watchoutPhotos || !D.watchoutPhotos.length) return;
            const total = D.watchoutPhotos.length;
            let from = evt.oldIndex;
            let to = evt.newIndex;
            if (from >= total) from = total - 1;
            if (to >= total) to = total - 1;
            if (from === to) {
              renderWatchoutPhotos();
              return;
            }
            pushHistory('Hoán đổi vị trí Quality Watch Out');
            const temp = D.watchoutPhotos[from];
            D.watchoutPhotos[from] = D.watchoutPhotos[to];
            D.watchoutPhotos[to] = temp;
            as();
            renderWatchoutPhotos();
          }
        });
      }
    }

    function setWatchoutPhotoLayout(index, layout) {
      if (!D.watchoutPhotos) D.watchoutPhotos = [];
      if (!D.watchoutPhotos[index]) D.watchoutPhotos[index] = { caption: '' };
      pushHistory('Đổi bố cục ảnh Watch Out');
      D.watchoutPhotos[index].photoLayout = layout;
      as();
      renderWatchoutPhotos();
    }

    function removeWatchoutSubPhoto(index) {
      if (!D.watchoutPhotos || !D.watchoutPhotos[index]) return;
      if (D.watchoutPhotos[index].imgSub) {
        if (!confirm('Bạn có muốn xóa ô ảnh phụ và chuyển sang bố cục 1 ảnh không? (Ảnh phụ sẽ được ẩn đi)')) return;
      }
      setWatchoutPhotoLayout(index, 'single');
    }

    function editWatchoutPhoto(index, subType = 'main') {
      const p = D.watchoutPhotos && D.watchoutPhotos[index];
      if (!p) return;
      const origKey = subType === 'sub' ? 'originalSub' : 'original';
      const imgKey = subType === 'sub' ? 'imgSub' : 'img';
      const orig = p[origKey] || p[imgKey];
      const fallback = p[imgKey] || null;
      if (!orig && !fallback) return;
      currentOriginalImg = orig || fallback;
      camTarget = { type: 'free', key: 'watchoutPhotos', index, subType };
      initCropper(orig || fallback, fallback !== orig ? fallback : null);
    }

    function delWatchoutPhoto(index, subType = 'main') {
      if (!confirm('Xóa ảnh này?')) return;
      pushHistory(subType === 'sub' ? 'Xóa ảnh phụ Watch Out' : 'Xóa ảnh chính Watch Out');
      if (D.watchoutPhotos && D.watchoutPhotos[index]) {
        if (subType === 'sub') {
          D.watchoutPhotos[index].imgSub = null;
          D.watchoutPhotos[index].originalSub = null;
        } else {
          D.watchoutPhotos[index].img = null;
          D.watchoutPhotos[index].original = null;
        }
      }
      as();
      renderWatchoutPhotos();
    }

    function renderTestingPhotos() {
      const el = document.getElementById('testingPhotos'); if (!el) return; el.innerHTML = '';
      const arr = D.testingPhotos || [];

      arr.forEach((p, i) => {
        const size = getPhotoSize(p);
        const isFull = (size === 'full');
        const div = document.createElement('div');
        div.className = 'testing-slot watchout-slot' + (isFull ? ' is-fullwidth' : '');
        div.dataset.index = String(i);

        const layout = (p && p.photoLayout) || (p && p.imgSub ? '3:1' : 'single');
        const targetMain = `{type:'free',key:'testingPhotos',index:${i},subType:'main'}`;
        const targetSub = `{type:'free',key:'testingPhotos',index:${i},subType:'sub'}`;

        const displayImg = p && p.img ? p.img : null;
        const displayImgSub = p && p.imgSub ? p.imgSub : null;

        const defaultCaption = (D.bvRows && D.bvRows[i] && D.bvRows[i].test) ? D.bvRows[i].test.trim() : '';
        const actualCaption = (p && p.caption !== undefined && p.caption !== null && p.caption !== '') 
          ? p.caption 
          : defaultCaption;

        div.innerHTML = `
        <!-- THANH TOPBAR VỚI DRAG-HANDLE VÀ CHỌN BỐ CỤC ẢNH (3:1, 1:1, 1 ẢNH) -->
        <div class="dim-slot-topbar" title="Kéo thả thanh này để hoán đổi vị trí">
          <span class="dim-drag-handle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
            #${i + 1}
          </span>
          <div style="display:inline-flex; align-items:center; gap:6px;">
            <div class="dim-layout-pills ignore-drag">
              <button type="button" class="dim-pill-btn ${layout === '3:1' ? 'active' : ''}" onclick="setTestingPhotoLayout(${i}, '3:1');event.stopPropagation()" title="Bố cục 3:1 (Ảnh chính 75% + Phụ 25%)">
                <svg width="11" height="8" viewBox="0 0 14 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="8.5" height="9" rx="1"/><rect x="10" y="0.5" width="3.5" height="9" rx="1"/></svg>
                3:1
              </button>
              <button type="button" class="dim-pill-btn ${layout === '1:1' ? 'active' : ''}" onclick="setTestingPhotoLayout(${i}, '1:1');event.stopPropagation()" title="Bố cục 1:1 (2 ảnh bằng nhau 50% - 50%)">
                <svg width="11" height="8" viewBox="0 0 14 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="6" height="9" rx="1"/><rect x="7.5" y="0.5" width="6" height="9" rx="1"/></svg>
                1:1
              </button>
              <button type="button" class="dim-pill-btn ${layout === 'single' ? 'active' : ''}" onclick="setTestingPhotoLayout(${i}, 'single');event.stopPropagation()" title="Bố cục 1 ảnh to (100% - Xóa/ẩn ô phụ)">
                <svg width="11" height="8" viewBox="0 0 14 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="13" height="9" rx="1"/></svg>
                1 ảnh
              </button>
              <span style="display:inline-block; width:1px; height:10px; background:#d0d7d2; margin:0 1px;"></span>
              ${getPhotoSizePillHtml('testingPhotos', i, size)}
            </div>
            <button type="button" class="pact del ignore-drag" style="position:static; width:19px; height:19px; border-radius:4px; display:inline-flex; align-items:center; justify-content:center;" title="Xóa ô Testing này" onclick="delFreeSlot('testingPhotos', ${i});event.stopPropagation()">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </div>

        <!-- CỤM ẢNH: 3:1, 1:1 HOẶC SINGLE (16:9 FIXED HEIGHT) -->
        <div class="dim-photo-container" data-layout="${layout}">
          <!-- ẢNH CHÍNH -->
          <div class="dim-main-photo" id="tph_main_${i}" title="Kéo thả hoặc nhấn Ctrl+V để dán ảnh">
            ${displayImg ? `<img src="${displayImg}" onclick="editTestingPhoto(${i}, 'main');event.stopPropagation()" style="cursor:pointer;" title="Bấm để chỉnh sửa/cắt ảnh">
            <div class="pactions">
              ${getPhotoSizeActionBtnHtml('testingPhotos', i, size)}
              <button class="pact copy" title="Sao chép toàn bộ ảnh gốc (Ctrl+C)" onclick="copyPhotoFromTarget(${targetMain});event.stopPropagation()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="pact del" title="Xóa ảnh" onclick="delTestingPhoto(${i}, 'main');event.stopPropagation()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
            </div>` : `
            <div class="dual-tap-box">
              <div class="tap-option" onclick="triggerNativeCamera(${targetMain})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-theme)" stroke-width="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>Chụp</span>
              </div>
              <div class="tap-option" onclick="triggerPickLibrary(${targetMain})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a3a6a" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Album</span>
              </div>
              <div class="tap-option" onclick="triggerPasteToTarget(${targetMain})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.8"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>
                <span>Dán</span>
              </div>
            </div>`}
          </div>

          <!-- ẢNH PHỤ CHI TIẾT (ẨN KHI Ở CHẾ ĐỘ SINGLE) -->
          ${layout !== 'single' ? `
          <div class="dim-sub-photo" id="tph_sub_${i}" title="Kéo thả hoặc nhấn Ctrl+V để dán ảnh">
            ${displayImgSub ? `<img src="${displayImgSub}" onclick="editTestingPhoto(${i}, 'sub');event.stopPropagation()" style="cursor:pointer;" title="Bấm để chỉnh sửa/cắt ảnh">
            <div class="pactions">
              <button class="pact copy" title="Sao chép toàn bộ ảnh gốc (Ctrl+C)" onclick="copyPhotoFromTarget(${targetSub});event.stopPropagation()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="pact del" title="Xóa ảnh phụ" onclick="delTestingPhoto(${i}, 'sub');event.stopPropagation()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
            </div>` : `
            <div class="dual-tap-box" style="flex-direction: column;">
              <div class="tap-option" onclick="triggerNativeCamera(${targetSub})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-theme)" stroke-width="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>Chụp</span>
              </div>
              <div class="tap-option" onclick="triggerPickLibrary(${targetSub})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a3a6a" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Album</span>
              </div>
              <div class="tap-option" onclick="triggerPasteToTarget(${targetSub})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.8"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>
                <span>Dán</span>
              </div>
            </div>`}
          </div>` : ''}
        </div>

        <!-- Ô NHẬP CHÚ THÍCH (CAPTION) KHÔNG BỊ SORTABLEJS KÉO THẺ -->
        <div class="watchout-caption-box ignore-drag">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;">
            <span style="font-size:10px; font-weight:600; color:#8e8e93;">Chú thích ảnh:</span>
            <button type="button" class="sync-caption-btn" onclick="syncTestingPhotoCaption(${i})" title="Lấy theo dòng Test Property #${i + 1}">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
              <span>Lấy theo Test Property</span>
            </button>
          </div>
          <textarea class="watchout-caption-input ignore-drag" rows="2" placeholder="${escapeHtml(defaultCaption ? ('Mặc định: ' + defaultCaption) : 'Nhập chú thích thử nghiệm...')}" oninput="updateCaption('testingPhotos', ${i}, this.value, this)">${escapeHtml(actualCaption)}</textarea>
        </div>`;

        el.appendChild(div);

        const tta = div.querySelector('textarea.watchout-caption-input');
        if (tta && actualCaption) autoGrowTextarea(tta);

        const mainPhotoEl = div.querySelector(`#tph_main_${i}`);
        const subPhotoEl = div.querySelector(`#tph_sub_${i}`);
        if (mainPhotoEl) attachDropZone(mainPhotoEl, { type: 'free', key: 'testingPhotos', index: i, subType: 'main' });
        if (subPhotoEl && layout !== 'single') attachDropZone(subPhotoEl, { type: 'free', key: 'testingPhotos', index: i, subType: 'sub' });
      });

      const addBtn = document.createElement('div');
      addBtn.className = 'add-photo-btn ignore-drag';
      addBtn.title = 'Bấm để thêm ô Testing Photo, kéo thả hoặc nhấn Ctrl+V để dán ảnh';
      addBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span style="color:var(--accent); font-weight:600; margin-top:2px;">THÊM ẢNH THỬ NGHIỆM</span><span style="font-size:9px; color:var(--muted); font-weight:normal;">Kéo thả hoặc Ctrl+V để dán</span>`;
      addBtn.onclick = () => {
        pushHistory('Thêm ô Testing Photo');
        if (!D.testingPhotos) D.testingPhotos = [];
        const newIdx = D.testingPhotos.length;
        const defaultCaption = (D.bvRows && D.bvRows[newIdx] && D.bvRows[newIdx].test) ? D.bvRows[newIdx].test.trim() : '';
        D.testingPhotos.push({ img: null, original: null, imgSub: null, originalSub: null, photoLayout: 'single', caption: defaultCaption });
        as();
        renderTestingPhotos();
      };
      attachDropZone(addBtn, { type: 'free', key: 'testingPhotos' }, true);
      el.appendChild(addBtn);

      if (typeof Sortable !== 'undefined') {
        if (el._sortable) el._sortable.destroy();
        el._sortable = new Sortable(el, {
          animation: 180,
          delay: 200,
          delayOnTouchOnly: true,
          touchStartThreshold: 5,
          draggable: '.testing-slot',
          handle: '.dim-slot-topbar, .dim-drag-handle',
          filter: 'input, textarea, select, button, .dim-layout-pills, .dim-pill-btn, .dim-close-sub-btn, .ignore-drag, .watchout-caption-box, .watchout-caption-input',
          preventOnFilter: false,
          swap: true,
          swapClass: 'sortable-swap-highlight',
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          dragClass: 'sortable-chosen',
          onEnd: function (evt) {
            if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
            if (evt.oldIndex === evt.newIndex) return;
            if (!D.testingPhotos || !D.testingPhotos.length) return;
            const total = D.testingPhotos.length;
            let from = evt.oldIndex;
            let to = evt.newIndex;
            if (from >= total) from = total - 1;
            if (to >= total) to = total - 1;
            if (from === to) {
              renderTestingPhotos();
              return;
            }
            pushHistory('Hoán đổi vị trí Testing Photo');
            const temp = D.testingPhotos[from];
            D.testingPhotos[from] = D.testingPhotos[to];
            D.testingPhotos[to] = temp;
            as();
            renderTestingPhotos();
          }
        });
      }
    }

    function syncTestingPhotoCaption(index) {
      if (!D.testingPhotos) D.testingPhotos = [];
      if (!D.testingPhotos[index]) D.testingPhotos[index] = {};
      const targetTest = (D.bvRows && D.bvRows[index] && D.bvRows[index].test) ? D.bvRows[index].test.trim() : '';
      if (!targetTest) {
        showToast && showToast('Không tìm thấy dòng Test Property #' + (index + 1));
        return;
      }
      pushHistory('Đồng bộ chú thích ảnh Testing theo Test Property');
      D.testingPhotos[index].caption = targetTest;
      as();
      renderTestingPhotos();
    }

    function setTestingPhotoLayout(index, layout) {
      if (!D.testingPhotos) D.testingPhotos = [];
      if (!D.testingPhotos[index]) D.testingPhotos[index] = { caption: '' };
      pushHistory('Đổi bố cục ảnh Testing');
      D.testingPhotos[index].photoLayout = layout;
      as();
      renderTestingPhotos();
    }

    function removeTestingSubPhoto(index) {
      if (!D.testingPhotos || !D.testingPhotos[index]) return;
      if (D.testingPhotos[index].imgSub) {
        if (!confirm('Bạn có muốn xóa ô ảnh phụ và chuyển sang bố cục 1 ảnh không? (Ảnh phụ sẽ được ẩn đi)')) return;
      }
      setTestingPhotoLayout(index, 'single');
    }

    function editTestingPhoto(index, subType = 'main') {
      const p = D.testingPhotos && D.testingPhotos[index];
      if (!p) return;
      const origKey = subType === 'sub' ? 'originalSub' : 'original';
      const imgKey = subType === 'sub' ? 'imgSub' : 'img';
      const orig = p[origKey] || p[imgKey];
      const fallback = p[imgKey] || null;
      if (!orig && !fallback) return;
      currentOriginalImg = orig || fallback;
      camTarget = { type: 'free', key: 'testingPhotos', index, subType };
      initCropper(orig || fallback, fallback !== orig ? fallback : null);
    }

    function delTestingPhoto(index, subType = 'main') {
      if (!confirm('Xóa ảnh này?')) return;
      pushHistory(subType === 'sub' ? 'Xóa ảnh phụ Testing' : 'Xóa ảnh chính Testing');
      if (D.testingPhotos && D.testingPhotos[index]) {
        if (subType === 'sub') {
          D.testingPhotos[index].imgSub = null;
          D.testingPhotos[index].originalSub = null;
        } else {
          D.testingPhotos[index].img = null;
          D.testingPhotos[index].original = null;
        }
      }
      as();
      renderTestingPhotos();
    }

    function renderAssemblyPhotos() {
      const el = document.getElementById('assemblyPhotos'); if (!el) return; el.innerHTML = '';
      const arr = D.assemblyPhotos || [];

      arr.forEach((p, i) => {
        const size = getPhotoSize(p);
        const isFull = (size === 'full');
        const div = document.createElement('div');
        div.className = 'assembly-slot watchout-slot' + (isFull ? ' is-fullwidth' : '');
        div.dataset.index = String(i);

        const layout = (p && p.photoLayout) || (p && p.imgSub ? '3:1' : 'single');
        const targetMain = `{type:'free',key:'assemblyPhotos',index:${i},subType:'main'}`;
        const targetSub = `{type:'free',key:'assemblyPhotos',index:${i},subType:'sub'}`;

        const displayImg = p ? (typeof p === 'string' ? p : (p.img || null)) : null;
        const displayImgSub = p && p.imgSub ? p.imgSub : null;

        div.innerHTML = `
        <!-- THANH TOPBAR VỚI DRAG-HANDLE VÀ CHỌN BỐ CỤC ẢNH (3:1, 1:1, 1 ẢNH) -->
        <div class="dim-slot-topbar" title="Kéo thả thanh này để hoán đổi vị trí">
          <span class="dim-drag-handle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
            #${i + 1}
          </span>
          <div style="display:inline-flex; align-items:center; gap:6px;">
            <div class="dim-layout-pills ignore-drag">
              <button type="button" class="dim-pill-btn ${layout === '3:1' ? 'active' : ''}" onclick="setAssemblyPhotoLayout(${i}, '3:1');event.stopPropagation()" title="Bố cục 3:1 (Ảnh chính 75% + Phụ 25%)">
                <svg width="11" height="8" viewBox="0 0 14 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="8.5" height="9" rx="1"/><rect x="10" y="0.5" width="3.5" height="9" rx="1"/></svg>
                3:1
              </button>
              <button type="button" class="dim-pill-btn ${layout === '1:1' ? 'active' : ''}" onclick="setAssemblyPhotoLayout(${i}, '1:1');event.stopPropagation()" title="Bố cục 1:1 (2 ảnh bằng nhau 50% - 50%)">
                <svg width="11" height="8" viewBox="0 0 14 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="6" height="9" rx="1"/><rect x="7.5" y="0.5" width="6" height="9" rx="1"/></svg>
                1:1
              </button>
              <button type="button" class="dim-pill-btn ${layout === 'single' ? 'active' : ''}" onclick="setAssemblyPhotoLayout(${i}, 'single');event.stopPropagation()" title="Bố cục 1 ảnh to (100% - Xóa/ẩn ô phụ)">
                <svg width="11" height="8" viewBox="0 0 14 10" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="13" height="9" rx="1"/></svg>
                1 ảnh
              </button>
              <span style="display:inline-block; width:1px; height:10px; background:#d0d7d2; margin:0 1px;"></span>
              ${getPhotoSizePillHtml('assemblyPhotos', i, size)}
            </div>
            <button type="button" class="pact del ignore-drag" style="position:static; width:19px; height:19px; border-radius:4px; display:inline-flex; align-items:center; justify-content:center;" title="Xóa ô Assembly này" onclick="delFreeSlot('assemblyPhotos', ${i});event.stopPropagation()">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </div>

        <!-- CỤM ẢNH: 3:1, 1:1 HOẶC SINGLE (16:9 FIXED HEIGHT) -->
        <div class="dim-photo-container" data-layout="${layout}">
          <!-- ẢNH CHÍNH -->
          <div class="dim-main-photo" id="asph_main_${i}" title="Kéo thả hoặc nhấn Ctrl+V để dán ảnh">
            ${displayImg ? `<img src="${displayImg}" onclick="editAssemblyPhoto(${i}, 'main');event.stopPropagation()" style="cursor:pointer;" title="Bấm để chỉnh sửa/cắt ảnh">
            <div class="pactions">
              ${getPhotoSizeActionBtnHtml('assemblyPhotos', i, size)}
              <button class="pact copy" title="Sao chép toàn bộ ảnh gốc (Ctrl+C)" onclick="copyPhotoFromTarget(${targetMain});event.stopPropagation()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="pact del" title="Xóa ảnh" onclick="delAssemblyPhoto(${i}, 'main');event.stopPropagation()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
            </div>` : `
            <div class="dual-tap-box">
              <div class="tap-option" onclick="triggerNativeCamera(${targetMain})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-theme)" stroke-width="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>Chụp</span>
              </div>
              <div class="tap-option" onclick="triggerPickLibrary(${targetMain})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a3a6a" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Album</span>
              </div>
              <div class="tap-option" onclick="triggerPasteToTarget(${targetMain})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.8"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>
                <span>Dán</span>
              </div>
            </div>`}
          </div>

          <!-- ẢNH PHỤ CHI TIẾT (ẨN KHI Ở CHẾ ĐỘ SINGLE) -->
          ${layout !== 'single' ? `
          <div class="dim-sub-photo" id="asph_sub_${i}" title="Kéo thả hoặc nhấn Ctrl+V để dán ảnh">
            ${displayImgSub ? `<img src="${displayImgSub}" onclick="editAssemblyPhoto(${i}, 'sub');event.stopPropagation()" style="cursor:pointer;" title="Bấm để chỉnh sửa/cắt ảnh">
            <div class="pactions">
              <button class="pact copy" title="Sao chép toàn bộ ảnh gốc (Ctrl+C)" onclick="copyPhotoFromTarget(${targetSub});event.stopPropagation()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              <button class="pact del" title="Xóa ảnh phụ" onclick="delAssemblyPhoto(${i}, 'sub');event.stopPropagation()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
            </div>` : `
            <div class="dual-tap-box" ${layout === '3:1' ? 'style="flex-direction:column;"' : ''}>
              <div class="tap-option" ${layout === '3:1' ? 'style="border-right:none; border-bottom:1px dashed var(--border-light);"' : ''} title="Chụp ảnh mới" onclick="triggerNativeCamera(${targetSub})">
                <svg width="${layout === '1:1' ? '16' : '14'}" height="${layout === '1:1' ? '16' : '14'}" viewBox="0 0 24 24" fill="none" stroke="var(--brand-theme)" stroke-width="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                ${layout === '1:1' ? '<span style="font-size:10px; margin-left:2px;">Chụp</span>' : ''}
              </div>
              <div class="tap-option" title="Chọn từ Album" onclick="triggerPickLibrary(${targetSub})">
                <svg width="${layout === '1:1' ? '16' : '14'}" height="${layout === '1:1' ? '16' : '14'}" viewBox="0 0 24 24" fill="none" stroke="#1a3a6a" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                ${layout === '1:1' ? '<span style="font-size:10px; margin-left:2px;">Album</span>' : ''}
              </div>
              <div class="tap-option" title="Dán ảnh từ Clipboard (Ctrl+V)" onclick="triggerPasteToTarget(${targetSub})">
                <svg width="${layout === '1:1' ? '16' : '14'}" height="${layout === '1:1' ? '16' : '14'}" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.8"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>
                ${layout === '1:1' ? '<span style="font-size:10px; margin-left:2px;">Dán</span>' : ''}
              </div>
            </div>`}
          </div>` : ''}
        </div>

        <!-- PHẦN CHÚ THÍCH (CAPTION) BÊN DƯỚI -->
        <div class="assembly-caption-box watchout-caption-box ignore-drag">
          <textarea class="assembly-caption-input watchout-caption-input ignore-drag" rows="2" placeholder="Ghi chú bước lắp ráp (Assembly instructions, steps, hardware)..." oninput="updateCaption('assemblyPhotos', ${i}, this.value, this)">${escapeHtml(p ? (p.caption || '') : '')}</textarea>
        </div>`;

        const mainPhotoEl = div.querySelector('.dim-main-photo');
        const subPhotoEl = div.querySelector('.dim-sub-photo');
        if (mainPhotoEl) attachDropZone(mainPhotoEl, { type: 'free', key: 'assemblyPhotos', index: i, subType: 'main' });
        if (subPhotoEl && layout !== 'single') attachDropZone(subPhotoEl, { type: 'free', key: 'assemblyPhotos', index: i, subType: 'sub' });

        el.appendChild(div);

        const ata = div.querySelector('textarea.assembly-caption-input');
        if (ata && p && p.caption) autoGrowTextarea(ata);
      });

      const addBtn = document.createElement('div');
      addBtn.className = 'add-photo-btn ignore-drag';
      addBtn.title = 'Bấm để thêm ô Assembly, kéo thả hoặc nhấn Ctrl+V để dán ảnh';
      addBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span style="color:var(--accent); font-weight:600; margin-top:2px;">THÊM BƯỚC LẮP RÁP</span><span style="font-size:9px; color:var(--muted); font-weight:normal;">Kéo thả hoặc Ctrl+V để dán</span>`;
      addBtn.onclick = () => {
        pushHistory('Thêm ô Assembly');
        if (!D.assemblyPhotos) D.assemblyPhotos = [];
        D.assemblyPhotos.push({ img: null, original: null, imgSub: null, originalSub: null, photoLayout: 'single', caption: '' });
        as();
        renderAssemblyPhotos();
      };
      attachDropZone(addBtn, { type: 'free', key: 'assemblyPhotos' }, true);
      el.appendChild(addBtn);

      if (typeof Sortable !== 'undefined') {
        if (el._sortable) el._sortable.destroy();
        el._sortable = new Sortable(el, {
          animation: 180,
          delay: 200,
          delayOnTouchOnly: true,
          touchStartThreshold: 5,
          draggable: '.assembly-slot',
          handle: '.dim-slot-topbar, .dim-drag-handle',
          filter: 'input, textarea, select, button, .dim-layout-pills, .dim-pill-btn, .dim-close-sub-btn, .ignore-drag, .watchout-caption-box, .watchout-caption-input, .assembly-caption-box, .assembly-caption-input',
          preventOnFilter: false,
          swap: true,
          swapClass: 'sortable-swap-highlight',
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          dragClass: 'sortable-chosen',
          onEnd: function (evt) {
            if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
            if (evt.oldIndex === evt.newIndex) return;
            if (!D.assemblyPhotos || !D.assemblyPhotos.length) return;
            const total = D.assemblyPhotos.length;
            let from = evt.oldIndex;
            let to = evt.newIndex;
            if (from >= total) from = total - 1;
            if (to >= total) to = total - 1;
            if (from === to) {
              renderAssemblyPhotos();
              return;
            }
            pushHistory('Hoán đổi vị trí Assembly Photo');
            const temp = D.assemblyPhotos[from];
            D.assemblyPhotos[from] = D.assemblyPhotos[to];
            D.assemblyPhotos[to] = temp;
            as();
            renderAssemblyPhotos();
          }
        });
      }
    }

    function setAssemblyPhotoLayout(index, layout) {
      if (!D.assemblyPhotos) D.assemblyPhotos = [];
      if (!D.assemblyPhotos[index]) D.assemblyPhotos[index] = { caption: '' };
      pushHistory('Đổi bố cục ảnh Assembly');
      D.assemblyPhotos[index].photoLayout = layout;
      as();
      renderAssemblyPhotos();
    }

    function removeAssemblySubPhoto(index) {
      if (!D.assemblyPhotos || !D.assemblyPhotos[index]) return;
      if (D.assemblyPhotos[index].imgSub) {
        if (!confirm('Bạn có muốn xóa ô ảnh phụ và chuyển sang bố cục 1 ảnh không? (Ảnh phụ sẽ được ẩn đi)')) return;
      }
      setAssemblyPhotoLayout(index, 'single');
    }

    function editAssemblyPhoto(index, subType = 'main') {
      const p = D.assemblyPhotos && D.assemblyPhotos[index];
      if (!p) return;
      const imgSrc = subType === 'sub' ? (p.originalSub || p.imgSub) : (p.original || p.img);
      if (!imgSrc) return;
      currentOriginalImg = imgSrc;
      camTarget = { type: 'free', key: 'assemblyPhotos', index, subType };
      initCropper(imgSrc);
    }

    function delAssemblyPhoto(index, subType = 'main') {
      if (!confirm('Xóa ảnh này?')) return;
      pushHistory(subType === 'sub' ? 'Xóa ảnh phụ Assembly' : 'Xóa ảnh chính Assembly');
      if (D.assemblyPhotos && D.assemblyPhotos[index]) {
        if (subType === 'sub') {
          D.assemblyPhotos[index].imgSub = null;
          D.assemblyPhotos[index].originalSub = null;
        } else {
          D.assemblyPhotos[index].img = null;
          D.assemblyPhotos[index].original = null;
        }
      }
      as();
      renderAssemblyPhotos();
    }


    function autoGrowTextarea(textareaEl) {
      if (!textareaEl) return;
      try {
        textareaEl.style.height = 'auto';
        textareaEl.style.height = Math.max(textareaEl.scrollHeight, 24) + 'px';
      } catch (e) {}
    }

    function updateCaption(key, i, val, el) {
      if (!D[key]) return;
      if (!D[key][i]) D[key][i] = {};
      D[key][i].caption = val;
      if (el) {
        autoGrowTextarea(el);
      }
      as();
    }
    function delFreePhoto(key, i) {
      if (!confirm('Bạn có chắc muốn xóa ảnh này?')) return;
      pushHistory('Xóa ảnh');
      if (D[key] && D[key][i]) {
        const size = getPhotoSize(D[key][i]);
        D[key][i] = { photoSize: size, fullWidth: (size === 'full'), caption: '' };
      } else {
        D[key][i] = null;
      }
      renderFreePhotos(key);
      as();
    }
    function delFreeSlot(key, i) { pushHistory('Xóa ô ảnh'); D[key].splice(i, 1); renderFreePhotos(key); as(); }

    function renderBVTable() {
      const tbody = document.getElementById('bvBody'); if (!tbody) return; tbody.innerHTML = '';
      (D.bvRows || []).forEach((row, i) => {
        const isPass = row.result === 'pass';
        const isFail = row.result === 'fail';
        const isPending = row.result === 'pending' || row.result === 'na';
        const tr = document.createElement('tr');
        tr.dataset.index = i;
        tr.innerHTML = `<td style="text-align:center; padding: 4px 6px;">
          <div class="bv-drag-handle" title="Kéo thả để đổi thứ tự hàng">⠿</div>
        </td>
        <td><input type="text" class="ignore-drag" value="${escapeHtml(row.test || '')}" placeholder="Test property..." oninput="saveBV(${i},'test',this.value)"></td>
        <td><div class="result-sel ignore-drag">
          <button class="result-btn pass ${isPass ? 'on' : ''}" onclick="setBVResult(${i},'pass')">PASS</button>
          <button class="result-btn fail ${isFail ? 'on' : ''}" onclick="setBVResult(${i},'fail')">FAIL</button>
          <button class="result-btn pending ${isPending ? 'on' : ''}" onclick="setBVResult(${i},'pending')">PENDING</button>
        </div></td>
        <td><textarea class="bv-table-textarea ignore-drag" rows="1" placeholder="Remark..." oninput="saveBV(${i},'remark',this.value);autoGrowTextarea(this)">${escapeHtml(row.remark || '')}</textarea></td>
        <td style="text-align:center; padding: 4px 6px;">
          <button class="bv-del-btn" title="Xóa hàng này" onclick="delBVRow(${i})">✕</button>
        </td>`;
        tbody.appendChild(tr);
        const rta = tr.querySelector('textarea.bv-table-textarea');
        if (rta && row.remark) autoGrowTextarea(rta);
      });

      initBVSortable();
    }

    function initBVSortable() {
      const tbody = document.getElementById('bvBody');
      if (!tbody || typeof Sortable === 'undefined') return;

      if (tbody._bvSortable) {
        tbody._bvSortable.destroy();
      }

      tbody._bvSortable = new Sortable(tbody, {
        animation: 200,
        handle: '.bv-drag-handle',
        draggable: 'tr',
        filter: 'input, button, textarea, .ignore-drag',
        preventOnFilter: false,
        ghostClass: 'bv-row-ghost',
        chosenClass: 'bv-row-chosen',
        onEnd: function (evt) {
          if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) return;
          if (!D.bvRows || !D.bvRows.length) return;
          const moved = D.bvRows.splice(evt.oldIndex, 1)[0];
          D.bvRows.splice(evt.newIndex, 0, moved);
          pushHistory('Đổi thứ tự hàng thử nghiệm BV');
          renderBVTable();
          as();
        }
      });
    }

    function addBVRow() { pushHistory('Thêm hàng thử nghiệm BV'); if (!D.bvRows) D.bvRows = []; D.bvRows.push({ test: '', result: '', remark: '' }); renderBVTable(); as(); }
    function delBVRow(i) {
      if (!D.bvRows || !D.bvRows[i]) return;
      const row = D.bvRows[i];
      if (row.test || row.result || row.remark) {
        if (!confirm(`Bạn có chắc muốn xóa hàng "${row.test || 'thử nghiệm'}" này?`)) return;
      }
      pushHistory('Xóa hàng thử nghiệm BV');
      D.bvRows.splice(i, 1);
      renderBVTable();
      as();
    }
    function saveBV(i, field, val) { if (!D.bvRows || !D.bvRows[i]) return; D.bvRows[i][field] = val; as(); }
    function setBVResult(i, val) { 
      pushHistory('Đổi kết quả thử nghiệm BV'); 
      if (!D.bvRows || !D.bvRows[i]) return; 
      const current = D.bvRows[i].result;
      const isSame = current === val || (val === 'pending' && current === 'na');
      D.bvRows[i].result = isSame ? '' : val; 
      renderBVTable(); 
      as(); 
    }

    /* ════════════════════════════════════════════════════════════════════════════
       EXECUTIVE QUALITY METRICS / OVERVIEW SUMMARY STRIP
       ════════════════════════════════════════════════════════════════════════════ */
    function getReportQuickMetrics(data) {
      const d = data || D || {};
      
      // 1. Quality Watch-outs
      const watchPhotos = (d.watchoutPhotos || []).filter(p => p && (p.img || p.imgSub || (p.caption && p.caption.trim())));
      const watchCount = watchPhotos.length;

      // 2. Testing BV
      const bvList = (d.bvRows || []).filter(r => r && (r.test || r.result || r.remark));
      const totalTests = bvList.length;
      const failedTests = bvList.filter(r => r.result === 'fail').length;
      const passedTests = bvList.filter(r => r.result === 'pass').length;
      const pendingTests = bvList.filter(r => r.result === 'pending' || r.result === 'na').length;

      // 3. Checklist
      let totalCriteria = 0;
      let checkedCriteria = 0;
      let passCriteria = 0;
      let failCriteria = 0;
      const chkGroups = (d.checklist && Array.isArray(d.checklist)) ? d.checklist : [];
      chkGroups.forEach(g => {
        (g.items || []).forEach(it => {
          totalCriteria++;
          if (it.status === 'yes') { checkedCriteria++; passCriteria++; }
          else if (it.status === 'no') { checkedCriteria++; failCriteria++; }
        });
      });
      const pendingCriteria = totalCriteria - passCriteria; // Gom cả các mục No và các mục chưa tick

      // 4. Dimensions flagged
      const validDims = (d.dimensions || []).filter(dim => dim && (dim.img || dim.imgSub || dim.actual || dim.drawing));
      const redDims = validDims.filter(dim => dim.color === 'color-red').length;
      const orangeDims = validDims.filter(dim => dim.color === 'color-orange').length;

      return {
        watchCount,
        totalTests,
        failedTests,
        passedTests,
        pendingTests,
        totalCriteria,
        checkedCriteria,
        passCriteria,
        failCriteria,
        pendingCriteria,
        redDims,
        orangeDims
      };
    }

    function renderOverviewSummary() {
      const el = document.getElementById('overviewSummaryStrip');
      if (!el || !D) return;

      const m = getReportQuickMetrics(D);

      // Watch-out badge
      let watchBadge = '';
      if (m.watchCount > 0) {
        watchBadge = `<div class="summary-badge badge-danger">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span><b>${m.watchCount}</b> Quality Watch-out${m.watchCount > 1 ? 's' : ''}</span>
        </div>`;
      } else {
        watchBadge = `<div class="summary-badge badge-success">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>0 Watch-outs (Clean)</span>
        </div>`;
      }

      // Testing badge
      let testBadge = '';
      if (m.totalTests === 0) {
        testBadge = `<div class="summary-badge badge-neutral">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>No Lab Tests</span>
        </div>`;
      } else if (m.failedTests > 0) {
        testBadge = `<div class="summary-badge badge-danger">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span><b>${m.failedTests}/${m.totalTests}</b> Tests Failed</span>
        </div>`;
      } else if (m.passedTests === m.totalTests) {
        testBadge = `<div class="summary-badge badge-success">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>All Tests Passed (${m.passedTests}/${m.totalTests})</span>
        </div>`;
      } else {
        testBadge = `<div class="summary-badge badge-warning">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span><b>${m.passedTests}/${m.totalTests}</b> Passed · ${m.pendingTests || (m.totalTests - m.passedTests)} Pending</span>
        </div>`;
      }

      // Checklist badge
      let checkBadge = '';
      if (m.totalCriteria === 0) {
        checkBadge = `<div class="summary-badge badge-neutral"><span>Checklist: 0 Items</span></div>`;
      } else if (m.passCriteria === m.totalCriteria) {
        checkBadge = `<div class="summary-badge badge-success">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Checklist (${m.totalCriteria}/${m.totalCriteria})</span>
        </div>`;
      } else {
        const pendingCount = m.pendingCriteria !== undefined ? m.pendingCriteria : (m.totalCriteria - m.passCriteria);
        checkBadge = `<div class="summary-badge badge-warning">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>Checklist: <b>${m.passCriteria}/${m.totalCriteria}</b> (${pendingCount} Pending)</span>
        </div>`;
      }

      // Dimension status badge (optional but super valuable)
      let dimBadge = '';
      if (m.redDims > 0 || m.orangeDims > 0) {
        const totalIssue = m.redDims + m.orangeDims;
        dimBadge = `<div class="summary-badge badge-warning">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><b>${totalIssue}</b> Dim Issue${totalIssue > 1 ? 's' : ''}</span>
        </div>`;
      }

      el.innerHTML = `
        <div class="overview-summary-head">
          <span>Quality Summary</span>
          <span style="font-size:10px; font-weight:500; color:var(--muted)">Auto-calculated</span>
        </div>
        <div class="overview-summary-pills">
          ${watchBadge}
          ${testBadge}
          ${checkBadge}
          ${dimBadge}
        </div>
      `;
    }

    /* ════════════════════════════════════════════════════════════════════════════
       APPLE-STYLE CHECKLIST LOGIC & SORTABLE DRAG-DROP
       ════════════════════════════════════════════════════════════════════════════ */
    function getActiveDefaultChecklist() {
      try {
        const custom = localStorage.getItem('user_custom_default_checklist');
        if (custom) {
          const parsed = JSON.parse(custom);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
      return DEFAULT_CHECKLIST_CONFIG;
    }

    function ensureChecklistData() {
      if (!D.checklist || !Array.isArray(D.checklist) || D.checklist.length === 0) {
        D.checklist = JSON.parse(JSON.stringify(getActiveDefaultChecklist()));
      }
    }

    function escapeChecklistText(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderChecklist() {
      ensureChecklistData();
      const overviewEl = document.getElementById('checklistOverviewCard');
      const groupsEl = document.getElementById('checklistGroupsContainer');
      if (!overviewEl || !groupsEl) return;

      // Calculate statistics
      let totalCriteria = 0;
      let passCount = 0;
      let failCount = 0;
      let pendingCount = 0;

      D.checklist.forEach(g => {
        if (!g.items || !Array.isArray(g.items)) g.items = [];
        g.items.forEach(item => {
          totalCriteria++;
          if (item.status === 'yes') passCount++;
          else if (item.status === 'no') failCount++;
          else pendingCount++;
        });
      });

      const checkedCount = passCount + failCount;
      const pct = totalCriteria > 0 ? Math.round((checkedCount / totalCriteria) * 100) : 0;

      // Render Overview Card
      overviewEl.innerHTML = `
        <div class="apple-overview-header">
          <div class="apple-overview-title">
            <span>Tiêu Chuẩn Kiểm Tra (Checklist)</span>
            <span class="apple-pill-num" style="background:#e8f7ed; color:#1b7a37;">${D.checklist.length} Nhóm</span>
          </div>
          <div class="apple-overview-pct">${pct}% Hoàn thành</div>
        </div>
        <div class="apple-progress-wrap">
          <div class="apple-progress-bar" style="width: ${pct}%;"></div>
        </div>
        <div class="apple-status-chips">
          <div class="apple-chip chip-pass"><span class="apple-chip-dot"></span> Đạt: <strong>${passCount}</strong></div>
          <div class="apple-chip chip-fail"><span class="apple-chip-dot"></span> Pending: <strong>${failCount}</strong></div>
          <div class="apple-chip chip-pend"><span class="apple-chip-dot"></span> Chưa kiểm: <strong>${pendingCount}</strong> / ${totalCriteria}</div>
        </div>
        <div class="apple-overview-actions">
          <button class="apple-act-btn btn-pri" onclick="addCategoryGroup()">+ Thêm Nhóm</button>
          <button class="apple-act-btn btn-pass" onclick="setAllChecklistStatus('yes')">✓ Tick Tất Cả Yes</button>
          <button class="apple-act-btn btn-neutral" onclick="setAllChecklistStatus(null)">↺ Xóa Tất Cả Tick</button>
          <button class="apple-act-btn btn-sync" onclick="copyChecklistFromLatestReport()" title="Cập nhật bảng checklist từ báo cáo được lưu gần đây nhất">📥 Lấy Từ Báo Cáo Gần Nhất</button>
          <button class="apple-act-btn btn-subtle" onclick="saveCurrentChecklistAsDefault()" title="Lưu cấu trúc checklist này làm mẫu mặc định cho tất cả báo cáo tạo mới sau này">⭐ Lưu Làm Mẫu Mới</button>
          <button class="apple-act-btn btn-subtle" onclick="resetDefaultChecklist()">⚙ 13 Nhóm Gốc</button>
        </div>
      `;

      // Render Groups
      groupsEl.innerHTML = '';
      D.checklist.forEach((group, gIdx) => {
        const groupCard = document.createElement('div');
        groupCard.className = 'apple-group-card';
        groupCard.dataset.groupIndex = gIdx;

        // Header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'apple-group-header';
        headerDiv.innerHTML = `
          <div class="group-drag-handle" title="Kéo thả để đổi thứ tự nhóm">⋮⋮</div>
          <span class="apple-pill-num">${gIdx + 1}</span>
          <input type="text" class="group-title-input" value="${escapeChecklistText(group.title || '')}" placeholder="Nhập tên nhóm hạng mục..." oninput="updateCategoryTitle(${gIdx}, this.value)">
          <button class="group-del-btn" title="Xóa toàn bộ nhóm này" onclick="removeCategoryGroup(${gIdx})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>Xóa</span>
          </button>
        `;
        groupCard.appendChild(headerDiv);

        // Criteria List
        const criteriaListDiv = document.createElement('div');
        criteriaListDiv.className = 'apple-criteria-list';

        (group.items || []).forEach((item, iIdx) => {
          const isYes = item.status === 'yes';
          const isNo = item.status === 'no';

          const rowDiv = document.createElement('div');
          rowDiv.className = 'apple-criterion-row';
          rowDiv.innerHTML = `
            <span class="criterion-bullet">•</span>
            <input type="text" class="criterion-text-input" value="${escapeChecklistText(item.text || '')}" placeholder="Nhập nội dung tiêu chí kiểm tra..." oninput="updateCriterionText(${gIdx}, ${iIdx}, this.value)">
            <div class="apple-seg-toggle">
              <button class="apple-seg-btn ${isYes ? 'active-yes' : ''}" onclick="toggleChecklistStatus(${gIdx}, ${iIdx}, 'yes')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Yes</span>
              </button>
              <button class="apple-seg-btn ${isNo ? 'active-no' : ''}" onclick="toggleChecklistStatus(${gIdx}, ${iIdx}, 'no')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                <span>No</span>
              </button>
            </div>
            <button class="criterion-del-btn" title="Xóa tiêu chí này" onclick="removeCriterion(${gIdx}, ${iIdx})">✕</button>
          `;
          criteriaListDiv.appendChild(rowDiv);
        });

        groupCard.appendChild(criteriaListDiv);

        // Footer with Add Criterion
        const footerDiv = document.createElement('div');
        footerDiv.className = 'apple-group-footer';
        footerDiv.innerHTML = `
          <button class="apple-add-criterion-btn" onclick="addCriterion(${gIdx})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Thêm tiêu chí</span>
          </button>
        `;
        groupCard.appendChild(footerDiv);

        groupsEl.appendChild(groupCard);
      });

      // Initialize / Refresh SortableJS on groups container
      initChecklistSortable();
    }

    function initChecklistSortable() {
      const el = document.getElementById('checklistGroupsContainer');
      if (!el || typeof Sortable === 'undefined') return;

      if (el._checklistSortable) {
        el._checklistSortable.destroy();
      }

      el._checklistSortable = new Sortable(el, {
        animation: 220,
        handle: '.group-drag-handle',
        draggable: '.apple-group-card',
        filter: 'input, button, textarea',
        preventOnFilter: false,
        ghostClass: 'apple-sort-ghost',
        chosenClass: 'apple-sort-chosen',
        onEnd: function (evt) {
          if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) return;
          if (!D.checklist || !D.checklist.length) return;
          const moved = D.checklist.splice(evt.oldIndex, 1)[0];
          D.checklist.splice(evt.newIndex, 0, moved);
          pushHistory('Đổi thứ tự nhóm checklist');
          renderChecklist();
          as();
        }
      });
    }

    function updateCategoryTitle(gIdx, val) {
      if (!D.checklist || !D.checklist[gIdx]) return;
      D.checklist[gIdx].title = val;
      as();
    }

    function updateCriterionText(gIdx, iIdx, val) {
      if (!D.checklist || !D.checklist[gIdx] || !D.checklist[gIdx].items || !D.checklist[gIdx].items[iIdx]) return;
      D.checklist[gIdx].items[iIdx].text = val;
      as();
    }

    function toggleChecklistStatus(gIdx, iIdx, targetStatus) {
      if (!D.checklist || !D.checklist[gIdx] || !D.checklist[gIdx].items || !D.checklist[gIdx].items[iIdx]) return;
      const cur = D.checklist[gIdx].items[iIdx].status;
      D.checklist[gIdx].items[iIdx].status = (cur === targetStatus) ? null : targetStatus;
      pushHistory('Đổi trạng thái tick checklist');
      renderChecklist();
      as();
    }

    function addCriterion(gIdx) {
      if (!D.checklist || !D.checklist[gIdx]) return;
      if (!D.checklist[gIdx].items) D.checklist[gIdx].items = [];
      D.checklist[gIdx].items.push({
        id: 'ci_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        text: '',
        status: null
      });
      pushHistory('Thêm tiêu chí checklist');
      renderChecklist();
      as();

      // Focus on the newly added criterion input
      setTimeout(() => {
        const cards = document.querySelectorAll('.apple-group-card');
        if (cards[gIdx]) {
          const inputs = cards[gIdx].querySelectorAll('.criterion-text-input');
          if (inputs.length > 0) inputs[inputs.length - 1].focus();
        }
      }, 50);
    }

    function removeCriterion(gIdx, iIdx) {
      if (!D.checklist || !D.checklist[gIdx] || !D.checklist[gIdx].items) return;
      D.checklist[gIdx].items.splice(iIdx, 1);
      pushHistory('Xóa tiêu chí checklist');
      renderChecklist();
      as();
    }

    function addCategoryGroup() {
      ensureChecklistData();
      const newGroupNum = D.checklist.length + 1;
      D.checklist.push({
        id: 'cg_' + Date.now(),
        title: 'Hạng mục mới ' + newGroupNum,
        items: [
          { id: 'ci_' + Date.now() + '_1', text: '', status: null }
        ]
      });
      pushHistory('Thêm nhóm checklist mới');
      renderChecklist();
      as();

      // Scroll smoothly to the newly added group card
      setTimeout(() => {
        const cards = document.querySelectorAll('.apple-group-card');
        if (cards.length > 0) {
          const lastCard = cards[cards.length - 1];
          lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const titleInput = lastCard.querySelector('.group-title-input');
          if (titleInput) { titleInput.focus(); titleInput.select(); }
        }
      }, 80);
    }

    function removeCategoryGroup(gIdx) {
      if (!D.checklist || !D.checklist[gIdx]) return;
      const title = D.checklist[gIdx].title || `Nhóm ${gIdx + 1}`;
      if (!confirm(`Bạn có chắc muốn xóa nhóm "${title}" và toàn bộ tiêu chí bên trong?`)) return;
      D.checklist.splice(gIdx, 1);
      pushHistory('Xóa nhóm checklist');
      renderChecklist();
      as();
    }

    function setAllChecklistStatus(targetStatus) {
      ensureChecklistData();
      D.checklist.forEach(g => {
        (g.items || []).forEach(item => {
          item.status = targetStatus;
        });
      });
      pushHistory(targetStatus === 'yes' ? 'Tick tất cả Yes checklist' : 'Xóa tất cả tick checklist');
      renderChecklist();
      as();
    }

    async function copyChecklistFromLatestReport() {
      try {
        const allReports = await dbGetAll();
        if (!allReports || allReports.length === 0) {
          showToast('Chưa có báo cáo nào khác');
          return;
        }

        const otherReports = allReports.filter(r => String(r.id) !== String(currentId));
        if (otherReports.length === 0) {
          showToast('Không có báo cáo nào khác để sao chép');
          return;
        }

        // Sắp xếp báo cáo theo thời gian cập nhật mới nhất
        otherReports.sort((a, b) => {
          const timeA = a.updatedAt || parseInt(a.id) || 0;
          const timeB = b.updatedAt || parseInt(b.id) || 0;
          return timeB - timeA;
        });

        // Tìm báo cáo gần nhất có dữ liệu checklist
        const sourceReport = otherReports.find(r => r.checklist && Array.isArray(r.checklist) && r.checklist.length > 0);
        if (!sourceReport) {
          showToast('Không tìm thấy báo cáo nào có bảng checklist');
          return;
        }

        const sourceTitle = getReportTitle(sourceReport);
        const countGroups = sourceReport.checklist.length;
        let countItems = 0;
        sourceReport.checklist.forEach(g => countItems += (g.items ? g.items.length : 0));

        const confirmed = confirm(
          `Tìm thấy báo cáo lưu gần nhất:\n"${sourceTitle}" (${countGroups} nhóm, ${countItems} tiêu chí).\n\n` +
          `Bạn có muốn cập nhật bảng Checklist này vào báo cáo hiện tại không?`
        );
        if (!confirmed) return;

        const resetTicks = confirm(
          `Bạn có muốn LÀM MỚI các ô tick (đặt về chưa tick) để kiểm tra mẫu sản phẩm mới không?\n\n` +
          `• Chọn [OK]: Làm mới ô tick (Khuyên dùng khi bắt đầu kiểm tra mẫu mới)\n` +
          `• Chọn [Cancel]: Giữ nguyên kết quả tick từ báo cáo trước`
        );

        const cloned = JSON.parse(JSON.stringify(sourceReport.checklist));
        if (resetTicks) {
          cloned.forEach(g => {
            if (g.items && Array.isArray(g.items)) {
              g.items.forEach(item => { item.status = null; });
            }
          });
        }

        pushHistory(`Đồng bộ checklist từ "${sourceTitle}"`);
        D.checklist = cloned;
        renderChecklist();
        as();
        showToast(`✓ Đã cập nhật checklist từ "${sourceTitle}"!`);
      } catch (err) {
        console.error(err);
        alert('Lỗi khi sao chép checklist: ' + err.message);
      }
    }

    function saveCurrentChecklistAsDefault() {
      if (!D.checklist || !D.checklist.length) return;
      const countGroups = D.checklist.length;
      let countItems = 0;
      D.checklist.forEach(g => countItems += (g.items ? g.items.length : 0));

      if (!confirm(`Lưu bảng Checklist hiện tại (${countGroups} nhóm, ${countItems} tiêu chí) làm MẪU MẶC ĐỊNH?\n\nTừ nay, khi bấm tạo Báo Cáo Mới, hệ thống sẽ tự động dùng luôn mẫu này thay vì mẫu 13 nhóm ban đầu.`)) return;

      const cleanTemplate = JSON.parse(JSON.stringify(D.checklist));
      cleanTemplate.forEach(g => {
        if (g.items && Array.isArray(g.items)) {
          g.items.forEach(item => { item.status = null; });
        }
      });

      localStorage.setItem('user_custom_default_checklist', JSON.stringify(cleanTemplate));
      showToast('⭐ Đã lưu làm Mẫu Mặc Định cho các báo cáo tạo mới!');
    }

    function resetDefaultChecklist() {
      if (!confirm('Khôi phục danh sách checklist về 13 nhóm tiêu chuẩn mặc định ban đầu của hệ thống?')) return;
      D.checklist = JSON.parse(JSON.stringify(DEFAULT_CHECKLIST_CONFIG));
      localStorage.removeItem('user_custom_default_checklist');
      pushHistory('Khôi phục checklist mặc định');
      renderChecklist();
      as();
      showToast('✓ Đã khôi phục 13 nhóm tiêu chuẩn');
    }

    function refreshAllSlots() { 
      COVER_SLOTS.forEach(s => refreshSlot('coverPhotos', s.replace(/ /g, '_'), 'cover')); 
    }

    function loadData() {
      try {
        const fields = ['fReportTitle', 'fModel', 'fDesc', 'fDim', 'fDate', 'fFactory', 'fReviewer', 'dimNotes', 'assemblyNotes', 'watchoutNotes', 'testingNotes', 'checklistNotes'];
        const keys = ['reportTitle', 'model', 'desc', 'dim', 'date', 'factory', 'reviewer', 'dimNotes', 'assemblyNotes', 'watchoutNotes', 'testingNotes', 'checklistNotes'];
        fields.forEach((id, i) => {
          const el = document.getElementById(id);
          if (el) {
            if (keys[i] === 'reviewer' && !D[keys[i]]) {
              D[keys[i]] = 'Quoc Hung';
            }
            el.value = D[keys[i]] || '';
          }
        });
        document.getElementById('fNumS').value = D.numS || 1; document.getElementById('fNumR').value = D.numR || 1;
        Object.entries(CHECK_OPTS).forEach(([g, opts]) => { opts.forEach(o => { const el = document.getElementById(`ck_${g}_${o}`); if (el) { if ((D.checks || {})[g] && D.checks[g][o]) el.classList.add('on'); else el.classList.remove('on'); } }); });
        
        if (!D.dimensions) {
            D.dimensions = [];
            for (let i = 0; i < DEFAULT_DIM_FIELDS.length; i++) {
                let f = DEFAULT_DIM_FIELDS[i];
                let actualVal = '', drawingVal = '', colorVal = 'color-blue', imgVal = null, originalVal = null;
                
                if (D.dimData) {
                    let oldKey = DIM_MAPPING[f.name] || f.name;
                    let oldData = D.dimData[oldKey];
                    if (oldData) {
                        actualVal = oldData.actual || '';
                        drawingVal = oldData.drawing || '';
                        colorVal = oldData.color || 'color-blue';
                        imgVal = oldData.img || null;
                        originalVal = oldData.original || null;
                    }
                }
                
                D.dimensions.push({
                    id: 'dim_' + Math.random().toString(36).substr(2, 9),
                    name: f.name,
                    actual: actualVal,
                    drawing: drawingVal,
                    actualUnit: 'mm',
                    drawingUnit: 'mm',
                    color: colorVal,
                    photoLayout: '3:1',
                    img: imgVal,
                    original: originalVal,
                    imgSub: null,
                    originalSub: null
                });
            }
        }

        D.dimensions.forEach(dimension => {
          normalizeDimensionMeasurement(dimension, 'actual');
          normalizeDimensionMeasurement(dimension, 'drawing');
        });
        buildDimGrid(); 
        renderBVTable();
        renderChecklist();
        renderOverviewSummary();
        FREE_PHOTO_KEYS.forEach(k => renderFreePhotos(k));
        refreshAllSlots();
      } catch (err) {
        alert("Lỗi tải dữ liệu: " + err.message);
      }
    }

    function showSection(i) {
      curSec = i; document.querySelectorAll('.sec-block').forEach((b, idx) => b.style.display = idx === i ? 'block' : 'none');
      document.querySelectorAll('.tab').forEach((t, idx) => t.classList.toggle('active', idx === i));
      const tab = document.getElementById(`tab${i}`); if (tab) tab.scrollIntoView({ inline: 'center', behavior: 'smooth' });
      document.getElementById('progressFill').style.width = Math.round(((curSec + 1) / TABS.length) * 100) + '%';
      window.scrollTo(0, 0);
    }
    function prevSection() { if (curSec > 0) showSection(curSec - 1); }
    function nextSection() { if (curSec < TABS.length - 1) showSection(curSec + 1); }

    function updateTopbar() { 
      document.getElementById('topTitle').textContent = getReportTitle(D); 
      const brandLogo = document.getElementById('topbarBrandLogo');
      if (brandLogo && typeof LOGO_WHITE !== 'undefined') {
        const isDark = true;
        brandLogo.src = isDark ? LOGO_WHITE : LOGO_BLACK;
      }
    }

    function toggleCheck(group, key) {
      pushHistory(`Đổi lựa chọn ${group}: ${key}`);
      if (!D.checks) D.checks = {}; if (!D.checks[group]) D.checks[group] = {}; D.checks[group][key] = !D.checks[group][key]; const el = document.getElementById(`ck_${group}_${key}`); if (el) el.classList.toggle('on', !!D.checks[group][key]);
      as();
    }


    const FIELD_KEY_MAP = {
      fReportTitle: 'reportTitle', fModel: 'model', fDesc: 'desc', fDim: 'dim', fDate: 'date', fFactory: 'factory', fReviewer: 'reviewer',
      dimNotes: 'dimNotes', assemblyNotes: 'assemblyNotes', watchoutNotes: 'watchoutNotes', testingNotes: 'testingNotes', checklistNotes: 'checklistNotes'
    };

    function as() {
      if (!currentId) return;
      D.updatedAt = Date.now();
      const saveText = document.getElementById('saveText'); if (saveText) saveText.textContent = 'Saving...';
      const saveIndicator = document.getElementById('saveIndicator'); if (saveIndicator) saveIndicator.title = 'Đang lưu dữ liệu...';
      Object.entries(FIELD_KEY_MAP).forEach(([id, key]) => { const el = document.getElementById(id); if (el) D[key] = el.value; });
      D.numS = document.getElementById('fNumS').value; D.numR = document.getElementById('fNumR').value;
      renderOverviewSummary();
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        await dbPut(D);
        if (saveText) saveText.textContent = 'Saved';
        if (saveIndicator) saveIndicator.title = 'Đã lưu & đồng bộ';
        updateTopbar();
      }, 400);
    }

    function flushAutosave() {
      if (!currentId || !D) return;
      D.updatedAt = Date.now();
      Object.entries(FIELD_KEY_MAP).forEach(([id, key]) => { const el = document.getElementById(id); if (el) D[key] = el.value; });
      const elNumS = document.getElementById('fNumS'); if (elNumS) D.numS = elNumS.value;
      const elNumR = document.getElementById('fNumR'); if (elNumR) D.numR = elNumR.value;
      clearTimeout(saveTimeout);
      dbPut(D);
    }

    window.addEventListener('beforeunload', flushAutosave);
    window.addEventListener('pagehide', flushAutosave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushAutosave();
    });

    async function openReport(id) {
      try {
        currentId = id; 
        D = await dbGet(id); 
        if (!D) {
          const all = await dbGetAll();
          D = all.find(r => String(r.id) === String(id));
        }
        
        if (!D) {
            alert('Lỗi: Không tìm thấy dữ liệu báo cáo!');
            return;
        }
        reports = []; // Giải phóng mảng danh sách báo cáo khỏi RAM khi đang làm việc trong report
        
        curSec = 0;
        isDimSelectMode = false;
        selectedDimIndices.clear();
        resetHistory();
        buildUI(); loadData(); showSection(0);
        document.getElementById('homeScreen').classList.remove('active'); document.getElementById('editScreen').classList.add('active');
        ['tabsWrap', 'progressBar', 'btnHome', 'btnExport', 'btnShare', 'btnUndo', 'btnRedo', 'saveIndicator', 'topbarDivider'].forEach(elemId => {
          const el = document.getElementById(elemId);
          if (el) el.style.display = elemId==='tabsWrap'||elemId==='progressBar'?'block':'inline-flex';
        });
        const btnStyler = document.getElementById('btnStyler');
        if (btnStyler) btnStyler.style.display = 'none';
        document.getElementById('saveBar').style.display = 'flex'; updateTopbar(); window.scrollTo(0, 0);
      } catch (err) {
        alert("Lỗi khi mở báo cáo: " + err.message);
      }
    }

    async function newReport() {
      try {
        const id = Date.now().toString(), mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], now = new Date();
        const r = { 
          id, model: '', desc: '', dim: '', date: `${now.getDate()}-${mo[now.getMonth()]}-${String(now.getFullYear()).slice(2)}`, factory: '', reviewer: 'Quoc Hung', numS: 1, numR: 1, 
          checks: { stage: {}, sample: {}, comfort: {}, rating: {} }, 
          coverPhotos: {}, 
          coverTitles: {},
          prodPhotos: [], 
          dimensions: null, dimNotes: '', 
          assemblyPhotos: [], assemblyNotes: '',
          watchoutPhotos: [], watchoutNotes: '', 
          bvRows: JSON.parse(JSON.stringify(DEFAULT_BV)), testingPhotos: [], testingNotes: '',
          checklist: JSON.parse(JSON.stringify(getActiveDefaultChecklist())),
          checklistPhotos: [], checklistNotes: ''
        };
        
        await dbPut(r); 
        await renderHome(); 
        openReport(id);
      } catch (err) {
        alert("Lỗi tạo báo cáo mới: " + err.message);
      }
    }

    function shareReport() {
      as(); 
      downloadReportJson(D);
      showToast('✓ JSON file downloaded');
    }
    let toastTimeout = null;
    function showToast(msg, duration = 2200) {
      const t = document.getElementById('toast');
      if (!t) return;
      if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
      }
      t.textContent = msg;
      t.classList.add('show');
      toastTimeout = setTimeout(() => {
        t.classList.remove('show');
        toastTimeout = null;
      }, duration);
    }

    // ═══════════════ PDF EXPORT (2 CỘT & ẢNH KÉP 3:1) ═══════════════
    async function exportPDF() {
      as(); showToast('Đang khởi tạo PDF...'); await new Promise(r => setTimeout(r, 150));
      if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast('Lỗi: Thư viện xuất PDF chưa sẵn sàng (vui lòng kiểm tra kết nối mạng).');
        return;
      }
      const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210, M = 14, BOTTOM_LIMIT = 276; let y = 0;

      let fontFam = 'helvetica';
      if (typeof FONT_ROBOTO !== 'undefined' && FONT_ROBOTO) {
        try {
          doc.addFileToVFS('Roboto-Regular.ttf', FONT_ROBOTO);
          doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
          if (typeof FONT_ROBOTO_BOLD !== 'undefined' && FONT_ROBOTO_BOLD) {
            doc.addFileToVFS('Roboto-Bold.ttf', FONT_ROBOTO_BOLD);
            doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
          }
          fontFam = 'Roboto';
          doc.setFont('Roboto', 'normal');
        } catch (e) {
          console.warn('Could not load Roboto into jsPDF:', e);
        }
      }

      const cfg = pdfConfig || DEFAULT_PDF_CONFIG;
      const themeRgb = hexToRgbArr(cfg.themeColor);
      const isDarkTheme = isColorDark(cfg.themeColor);
      const isHeaderDark = isColorDark(cfg.headerTextColor);
      const headerFooterTextRgb = (!isDarkTheme && !isHeaderDark) ? [20, 20, 20] : hexToRgbArr(cfg.headerTextColor);
      const companyTextRgb = headerFooterTextRgb;
      const setPdfTextOpacity = opacity => {
        if (typeof doc.setGState === 'function' && typeof doc.GState === 'function') {
          doc.setGState(new doc.GState({ opacity }));
        }
      };

      const addHeader = (title) => {
        doc.addPage(); 
        doc.setFillColor(...themeRgb); 
        doc.rect(0, 0, W, 24, 'F'); 
        if (!isDarkTheme) {
          doc.setDrawColor(215, 220, 225);
          doc.setLineWidth(0.35);
          doc.line(0, 24, W, 24);
        }
        const pdfLogo = isDarkTheme ? LOGO_WHITE : LOGO_BLACK;
        const logoW_sub = cfg.logoW_sub || 36;
        const logoH_sub = logoW_sub / 10.1587;
        const logoX_sub = cfg.logoX_sub || M;
        const logoY_sub = cfg.logoY_sub || 4.2;
        try {
          doc.addImage(pdfLogo, 'PNG', logoX_sub, logoY_sub, logoW_sub, logoH_sub);
        } catch (e) {
          doc.setTextColor(...companyTextRgb); doc.setFontSize(8); doc.setFont(fontFam, 'bold'); doc.text('SOFACOMPANY', M, 7);
        }
        doc.setTextColor(...headerFooterTextRgb);
        const topInfo = [D.model, D.desc, D.reviewer ? 'Reviewer: ' + D.reviewer : ''].filter(Boolean).join('  |  ');
        if(topInfo) {
          setPdfTextOpacity(0.7);
          doc.setFontSize(7); doc.setFont(fontFam, 'normal'); doc.text(topInfo, W - M, 7, { align: 'right', baseline: 'middle' });
          setPdfTextOpacity(1);
        }
        doc.setFontSize(14); doc.setFont(fontFam, 'bold'); doc.text(title.toUpperCase(), W / 2, 17, { align: 'center', baseline: 'middle' });
        y = 32; doc.setTextColor(30, 30, 30);
      };

      const addSafeTextBlock = (title, text, curY, maxW = W - M * 2) => {
        if (!text || !text.trim()) return curY; 
        let ty = curY;
        if (title) { 
          if (ty + 8 > BOTTOM_LIMIT) { addHeader(title); ty = y; } 
          doc.setFont(fontFam, 'bold'); 
          doc.setFontSize(9.5); 
          doc.setTextColor(40, 40, 40); 
          doc.text(title, M, ty); 
          ty += 5.2; 
        }
        doc.setFont(fontFam, 'normal'); 
        doc.setFontSize(9); 
        doc.setTextColor(50, 45, 40);
        const lines = doc.splitTextToSize(text, maxW);
        for (let i = 0; i < lines.length; i++) { 
          if (ty + 5 > BOTTOM_LIMIT) { 
            addHeader(title || 'Notes'); 
            ty = y; 
            doc.setFont(fontFam, 'normal'); 
            doc.setFontSize(9); 
            doc.setTextColor(50, 45, 40); 
          } 
          doc.text(lines[i], M, ty); 
          ty += 4.5; 
        }
        return ty + 4;
      };

     const addImg = (src, x, iy, iw, ih) => { 
        if (!src) return null; 
        try { 
          // Kiểm tra tỉ lệ ảnh gốc để hiển thị đúng chuẩn "contain" (không méo hình)
          const imgProps = doc.getImageProperties(src);
          const imgRatio = imgProps.width / imgProps.height;
          const boxRatio = iw / ih;

          let renderW = iw;
          let renderH = ih;
          let offsetX = 0;
          let offsetY = 0;

          if (imgRatio > boxRatio) {
            // Ảnh bè ngang hơn khung -> co theo chiều rộng
            renderH = iw / imgRatio;
            offsetY = (ih - renderH) / 2;
          } else {
            // Ảnh cao hơn khung -> co theo chiều cao
            renderW = ih * imgRatio;
            offsetX = (iw - renderW) / 2;
          }

          doc.addImage(src, 'JPEG', x + offsetX, iy + offsetY, renderW, renderH); 
          return { x: x + offsetX, y: iy + offsetY, w: renderW, h: renderH };
        } catch (e) {
          // Dự phòng nếu không đọc được thuộc tính ảnh
          try { 
            doc.addImage(src, 'JPEG', x, iy, iw, ih); 
            return { x, y: iy, w: iw, h: ih };
          } catch(err) {
            return null;
          }
        } 
      };

      const renderCard = (p, px, py, gw, cardH) => {
        if (!p) return cardH;
        const layout = p.photoLayout || (p.imgSub ? '3:1' : 'single');
        let itemMainW = gw;
        let itemSubW = 0;
        if (layout === '1:1') {
          itemMainW = gw / 2;
          itemSubW = gw / 2;
        } else if (layout === '3:1') {
          itemMainW = gw * 0.75;
          itemSubW = gw * 0.25;
        }

        if (itemSubW > 0) {
          // Bố cục 2 ảnh (3:1 hoặc 1:1)
          if (p.img) {
            addImg(p.img, px, py, itemMainW, cardH);
          } else {
            doc.setFillColor(248, 245, 240);
            doc.rect(px, py, itemMainW, cardH, 'F');
            doc.setFont(fontFam, 'normal'); doc.setFontSize(7.5); doc.setTextColor(170, 165, 158);
            doc.text('Main View', px + itemMainW / 2, py + cardH / 2, { align: 'center' });
          }

          // Vùng ảnh phụ (đồng bộ với ảnh chính: chỉ vẽ nền chờ khi chưa có ảnh)
          if (p.imgSub) {
            addImg(p.imgSub, px + itemMainW, py, itemSubW, cardH);
          } else {
            doc.setFillColor(248, 245, 240);
            doc.rect(px + itemMainW, py, itemSubW, cardH, 'F');
            doc.setFont(fontFam, 'normal'); doc.setFontSize(7); doc.setTextColor(170, 165, 158);
            doc.text(layout === '1:1' ? 'Side View' : 'Detail', px + itemMainW + itemSubW / 2, py + cardH / 2, { align: 'center' });
          }

          // Khung viền và đường kẻ phân cách
          doc.setDrawColor(220, 217, 210);
          doc.setLineWidth(0.25);
          doc.rect(px, py, gw, cardH, 'S');
          doc.line(px + itemMainW, py, px + itemMainW, py + cardH);

          return cardH;
        } else {
          // Chế độ 1 ảnh (Single mode)
          if (p.img) {
            addImg(p.img, px, py, gw, cardH);
          } else {
            doc.setFillColor(248, 245, 240);
            doc.rect(px, py, gw, cardH, 'F');
            doc.setFont(fontFam, 'normal'); doc.setFontSize(7.5); doc.setTextColor(170, 165, 158);
            doc.text('Photo View', px + gw / 2, py + cardH / 2, { align: 'center' });
          }

          doc.setDrawColor(220, 217, 210);
          doc.setLineWidth(0.25);
          doc.rect(px, py, gw, cardH, 'S');

          return cardH;
        }
      };

      const renderPhotoGrid = (photos, headerTitle, customCardH, customGapY) => {
        const gapX = 6;
        const gapY = customGapY !== undefined ? customGapY : 6.5;
        const fullW = W - M * 2; // 182mm
        const gw = (fullW - gapX) / 2; // 88mm

        const estimateCardH = (p, isFull = false) => {
          const targetW = isFull ? fullW : gw;
          if (!p) return isFull ? 65 : 42;
          if (customCardH) {
            return isFull ? Math.min(Math.max(customCardH * 1.4, 60), 85) : customCardH;
          }
          const layout = p.photoLayout || (p.imgSub ? '3:1' : 'single');
          const mainW = layout === '3:1' ? targetW * 0.75 : (layout === '1:1' ? targetW * 0.5 : targetW);
          let r = 4 / 3;
          if (p.img) {
            try {
              const pr = doc.getImageProperties(p.img);
              if (pr && pr.width && pr.height) r = pr.width / pr.height;
            } catch(e) {}
          }
          let h = mainW / r;
          if (isFull) {
            if (h > 85) h = 85;
            if (h < 50) h = 50;
          } else {
            if (h > 62) h = 62;
            if (h < 35) h = 35;
          }
          return h;
        };

        const padX = 2.5;

        const drawCaption = (lines, px, targetW, capY) => {
          if (!lines || lines.length === 0) return;
          doc.setFontSize(8.5);
          doc.setTextColor(45, 40, 35);
          if (lines.length === 1) {
            doc.setFont(fontFam, 'bold');
            doc.text(lines[0], px + targetW / 2, capY, { align: 'center' });
          } else {
            doc.setFont(fontFam, 'normal');
            for (let i = 0; i < lines.length; i++) {
              doc.text(lines[i], px + padX, capY + i * 3.8);
            }
          }
        };

        let i = 0;
        while (i < photos.length) {
          const p0 = photos[i];
          const isFull0 = !!(p0 && (p0.fullWidth || p0.photoSize === 'full'));

          if (isFull0) {
            // ══════════════ NHÁNH 1: FULL-WIDTH 100% (182mm) ══════════════
            const rowCardH = estimateCardH(p0, true);
            const textW = fullW - padX * 2;
            doc.setFont(fontFam, 'normal');
            doc.setFontSize(8.5);
            const capLines = (p0 && p0.caption && p0.caption.trim()) ? doc.splitTextToSize(p0.caption.trim(), textW) : [];
            const captionH = capLines.length > 0 ? (capLines.length * 3.8 + 3.0) : 0;
            const rowTotalH = rowCardH + captionH + gapY;

            if (y + rowTotalH > BOTTOM_LIMIT) {
              addHeader(headerTitle);
            }

            const py = y;
            const px0 = M;

            renderCard(p0, px0, py, fullW, rowCardH);

            const capY = py + rowCardH + 3.8;
            drawCaption(capLines, px0, fullW, capY);

            y += rowTotalH;
            i++;
          } else {
            // ══════════════ NHÁNH 2: NORMAL 50% (88mm) + 50% (88mm) ══════════════
            const p1 = (i + 1 < photos.length && !(photos[i + 1] && (photos[i + 1].fullWidth || photos[i + 1].photoSize === 'full'))) ? photos[i + 1] : null;

            const rowMaxCardH = customCardH ? customCardH : Math.max(estimateCardH(p0, false), p1 ? estimateCardH(p1, false) : 0, 42);
            const textW = gw - padX * 2;
            doc.setFont(fontFam, 'normal');
            doc.setFontSize(8.5);

            const capLines0 = (p0 && p0.caption && p0.caption.trim()) ? doc.splitTextToSize(p0.caption.trim(), textW) : [];
            const capLines1 = (p1 && p1.caption && p1.caption.trim()) ? doc.splitTextToSize(p1.caption.trim(), textW) : [];
            const maxCapLines = Math.max(capLines0.length, capLines1.length);
            const captionH = maxCapLines > 0 ? (maxCapLines * 3.8 + 3.0) : 0;
            const rowTotalH = rowMaxCardH + captionH + gapY;

            if (y + rowTotalH > BOTTOM_LIMIT) {
              addHeader(headerTitle);
            }

            const py = y;
            const px0 = M;
            const px1 = M + gw + gapX;

            renderCard(p0, px0, py, gw, rowMaxCardH);
            if (p1) {
              renderCard(p1, px1, py, gw, rowMaxCardH);
            }

            const capY = py + rowMaxCardH + 3.8;
            drawCaption(capLines0, px0, gw, capY);
            if (p1) {
              drawCaption(capLines1, px1, gw, capY);
            }

            y += rowTotalH;
            i += (p1 ? 2 : 1);
          }
        }
      };

      const renderPhotoSection = (sectionTitle, photoArray, notesText, notesTitle) => {
        const validPhotos = (photoArray || []).filter(p => p && (p.img || p.imgSub || (p.caption && p.caption.trim())));
        if (validPhotos.length === 0 && (!notesText || !notesText.trim())) return;

        addHeader(sectionTitle);

        if (validPhotos.length > 0) {
          renderPhotoGrid(validPhotos, sectionTitle);
        }

        if (notesText && notesText.trim()) {
          y = addSafeTextBlock(notesTitle || (sectionTitle + ' Comments'), notesText, y);
        }
      };

      // ================= 1. OVERALL =================
      doc.setFillColor(...themeRgb); 
      const bannerH = cfg.bannerH || 24;
      doc.rect(0, 0, W, bannerH, 'F'); 
      if (!isDarkTheme) {
        doc.setDrawColor(215, 220, 225);
        doc.setLineWidth(0.35);
        doc.line(0, bannerH, W, bannerH);
      }
      const pdfLogo = isDarkTheme ? LOGO_WHITE : LOGO_BLACK;
      const logoW_p1 = cfg.logoW_p1 || 44;
      const logoH_p1 = logoW_p1 / 10.1587;
      const logoX_p1 = cfg.logoX_p1 || M;
      const logoY_p1 = cfg.logoY_p1 || 6.2;
      try {
        doc.addImage(pdfLogo, 'PNG', logoX_p1, logoY_p1, logoW_p1, logoH_p1);
      } catch (e) {
        doc.setTextColor(...companyTextRgb); doc.setFontSize(9); doc.setFont(fontFam, 'bold'); doc.text('SOFACOMPANY', M, 9);
      }
      doc.setTextColor(...headerFooterTextRgb);
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(cfg.titleFontSize || 16);
      const titleToPrint = (D && D.reportTitle && D.reportTitle.trim()) ? D.reportTitle.trim() : (cfg.reportTitle || 'PP SAMPLE REVIEW REPORT');
      doc.text(titleToPrint, W / 2, cfg.titleY || 16, { align: 'center', baseline: 'middle' });
      y = bannerH + 6;

      const infoRows = [
        ['Model No.', D.model], ['Description', D.desc], 
        ['Dimension', D.dim], ['Date', D.date], 
        ['Factory', D.factory], ['Reviewed by', D.reviewer]
      ]; 
      
      const hw = (W - M * 2) / 2 - 2;
      for (let i = 0; i < infoRows.length; i += 2) {
        const [l1, v1] = infoRows[i], [l2, v2] = infoRows[i + 1] || ['', ''];
        doc.setFillColor(248, 246, 242); doc.rect(M, y, hw, 9, 'FD'); doc.rect(M + hw + 4, y, hw, 9, 'FD');
        doc.setFont(fontFam, 'bold'); doc.setFontSize(8.5); doc.setTextColor(100, 95, 90); doc.text(l1 + ':', M + 2, y + 5.9); doc.text(l2 + ':', M + hw + 6, y + 5.9);
        doc.setFont(fontFam, 'normal'); doc.setTextColor(20, 20, 20); doc.text(String(v1 || '—'), M + 24, y + 5.9); doc.text(String(v2 || '—'), M + hw + 26, y + 5.9); y += 10;
      } y += 4;

      const chkLine = (label, group) => {
        doc.setFont(fontFam, 'bold'); doc.setFontSize(8.5); doc.setTextColor(80, 75, 70); doc.text(label + ':', M, y + 3.5); let cx = M + 18;
        const checkFillRgb = isDarkTheme ? themeRgb : [30, 30, 30];
        const checkBorderRgb = isDarkTheme ? themeRgb : [30, 30, 30];
        CHECK_OPTS[group].forEach(k => {
          if (!!((D.checks || {})[group]?.[k])) {
            doc.setFillColor(...checkFillRgb);
            doc.setDrawColor(...checkBorderRgb);
            doc.setLineWidth(0.2);
            doc.rect(cx, y + 1, 3, 3, 'FD');
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.38);
            doc.line(cx + 0.65, y + 2.45, cx + 1.3, y + 3.05);
            doc.line(cx + 1.3, y + 3.05, cx + 2.45, y + 1.55);
          } else {
            doc.setDrawColor(180, 175, 170);
            doc.setLineWidth(0.2);
            doc.rect(cx, y + 1, 3, 3, 'S');
          }
          doc.setFont(fontFam, 'normal'); doc.setFontSize(8); doc.setTextColor(40, 40, 40); doc.text(k, cx + 4.5, y + 3.8); cx += doc.getTextWidth(k) + 11;
        }); y += 6.5;
      };
      ['stage', 'sample', 'comfort', 'rating'].forEach((g, i) => { chkLine(['Stage', 'Sample', 'Comfort', 'Rating'][i], g); }); y += 2.5;

      // ================= EXECUTIVE QUALITY SUMMARY STRIP =================
      const qm = getReportQuickMetrics(D);
      const sumBoxW = W - M * 2;
      const sumBoxH = 13.5;
      doc.setFillColor(248, 246, 242);
      doc.setDrawColor(225, 220, 212);
      doc.setLineWidth(0.25);
      doc.rect(M, y, sumBoxW, sumBoxH, 'FD');

      // Tiêu đề nhỏ thanh lịch
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(140, 130, 122);
      doc.text("QUALITY SUMMARY", M + 3, y + 3.8);

      // Vẽ các Badges / Status Pills
      let badgeX = M + 3;
      const badgeY = y + 5.5;
      const badgeH = 5.6;

      const drawPdfBadge = (text, bgRgb, borderRgb, textRgb, isAlert = false) => {
        doc.setFont(fontFam, 'bold');
        doc.setFontSize(7.5);
        const textW = doc.getTextWidth(text);
        const bW = textW + 8;
        doc.setFillColor(...bgRgb);
        doc.setDrawColor(...borderRgb);
        doc.setLineWidth(0.2);
        doc.rect(badgeX, badgeY, bW, badgeH, 'FD');
        
        // Vẽ chấm tròn nhỏ biểu trưng trạng thái
        doc.setFillColor(...borderRgb);
        doc.circle(badgeX + 3.2, badgeY + badgeH / 2, 1.1, 'F');

        doc.setTextColor(...textRgb);
        doc.text(text, badgeX + 6.2, badgeY + 4.0);
        badgeX += bW + 3;
      };

      // 1. Watch-out
      if (qm.watchCount > 0) {
        drawPdfBadge(`${qm.watchCount} Watch-out${qm.watchCount > 1 ? 's' : ''}`, [253, 240, 240], [226, 75, 74], [180, 40, 40], true);
      } else {
        drawPdfBadge("0 Watch-outs", [237, 247, 238], [52, 168, 83], [30, 120, 50]);
      }

      // 2. Testing BV
      if (qm.totalTests === 0) {
        drawPdfBadge("No Lab Tests", [240, 237, 232], [140, 135, 130], [70, 65, 60]);
      } else if (qm.failedTests > 0) {
        drawPdfBadge(`${qm.failedTests}/${qm.totalTests} Tests Failed`, [253, 240, 240], [226, 75, 74], [180, 40, 40], true);
      } else if (qm.passedTests === qm.totalTests) {
        drawPdfBadge(`All Tests Passed (${qm.passedTests}/${qm.totalTests})`, [237, 247, 238], [52, 168, 83], [30, 120, 50]);
      } else {
        drawPdfBadge(`${qm.passedTests}/${qm.totalTests} Passed (${qm.pendingTests || (qm.totalTests - qm.passedTests)} Pending)`, [253, 247, 236], [232, 144, 32], [180, 83, 9], true);
      }

      // 3. Checklist
      if (qm.totalCriteria > 0) {
        if (qm.passCriteria === qm.totalCriteria) {
          drawPdfBadge(`Checklist (${qm.totalCriteria}/${qm.totalCriteria})`, [237, 247, 238], [52, 168, 83], [30, 120, 50]);
        } else {
          const pendingCount = qm.pendingCriteria !== undefined ? qm.pendingCriteria : (qm.totalCriteria - qm.passCriteria);
          drawPdfBadge(`Checklist: ${qm.passCriteria}/${qm.totalCriteria} (${pendingCount} Pending)`, [253, 247, 236], [232, 144, 32], [180, 83, 9], true);
        }
      }

      // 4. Dimension (nếu có vấn đề phát hiện)
      if (qm.redDims > 0 || qm.orangeDims > 0) {
        const dimTotal = qm.redDims + qm.orangeDims;
        drawPdfBadge(`${dimTotal} Dim Issue${dimTotal > 1 ? 's' : ''}`, [253, 247, 236], [232, 144, 32], [180, 83, 9], true);
      }

      y += sumBoxH + 4;

      doc.setFont(fontFam, 'bold'); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40); doc.text("OVERVIEW", M, y); y += 4;
      const cp = D.coverPhotos || {}; 
      const ckeys = COVER_SLOTS.map(s => s.replace(/ /g, '_')); 
      
      const gapX = 4;
      const gapY = 4.5;
      const barH = 5.2;
      const pw = (W - M * 2 - gapX) / 2; 
      const ph = 74;
      
      const gridCoords = [
        [M, y], 
        [M + pw + gapX, y], 
        [M, y + ph + barH + gapY], 
        [M + pw + gapX, y + ph + barH + gapY]
      ];

      gridCoords.forEach(([px, py], i) => {
        const key = ckeys[i];
        const dataObj = cp[key]; 
        const img = dataObj ? (typeof dataObj === 'string' ? dataObj : dataObj.img) : null;
        const slotTitle = (D.coverTitles && D.coverTitles[key]) ? D.coverTitles[key] : COVER_SLOTS[i];
        
        let barX = px;
        let barY = py + ph;
        let barW = pw;

        if (img) { 
          const bounds = addImg(img, px, py, pw, ph); 
          if (bounds) {
            barX = bounds.x;
            barW = bounds.w;
            barY = bounds.y + bounds.h;
          }
        } else { 
          doc.setFillColor(245, 242, 237); 
          doc.rect(px, py, pw, ph, 'F'); 
          doc.setTextColor(170, 165, 158); 
          doc.setFontSize(8); 
          doc.setFont(fontFam, 'normal');
          doc.text('No Photo', px + pw / 2, py + ph / 2, { align: 'center' }); 
        }
        
        // Thanh màu nền: độ dài cạnh bằng chính xác 2 cạnh của ảnh, không bị lồi ra ngoài
        doc.setFillColor(245, 242, 237); 
        doc.rect(barX, barY, barW, barH, 'F'); 
        doc.setTextColor(80, 75, 70); 
        doc.setFont(fontFam, 'bold'); 
        doc.setFontSize(7.5); 
        doc.text(slotTitle.toUpperCase(), barX + barW / 2, barY + (barH / 2) + 1, { align: 'center', maxWidth: barW - 2 });
      });
      
      y += (ph + barH) * 2 + gapY + 4;

      // ================= 2. PHOTO =================
      renderPhotoSection('Product Photos', D.prodPhotos, null, null);

      // ================= 3. DIMENSIONS (2 CỘT & ẢNH KÉP 3:1) =================
      const validDims = (D.dimensions || []).filter(d => d.img || d.imgSub || d.actual || d.drawing);
      if (validDims.length > 0) {
        let _updateIconPngDataUrl = null;
        const getUpdateIconPng = () => {
          if (_updateIconPngDataUrl) return _updateIconPngDataUrl;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 72; canvas.height = 72;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 72, 72);
            ctx.scale(72 / 24, 72 / 24);
            ctx.strokeStyle = '#e89020';
            ctx.lineWidth = 2.4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (typeof Path2D !== 'undefined') {
              ctx.stroke(new Path2D("M21 2v6h-6"));
              ctx.stroke(new Path2D("M3 12a9 9 0 0 1 15-6.7L21 8"));
              ctx.stroke(new Path2D("M3 22v-6h6"));
              ctx.stroke(new Path2D("M21 12a9 9 0 0 1-15 6.7L3 16"));
            } else {
              ctx.beginPath();
              ctx.arc(12, 12, 8.5, -0.4, 2.0);
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(12, 12, 8.5, Math.PI - 0.4, Math.PI + 2.0);
              ctx.stroke();
            }
            _updateIconPngDataUrl = canvas.toDataURL('image/png');
          } catch(e) {
            console.warn('Cannot generate update icon canvas', e);
          }
          return _updateIconPngDataUrl;
        };

        const drawDimStatusShapePdf = (shapeType, sx, sy, r = 1.6) => {
          if (shapeType === 'color-red' || shapeType === 'not_ok') {
            doc.setDrawColor(226, 75, 74);
            doc.setLineWidth(0.55);
            const d = r * 0.85;
            doc.line(sx - d, sy - d, sx + d, sy + d);
            doc.line(sx - d, sy + d, sx + d, sy - d);
          } else if (shapeType === 'color-orange' || shapeType === 'update') {
            const iconUrl = getUpdateIconPng();
            if (iconUrl) {
              const iconSize = r * 2.2;
              doc.addImage(iconUrl, 'PNG', sx - iconSize / 2, sy - iconSize / 2, iconSize, iconSize);
            } else {
              doc.setFillColor(210, 138, 20);
              doc.circle(sx, sy, r, 'F');
            }
          } else {
            doc.setFillColor(55, 138, 221);
            doc.circle(sx, sy, r, 'F');
          }
        };

        const addDimensionLegend = () => {
          let lx = M;
          const ly = y - 0.8;
          const legendItems = [
            { type: 'ok', label: 'OK' },
            { type: 'not_ok', label: 'Not OK' },
            { type: 'update', label: 'Update Drawing' }
          ];

          doc.setFont(fontFam, 'normal');
          doc.setFontSize(8);
          doc.setTextColor(80, 75, 70);

          legendItems.forEach((item) => {
            drawDimStatusShapePdf(item.type, lx + 1.5, ly, 1.6);
            doc.text(item.label, lx + 4.5, ly + 1);
            lx += doc.getTextWidth(item.label) + 12;
          });

          y += 5.5;
        };

        addHeader('Product Dimension & Details');
        addDimensionLegend();
        
        let dx = M, dy = y;
        const dimCols = 2; 
        const dimSlotW = (W - M * 2 - 4) / dimCols; // ~89mm mỗi ô
        const dimImgH = (dimSlotW * 0.75) * 0.75;  // Chiều cao ảnh chuẩn (~50mm)
        const dimSlotH = dimImgH + 20;             // Thêm 20mm cho phần dữ liệu text dưới
        
        validDims.forEach((d, i) => {
          if (dy + dimSlotH > BOTTOM_LIMIT) { 
              addHeader('Product Dimension & Details'); 
              addDimensionLegend();
              dy = y; 
              dx = M; 
          }

          const layout = d.photoLayout || '3:1';
          let itemMainW, itemSubW;
          if (layout === 'single') {
            itemMainW = dimSlotW;
            itemSubW = 0;
          } else if (layout === '1:1') {
            itemMainW = dimSlotW / 2;
            itemSubW = dimSlotW / 2;
          } else {
            itemMainW = dimSlotW * 0.75;
            itemSubW = dimSlotW * 0.25;
          }
          
          const displayImg = d.img || null;
          const displayImgSub = d.imgSub || null;

          // Viền khung tổng
          doc.setDrawColor(220, 217, 210); 
          doc.rect(dx, dy, dimSlotW, dimSlotH, 'S');

          // Vùng ẢNH CHÍNH
          if (displayImg) { 
            addImg(displayImg, dx, dy, itemMainW, dimImgH); 
          } else { 
            doc.setFillColor(248, 245, 240); 
            doc.rect(dx, dy, itemMainW, dimImgH, 'F'); 
            doc.setFont(fontFam, 'normal'); doc.setFontSize(7); doc.setTextColor(170, 165, 158);
            doc.text('Main View', dx + itemMainW / 2, dy + dimImgH / 2, { align: 'center' });
          }

          // Vùng ẢNH PHỤ (nếu có)
          if (itemSubW > 0) {
            if (displayImgSub) { 
              addImg(displayImgSub, dx + itemMainW, dy, itemSubW, dimImgH); 
            } else { 
              doc.setFillColor(248, 245, 240); 
              doc.rect(dx + itemMainW, dy, itemSubW, dimImgH, 'F'); 
              doc.setFont(fontFam, 'normal'); doc.setFontSize(6.5); doc.setTextColor(170, 165, 158);
              doc.text(layout === '1:1' ? 'Side View' : 'Detail', dx + itemMainW + itemSubW / 2, dy + dimImgH / 2, { align: 'center' });
            }

            // Đường phân cách giữa 2 ảnh
            doc.setDrawColor(220, 217, 210);
            doc.line(dx + itemMainW, dy, dx + itemMainW, dy + dimImgH);
          }

          // Đường kẻ ngang ngăn cách ảnh và vùng text
          doc.setDrawColor(220, 217, 210);
          doc.line(dx, dy + dimImgH, dx + dimSlotW, dy + dimImgH);
          
          // KHỐI DỮ LIỆU ĐÁY
          const fy = dy + dimImgH + 2; 
          doc.setFont(fontFam, 'bold'); doc.setFontSize(8); doc.setTextColor(50, 45, 40); 
          doc.text(d.name || 'DIMENSION', dx + 3, fy + 3, { maxWidth: dimSlotW - 12 });
          
          const statusType = d.color === 'color-red' ? 'not_ok' : d.color === 'color-orange' ? 'update' : 'ok';
          drawDimStatusShapePdf(statusType, dx + dimSlotW - 5, fy + 2, 1.8);
          
          doc.setFont(fontFam, 'normal'); doc.setFontSize(7.5); doc.setTextColor(80, 75, 70);
          const actVal = formatDimensionMeasurement(d, 'actual');
          const drwVal = formatDimensionMeasurement(d, 'drawing');
          
          // Cột nhãn và giá trị cố định thẳng hàng, không bị phụ thuộc vào độ dài Drawing để tránh đè chữ
          const labelColX = dx + 3;
          const valColX = dx + 18; // Cột số đo bắt đầu ngay sau nhãn 'Actual:' / 'Drawing:'
          
          // Dòng 1: Actual
          doc.setFont(fontFam, 'bold');
          doc.setTextColor(100, 95, 90);
          doc.text('Actual:', labelColX, fy + 9.5);
          doc.setFont(fontFam, 'normal');
          doc.setTextColor(30, 30, 30);
          doc.text(actVal, valColX, fy + 9.5);
          
          // Dòng 2: Drawing
          doc.setFont(fontFam, 'bold');
          doc.setTextColor(100, 95, 90);
          doc.text('Drawing:', labelColX, fy + 14);
          doc.setFont(fontFam, 'normal');
          doc.setTextColor(50, 50, 50);
          doc.text(drwVal, valColX, fy + 14);
          
          dx += dimSlotW + 4;
          if ((i + 1) % dimCols === 0) {
              dx = M;
              dy += dimSlotH + 4.5;
          }
        });
        if (validDims.length > 0) {
          const lastCardBottom = (validDims.length % dimCols !== 0) ? (dy + dimSlotH) : (dy - 4.5);
          y = lastCardBottom + 6.5;
        }
        if (D.dimNotes && D.dimNotes.trim()) y = addSafeTextBlock('Dimension Remarks', D.dimNotes, y);
      }

      // ================= 4. PRODUCT ASSEMBLY =================
      renderPhotoSection('Product Assembly', D.assemblyPhotos, D.assemblyNotes, 'Assembly Notes');

      // ================= 5. QUALITY WATCH OUT =================
      renderPhotoSection('Quality Watch Out', D.watchoutPhotos, D.watchoutNotes, 'Quality Watch Out Notes');

      // ================= 6. TESTING =================
      const validBV = (D.bvRows || []).filter(r => r && (r.test || r.result || r.remark));
      const validTestingPhotos = (D.testingPhotos || [])
        .map((p, idx) => {
          if (!p) return null;
          const defaultCap = (D.bvRows && D.bvRows[idx] && D.bvRows[idx].test) ? D.bvRows[idx].test.trim() : '';
          const cap = (p.caption !== undefined && p.caption !== null && p.caption !== '') ? p.caption : defaultCap;
          return { ...p, caption: cap };
        })
        .filter(p => p && (p.img || p.imgSub || (p.caption && p.caption.trim())));
      if (validBV.length > 0 || validTestingPhotos.length > 0 || (D.testingNotes && D.testingNotes.trim())) {
        addHeader('Testing');
        if(validBV.length > 0) {
            const tableW = W - M * 2;
            doc.setFillColor(242, 242, 247); 
            doc.rect(M, y, tableW, 6.5, 'F'); 
            doc.setDrawColor(215, 215, 220);
            doc.setLineWidth(0.3);
            doc.rect(M, y, tableW, 6.5, 'S');
            doc.setFont(fontFam, 'bold'); doc.setFontSize(8.5); doc.setTextColor(50, 45, 40);
            doc.text('Test Property', M + 3, y + 4.4); 
            doc.text('Result', M + 106, y + 4.4, { align: 'center' }); 
            doc.text('Remark', M + 122, y + 4.4); 
            y += 6.5;

            validBV.forEach(row => {
              const isPass = row.result === 'pass';
              const isFail = row.result === 'fail';
              const isPending = row.result === 'pending' || row.result === 'na';
              const rColor = isPass ? [45, 90, 61] : isFail ? [139, 32, 32] : isPending ? [180, 100, 20] : [120, 115, 110];
              const resText = isPending ? 'PENDING' : (row.result || '—').toUpperCase();
              const testLines = doc.splitTextToSize(row.test || '', 92);
              const remarkLines = doc.splitTextToSize(row.remark || '', 56);
              const maxLines = Math.max(testLines.length, remarkLines.length, 1);
              const rowH = maxLines * 3.8 + 3.2;

              if (y + rowH > BOTTOM_LIMIT) { 
                addHeader('Testing'); 
                doc.setFillColor(242, 242, 247); 
                doc.rect(M, y, tableW, 6.5, 'F'); 
                doc.setDrawColor(215, 215, 220);
                doc.setLineWidth(0.3);
                doc.rect(M, y, tableW, 6.5, 'S');
                doc.setFont(fontFam, 'bold'); doc.setFontSize(8.5); doc.setTextColor(50, 45, 40);
                doc.text('Test Property', M + 3, y + 4.4); 
                doc.text('Result', M + 106, y + 4.4, { align: 'center' }); 
                doc.text('Remark', M + 122, y + 4.4); 
                y += 6.5;
              }

              doc.setFont(fontFam, 'normal'); doc.setFontSize(8); doc.setTextColor(40, 35, 30);
              doc.text(testLines, M + 3, y + 4.0); 

              doc.setFont(fontFam, 'bold'); doc.setTextColor(...rColor); 
              doc.text(resText, M + 106, y + 4.0, { align: 'center' }); 

              doc.setFont(fontFam, 'normal'); doc.setTextColor(70, 65, 60); 
              doc.text(remarkLines, M + 122, y + 4.0); 

              doc.setDrawColor(225, 220, 212); 
              doc.setLineWidth(0.25);
              doc.line(M, y + rowH, M + tableW, y + rowH); 
              y += rowH;
            }); 
            y += 5;
        }

        if (validTestingPhotos.length > 0) {
          if (y + 40 > BOTTOM_LIMIT) {
            addHeader('Testing Photos');
          } else {
            doc.setFont(fontFam, 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(40, 40, 40);
            doc.text('Testing Photos', M, y);
            y += 5.5;
          }

          const isThreeRows = validTestingPhotos.length > 4;
          const testingCardH = isThreeRows ? 41 : (validTestingPhotos.length > 2 ? 48 : 55);
          const testingGapY = isThreeRows ? 3.5 : 5.5;
          renderPhotoGrid(validTestingPhotos, 'Testing Photos', testingCardH, testingGapY);
        }
        if (D.testingNotes && D.testingNotes.trim()) y = addSafeTextBlock('Testing Comments', D.testingNotes, y);
      }

      // ================= 7. CHECKLIST =================
      const checklistGroups = (D.checklist && Array.isArray(D.checklist)) ? D.checklist : [];
      const hasChecklistData = checklistGroups.some(g => g && g.items && g.items.length > 0);

      if (hasChecklistData) {
        addHeader('Check List');

        // Bắt đầu ngay dưới banner (y=28mm thay vì 32mm để tận dụng tối đa chiều cao trang)
        y = 28;

        const colGroupW = 42;
        const colItemW = 116;
        const colYesW = 12;
        const colNoW = 12;
        const totalW = colGroupW + colItemW + colYesW + colNoW; // 182mm (Khớp khít chiều rộng khả dụng: 210 - 28)

        // Tính tổng số dòng tiêu chí
        let totalRows = 0;
        checklistGroups.forEach(g => {
          totalRows += (g.items && g.items.length > 0) ? g.items.length : 1;
        });

        const headerH = 6.2;
        const safeBottomY = 281; // Ngay phía trên dải footer ở 285mm
        const maxAvailableH = safeBottomY - y - headerH; // ~246.8mm

        // Tính toán chiều cao hàng động: Nếu danh sách tối đa (~32-34 mục), tự động co để khớp đúng 1 trang PDF
        const canFitSinglePage = totalRows <= 35;
        let rowH = 7.0;
        let fontSize = 7.3;
        let groupFontSize = 7.5;

        if (canFitSinglePage && totalRows > 0) {
          const calcH = maxAvailableH / totalRows;
          rowH = Math.min(Math.max(calcH, 6.5), 8.2);
          if (totalRows >= 28) {
            fontSize = 7.1;
            groupFontSize = 7.3;
          } else if (totalRows >= 20) {
            fontSize = 7.4;
            groupFontSize = 7.6;
          } else {
            fontSize = 7.8;
            groupFontSize = 8.0;
          }
        }

        const drawChecklistTableHeader = (curY) => {
          doc.setFillColor(242, 242, 247);
          doc.rect(M, curY, totalW, headerH, 'F');
          doc.setDrawColor(200, 200, 205);
          doc.setLineWidth(0.3);
          doc.rect(M, curY, totalW, headerH, 'S');

          // Kẻ vách ngăn giữa các cột tiêu đề
          doc.line(M + colGroupW, curY, M + colGroupW, curY + headerH);
          doc.line(M + colGroupW + colItemW, curY, M + colGroupW + colItemW, curY + headerH);
          doc.line(M + colGroupW + colItemW + colYesW, curY, M + colGroupW + colItemW + colYesW, curY + headerH);

          doc.setFont(fontFam, 'bold');
          doc.setFontSize(7.8);
          doc.setTextColor(50, 50, 55);
          doc.text('Category', M + 2.5, curY + 4.2);
          doc.text('Inspection Criteria', M + colGroupW + 2.5, curY + 4.2);
          doc.text('Yes', M + colGroupW + colItemW + colYesW / 2, curY + 4.2, { align: 'center' });
          doc.text('No', M + colGroupW + colItemW + colYesW + colNoW / 2, curY + 4.2, { align: 'center' });
          return curY + headerH;
        };

        y = drawChecklistTableHeader(y);

        checklistGroups.forEach((g, gIdx) => {
          const groupTitle = `${gIdx + 1}. ${g.title || ''}`;
          const items = (g.items && g.items.length > 0) ? g.items : [{ text: '—', status: null }];
          const groupTotalRows = items.length;
          const groupTotalH = groupTotalRows * rowH;

          // Kiểm tra ngắt trang nếu vượt quá 35 mục (fallback an toàn)
          if (!canFitSinglePage && y + rowH > BOTTOM_LIMIT) {
            addHeader('Check List');
            y = 28;
            y = drawChecklistTableHeader(y);
          }

          const groupStartY = y;

          // 1. Vẽ ô nhóm gộp (Merged Cell) bên cột trái giống ảnh mẫu
          doc.setDrawColor(215, 215, 220);
          doc.setLineWidth(0.25);
          doc.rect(M, groupStartY, colGroupW, groupTotalH, 'S');

          // Căn giữa tiêu đề nhóm theo chiều cao ô gộp
          doc.setFont(fontFam, 'bold');
          doc.setFontSize(groupFontSize);
          doc.setTextColor(25, 25, 25);
          const groupLines = doc.splitTextToSize(groupTitle, colGroupW - 5);
          const lineSpacing = 3.3;
          const groupTextH = (groupLines.length - 1) * lineSpacing;
          const groupTextY = groupStartY + (groupTotalH - groupTextH) / 2 + 0.9;
          doc.text(groupLines, M + 2.5, groupTextY);

          // 2. Vẽ từng dòng tiêu chí & ô Yes / No
          items.forEach(item => {
            const rowY = y;

            // Đặt lại màu viền xám và độ dày nét chuẩn trước khi vẽ các ô
            doc.setDrawColor(215, 215, 220);
            doc.setLineWidth(0.25);

            // Ô tiêu chí
            doc.rect(M + colGroupW, rowY, colItemW, rowH, 'S');
            // Ô Yes & No
            doc.rect(M + colGroupW + colItemW, rowY, colYesW, rowH, 'S');
            doc.rect(M + colGroupW + colItemW + colYesW, rowY, colNoW, rowH, 'S');

            // Chữ tiêu chí (căn giữa theo chiều dọc hàng)
            doc.setFont(fontFam, 'normal');
            doc.setFontSize(fontSize);
            doc.setTextColor(35, 35, 35);
            const itemText = item.text || '—';
            const itemLines = doc.splitTextToSize(itemText, colItemW - 5);
            const itemTextH = (itemLines.length - 1) * 3.0;
            const itemTextY = rowY + (rowH - itemTextH) / 2 + 0.8;
            doc.text(itemLines, M + colGroupW + 2.5, itemTextY);

            // Dấu Yes / No
            const yesCenterX = M + colGroupW + colItemW + colYesW / 2;
            const noCenterX = M + colGroupW + colItemW + colYesW + colNoW / 2;
            const symbolCenterY = rowY + rowH / 2;

            if (item.status === 'yes') {
              doc.setDrawColor(34, 138, 61);
              doc.setLineWidth(0.45);
              doc.line(yesCenterX - 1.4, symbolCenterY - 0.2, yesCenterX - 0.4, symbolCenterY + 0.9);
              doc.line(yesCenterX - 0.4, symbolCenterY + 0.9, yesCenterX + 1.5, symbolCenterY - 1.1);
            } else if (item.status === 'no') {
              doc.setDrawColor(201, 42, 42);
              doc.setLineWidth(0.45);
              doc.line(noCenterX - 1.1, symbolCenterY - 1.1, noCenterX + 1.1, symbolCenterY + 1.1);
              doc.line(noCenterX + 1.1, symbolCenterY - 1.1, noCenterX - 1.1, symbolCenterY + 1.1);
            }

            y += rowH;
          });
        });

        y += 6;
      }

      // Kiểm tra ảnh chụp & ghi chú checklist: nếu trang hiện tại không đủ chỗ (như bảng đầy 32 mục), tự động đẩy sang trang mới
      const validChecklistPhotos = (D.checklistPhotos || []).filter(p => p && (p.img || p.imgSub || (p.caption && p.caption.trim())));
      const hasChecklistNotes = !!(D.checklistNotes && D.checklistNotes.trim());
      if (validChecklistPhotos.length > 0 || hasChecklistNotes) {
        if (y + 50 > BOTTOM_LIMIT) {
          addHeader('Check List Photos');
        }
        renderPhotoSection('Check List Photos', D.checklistPhotos, D.checklistNotes, 'Checklist Remarks');
      }

      // Đánh số trang & Footer
      const totalPages = doc.getNumberOfPages();
      const reportName = getReportTitle(D);
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p); 
        doc.setFillColor(...themeRgb); 
        doc.rect(0, 285, W, 12, 'F'); 
        if (!isDarkTheme) {
          doc.setDrawColor(215, 220, 225);
          doc.setLineWidth(0.3);
          doc.line(0, 285, W, 285);
        }
        doc.setTextColor(...headerFooterTextRgb); setPdfTextOpacity(0.7); doc.setFontSize(7); doc.setFont(fontFam, 'normal');
        doc.text(`${reportName} — SOFACOMPANY`, M, 292); doc.text(`Page ${p} of ${totalPages}`, W - M, 292, { align: 'right' });
        setPdfTextOpacity(1);
      }

      const repTitle = (D.reportTitle && D.reportTitle.trim()) || (typeof pdfConfig !== 'undefined' && pdfConfig.reportTitle) || 'PP SAMPLE REVIEW REPORT';
      const parts = [repTitle, D.model, D.desc, D.date].map(s => (s || '').trim()).filter(Boolean);
      const rawFileName = parts.join('_') || 'report';
      const safeFileName = rawFileName.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
      doc.save(`${safeFileName}.pdf`); 
      showToast('✓ PDF đã tải xong!');
      if (typeof window !== 'undefined' && window._lastGeneratedDoc) {
        delete window._lastGeneratedDoc;
      }
      return doc;
    }

    // ═══════════════ PWA SERVICE WORKER REGISTRATION ═══════════════
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
          .then(reg => console.log('[PWA] ServiceWorker đã đăng ký thành công:', reg.scope))
          .catch(err => console.warn('[PWA] Không thể đăng ký ServiceWorker:', err));
      });
    }

    
// Expose all declared functions to window scope for inline HTML handlers
window.addBVRow = addBVRow;
window.addCategoryGroup = addCategoryGroup;
window.addCriterion = addCriterion;
window.addDimSlot = addDimSlot;
window.applyImageFileToTarget = applyImageFileToTarget;
window.applyImportData = applyImportData;
window.applyStraighten = applyStraighten;
window.applyThemeToWeb = applyThemeToWeb;
window.attachDropZone = attachDropZone;
window.autoGrowTextarea = autoGrowTextarea;
window.backupDatabase = backupDatabase;
window.buildDimGrid = buildDimGrid;
window.buildSlotGrid = buildSlotGrid;
window.buildUI = buildUI;
window.canDecodeNatively = canDecodeNatively;
window.closeCamera = closeCamera;
window.closeImportConflictModal = closeImportConflictModal;
window.closePdfStyler = closePdfStyler;
window.convertHeicWithLibheif = convertHeicWithLibheif;
window.copyChecklistFromLatestReport = copyChecklistFromLatestReport;
window.copyDataUrlToClipboard = copyDataUrlToClipboard;
window.copyPhotoFromTarget = copyPhotoFromTarget;
window.dbDelete = dbDelete;
window.dbGet = dbGet;
window.dbGetAll = dbGetAll;
window.dbPut = dbPut;
window.delAssemblyPhoto = delAssemblyPhoto;
window.delBVRow = delBVRow;
window.delDimPhoto = delDimPhoto;
window.delFreePhoto = delFreePhoto;
window.delFreeSlot = delFreeSlot;
window.delSlotPhoto = delSlotPhoto;
window.delTestingPhoto = delTestingPhoto;
window.delWatchoutPhoto = delWatchoutPhoto;
window.deleteSelectedDims = deleteSelectedDims;
window.deleteSelectedReports = deleteSelectedReports;
window.doDuplicateReport = doDuplicateReport;
window.downloadReportJson = downloadReportJson;
window.drawLiveHeaderPreview = drawLiveHeaderPreview;
window.duplicateReportById = duplicateReportById;
window.duplicateSelectedReports = duplicateSelectedReports;
window.editAssemblyPhoto = editAssemblyPhoto;
window.editDimPhoto = editDimPhoto;
window.editFreePhoto = editFreePhoto;
window.editSlotPhoto = editSlotPhoto;
window.editTestingPhoto = editTestingPhoto;
window.editWatchoutPhoto = editWatchoutPhoto;
window.ensureChecklistData = ensureChecklistData;
window.escapeChecklistText = escapeChecklistText;
window.escapeHtml = escapeHtml;
window.exportPDF = exportPDF;
window.findNextCopySuffix = findNextCopySuffix;
window.flipImage = flipImage;
window.flushAutosave = flushAutosave;
window.flushPendingTextUndo = flushPendingTextUndo;
window.formatDimensionMeasurement = formatDimensionMeasurement;
window.getActiveDefaultChecklist = getActiveDefaultChecklist;
window.getAutomaticDimensionColor = getAutomaticDimensionColor;
window.getClipboardImageFiles = getClipboardImageFiles;
window.getCompanyTextRgb = getCompanyTextRgb;
window.getDroppedImageFiles = getDroppedImageFiles;
window.getHeaderFooterTextRgb = getHeaderFooterTextRgb;
window.getLibheifModule = getLibheifModule;
window.getPhotoDataByTarget = getPhotoDataByTarget;
window.getPhotoSize = getPhotoSize;
window.getPhotoSizeActionBtnHtml = getPhotoSizeActionBtnHtml;
window.getPhotoSizePillHtml = getPhotoSizePillHtml;
window.getReportQuickMetrics = getReportQuickMetrics;
window.getReportTitle = getReportTitle;
window.getThemeRgb = getThemeRgb;
window.goHome = goHome;
window.handleConflictAction = handleConflictAction;
window.handleFile = handleFile;
window.handleMultipleDroppedFiles = handleMultipleDroppedFiles;
window.hexToRgbArr = hexToRgbArr;
window.highlightTarget = highlightTarget;
window.importReport = importReport;
window.initBVSortable = initBVSortable;
window.initCachedLogos = initCachedLogos;
window.initChecklistSortable = initChecklistSortable;
window.initCropper = initCropper;
window.initDB = initDB;
window.initHomeDragAndDrop = initHomeDragAndDrop;
window.isColorDark = isColorDark;
window.isFileDrag = isFileDrag;
window.isHeicFile = isHeicFile;
window.isImageFile = isImageFile;
window.loadData = loadData;
window.loadPdfConfig = loadPdfConfig;
window.makeCheck = makeCheck;
window.newReport = newReport;
window.nextSection = nextSection;
window.normalizeDimensionMeasurement = normalizeDimensionMeasurement;
window.normalizeMasterPhoto = normalizeMasterPhoto;
window.normalizeReportPhotos = normalizeReportPhotos;
window.onStylerColorChange = onStylerColorChange;
window.onStylerSliderChange = onStylerSliderChange;
window.onStylerTitleChange = onStylerTitleChange;
window.openPdfStyler = openPdfStyler;
window.openReport = openReport;
window.pasteJsonFromClipboard = pasteJsonFromClipboard;
window.populateStylerUI = populateStylerUI;
window.prevSection = prevSection;
window.processJsonData = processJsonData;
window.pushHistory = pushHistory;
window.pushHistorySnapshot = pushHistorySnapshot;
window.readImageFileAsDataUrl = readImageFileAsDataUrl;
window.redo = redo;
window.refreshAllSlots = refreshAllSlots;
window.refreshSlot = refreshSlot;
window.removeAssemblySubPhoto = removeAssemblySubPhoto;
window.removeCategoryGroup = removeCategoryGroup;
window.removeCriterion = removeCriterion;
window.removeDimSubPhoto = removeDimSubPhoto;
window.removeTestingSubPhoto = removeTestingSubPhoto;
window.removeWatchoutSubPhoto = removeWatchoutSubPhoto;
window.renderAssemblyPhotos = renderAssemblyPhotos;
window.renderBVTable = renderBVTable;
window.renderChecklist = renderChecklist;
window.renderDimStatusShape = renderDimStatusShape;
window.renderFreePhotos = renderFreePhotos;
window.renderHome = renderHome;
window.renderOverviewSummary = renderOverviewSummary;
window.renderSlotHTML = renderSlotHTML;
window.renderTestingPhotos = renderTestingPhotos;
window.renderWatchoutPhotos = renderWatchoutPhotos;
window.resetDefaultChecklist = resetDefaultChecklist;
window.resetHistory = resetHistory;
window.resetPdfConfig = resetPdfConfig;
window.resetTransforms = resetTransforms;
window.resizeImage = resizeImage;
window.resolveHoveredPhotoTarget = resolveHoveredPhotoTarget;
window.resolvePasteTarget = resolvePasteTarget;
window.restoreDatabase = restoreDatabase;
window.retakeFromCamera = retakeFromCamera;
window.retakeFromLibrary = retakeFromLibrary;
window.retakeFromPaste = retakeFromPaste;
window.rotate90 = rotate90;
window.saveBV = saveBV;
window.saveCurrentChecklistAsDefault = saveCurrentChecklistAsDefault;
window.savePdfConfig = savePdfConfig;
window.savePdfConfigAndClose = savePdfConfigAndClose;
window.savePhoto = savePhoto;
window.selectAllDims = selectAllDims;
window.selectAllReports = selectAllReports;
window.setAllChecklistStatus = setAllChecklistStatus;
window.setAssemblyPhotoLayout = setAssemblyPhotoLayout;
window.setBVResult = setBVResult;
window.setCropRatio = setCropRatio;
window.setDimPhotoLayout = setDimPhotoLayout;
window.setTestingPhotoLayout = setTestingPhotoLayout;
window.setText = setText;
window.setVal = setVal;
window.setWatchoutPhotoLayout = setWatchoutPhotoLayout;
window.shareReport = shareReport;
window.shareReportById = shareReportById;
window.shareSelectedReports = shareSelectedReports;
window.showSection = showSection;
window.showToast = showToast;
window.switchStylerTab = switchStylerTab;
window.syncTestingPhotoCaption = syncTestingPhotoCaption;
window.toggleCheck = toggleCheck;
window.toggleChecklistStatus = toggleChecklistStatus;
window.toggleDimSelectMode = toggleDimSelectMode;
window.togglePhotoFullWidth = togglePhotoFullWidth;
window.togglePhotoSize = togglePhotoSize;
window.toggleSelectDimIndex = toggleSelectDimIndex;
window.toggleSelectMode = toggleSelectMode;
window.triggerNativeCamera = triggerNativeCamera;
window.triggerPasteToTarget = triggerPasteToTarget;
window.triggerPickLibrary = triggerPickLibrary;
window.undo = undo;
window.updateBatchUI = updateBatchUI;
window.updateCaption = updateCaption;
window.updateCategoryTitle = updateCategoryTitle;
window.updateCoverLabel = updateCoverLabel;
window.updateCriterionText = updateCriterionText;
window.updateDimBatchUI = updateDimBatchUI;
window.updateDimField = updateDimField;
window.updateTopbar = updateTopbar;
window.updateUndoRedoUI = updateUndoRedoUI;
window.usePhoto = usePhoto;

initDB().then(() => { renderHome(); initHomeDragAndDrop(); }).catch(err => { console.error('Lỗi khởi tạo IndexedDB:', err); showToast('Lỗi bộ nhớ IndexedDB'); });
