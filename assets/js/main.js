/* ==========================================================================
   YunSee CTF Team — 交互脚本
   纯静态：不发起任何网络请求，直接双击 index.html 即可运行。
   ========================================================================== */
(() => {
  'use strict';

  /* ---------------------------------------------------------------- 工具 */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const esc = v => String(v).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fieldLabel = key => (FIELDS.find(f => f.key === key) || {}).label || key;

  // 成员的 field 允许写字符串或数组，统一取成数组处理
  const fieldsOf = m => (Array.isArray(m.field) ? m.field : [m.field]).filter(Boolean);

  /* ------------------------------------------------------------ 统计派生 */
  const STATS = {
    members:  CORE_MEMBERS.length + CLUB_MEMBERS.length,
    awards:   AWARDS.length,
    projects: PROJECTS.length,
    national: AWARDS.filter(a => a.level === '国家级').length,
    intl:     AWARDS.filter(a => a.level === '国际').length,
    champion: AWARDS.filter(a => /冠军|一等奖|第一/.test(a.rank)).length
  };

  /* ======================================================================
     01. 加载屏
     ====================================================================== */
  const boot      = $('#boot');
  const bootFill  = $('#boot-fill');
  const bootPct   = $('#boot-percent');
  const bootState = $('#boot-state');
  const readout   = bootPct.parentElement;

  let repeatVisit = false;
  try { repeatVisit = sessionStorage.getItem('yunsee-booted') === '1'; } catch (_) {}

  const MIN_MS   = repeatVisit ? 950 : 2350;   // 首访完整播完签名笔画
  const startAt  = performance.now();
  let target = 0, shown = 0, finished = false, loadReady = false, rafId = 0;

  const PHASES = [
    [0,  'Initialising'],
    [22, 'Loading roster'],
    [46, 'Decrypting records'],
    [68, 'Building interface'],
    [88, 'Finalising surface'],
    [99, 'Link established']
  ];

  function setTarget(v) { target = Math.max(target, Math.min(100, v)); }

  function placeReadout(p) {
    const h = readout.offsetHeight;
    const edge = innerHeight * p / 100;
    const max = Math.max(18, innerHeight - h - 18);
    readout.style.top = Math.min(max, Math.max(18, edge - h / 2)) + 'px';
  }

  function paint() {
    const p = Math.round(shown);
    bootFill.style.height = shown.toFixed(2) + '%';
    bootPct.textContent = p + '%';
    let label = PHASES[0][1];
    for (const [at, text] of PHASES) if (p >= at) label = text;
    bootState.textContent = label;
    placeReadout(shown);
  }

  function tick() {
    const diff = target - shown;
    shown += diff > 0 ? Math.max(diff * 0.09, 0.22) : 0;
    if (shown > target) shown = target;
    paint();
    if (target >= 100 && shown >= 99.85) { finish(); return; }
    rafId = requestAnimationFrame(tick);
  }

  function gate() {
    if (loadReady && performance.now() - startAt >= MIN_MS) setTarget(100);
    else if (loadReady) setTimeout(gate, 80);
  }

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(rafId);
    shown = 100; paint();
    try { sessionStorage.setItem('yunsee-booted', '1'); } catch (_) {}

    setTimeout(() => boot.classList.add('is-wiping'), 190);
    setTimeout(() => {
      boot.classList.add('is-leaving');
      document.body.classList.add('is-booted');
      drawMark('head');
      flashCards();
    }, 900);
    setTimeout(() => boot.classList.add('is-done'), 1740);
  }

  function skipBoot() {
    if (finished) return;
    target = 100; shown = 100;
    finish();
  }

  function flashCards() {
    const cards = $$('.hero-stat');
    cards.forEach((c, i) => {
      c.style.setProperty('--fd', i * 55 + 'ms');
      c.classList.add('flash');
    });
  }

  function startBoot() {
    if (reduceMotion.matches) {
      boot.classList.add('is-done', 'is-leaving');
      document.body.classList.add('is-booted');
      drawMark('head');                    // 签名直接以完成态显示
      return;
    }
    setTarget(18);
    rafId = requestAnimationFrame(tick);

    $('#boot-skip').addEventListener('click', skipBoot);
    addEventListener('keydown', e => { if (e.key === 'Escape') skipBoot(); });
    addEventListener('resize', () => placeReadout(shown));

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => setTarget(72));
    } else setTarget(72);

    if (document.readyState === 'complete') { loadReady = true; setTarget(92); gate(); }
    else addEventListener('load', () => { loadReady = true; setTarget(92); gate(); });

    // 兜底：任何异常都不应把用户永久困在加载屏。
    // setTimeout 在后台标签页仍会触发，而 rAF 会被节流甚至暂停，因此双保险。
    setTimeout(() => { loadReady = true; setTarget(100); }, 6000);
    setTimeout(skipBoot, 9000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !finished) {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(tick);
      }
    });
  }

  /* ====================================================================
     手写签名 —— Vara.js + Pacifico 单线手写字体
     加载屏 / 页眉 / 页脚三处签名由 vendor 里的 Vara 包按真实字形逐笔绘制。
     字体数据内联为全局常量（vara-font.js），这里转成 Blob URL 喂给
     Vara 的 XHR 加载器，file:// 双击打开同样可用。库缺失或加载失败时静默
     退回容器里的静态兜底字样，不影响加载屏与页面其余部分。
     ==================================================================== */
  const MARKS = {};

  /* Vara 自带的笔画推进是 setInterval + 硬编码 1000/30，也就是无论屏幕多少赫兹
     都只画 30 帧，且定时器不与显示刷新同步，会额外抖动、后台标签页里空转。
     这里把它的逐帧原语换成 requestAnimationFrame：帧率天然跟随设备刷新率
     （60 / 120 / 144Hz 各自匹配），与 vsync 对齐，页面不可见时浏览器自动暂停。
     改的是 prototype 上的方法，vendor 里的库文件保持原厂，升级不会丢。 */
  let varaPatched = false;

  function patchVaraFrameRate() {
    if (varaPatched || typeof Vara !== 'function' || !Vara.prototype.animate) return;
    varaPatched = true;

    // 原签名 animate(path, duration, delay, target)：
    // 等 delay 毫秒后，用 duration 毫秒把 path 的 strokeDashoffset 线性推到 target
    Vara.prototype.animate = function (path, duration, delay, target) {
      const to = +target || 0;
      setTimeout(() => {
        const from = parseFloat(path.style.strokeDashoffset);
        let t0 = 0;
        const step = now => {
          if (!t0) t0 = now;                 // 以第一帧为起点，避免调度抖动吃掉开头
          // duration 为 0 时（reduced-motion 传 1 也几乎等价）直接一帧到位
          const p = duration > 0 ? Math.min(1, (now - t0) / duration) : 1;
          path.style.strokeDashoffset = from + p * (to - from);
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, delay);
    };
  }

  function initMarks() {
    if (typeof Vara !== 'function' || !window.VARA_FONT) return;
    patchVaraFrameRate();

    let fontUrl;
    try {
      fontUrl = URL.createObjectURL(
        new Blob([JSON.stringify(window.VARA_FONT)], { type: 'application/json' }));
    } catch (_) { return; }

    const make = (name, id, opts) => {
      const el = document.getElementById(id);
      if (!el || !el.clientWidth) return;
      el.textContent = '';                       // 移除静态兜底字样，交给 Vara 渲染
      const inst = { el, duration: opts.duration, ready: false, pending: false, busy: 0 };
      try {
        inst.vara = new Vara('#' + id, fontUrl, [{ text: 'YunSee', id: 'sig' }], {
          fontSize: Math.max(14, el.clientWidth / 7),   // 取小值防止 Vara 折行，最终大小由 viewBox 缩放决定
          strokeWidth: 1.1,
          color: '#000',                                // 占位色，实际由 CSS currentColor 接管
          textAlign: 'left',
          autoAnimation: opts.auto && !reduceMotion.matches,
          duration: reduceMotion.matches ? 1 : opts.duration
        });
      } catch (_) { return; }
      inst.vara.ready(() => {
        fitMark(inst.el);
        inst.ready = true;
        if (inst.pending) { inst.pending = false; drawMark(name); }
      });
      MARKS[name] = inst;
    };

    make('boot', 'boot-mark', { auto: true,  duration: repeatVisit ? 1150 : 2050 });
    make('head', 'head-mark', { auto: false, duration: 1050 });
    make('foot', 'foot-mark', { auto: false, duration: 1900 });
  }

  /* Vara 生成的 SVG 是创建时定死的像素尺寸。给它补一个贴合字形包围盒的
     viewBox 并交给 CSS 拉伸，让签名像原先的内联 SVG 一样随容器等比缩放。 */
  function fitMark(el) {
    const svg = el.querySelector('svg');
    if (!svg) return;
    try {
      const bb = svg.getBBox();
      const pad = bb.height * 0.08;
      svg.setAttribute('viewBox',
        [bb.x - pad, bb.y - pad, bb.width + pad * 2, bb.height + pad * 2]
          .map(v => v.toFixed(2)).join(' '));
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      el.style.setProperty('--mark-ratio', ((bb.width + pad * 2) / (bb.height + pad * 2)).toFixed(3));
    } catch (_) { /* 容器不可见时 getBBox 会失败，保持 CSS 里的默认占位比例 */ }
  }

  /* 手写签名绘制控制（页眉：加载完成后首绘 + 悬停重绘；页脚：滚动入场） */
  function drawMark(name) {
    const inst = MARKS[name];
    if (!inst) return;
    if (!inst.ready) { inst.pending = true; return; }
    if (reduceMotion.matches) { inst.vara.draw('sig', 1); return; }
    const now = performance.now();
    if (now < inst.busy) return;               // 上一遍还没画完，跳过这次重绘
    inst.busy = now + inst.duration + 150;
    inst.vara.draw('sig', inst.duration);
  }

  /* ======================================================================
     02. 首屏
     ====================================================================== */
  function renderHero() {
    $('#hero-intro').textContent = SITE.intro;

    // 成立年份只在 data.js 的 SITE.founded 里维护，页眉 / 首屏 / 页脚统一取这里
    $('#topbar-sub').textContent = 'CTF TEAM\nEST. ' + SITE.founded;
    $('#stat-founded').dataset.count = SITE.founded;

    const wm = $('#wordmark-text');
    wm.textContent = '';
    [...SITE.nameUpper].forEach((ch, i) => {
      const clip = document.createElement('span');
      clip.className = 'wm-clip';
      const span = document.createElement('span');
      span.className = 'wm-char';
      span.style.transitionDelay = (40 + i * 52) + 'ms';
      span.textContent = ch;
      clip.appendChild(span);
      wm.appendChild(clip);
    });

    document.title = SITE.name + ' // CTF TEAM';
  }

  /* ======================================================================
     03. 核心成员
     ====================================================================== */
  function renderCore() {
    $('#core-grid').innerHTML = CORE_MEMBERS.map((m, i) => {
      const skills = (m.skills || []).map(([label, v], k) => `
        <div class="skill">
          <b>${esc(label)}</b>
          <span class="skill-bar"><span style="--v:${Number(v)}%;--sd:${0.15 + k * 0.11}s"></span></span>
          <i>${Number(v)}</i>
        </div>`).join('');

      // 按钮始终保留；url 为 '#' 或空时渲染成不可点击的占位态，
      // 避免真的挂 href="#" 点一下跳回页首
      const links = Object.entries(m.links || {}).map(([k, url]) => {
        const label = esc(k.toUpperCase()) + ' ↗';
        return (url && url !== '#')
          ? `<a href="${esc(url)}" target="_blank" rel="noreferrer">${label}</a>`
          : `<span class="is-placeholder" role="link" aria-disabled="true" title="链接待补充">${label}</span>`;
      }).join('');

      const fields = fieldsOf(m);
      const roleLine = [m.name, fields.map(fieldLabel).join(' / '), 'SINCE ' + m.since]
        .map(esc).join(' · ');

      return `
        <article class="core-card" style="--i:${i}">
          <div class="core-top">
            <div class="core-avatar" aria-hidden="true">${esc(m.handle.charAt(0))}</div>
            <span class="core-index">${String(i + 1).padStart(3, '0')} / ${esc(fields[0])}</span>
          </div>
          <h3 class="core-handle">${esc(m.handle)}</h3>
          <p class="core-role">${roleLine}</p>
          <p class="core-bio">${esc(m.bio)}</p>
          <div class="core-skills">${skills}</div>
          ${links ? `<div class="core-links">${links}</div>` : ''}
        </article>`;
    }).join('')
    // 末位固定一张招新卡：既补上网格空位，也把空缺变成招新入口
    + `
        <a class="core-card core-card--open" style="--i:${CORE_MEMBERS.length}" href="#join">
          <div class="core-top">
            <div class="core-avatar" aria-hidden="true">+</div>
            <span class="core-index">OPEN / 招新中</span>
          </div>
          <h3 class="core-handle">虚位以待</h3>
          <p class="core-role">RECRUITING · 常年招新</p>
          <p class="core-bio">不限学校与年级，各方向均在招。填写邮箱投递即可开始。</p>
          <div class="core-skills"></div>
          <div class="core-links"><span class="core-open-cta">加入战队 ↗</span></div>
        </a>`;
  }

  /* 网格补位：卡片数不是列数整倍数时，末行会露出网格底色（--line）像块空灰格。
     列数随断点变化，所以按当前实际列数动态补透明占位格。 */
  function fillGrid(grid) {
    if (!grid) return;
    [...grid.querySelectorAll('.grid-filler')].forEach(el => el.remove());
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
    const items = grid.children.length;
    const need = cols > 1 ? (cols - (items % cols)) % cols : 0;
    for (let i = 0; i < need; i++) {
      const d = document.createElement('div');
      d.className = 'grid-filler';
      d.setAttribute('aria-hidden', 'true');
      grid.appendChild(d);
    }
  }

  function initGridFill() {
    const grids = ['#core-grid', '#proj-grid', '#partner-grid'].map(s => $(s));
    const run = () => grids.forEach(fillGrid);
    run();
    let t;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(run, 150); });
  }

  /* ======================================================================
     04. 俱乐部成员 + 方向筛选
     ====================================================================== */
  let rosterFilter = 'ALL';

  function renderRosterFilter() {
    const used = [...new Set(CLUB_MEMBERS.flatMap(fieldsOf))];
    const keys = ['ALL', ...FIELDS.filter(f => used.includes(f.key)).map(f => f.key)];
    $('#roster-filter').innerHTML = keys.map(k =>
      `<button type="button" data-f="${esc(k)}"${k === rosterFilter ? ' class="active"' : ''}>${esc(k)}</button>`
    ).join('');

    $$('#roster-filter button').forEach(btn => btn.addEventListener('click', () => {
      rosterFilter = btn.dataset.f;
      $$('#roster-filter button').forEach(b => b.classList.toggle('active', b === btn));
      renderRoster();
    }));
  }

  function renderRoster() {
    const list = rosterFilter === 'ALL'
      ? CLUB_MEMBERS
      : CLUB_MEMBERS.filter(m => fieldsOf(m).includes(rosterFilter));

    const body = $('#club-body');
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="5"><div class="roster-empty">该方向暂无成员记录</div></td></tr>`;
    } else {
      body.innerHTML = list.map((m, i) => {
        const tags = fieldsOf(m).map(f =>
          `<span class="tag">${esc(f)} · ${esc(fieldLabel(f))}</span>`).join('');
        return `
        <tr class="roster-row" style="--i:${i}">
          <td class="cell-idx">${String(i + 1).padStart(2, '0')}</td>
          <td class="cell-handle">${esc(m.handle)}</td>
          <td><div class="cell-fields">${tags}</div></td>
          <td class="cell-year">${esc(m.since)}</td>
          <td><span class="tag ${m.status === '在役' ? 'tag--signal' : 'tag--line'}">${esc(m.status)}</span></td>
        </tr>`;
      }).join('');
    }
    $('#roster-count').textContent =
      `${String(list.length).padStart(2, '0')} / ${String(CLUB_MEMBERS.length).padStart(2, '0')} MEMBERS`;
  }

  function renderClubTip() {
    if (typeof CLUB_TIP !== 'object' || !CLUB_TIP) { $('#club-tip').hidden = true; return; }
    $('#club-tip-title').textContent = CLUB_TIP.title || '';
    $('#club-tip-text').textContent  = CLUB_TIP.body  || '';
    const note = $('#club-tip-note');
    note.textContent = CLUB_TIP.note || '';
    note.hidden = !CLUB_TIP.note;
  }

  /* ======================================================================
     05. 战队奖项
     ====================================================================== */
  const AWARD_PREVIEW = 8;          // 默认展示的奖项条数，其余折叠

  function awardItem(a, i) {
    const hot = /冠军|一等奖|第一/.test(a.rank);
    return `
      <li class="award" style="--i:${i}">
        <span class="award-year">${esc(a.year)}</span>
        <div class="award-main">
          <h3>${esc(a.event)}</h3>
          <p>${esc(a.note || '')}</p>
        </div>
        <span class="award-rank">${esc(a.rank)}</span>
        <span class="tag ${hot ? 'tag--signal' : ''}">${esc(a.level)}</span>
      </li>`;
  }

  function renderAwards() {
    const sorted = [...AWARDS].sort((a, b) => b.year - a.year);
    const head = sorted.slice(0, AWARD_PREVIEW);
    const rest = sorted.slice(AWARD_PREVIEW);

    $('#award-list').innerHTML = head.map(awardItem).join('');
    $('#award-more').innerHTML = rest.map(awardItem).join('');

    const wrap   = $('#awards-wrap');
    const more   = $('#awards-more');
    const toggle = $('#awards-toggle');
    const label  = $('#awards-toggle-label');

    if (!rest.length) {            // 奖项不超过 N 条时不显示折叠控件
      toggle.hidden = true;
      more.hidden = true;
      return;
    }

    const closed = `展开全部 ${sorted.length} 项奖项`;
    const opened = `收起 / 仅显示最新 ${AWARD_PREVIEW} 项`;
    toggle.hidden = false;
    label.textContent = closed;

    toggle.addEventListener('click', () => {
      const open = !wrap.classList.contains('is-open');
      wrap.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      more.setAttribute('aria-hidden', String(!open));
      label.textContent = open ? opened : closed;

      // 收起时若视口已滚到列表下方，把页面带回奖项区顶部，避免内容突然塌陷
      if (!open) {
        const top = $('#awards').getBoundingClientRect().top + scrollY - 90;
        if (scrollY > top) {
          scrollTo({ top, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
        }
      }
    });
  }

  /* 数字滚动 */
  const LANG_COLOR = {
    Python: '#3572a5', 'C++': '#f34b7d', C: '#555555', Go: '#00add8',
    Rust: '#dea584', JavaScript: '#f1e05a', TypeScript: '#3178c6',
    Sage: '#8b5cf6', Markdown: '#4b5563', Shell: '#89e051', Java: '#b07219'
  };

  // lang 允许写成 'Go + TypeScript（React + Next.js）' 这类复合串，取第一个能识别的语言取色
  function langColor(lang) {
    if (!lang) return '#101110';
    if (LANG_COLOR[lang]) return LANG_COLOR[lang];
    const hit = String(lang).split(/[\s,+/、·（）()]+/).find(t => LANG_COLOR[t]);
    return LANG_COLOR[hit] || '#101110';
  }

  function countUp(el, to, plain) {
    const from = plain ? Math.max(0, to - 24) : 0;
    const dur = 1100;
    if (reduceMotion.matches) { el.textContent = plain ? to : String(to).padStart(2, '0'); return; }
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (to - from) * e);
      el.textContent = plain ? v : String(v).padStart(2, '0');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function initCounters() {
    const nodes = $$('[data-count], [data-count-key]');
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        const plain = el.hasAttribute('data-plain') || el.hasAttribute('data-count');
        const val = el.hasAttribute('data-count')
          ? Number(el.dataset.count)
          : Number(STATS[el.dataset.countKey] || 0);
        countUp(el, val, plain);
        obs.unobserve(el);
      });
    }, { threshold: .4 });
    nodes.forEach(n => io.observe(n));
  }

  /* ======================================================================
     06. 开源项目
     ====================================================================== */
  function renderProjects() {
    const org = SITE.github.replace(/^https?:\/\/(www\.)?github\.com\/?/, '') || 'GITHUB';
    $('#proj-org').textContent = 'GITHUB / ' + org.toUpperCase();
    $('#proj-all').href = SITE.github;

    $('#proj-grid').innerHTML = PROJECTS.map((p, i) => `
      <a class="proj" style="--i:${i}" href="${esc(p.url)}" target="_blank" rel="noreferrer">
        <div class="proj-top">
          <span class="tag tag--line">${esc(p.tag || 'REPO')}</span>
          <span class="proj-arrow" aria-hidden="true">↗</span>
        </div>
        <h3 class="proj-name">${esc(p.name)}</h3>
        <p class="proj-desc">${esc(p.desc)}</p>
        <div class="proj-foot">
          <span class="proj-lang"><i style="--lang:${esc(langColor(p.lang))}"></i>${esc(p.lang)}</span>
        </div>
      </a>`).join('');
  }

  /* ======================================================================
     07. 合作伙伴
     url 为空时渲染成不可点击的卡片，避免死链
     ====================================================================== */
  function renderPartners() {
    $('#partner-grid').innerHTML = PARTNERS.map((p, i) => {
      const linked = Boolean(p.url);
      const tag = linked ? 'a' : 'div';
      const attrs = linked
        ? ` href="${esc(p.url)}" target="_blank" rel="noreferrer"`
        : ' aria-disabled="true"';
      const foot = linked
        ? '<span class="partner-arrow" aria-hidden="true">↗</span>'
        : '<span class="partner-soon">官网待补</span>';

      return `
        <${tag} class="partner${linked ? ' is-link' : ''}" style="--i:${i}"${attrs}>
          <div class="partner-top">
            <span class="partner-logo">
              <img src="${esc(p.logo)}" alt="${esc(p.name)} logo"
                   width="92" height="92" loading="lazy" decoding="async">
            </span>
            <span class="partner-index">${String(i + 1).padStart(3, '0')}</span>
          </div>
          <h3 class="partner-name">${esc(p.name)}</h3>
          <p class="partner-en">${esc(p.en)}</p>
          <p class="partner-desc">${esc(p.desc)}</p>
          <div class="partner-foot">
            <div class="partner-tags">${(p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
            ${foot}
          </div>
        </${tag}>`;
    }).join('');
  }

  /* ======================================================================
     08. 友链
     ====================================================================== */
  function hostOf(url) {
    try { return new URL(url).host.replace(/^www\./, ''); }
    catch (_) { return String(url).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''); }
  }

  function renderFriends() {
    $('#flink-list').innerHTML = FRIEND_LINKS.map((f, i) => `
      <a class="flink" style="--i:${i}" href="${esc(f.url)}" target="_blank" rel="noreferrer">
        <span class="flink-mark" aria-hidden="true">${esc([...f.name][0] || '#')}</span>
        <div class="flink-main">
          <h3>${esc(f.name)}</h3>
          ${f.desc ? `<p>${esc(f.desc)}</p>` : ''}
        </div>
        <span class="flink-host">${esc(hostOf(f.url))}</span>
        <span class="flink-arrow" aria-hidden="true">↗</span>
      </a>`).join('');

    $('#flink-mail').textContent = SITE.contactEmail;
    $('#flink-count').textContent =
      String(FRIEND_LINKS.length).padStart(2, '0') + ' LINKS';
  }

  /* ======================================================================
     09. 加入战队
     ====================================================================== */
  let pickedField = '';

  function renderJoin() {
    $('#join-list').innerHTML = JOIN_NOTES.map((n, i) => `
      <li>
        <em>${String(i + 1).padStart(2, '0')}</em>
        <div><b>${esc(n.t)}</b><p>${esc(n.d)}</p></div>
      </li>`).join('');

    $('#field-group').innerHTML = FIELDS.map(f =>
      `<button class="pill" type="button" data-k="${esc(f.key)}">${esc(f.key)} · ${esc(f.label)}</button>`
    ).join('');

    $$('#field-group .pill').forEach(btn => btn.addEventListener('click', () => {
      const same = pickedField === btn.dataset.k;
      pickedField = same ? '' : btn.dataset.k;
      $$('#field-group .pill').forEach(b => b.classList.toggle('active', !same && b === btn));
    }));

    $('#join-target').textContent = SITE.joinEmail;
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setMsg(text, kind) {
    const msg = $('#email-msg');
    msg.textContent = text || '';
    msg.className = 'field-msg' + (text ? ' show ' + (kind || '') : '');
    $('#field-email').classList.toggle('is-error', kind === 'err');
  }

  function buildMailto(email, field, note) {
    const subject = `[${SITE.name} 招新申请] ${field ? field + ' / ' : ''}${email}`;
    const body = [
      `战队：${SITE.name} CTF Team`,
      `申请邮箱：${email}`,
      `意向方向：${field ? field + ' · ' + fieldLabel(field) : '（未选择）'}`,
      '',
      '自我介绍：',
      note || '（未填写）',
      '',
      '——',
      `本邮件由 ${SITE.name} 官网招新表单生成`
    ].join('\r\n');

    return `mailto:${SITE.joinEmail}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
  }

  function openMail(url) {
    const a = document.createElement('a');
    a.href = url;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function initJoinForm() {
    const form   = $('#join-form');
    const input  = $('#join-email');
    const submit = $('#join-submit');
    const label  = submit.querySelector('.submit-label');
    const original = label.innerHTML;
    let busy = false;

    input.addEventListener('input', () => { if (input.value) setMsg('', ''); });

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (busy) return;

      const email = input.value.trim();
      if (!email)              { setMsg('请先填写你的邮箱地址', 'err'); input.focus(); return; }
      if (!EMAIL_RE.test(email)) { setMsg('邮箱格式不正确，请检查后重试', 'err'); input.focus(); return; }

      setMsg('校验通过，正在准备申请邮件…', 'ok');
      busy = true;
      submit.classList.add('is-sending');
      label.innerHTML = '正在唤起邮件客户端…';

      const url = buildMailto(email, pickedField, $('#join-note').value.trim());

      setTimeout(() => {
        openMail(url);
        submit.classList.remove('is-sending');
        submit.classList.add('is-sent');
        label.innerHTML = '已唤起默认邮箱 ✓';
        setMsg('若邮件客户端未打开，请手动发送至 ' + SITE.joinEmail, 'ok');

        setTimeout(() => {
          submit.classList.remove('is-sent');
          label.innerHTML = original;
          busy = false;
        }, 3600);
      }, 760);
    });
  }

  /* ======================================================================
     10. 页脚
     ====================================================================== */
  function renderFooter() {
    const words = ['WEB', 'PWN', 'REVERSE', 'CRYPTO', 'MISC', 'BLOCKCHAIN',
                   'FORENSICS', 'AWD', 'RESEARCH', '0DAY', 'WRITEUP'];
    const html = words.map((w, i) => i % 3 === 0 ? `<b>${w}</b>` : `<span>${w}</span>`).join('<span>·</span>');
    $('#ticker-a').innerHTML = html;
    $('#ticker-b').innerHTML = html;

    $('#foot-github').href = SITE.github;
    $('#foot-wiki').href   = SITE.github;
    const mail = $('#foot-mail');
    mail.href = 'mailto:' + SITE.contactEmail;
    mail.textContent = SITE.contactEmail;
    $('#foot-qq').textContent  = 'QQ 群 / ' + SITE.qqGroup;
    $('#foot-loc').textContent = SITE.location;
    $('#foot-name').textContent  = SITE.nameUpper;
    $('#foot-name2').textContent = SITE.name;
    $('#foot-est').textContent   = 'EST. ' + SITE.founded;
    $('#year').textContent = new Date().getFullYear();

    const built = new Date(document.lastModified);
    const pad = n => String(n).padStart(2, '0');
    $('#build-stamp').textContent = isNaN(built)
      ? 'BUILD / STATIC'
      : `BUILD / ${built.getFullYear()}.${pad(built.getMonth() + 1)}.${pad(built.getDate())}`;
  }

  /* ======================================================================
     11. 主题切换
     ====================================================================== */
  function initTheme() {
    const btn = $('#theme-toggle');
    let animating = false;

    const sync = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      btn.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
      btn.setAttribute('title', dark ? '切换到浅色模式' : '切换到深色模式');
      btn.setAttribute('aria-pressed', String(dark));
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#0e0f0e' : '#f6f6f3');
    };

    // 主题已由 head 里的内联脚本定好（默认夜间 / 或读取用户此前的手动选择），
    // 这里不再按 prefers-color-scheme 覆盖，否则浅色系统会把默认拉回白天。
    sync();

    btn.addEventListener('click', async () => {
      if (animating) return;
      const root = document.documentElement;
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      const r = btn.getBoundingClientRect();
      const ox = r.left + r.width / 2;
      const oy = r.top + r.height / 2;
      const radius = Math.hypot(Math.max(ox, innerWidth - ox), Math.max(oy, innerHeight - oy));

      const apply = () => {
        root.dataset.theme = next;
        root.dataset.themeSource = 'manual';
        try { localStorage.setItem('yunsee-theme', next); } catch (_) {}
        sync();
      };

      animating = true;
      btn.classList.remove('theme-spinning');
      void btn.offsetWidth;
      btn.classList.add('theme-spinning');

      if (!document.startViewTransition || reduceMotion.matches) {
        root.classList.add('theme-fallback');
        apply();
        setTimeout(() => {
          root.classList.remove('theme-fallback');
          btn.classList.remove('theme-spinning');
          animating = false;
        }, reduceMotion.matches ? 20 : 420);
        return;
      }

      const vt = document.startViewTransition(apply);
      try {
        await vt.ready;
        root.animate(
          { clipPath: [`circle(0px at ${ox}px ${oy}px)`, `circle(${radius}px at ${ox}px ${oy}px)`] },
          { duration: 680, easing: 'cubic-bezier(.22, 1, .36, 1)', pseudoElement: '::view-transition-new(root)' }
        );
        await vt.finished;
      } catch (_) {
        /* 浏览器取消视觉过渡时主题已生效，忽略即可 */
      } finally {
        btn.classList.remove('theme-spinning');
        animating = false;
      }
    });
  }

  /* ======================================================================
     12. 导航 / 滚动
     ====================================================================== */
  const SECTIONS = ['top', 'core', 'club', 'awards', 'projects', 'partners', 'friends', 'join'];

  function initNav() {
    const topbar = $('#topbar');
    const burger = $('#burger');
    const menu   = $('#menu');
    let ticking = false;

    const closeMenu = () => {
      menu.classList.remove('is-open');
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-locked');
    };

    burger.addEventListener('click', () => {
      const open = !menu.classList.contains('is-open');
      menu.classList.toggle('is-open', open);
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('is-locked', open);
    });
    $$('#menu a').forEach(a => a.addEventListener('click', closeMenu));
    addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

    function updateActive() {
      const probe = scrollY + innerHeight * 0.34;
      let current = SECTIONS[0];
      SECTIONS.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= probe) current = id;
      });
      if (scrollY + innerHeight >= document.body.scrollHeight - 120) current = SECTIONS[SECTIONS.length - 1];

      $$('#topnav a').forEach(a => a.classList.toggle('active', a.dataset.target === current));
      $$('#rail a').forEach(a => a.classList.toggle('active', a.dataset.target === current));
      topbar.classList.toggle('is-stuck', scrollY > 10);
    }

    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { updateActive(); ticking = false; });
    }, { passive: true });

    updateActive();
  }

  /* ======================================================================
     13. 滚动揭示
     ====================================================================== */
  function initReveal() {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); } });
    }, { threshold: .06, rootMargin: '0px 0px -6% 0px' });

    $$('.reveal, [data-stagger]').forEach(el => {
      if (el.hasAttribute('data-stagger')) {
        [...el.children].forEach((c, i) => c.style.setProperty('--i', i));
      }
      io.observe(el);
    });

    // 页脚签名滚动到视野内逐笔绘制
    const footMark = $('#foot-mark');
    const fio = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { drawMark('foot'); fio.disconnect(); } });
    }, { threshold: .35 });
    fio.observe(footMark);

    // 页眉签名：悬停重绘
    $('.topbar-mark').addEventListener('mouseenter', () => drawMark('head'));
  }

  /* ======================================================================
     启动
     ====================================================================== */
  renderHero();
  renderCore();
  renderRosterFilter();
  renderRoster();
  renderClubTip();
  renderAwards();
  renderProjects();
  renderPartners();
  renderFriends();
  renderJoin();
  renderFooter();

  initTheme();
  initNav();
  initGridFill();
  initMarks();
  initReveal();
  initCounters();
  initJoinForm();
  startBoot();
})();
