/* ==========================================================================
   YunSee 文库 — 文献目录 + 站内 PDF 阅读器（library.html）
   --------------------------------------------------------------------------
   阅读器基于自托管的 PDF.js（assets/vendor/pdfjs/，Mozilla 官方 legacy 构建）：
   canvas 逐页渲染，透明文本层叠在页面上，负责选中复制与浏览器原生 Ctrl+F 检索。

   文献数据不直接请求 .pdf，而是读 tools/pack-pdf.py 生成的同名 .pdf.js：
   IDM 等下载工具会拦截 PDF 响应并弹下载框，打包成 JS 经 <script> 加载就不会被拦截，
   双击 file:// 打开时也照常可用。原始 .pdf 只在访客点「下载」时才会被请求。

   本文件是经典脚本，PDF.js 以 import() 按需加载。file:// 下浏览器会拦截 ES 模块，
   此时把同一份数据转成 Blob 交给浏览器内置的 PDF 阅读器显示，页面其余部分照常。
   页眉 / 主题 / 签名 / 页脚 / 滚动揭示 / 统计数字由 main.js 负责（它在本文件之后加载）。
   ========================================================================== */
(() => {
  'use strict';

  /* ---------------------------------------------------------------- 工具 */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const esc = v => String(v).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2  = n => String(n).padStart(2, '0');
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const dots  = date => String(date || '').replace(/-/g, '.');          // 2026-10-08 → 2026.10.08
  const abs   = path => new URL(path, document.baseURI).href;
  const fileName = path => decodeURIComponent(String(path).split('/').pop());

  /* ---------------------------------------------------------------- 常量 */
  // 官方包里是 .mjs，这里改名为 .js（内容未动）：部分静态服务器（如 Windows 上的
  // python -m http.server）把 .mjs 当 text/plain 发送，浏览器会拒绝按模块执行
  const PDFJS_DIR  = 'assets/vendor/pdfjs/';
  const CSS_UNITS  = 96 / 72;      // PDF 点 → CSS 像素：100% 即纸张实际尺寸，与 PDF.js 一致
  const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
  const MIN_SCALE  = 0.25;
  const MAX_SCALE  = 4;
  const AUTO_MAX   = 1.25;         // 默认按宽度适配，但大屏 / 全屏下不超过 125%，避免 A4 被放得过大
  const MAX_PIXELS = 16777216;     // 单页画布像素上限（4096²），高倍屏放大时防止移动端爆内存
  const KEEP_NEAR  = 6;            // 距当前页超过这么多页的画布会被回收，长文档也不会占满内存

  // 目录按发布日期倒序，最新一篇为默认打开的文献
  const DOCS = [...LIBRARY].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  /* ======================================================================
     01. 文献目录
     ====================================================================== */
  function renderIndex() {
    const pages = DOCS.reduce((n, d) => n + (Number(d.pages) || 0), 0);
    $('#lib-count').textContent = `${pad2(DOCS.length)} DOCUMENTS · ${pad2(pages)} PAGES`;
    $('#lib-latest').textContent = DOCS.length ? dots(DOCS[0].date).slice(0, 7) : '—';
    $('#lib-mail').textContent = SITE.contactEmail;

    $('#doc-list').innerHTML = DOCS.map(d => `
      <li class="doc" data-id="${esc(d.id)}">
        <div class="doc-code">
          <b>${esc(d.code)}</b>
          <span>${esc(d.type || 'DOCUMENT')}</span>
        </div>
        <div class="doc-main">
          <h3><a class="doc-open" href="?doc=${encodeURIComponent(d.id)}#reader">${esc(d.title)}</a></h3>
          ${d.subtitle ? `<p>${esc(d.subtitle)}</p>` : ''}
          <div class="doc-tags">
            ${d.status ? `<span class="tag tag--signal">${esc(d.status)}</span>` : ''}
            ${(d.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
          </div>
        </div>
        <div class="doc-meta">
          <span><b>${pad2(d.pages)}</b> PAGES</span>
          <span>${esc(d.size || 'PDF')}</span>
          <span>${esc(dots(d.date))}</span>
        </div>
        <div class="doc-actions">
          <span class="tag tag--ink doc-now">阅读中</span>
          <span class="doc-arrow" aria-hidden="true">→</span>
          <a class="doc-dl" href="${esc(d.file)}" download="${esc(fileName(d.file))}"
             title="下载 PDF" aria-label="下载 ${esc(d.code)} PDF">↓</a>
        </div>
      </li>`).join('');

    $$('#doc-list .doc-open').forEach(a => a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;   // 新标签页打开交给浏览器
      e.preventDefault();
      const doc = DOCS.find(d => d.id === a.closest('.doc').dataset.id);
      if (doc && doc !== R.doc) openDoc(doc);
      $('#reader').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    }));
  }

  /* 阅读区左栏的文献信息表 + 工具栏标题 + 下载链接 */
  function syncDocUI(d) {
    $('#rd-code').textContent = d.code;
    const title = $('#rd-title');
    title.textContent = d.title;
    title.title = d.subtitle ? `${d.title} — ${d.subtitle}` : d.title;

    $('#doc-spec').innerHTML = [
      ['CODE', d.code], ['TYPE', d.type], ['STATUS', d.status],
      ['PAGES', d.pages && pad2(d.pages)], ['SIZE', d.size], ['DATE', dots(d.date)]
    ].filter(([, v]) => v)
     .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

    ['#rd-download', '#spec-download'].forEach(s => {
      const a = $(s);
      a.href = d.file;
      a.setAttribute('download', fileName(d.file));
    });

    $$('#doc-list .doc').forEach(li => li.classList.toggle('is-current', li.dataset.id === d.id));
    document.title = `${d.code} — YunSee // LIBRARY`;

    // 分享链接：默认文献保持干净的 library.html，其余写成 ?doc=<id>（保留 #reader 等锚点）
    try {
      const url = new URL(location.href);
      if (d === DOCS[0]) url.searchParams.delete('doc');
      else url.searchParams.set('doc', d.id);
      if (url.href !== location.href) history.replaceState(null, '', url);
    } catch (_) { /* file:// 下部分浏览器不允许改写地址，忽略即可 */ }
  }

  /* ======================================================================
     02. 阅读器
     ====================================================================== */
  const rd      = $('#rd');
  const stage   = $('#rd-stage');
  const pagesEl = $('#rd-pages');
  const status  = $('#rd-status');
  const note    = $('#rd-note');
  const pageInput = $('#rd-page');

  const R = {
    doc: null,        // 当前文献（LIBRARY 条目）
    gen: 0,           // 每次打开文献 +1，用来丢弃上一份文献迟到的异步结果
    lib: null,        // PDF.js 模块
    task: null,       // 当前 PDFDocumentLoadingTask
    pages: [],        // 每页：{ num, page, w, h, sheet, box, canvasBox, text, ... }
    want: [],         // 视口附近待渲染的页，按离当前页的距离排序
    scale: 1,         // 相对纸张实际尺寸的缩放
    mode: 'auto',     // auto（适宽且 ≤125%）/ width（适宽）/ page（整页）/ manual
    current: 1,
    native: false,    // 已退回浏览器内置阅读器
    blobUrl: ''       // 内置阅读器用的 Blob 地址，关闭文献时回收
  };

  /* ---------------------------------------------------- 加载 PDF.js */
  let pdfjsPromise = null;
  function loadPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import(abs(PDFJS_DIR + 'pdf.min.js')).then(lib => {
        lib.GlobalWorkerOptions.workerSrc = abs(PDFJS_DIR + 'pdf.worker.min.js');
        return lib;
      });
      pdfjsPromise.catch(() => { pdfjsPromise = null; });   // 失败后允许下次重试
    }
    return pdfjsPromise;
  }

  /* ---------------------------------------------------- 加载文献数据
     读 <file>.js 而不是 <file>：打包数据以 PDF 文件名为键挂在 window.YUNSEE_PDF 上 */
  const dataScripts = {};
  function loadData(d) {
    const key = fileName(d.file);
    if (!dataScripts[key]) {
      dataScripts[key] = new Promise((resolve, reject) => {
        const missing = msg => reject(Object.assign(new Error(msg), { name: 'DataMissing' }));
        const s = document.createElement('script');
        s.src = d.file + '.js';
        s.onload = () => {
          const b64 = (window.YUNSEE_PDF || {})[key];
          if (b64) resolve(b64);
          else missing(s.src + ' 里没有 ' + key + ' 的数据');
        };
        s.onerror = () => missing('缺少 ' + s.src + '，请在仓库根目录运行 python tools/pack-pdf.py');
        document.head.appendChild(s);
      });
      dataScripts[key].catch(() => { delete dataScripts[key]; });
    }
    return dataScripts[key].then(b64 => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    });
  }

  /* ---------------------------------------------------- 状态层
     载入分三步显示（取数据 → 启动阅读器 → 渲染），不伪造百分比 */
  const STEPS = ['Fetching document', 'Starting reader', 'Rendering'];

  function showLoading(d) {
    status.classList.remove('is-hidden');
    status.innerHTML = `
      <div class="rd-loading">
        <span class="eyebrow" id="rd-phase">${STEPS[0]}</span>
        <b class="rd-pct" id="rd-pct">01<small> / ${pad2(STEPS.length)}</small></b>
        <span class="rd-track" id="rd-track"><span></span></span>
        <span class="meta">${esc(fileName(d.file))}${d.size ? ' · ' + esc(d.size) : ''}</span>
      </div>`;
    setStep(0);
  }

  function setStep(i) {
    const ph = $('#rd-phase');
    if (!ph) return;
    ph.textContent = STEPS[i];
    $('#rd-pct').firstChild.textContent = pad2(i + 1);
    $('#rd-track').style.setProperty('--p', ((i + 1) / STEPS.length).toFixed(3));
  }

  function hideStatus() { status.classList.add('is-hidden'); }

  // 出错时只给「下载」：不放直链 .pdf 的「新标签页打开」，下载工具会把它也变成下载
  function showError(d, title, text) {
    status.classList.remove('is-hidden');
    status.innerHTML = `
      <div class="rd-error" role="alert">
        <span class="tag">READER ERROR</span>
        <h3>${esc(title)}</h3>
        <p>${esc(text)}</p>
        <div class="rd-error-actions">
          <a class="btn btn--solid" href="${esc(d.file)}" download="${esc(fileName(d.file))}"><span>下载 PDF</span><span>↓</span></a>
        </div>
      </div>`;
  }

  /* 站内阅读器不可用时，把已取到的数据转成 Blob 交给浏览器内置阅读器显示。
     Blob 不走网络，下载工具拦截不到，也不会因此弹下载框 */
  function fallbackNative(d, bytes) {
    R.native = true;
    rd.classList.add('is-native');
    hideStatus();
    note.innerHTML = `
      <span class="tag">FALLBACK</span>
      <p>${location.protocol === 'file:'
        ? '本地双击打开（file://）时浏览器不允许加载站内阅读器，已改用浏览器内置阅读器显示；部署到 http(s) 后自动启用站内阅读器。'
        : '站内阅读器加载失败，已改用浏览器内置阅读器显示。'}</p>`;
    note.hidden = false;

    R.blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const frame = document.createElement('iframe');
    frame.className = 'rd-native';
    frame.src = R.blobUrl;
    frame.title = d.title;
    stage.appendChild(frame);
  }

  /* ---------------------------------------------------- 打开 / 关闭文献 */
  async function teardown() {
    R.pages.forEach(p => {
      if (p.task) p.task.cancel();
      if (p.textLayer) p.textLayer.cancel();
    });
    R.pages = [];
    R.want = [];
    pagesEl.textContent = '';
    $$('.rd-native', stage).forEach(f => f.remove());
    if (R.blobUrl) { URL.revokeObjectURL(R.blobUrl); R.blobUrl = ''; }
    note.hidden = true;
    R.native = false;
    rd.classList.remove('is-ready', 'is-native');
    lockTools(true);

    const task = R.task;
    R.task = null;
    if (task) { try { await task.destroy(); } catch (_) { /* 已销毁 */ } }
  }

  async function openDoc(d) {
    const gen = ++R.gen;
    R.doc = d;
    syncDocUI(d);
    await teardown();
    if (gen !== R.gen) return;
    showLoading(d);

    let bytes = null;
    try {
      const libReady = loadPdfjs();          // 与文献数据并行加载
      libReady.catch(() => {});
      bytes = await loadData(d);
      if (gen !== R.gen) return;
      setStep(1);

      R.lib = await libReady;
      if (gen !== R.gen) return;
      setStep(2);

      // PDF.js 会把数据转交给 worker，原数组随之失效，留一份副本给出错时的内置阅读器
      const task = R.lib.getDocument({ data: bytes.slice(), enableXfa: false });
      R.task = task;
      const pdf = await task.promise;
      if (gen !== R.gen) return;

      const pages = await Promise.all(
        Array.from({ length: pdf.numPages }, (_, i) => pdf.getPage(i + 1)));
      if (gen !== R.gen) return;

      buildPages(pages);
      R.mode = 'auto';
      R.scale = fitScale('auto');
      layout();
      syncZoomUI();
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
      updateView();

      // 等首屏页面画好再撤掉状态层，避免先看到一排空白纸
      await waitFirstPaint(gen);
      if (gen !== R.gen) return;
      rd.classList.add('is-ready');
      hideStatus();
      renderAllText(gen);
    } catch (err) {
      if (gen !== R.gen) return;
      fail(d, err, bytes);
    }
  }

  function fail(d, err, bytes) {
    const name = err && err.name;
    console.warn('[YunSee 文库] 站内阅读器无法打开', d.file, err);
    if (name === 'DataMissing') {
      showError(d, '找不到这份文献', '文献数据缺失或已被移动，可以先下载原始 PDF 阅读，或通过页脚邮箱联系我们。');
    } else if (name === 'InvalidPDFException') {
      showError(d, '文件无法解析', '这份 PDF 似乎已损坏，可以尝试下载后用本地阅读器打开。');
    } else if (bytes) {
      // 数据已到手，只是 PDF.js 没起来（file:// 拦截 ES 模块、老旧浏览器等）
      fallbackNative(d, bytes);
    } else {
      showError(d, '阅读器加载失败', '可以先下载原始 PDF 阅读，或稍后刷新重试。');
    }
  }

  function waitFirstPaint(gen) {
    return new Promise(resolve => {
      const t0 = performance.now();
      const check = () => {
        const first = R.want[0];
        if (gen !== R.gen || !first || first.renderedScale || first.failed ||
            performance.now() - t0 > 2500) resolve();
        else setTimeout(check, 40);
      };
      check();
    });
  }

  /* ---------------------------------------------------- 页面骨架 */
  function buildPages(pages) {
    const total = pages.length;
    const frag = document.createDocumentFragment();
    R.current = 1;
    R.pages = pages.map((page, i) => {
      const base = page.getViewport({ scale: 1 });   // 已计入 /Rotate 与 UserUnit
      const sheet = document.createElement('div');
      sheet.className = 'rd-sheet';
      sheet.style.setProperty('--i', i);
      sheet.innerHTML = `
        <div class="rd-label"><span><b>${pad2(i + 1)}</b>/ ${pad2(total)}</span><span>${esc(R.doc.code)}</span></div>
        <div class="rd-page" style="--user-unit:${page.userUnit || 1}">
          <div class="rd-canvas"></div>
          <div class="textLayer"></div>
        </div>`;
      frag.appendChild(sheet);
      const box = sheet.querySelector('.rd-page');
      return {
        num: i + 1, page, w: base.width, h: base.height,
        sheet, box,
        label: sheet.querySelector('.rd-label'),
        canvasBox: box.querySelector('.rd-canvas'),
        text: box.querySelector('.textLayer'),
        task: null, renderedScale: 0, failed: false,
        textLayer: null, textReady: false, textScale: 0
      };
    });
    pagesEl.appendChild(frag);

    lockTools(false);
    $('#rd-total').textContent = '/ ' + pad2(total);
    setCurrent(1, true);
  }

  /* 按当前缩放写入每页尺寸；画布先被 CSS 拉伸占位，随后再按新尺寸重绘 */
  function layout() {
    const s = R.scale * CSS_UNITS;
    R.pages.forEach(p => {
      p.box.style.width  = Math.floor(p.w * s) + 'px';
      p.box.style.height = Math.floor(p.h * s) + 'px';
      p.box.style.setProperty('--scale-factor', s);
    });
  }

  /* ---------------------------------------------------- 渲染 */
  async function renderPage(p) {
    const gen = R.gen, scale = R.scale;
    const viewport = p.page.getViewport({ scale: scale * CSS_UNITS });

    let ratio = window.devicePixelRatio || 1;
    const area = viewport.width * viewport.height;
    if (area * ratio * ratio > MAX_PIXELS) ratio = Math.sqrt(MAX_PIXELS / area);

    const canvas = document.createElement('canvas');
    canvas.width  = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);

    const task = p.page.render({
      canvas,
      viewport,
      transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined
    });
    p.task = task;
    try {
      await task.promise;
    } catch (err) {
      if (err && err.name === 'RenderingCancelledException') return;
      throw err;
    } finally {
      if (p.task === task) p.task = null;
    }
    if (gen !== R.gen) return;

    p.canvasBox.replaceChildren(canvas);      // 新画布画好后再替换，缩放时不闪白
    p.renderedScale = scale;
    syncText(p);
  }

  let rendering = false;
  function pump() {
    if (rendering) return;
    const p = R.want.find(pg => pg.renderedScale !== R.scale && !pg.failed);
    if (!p) return;
    rendering = true;
    renderPage(p)
      .catch(err => { p.failed = true; console.warn('[YunSee 文库] 第 ' + p.num + ' 页渲染失败', err); })
      .finally(() => { rendering = false; pump(); });
  }

  /* 文本层：后台逐页建好，保证 Ctrl+F 能搜到全文（不只是已滚到的页） */
  async function ensureText(p) {
    if (p.textLayer) return;
    const tl = new R.lib.TextLayer({
      textContentSource: p.page.streamTextContent({ includeMarkedContent: true, disableNormalization: true }),
      container: p.text,
      viewport: p.page.getViewport({ scale: R.scale * CSS_UNITS })
    });
    p.textLayer = tl;
    p.textScale = R.scale;
    try { await tl.render(); } catch (_) { return; }   // 切换文献时被取消
    const end = document.createElement('div');
    end.className = 'endOfContent';
    p.text.appendChild(end);
    p.textReady = true;
    syncText(p);
  }

  // 位置与字号随 CSS 变量自动缩放，这里只校正每段文字的横向拉伸
  function syncText(p) {
    if (!p.textReady || p.textScale === R.scale) return;
    p.textLayer.update({ viewport: p.page.getViewport({ scale: R.scale * CSS_UNITS }) });
    p.textScale = R.scale;
  }

  async function renderAllText(gen) {
    for (const p of R.pages) {
      if (gen !== R.gen) return;
      await ensureText(p);
      await new Promise(r => setTimeout(r, 0));    // 让出主线程，滚动不卡
    }
  }

  /* 距当前页很远的画布回收掉，回到附近时重绘 */
  function evict() {
    if (R.pages.length <= KEEP_NEAR * 2 + 1) return;
    R.pages.forEach(p => {
      if (p.renderedScale && Math.abs(p.num - R.current) > KEEP_NEAR && !R.want.includes(p)) {
        p.canvasBox.textContent = '';
        p.renderedScale = 0;
      }
    });
  }

  /* ---------------------------------------------------- 视口：当前页 / 进度 / 待渲染 */
  let viewTimer = 0, viewFrame = 0;
  function queueView(delay) {
    clearTimeout(viewTimer);
    cancelAnimationFrame(viewFrame);
    if (delay) viewTimer = setTimeout(updateView, delay);
    else viewFrame = requestAnimationFrame(updateView);
  }

  function updateView() {
    if (!R.pages.length) return;
    const top = stage.scrollTop, h = stage.clientHeight;
    const probe = top + h * 0.3;
    let current = 1;
    const want = [];
    for (const p of R.pages) {
      const y = p.sheet.offsetTop, b = y + p.sheet.offsetHeight;
      if (y <= probe) current = p.num;
      if (b > top - h * 0.5 && y < top + h * 1.5) want.push(p);
    }
    const max = stage.scrollHeight - h;
    if (max > 0 && top >= max - 2) current = R.pages.length;   // 滚到底时末页可能永远够不到探测线

    want.sort((a, b) => Math.abs(a.num - current) - Math.abs(b.num - current));
    R.want = want;
    setCurrent(current);
    $('#rd-progress').style.setProperty('--p', (max > 0 ? clamp(top / max, 0, 1) : 1).toFixed(4));
    evict();
    pump();
  }

  // 没有可翻的页面时（载入中 / 出错 / 内置阅读器）锁住翻页与缩放，避免按了没反应
  function lockTools(locked) {
    ['#rd-prev', '#rd-next', '#rd-out', '#rd-in', '#rd-fit-width', '#rd-fit-page']
      .forEach(s => { $(s).disabled = locked; });
    pageInput.disabled = locked;
    if (locked) {
      pageInput.value = '—';
      $('#rd-total').textContent = '/ —';
      $('#rd-scale').textContent = '—';
      $('#rd-progress').style.setProperty('--p', 0);
    }
  }

  function setCurrent(n, force) {
    if (n === R.current && !force) return;
    R.current = n;
    R.pages.forEach(p => p.sheet.classList.toggle('is-current', p.num === n));
    if (document.activeElement !== pageInput) pageInput.value = String(n);
    $('#rd-prev').disabled = n <= 1;
    $('#rd-next').disabled = n >= R.pages.length;
  }

  function go(n) {
    if (!R.pages.length) return;
    n = clamp(Math.round(n), 1, R.pages.length);
    const p = R.pages[n - 1];
    stage.scrollTop = p.sheet.offsetTop - 14;
    setCurrent(n);
  }

  /* ---------------------------------------------------- 缩放 */
  function fitScale(mode) {
    const p = R.pages[R.current - 1] || R.pages[0];
    if (!p) return 1;
    const cs = getComputedStyle(pagesEl);
    const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2;
    const byWidth = availW / (p.w * CSS_UNITS);
    if (mode === 'page') {
      const label = p.label.offsetHeight + parseFloat(getComputedStyle(p.label).marginBottom);
      const availH = stage.clientHeight - label - 32;
      return clamp(Math.min(byWidth, availH / (p.h * CSS_UNITS)), MIN_SCALE, MAX_SCALE);
    }
    return clamp(mode === 'auto' ? Math.min(byWidth, AUTO_MAX) : byWidth, MIN_SCALE, MAX_SCALE);
  }

  // 记下 (px, py) 处对应的页面位置，缩放后把同一位置放回原处（滚轮缩放跟随鼠标）
  function anchorAt(px, py) {
    const x = stage.scrollLeft + px, y = stage.scrollTop + py;
    const p = R.pages.find(pg => pg.box.offsetTop + pg.box.offsetHeight >= y) || R.pages[R.pages.length - 1];
    return {
      p, px, py,
      fx: (x - p.box.offsetLeft) / p.box.offsetWidth,
      fy: (y - p.box.offsetTop) / p.box.offsetHeight
    };
  }

  function zoomTo(next, mode, px, py) {
    if (!R.pages.length) return;
    next = clamp(Math.round(next * 1000) / 1000, MIN_SCALE, MAX_SCALE);
    R.mode = mode;
    if (Math.abs(next - R.scale) >= 0.001) {
      const a = anchorAt(px == null ? stage.clientWidth / 2 : px, py == null ? stage.clientHeight / 2 : py);
      R.scale = next;
      layout();
      const b = a.p.box;
      stage.scrollTop  = b.offsetTop  + a.fy * b.offsetHeight - a.py;
      stage.scrollLeft = b.offsetLeft + a.fx * b.offsetWidth  - a.px;
      queueView(140);                  // 连续缩放时等手停下再重绘
    }
    syncZoomUI();
  }

  function stepZoom(dir) {
    const cur = R.scale;
    const next = dir > 0
      ? ZOOM_STEPS.find(z => z > cur + 0.005) || MAX_SCALE
      : [...ZOOM_STEPS].reverse().find(z => z < cur - 0.005) || MIN_SCALE;
    zoomTo(next, 'manual');
  }

  function setMode(mode) {
    const n = R.current;
    zoomTo(fitScale(mode), mode);
    if (mode === 'page') go(n);
  }

  function syncZoomUI() {
    $('#rd-scale').textContent = Math.round(R.scale * 100) + '%';
    $('#rd-out').disabled = R.scale <= MIN_SCALE + 0.001;
    $('#rd-in').disabled  = R.scale >= MAX_SCALE - 0.001;
    $('#rd-fit-width').setAttribute('aria-pressed', String(R.mode === 'width'));
    $('#rd-fit-page').setAttribute('aria-pressed', String(R.mode === 'page'));
  }

  /* ---------------------------------------------------- 交互绑定 */
  function initReader() {
    $('#rd-prev').addEventListener('click', () => go(R.current - 1));
    $('#rd-next').addEventListener('click', () => go(R.current + 1));
    $('#rd-out').addEventListener('click', () => stepZoom(-1));
    $('#rd-in').addEventListener('click', () => stepZoom(1));
    $('#rd-fit-width').addEventListener('click', () => setMode(R.mode === 'width' ? 'auto' : 'width'));
    $('#rd-fit-page').addEventListener('click', () => setMode(R.mode === 'page' ? 'auto' : 'page'));

    // 页码输入：回车跳转，失焦还原成当前页
    pageInput.addEventListener('focus', () => pageInput.select());
    pageInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { go(parseInt(pageInput.value, 10) || R.current); pageInput.blur(); }
      if (e.key === 'Escape') pageInput.blur();
    });
    pageInput.addEventListener('blur', () => { pageInput.value = R.pages.length ? String(R.current) : '—'; });

    // 键盘：焦点在阅读器内时，← → 翻页，+ − 缩放（↑ ↓ 空格 PageUp/Down 保持原生滚动）
    rd.addEventListener('keydown', e => {
      if (!R.pages.length || e.target === pageInput || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowLeft') go(R.current - 1);
      else if (e.key === 'ArrowRight') go(R.current + 1);
      else if (e.key === '+' || e.key === '=') stepZoom(1);
      else if (e.key === '-' || e.key === '_') stepZoom(-1);
      else return;
      e.preventDefault();
    });

    // Ctrl + 滚轮 / 触控板双指捏合：只缩放文献，不缩放整个网页
    stage.addEventListener('wheel', e => {
      if (!e.ctrlKey || !R.pages.length) return;
      e.preventDefault();
      const delta = clamp(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, -120, 120);
      const r = stage.getBoundingClientRect();
      zoomTo(R.scale * Math.exp(-delta * 0.0022), 'manual', e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    stage.addEventListener('scroll', () => queueView(0), { passive: true });

    // 尺寸变化（窗口缩放 / 全屏 / 横竖屏）：适配模式下重算缩放
    let lastW = 0, lastH = 0;
    const onResize = () => {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || (w === lastW && h === lastH)) return;
      lastW = w; lastH = h;
      if (!R.pages.length) return;
      if (R.mode === 'manual') queueView(0);
      else zoomTo(fitScale(R.mode), R.mode);
    };
    if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(onResize)).observe(stage);
    else addEventListener('resize', onResize);

    // 拖选文字时让 endOfContent 铺满文本层，选区不会跳到页首（同 PDF.js 官方查看器）
    pagesEl.addEventListener('mousedown', e => {
      const layer = e.target.closest('.textLayer');
      if (layer) layer.classList.add('selecting');
    });
    document.addEventListener('mouseup', () =>
      $$('.textLayer.selecting', pagesEl).forEach(t => t.classList.remove('selecting')));

    // 全屏阅读（iPhone Safari 不支持元素全屏，按钮直接隐藏）
    const full = $('#rd-full');
    if (!document.fullscreenEnabled || !rd.requestFullscreen) full.hidden = true;
    full.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else rd.requestFullscreen().catch(() => {});
    });
    document.addEventListener('fullscreenchange', () => {
      const on = document.fullscreenElement === rd;
      rd.classList.toggle('is-full', on);
      full.setAttribute('aria-label', on ? '退出全屏' : '全屏阅读');
      full.title = on ? '退出全屏（Esc）' : '全屏阅读';
      if (on) stage.focus({ preventScroll: true });
    });

    lockTools(true);
    const wanted = new URLSearchParams(location.search).get('doc');
    const doc = DOCS.find(d => d.id === wanted) || DOCS[0];
    if (doc) openDoc(doc);
    else {
      $('#rd-title').textContent = '暂无文献';
      status.innerHTML = '<div class="rd-error"><span class="tag">EMPTY</span><h3>文库暂未收录文献</h3></div>';
    }
  }

  /* ======================================================================
     启动
     ====================================================================== */
  renderIndex();
  initReader();
})();
