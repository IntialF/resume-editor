/* ============================================================
 * 简历编辑器 — 应用逻辑
 * - 单一状态 state，编辑区 input 事件只更新状态（不重建表单，避免失焦）
 * - 预览由「内容单元 → 离屏测量 → 贪心装页」生成真实 A4 页面
 * - 打印使用与预览完全相同的 px 尺寸，做到所见即所得
 * ============================================================ */

(function () {
  'use strict';

  /* ---------------- 常量 ---------------- */
  const STORAGE_KEY = 'resume-editor-v1';
  const PAGE_W = 794;   // A4 @ 96dpi
  const PAGE_H = 1123;
  const PAGE_GAP = 26;  // 屏幕上两页之间的间距

  const ACCENTS = ['#2f6df6', '#1f2937', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#0369a1'];

  const TYPES = {
    education: {
      label: '教育经历', en: 'Education',
      fields: {
        title:    ['学校 / 院校', '例如：浙江大学'],
        subtitle: ['专业 / 学位', '例如：计算机科学与技术 · 本科'],
        meta:     ['补充信息', '例如：GPA 3.8 / 专业前 5%'],
        date:     ['就读时间', '2016.09 – 2020.06'],
        link:     ['相关链接', '可留空']
      },
      itemLabel: '添加教育经历'
    },
    work: {
      label: '工作经历', en: 'Experience',
      fields: {
        title:    ['公司名称', '例如：某某科技有限公司'],
        subtitle: ['担任职位', '例如：高级前端工程师'],
        meta:     ['部门 / 地点', '例如：技术中台 · 上海'],
        date:     ['在职时间', '2022.03 – 至今'],
        link:     ['相关链接', '可留空']
      },
      itemLabel: '添加工作经历'
    },
    project: {
      label: '项目经历', en: 'Projects',
      fields: {
        title:    ['项目名称', '例如：企业级数据可视化平台'],
        subtitle: ['担任角色', '例如：前端负责人'],
        meta:     ['技术栈', '例如：Vue 3 / TypeScript / ECharts'],
        date:     ['起止时间', '2023.01 – 2023.09'],
        link:     ['项目链接', '例如：github.com/xxx']
      },
      itemLabel: '添加项目经历'
    },
    skill: {
      // 整块文本编辑：不使用逐条字段，一个模块只有一个多行文本框
      label: '专业技能', en: 'Skills', fields: {}, itemLabel: '技能'
    },
    award: {
      label: '荣誉奖项', en: 'Awards',
      fields: {
        title:    ['奖项名称', '例如：年度优秀员工'],
        subtitle: ['颁发机构', '例如：某某科技有限公司'],
        meta:     ['补充说明', '可留空'],
        date:     ['获奖时间', '2023.12'],
        link:     ['相关链接', '可留空']
      },
      itemLabel: '添加奖项'
    },
    custom: {
      label: '自定义模块', en: 'More',
      fields: {
        title:    ['条目标题', '例如：志愿服务'],
        subtitle: ['副标题', '例如：组织者'],
        meta:     ['补充信息', '可留空'],
        date:     ['时间', '可留空'],
        link:     ['相关链接', '可留空']
      },
      itemLabel: '添加条目'
    }
  };

  const BASICS_FIELDS = [
    { key: 'name',     label: '姓名',       ph: '张明' },
    { key: 'jobTitle', label: '求职意向 / 头衔', ph: '高级前端工程师' },
    { key: 'phone',    label: '手机',       ph: '138 0000 0000' },
    { key: 'email',    label: '邮箱',       ph: 'zhangming@example.com' },
    { key: 'location', label: '所在城市',   ph: '上海' },
    { key: 'website',  label: '个人主页 / GitHub', ph: 'github.com/zhangming' },
    { key: 'summary',  label: '个人简介',   ph: '一段简短的自我评价…', textarea: true, span2: true }
  ];

  const DEMO = {
    basics: {
      name: '张明',
      jobTitle: '高级前端工程师',
      phone: '138 0000 0000',
      email: 'zhangming@example.com',
      location: '上海',
      website: 'github.com/zhangming',
      summary: '**6 年前端开发经验**，专注复杂 Web 应用架构与性能优化。主导过多个从 0 到 1 的中后台与数据可视化项目，熟悉工程化体系建设，具备良好的跨团队协作与技术推动能力。'
    },
    sections: [
      {
        id: uid(), type: 'work', title: '工作经历', visible: true,
        items: [
          {
            id: uid(), title: '星海科技有限公司', subtitle: '高级前端工程师',
            meta: '技术中台部 · 上海', date: '2022.03 – 至今', link: '',
            points: '负责企业级数据平台的前端架构设计，主导从 Vue 2 到 Vue 3 + TypeScript 的渐进式迁移，覆盖 40+ 业务页面。\n设计并落地统一组件库，沉淀 60+ 通用组件，被 5 条业务线复用，**需求交付效率提升约 35%**。\n推动首屏性能优化，通过路由懒加载、资源预加载与大数据虚拟滚动，将**首屏时间从 3.2s 降至 1.4s**。\n带领 4 人前端小组，建立代码评审与单元测试规范，线上缺陷率同比下降 42%。'
          },
          {
            id: uid(), title: '云图信息技术有限公司', subtitle: '前端工程师',
            meta: '产品研发部 · 杭州', date: '2020.07 – 2022.02', link: '',
            points: '参与 SaaS 协作产品的核心模块开发，独立完成权限系统、消息中心与富文本编辑器。\n搭建基于 Webpack 的工程化脚手架，统一构建流程，构建耗时降低约 30%。\n负责小程序端 H5 混合开发，支撑日均 10 万+ 访问量。'
          }
        ]
      },
      {
        id: uid(), type: 'project', title: '项目经历', visible: true,
        items: [
          {
            id: uid(), title: '企业级数据可视化平台', subtitle: '前端负责人',
            meta: 'Vue 3 / TypeScript / ECharts / Pinia', date: '2023.01 – 2023.09', link: '',
            points: '从 0 到 1 搭建可视化搭建平台，支持拖拽生成仪表盘，已服务 300+ 内部业务同学。\n抽象图表配置 schema，实现 20+ 图表类型的动态渲染与主题切换。\n设计大数据量下的分片渲染方案，万级数据点渲染保持 60fps。'
          },
          {
            id: uid(), title: '开源组件库 Orbit UI', subtitle: '发起人 / 主要维护者',
            meta: 'React / Vite / Rollup / Vitest', date: '2022.09 – 至今', link: 'github.com/zhangming/orbit-ui',
            points: '面向中后台场景的轻量组件库，GitHub 1.2k+ Star，累计发布 30+ 版本。\n实现按需加载、无障碍支持与完整 TypeScript 类型定义。'
          }
        ]
      },
      {
        id: uid(), type: 'education', title: '教育经历', visible: true,
        items: [
          {
            id: uid(), title: '浙江大学', subtitle: '计算机科学与技术 · 本科',
            meta: 'GPA 3.8 / 4.0 · 校级优秀毕业生', date: '2016.09 – 2020.06', link: '',
            points: '主修课程：数据结构、操作系统、计算机网络、软件工程。\n校 ACM 集训队成员，获省级程序设计竞赛二等奖。'
          },
          {
            id: uid(), title: '浙江大学', subtitle: '软件工程 · 硕士（保送）',
            meta: '研究方向：人机交互与可视化', date: '2020.09 – 2022.06', link: '',
            points: ''
          }
        ]
      },
      {
        id: uid(), type: 'skill', title: '专业技能', visible: true,
        content: '**前端开发**：JavaScript / TypeScript、Vue 3 / React、HTML5 / CSS3 与响应式布局；具备大型 SPA 架构经验，主导过多个从 0 到 1 的中后台与数据可视化项目，熟悉组件库设计与首屏性能调优。\n**工程化**：Vite / Webpack / Rollup、pnpm Monorepo、CI/CD 与 ESLint，熟悉构建性能优化。\n**测试与质量**：Vitest / Jest、Playwright，单元测试与端到端测试体系建设。\n**其他能力**：Node.js 基础、ECharts / D3 数据可视化、英语 CET-6。',
        items: []
      },
      {
        id: uid(), type: 'award', title: '荣誉与证书', visible: true,
        items: [
          { id: uid(), title: '年度优秀员工', subtitle: '星海科技有限公司', meta: '', date: '2023.12', link: '', points: '' },
          { id: uid(), title: '浙江省大学生程序设计竞赛 二等奖', subtitle: '浙江省教育厅', meta: '', date: '2019.05', link: '', points: '' }
        ]
      }
    ],
    settings: {
      template: 'modern', accent: '#2f6df6', fontSize: 'mid', density: 'normal',
      custom: {
        fontSize: 13, lineHeight: 1.62, itemGap: 13, secGap: 20,
        fontTouched: false, spacingTouched: false
      },
      margin: 'normal', font: 'sans', showFooter: true
    }
  };

  const DENSITY = {
    compact: { lh: 1.48, itemGap: 8,  secGap: 13 },
    normal:  { lh: 1.62, itemGap: 13, secGap: 20 },
    loose:   { lh: 1.78, itemGap: 19, secGap: 27 }
  };
  const FONT_SIZE = { small: 12, mid: 13, large: 14 };
  const MARGIN    = { narrow: 40, normal: 52, wide: 66 };
  // 自定义字号 / 间距的允许范围
  const CUSTOM_LIMITS = {
    fontSize:   { min: 10,  max: 20,  step: 0.5  },
    lineHeight: { min: 1.1, max: 2.4, step: 0.02 },
    itemGap:    { min: 0,   max: 40,  step: 1    },
    secGap:     { min: 0,   max: 50,  step: 1    }
  };

  /* ---------------- 状态 ---------------- */
  let state = load() || normalize(JSON.parse(JSON.stringify(DEMO)));
  let ui = { collapsed: new Set(), settingsOpen: false, drag: null, dropEl: null, dropPlace: null };
  let zoomMode = 'fit';
  let zoomManual = 1;
  let saveTimer = null, previewTimer = null, toastTimer = null;

  const $ = (sel) => document.querySelector(sel);
  const editorRoot = $('#sectionsRoot');
  const basicsBody = $('#basicsBody');
  const paperStage = $('#paperStage');
  const previewScroll = $('#previewScroll');
  const measureHost = $('#measureHost');

  /* ---------------- 工具 ---------------- */
  function uid() { return 'x' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // 轻量富文本：**文字** 表示加粗。先转义再解析，保证不会注入 HTML
  function rich(v) {
    return esc(v).replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  }
  function plain(v) { return String(v == null ? '' : v).replace(/\*\*/g, ''); }
  function fmtToolbar(hint) {
    return `<div class="field-toolbar">
      <button type="button" class="fmt-btn" data-fmt="bold" title="加粗选中文字（Ctrl+B）"><b>B</b></button>
      <span class="fmt-hint">${esc(hint || '选中文字后按 Ctrl+B 加粗，或手动输入 **文字**')}</span>
    </div>`;
  }
  // 选中文字 → 包裹/取消 **加粗** 标记
  function toggleBold(el) {
    if (!el || el.selectionStart == null) return;
    const start = el.selectionStart, end = el.selectionEnd, v = el.value;
    if (start === end) { toast('请先选中要加粗的文字'); return; }
    const before = v.slice(0, start), sel = v.slice(start, end), after = v.slice(end);
    if (!sel.replace(/\*/g, '').trim()) { toast('请选中要加粗的文字'); return; }
    let nv, ns, ne;
    if (sel.startsWith('**') && sel.endsWith('**') && sel.length > 4) {
      const inner = sel.slice(2, -2);
      nv = before + inner + after; ns = start; ne = start + inner.length;
    } else if (before.endsWith('**') && after.startsWith('**')) {
      nv = before.slice(0, -2) + sel + after.slice(2); ns = start - 2; ne = end - 2;
    } else {
      nv = before + '**' + sel + '**' + after; ns = start + 2; ne = end + 2;
    }
    el.value = nv;
    el.focus();
    el.setSelectionRange(ns, ne);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function debounceSave() {
    $('#saveState').classList.add('saving');
    $('#saveState').lastChild.textContent = '保存中…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        $('#saveState').classList.remove('saving');
        $('#saveState').lastChild.textContent = '已自动保存';
      } catch (e) { toast('本地保存失败：' + e.message); }
    }, 350);
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalize(JSON.parse(raw));
    } catch (e) { return null; }
  }
  function normalize(d) {
    const st = Object.assign(clone(DEMO.settings), d && d.settings || {});
    // 兼容旧数据：补齐全套自定义数值，并校验预设键
    st.custom = Object.assign(clone(DEMO.settings.custom), (d && d.settings && d.settings.custom) || {});
    if (!FONT_SIZE[st.fontSize] && st.fontSize !== 'custom') st.fontSize = 'mid';
    if (!DENSITY[st.density] && st.density !== 'custom') st.density = 'normal';
    const out = {
      basics: Object.assign({ name: '', jobTitle: '', phone: '', email: '', location: '', website: '', summary: '' }, d && d.basics || {}),
      sections: [],
      settings: st
    };
    if (d && Array.isArray(d.sections)) {
      d.sections.forEach(s => {
        if (!s || !TYPES[s.type]) return;
        const sec = {
          id: s.id || uid(), type: s.type, title: String(s.title || TYPES[s.type].label),
          visible: s.visible !== false,
          items: (Array.isArray(s.items) ? s.items : []).map(it => ({
            id: it && it.id || uid(),
            title: String(it && it.title || ''), subtitle: String(it && it.subtitle || ''),
            meta: String(it && it.meta || ''), date: String(it && it.date || ''),
            link: String(it && it.link || ''), points: String(it && it.points || '')
          }))
        };
        if (s.type === 'skill') {
          // 技能模块改为整块文本；旧版分栏数据自动合并成「每行一条」
          sec.content = typeof s.content === 'string' ? s.content : '';
          if (!sec.content.trim() && sec.items.length) {
            sec.content = sec.items.map(it => {
              const t = String(it.title || '').trim();
              let v = String(it.subtitle || '').trim() || String(it.points || '').trim();
              // 旧分栏数据里内容常重复写了类别名，合并成整块时去掉重复前缀
              if (t && (v.startsWith(t + '：') || v.startsWith(t + ':'))) v = v.slice(t.length + 1).trim();
              if (!t && !v) return '';
              return t ? (v ? '**' + t + '**：' + v : '**' + t + '**') : v;
            }).filter(Boolean).join('\n');
          }
          sec.items = [];
        }
        out.sections.push(sec);
      });
    }
    return out;
  }
  function setAt(path, value) {
    const parts = path.split('.');
    let o = state;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
  }
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2600);
  }
  function openModal(title, bodyHtml, footHtml) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    $('#modalFoot').innerHTML = footHtml || '<button class="btn btn-ghost" data-action="close-modal">关闭</button>';
    $('#modalBackdrop').hidden = false;
  }
  function closeModal() { $('#modalBackdrop').hidden = true; }
  function numClamp(v, key, fallback) {
    const l = CUSTOM_LIMITS[key], n = Number(v);
    return isFinite(n) ? Math.min(l.max, Math.max(l.min, n)) : fallback;
  }
  function effectiveFont() {
    const s = state.settings;
    return s.fontSize === 'custom' ? numClamp(s.custom.fontSize, 'fontSize', 13) : (FONT_SIZE[s.fontSize] || 13);
  }
  function effectiveDensity() {
    const s = state.settings;
    if (s.density === 'custom') return {
      lh: +numClamp(s.custom.lineHeight, 'lineHeight', 1.62).toFixed(2),
      itemGap: numClamp(s.custom.itemGap, 'itemGap', 13),
      secGap: numClamp(s.custom.secGap, 'secGap', 20)
    };
    return DENSITY[s.density] || DENSITY.normal;
  }
  function pageVars() {
    const s = state.settings;
    const d = effectiveDensity();
    const accent = /^#[0-9a-fA-F]{3,8}$/.test(s.accent || '') ? s.accent : '#2f6df6';
    return [
      '--accent:' + accent,
      '--pad:' + (MARGIN[s.margin] || 52) + 'px',
      '--fs:' + effectiveFont() + 'px',
      '--lh:' + d.lh,
      '--item-gap:' + d.itemGap + 'px',
      '--sec-gap:' + d.secGap + 'px'
    ].join(';');
  }
  function pageAttrs() {
    return 'data-template="' + esc(state.settings.template) + '" data-font="' + esc(state.settings.font) + '" style="' + pageVars() + '"';
  }

  /* ============================================================
   *  编辑区渲染
   * ============================================================ */
  function renderEditor() {
    renderBasics();
    renderSettings();
    renderSections();
  }

  function renderBasics() {
    basicsBody.innerHTML = '<div class="field-grid">' + BASICS_FIELDS.map(f => {
      const val = state.basics[f.key] || '';
      const input = f.textarea
        ? `${fmtToolbar('选中文字后点 B 或按 Ctrl+B 加粗')}<textarea data-bind="basics.${f.key}" rows="3" placeholder="${esc(f.ph)}">${esc(val)}</textarea>`
        : `<input type="text" data-bind="basics.${f.key}" value="${esc(val)}" placeholder="${esc(f.ph)}">`;
      return `<div class="field ${f.span2 ? 'span-2' : ''}"><label>${esc(f.label)}</label>${input}</div>`;
    }).join('') + '</div>';
  }

  function renderSettings() {
    const s = state.settings;
    $('#settingsCard').hidden = !ui.settingsOpen;
    if (!ui.settingsOpen) return;
    const seg = (name, opts, cur) => `<div class="seg">` + opts.map(([v, label]) =>
      `<button data-setting="${name}" data-value="${v}" class="${cur === v ? 'active' : ''}">${label}</button>`
    ).join('') + '</div>';
    const fs = effectiveFont();
    const d = effectiveDensity();
    const c = s.custom;
    const slider = (key, label, unit) => {
      const l = CUSTOM_LIMITS[key];
      return `<div class="ctrl-row">
        <span class="ctrl-label">${label}</span>
        <input type="range" data-custom="${key}" min="${l.min}" max="${l.max}" step="${l.step}" value="${c[key]}" aria-label="${label}">
        <input type="number" class="num" data-custom="${key}" min="${l.min}" max="${l.max}" step="${l.step}" value="${c[key]}" aria-label="${label}数值">
        <span class="ctrl-unit">${unit}</span>
      </div>`;
    };

    const fontExtra = s.fontSize === 'custom'
      ? `<div class="custom-controls">
           ${slider('fontSize', '字号', 'px')}
           <div class="settings-tip">点上方「小 / 标准 / 大」可随时恢复预设值</div>
         </div>`
      : `<div class="setting-current">当前 ${fs}px</div>`;
    const densityExtra = s.density === 'custom'
      ? `<div class="custom-controls">
           ${slider('lineHeight', '行距', '倍')}
           ${slider('itemGap', '条目间距', 'px')}
           ${slider('secGap', '模块间距', 'px')}
           <div class="settings-tip">点上方「紧凑 / 标准 / 宽松」可随时恢复预设值</div>
         </div>`
      : `<div class="setting-current">当前行距 ${d.lh} · 条目间距 ${d.itemGap}px · 模块间距 ${d.secGap}px</div>`;

    $('#settingsBody').innerHTML = `
      <div class="settings-grid">
        <div class="setting-block span-2"><label>正文字号</label>${seg('fontSize', [['small', '小'], ['mid', '标准'], ['large', '大'], ['custom', '自定义']], s.fontSize)}${fontExtra}</div>
        <div class="setting-block span-2"><label>行距与间距</label>${seg('density', [['compact', '紧凑'], ['normal', '标准'], ['loose', '宽松'], ['custom', '自定义']], s.density)}${densityExtra}</div>
        <div class="setting-block"><label>版式模板</label>${seg('template', [['modern', '现代'], ['classic', '经典'], ['minimal', '简约']], s.template)}</div>
        <div class="setting-block"><label>主题色</label>
          <div class="swatches">${ACCENTS.map(ac => `<button class="swatch ${ac === s.accent ? 'active' : ''}" style="background:${ac}" data-setting="accent" data-value="${ac}" title="${ac}"></button>`).join('')}
            <input type="color" class="color-input" data-bind="settings.accent" value="${esc(s.accent)}" title="自定义颜色">
          </div>
        </div>
        <div class="setting-block"><label>页边距</label>${seg('margin', [['narrow', '窄'], ['normal', '标准'], ['wide', '宽']], s.margin)}</div>
        <div class="setting-block"><label>字体</label>${seg('font', [['sans', '黑体'], ['serif', '宋体']], s.font)}</div>
        <div class="setting-block"><label>页脚</label>
          <label class="switch-row"><input type="checkbox" data-setting="showFooter" ${s.showFooter ? 'checked' : ''}> 显示姓名与页码</label>
        </div>
      </div>`;
  }

  function renderSections() {
    editorRoot.innerHTML = state.sections.map((sec, si) => {
      const t = TYPES[sec.type];
      const isSkill = sec.type === 'skill';

      // 技能模块 = 一整块：只有一个多行文本框，每行一条技能
      const skillEditor = isSkill ? `
        <div class="skill-block-editor">
          <div class="field">
            <label>技能清单（每行一条）</label>
            ${fmtToolbar('每行一条技能；选中文字可加粗，例如 **类别**：内容')}
            <textarea data-bind="sections.${si}.content" rows="9" placeholder="**数据分析与看板**：熟练使用 SQL 进行数据查询与提取…&#10;**工程化**：Vite / Webpack / Rollup、CI/CD…&#10;每行一条，长句换行会自动对齐">${esc(sec.content || '')}</textarea>
            <div class="field-help">每行一条 → 预览自动加小圆点；长句换行后文字与首行整齐对齐。行首写 <b>**类别**：</b> 可加粗分类名。</div>
          </div>
        </div>` : '';

      const items = isSkill ? '' : sec.items.map((it, ii) => {
        const collapsed = ui.collapsed.has(it.id);
        const sum = plain(it.title || '未命名条目') + (it.subtitle ? ' · ' + plain(it.subtitle) : '');
        const fields = Object.keys(t.fields).map(k => {
          const [label, ph] = t.fields[k];
          const span2 = (k === 'link' || k === 'meta');
          return `<div class="field ${span2 ? 'span-2' : ''}"><label>${esc(label)}</label>
            <input type="text" data-bind="sections.${si}.items.${ii}.${k}" value="${esc(it[k] || '')}" placeholder="${esc(ph)}"></div>`;
        }).join('');
        const pointsField = `
          <div class="field span-2">
            <label>描述要点</label>
            ${fmtToolbar('每行一条，自动生成小圆点；选中文字可加粗')}
            <textarea data-bind="sections.${si}.items.${ii}.points" rows="4" placeholder="每行一条，预览中会自动转成项目符号；建议用数据量化成果">${esc(it.points)}</textarea>
            <div class="field-help">每行一条 · 留空则不显示该区域</div>
          </div>`;
        return `
          <div class="item-card ${collapsed ? 'collapsed' : ''}" data-item-id="${it.id}" data-sec-id="${sec.id}">
            <div class="item-head" data-cmd="toggle-item" data-id="${it.id}">
              <span class="drag-handle" draggable="true" data-drag="item" data-id="${it.id}" data-sec="${sec.id}" title="拖拽排序">⠿</span>
              <span class="item-toggle">▶</span>
              <span class="item-summary">${esc(sum)}</span>
              <div class="item-actions">
                <button class="icon-btn" data-cmd="item-up" data-si="${si}" data-ii="${ii}" title="上移" ${ii === 0 ? 'disabled' : ''}>↑</button>
                <button class="icon-btn" data-cmd="item-down" data-si="${si}" data-ii="${ii}" title="下移" ${ii === sec.items.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="icon-btn danger" data-cmd="item-del" data-si="${si}" data-ii="${ii}" title="删除">✕</button>
              </div>
            </div>
            <div class="item-body">
              <div class="field-grid">${fields}${pointsField}</div>
              <div class="item-foot"><button class="link-del" data-cmd="item-del" data-si="${si}" data-ii="${ii}">删除此条目</button></div>
            </div>
          </div>`;
      }).join('');

      const listBody = isSkill ? skillEditor :
        (items || '<div class="empty-hint">暂无条目</div>') +
        `<button class="add-item-btn" data-cmd="item-add" data-si="${si}">+ ${esc(t.itemLabel)}</button>`;

      return `
        <div class="card section-card ${sec.visible ? '' : 'is-hidden'}" data-sec-id="${sec.id}">
          <div class="card-head">
            <div class="section-head-left">
              <span class="drag-handle" draggable="true" data-drag="section" data-id="${sec.id}" title="拖拽排序">⠿</span>
              <span class="section-type-badge">${esc(t.label)}</span>
              <input class="section-name-input" data-bind="sections.${si}.title" value="${esc(sec.title)}" title="模块标题，可自由修改" aria-label="模块标题">
            </div>
            <div class="card-actions">
              <button class="icon-btn" data-cmd="sec-up" data-si="${si}" title="上移模块" ${si === 0 ? 'disabled' : ''}>↑</button>
              <button class="icon-btn" data-cmd="sec-down" data-si="${si}" title="下移模块" ${si === state.sections.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="icon-btn" data-cmd="sec-toggle" data-si="${si}" title="${sec.visible ? '隐藏（不出现在简历中）' : '显示'}">${sec.visible ? '◉' : '◎'}</button>
              <button class="icon-btn danger" data-cmd="sec-del" data-si="${si}" title="删除模块">✕</button>
            </div>
          </div>
          <div class="items-list ${isSkill ? 'is-skill' : ''}">${listBody}</div>
        </div>`;
    }).join('');
  }

  function newItem(type) {
    return { id: uid(), title: '', subtitle: '', meta: '', date: '', link: '', points: '' };
  }
  function afterChange(scrollTarget) {
    debounceSave();
    schedulePreview();
    if (scrollTarget) setTimeout(() => scrollTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
  }

  /* ---------------- 编辑区事件 ---------------- */
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset || !el.dataset.bind) return;
    setAt(el.dataset.bind, el.value);
    // 条目摘要与卡片标题保持同步，但不重建输入框（保护焦点）
    const card = el.closest('.item-card');
    if (card) {
      const sec = state.sections.find(s => s.id === card.dataset.secId);
      const it = sec && sec.items.find(i => i.id === card.dataset.itemId);
      if (it) {
        const sum = card.querySelector('.item-summary');
        sum.textContent = plain(it.title || '未命名条目') + (it.subtitle ? ' · ' + plain(it.subtitle) : '');
      }
    }
    debounceSave();
    schedulePreview();
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.setting === 'showFooter') {
      state.settings.showFooter = el.checked;
      debounceSave(); schedulePreview();
    }
  });

  /* ---------------- 选中文字加粗 ---------------- */
  // 点 B 按钮时保持输入框焦点与选区不丢失
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest && e.target.closest('[data-fmt]')) e.preventDefault();
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-fmt]');
    if (!b) return;
    const input = b.closest('.field').querySelector('textarea, input');
    if (b.dataset.fmt === 'bold') toggleBold(input);
  });
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || (e.key !== 'b' && e.key !== 'B')) return;
    const el = document.activeElement;
    if (el && el.dataset && el.dataset.bind) { e.preventDefault(); toggleBold(el); }
  });

  editorRoot.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cmd]');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    const si = +btn.dataset.si, ii = +btn.dataset.ii;
    const sec = state.sections[si];
    let needRender = true, newItemId = null;

    switch (cmd) {
      case 'toggle-item': {
        if (e.target.closest('.drag-handle, .icon-btn, button')) return;
        const id = btn.dataset.id;
        ui.collapsed.has(id) ? ui.collapsed.delete(id) : ui.collapsed.add(id);
        btn.closest('.item-card').classList.toggle('collapsed');
        return;
      }
      case 'sec-up':    if (si > 0) state.sections.splice(si - 1, 0, state.sections.splice(si, 1)[0]); break;
      case 'sec-down':  if (si < state.sections.length - 1) state.sections.splice(si + 1, 0, state.sections.splice(si, 1)[0]); break;
      case 'sec-toggle': sec.visible = !sec.visible; break;
      case 'sec-del':
        if (!confirm('确定删除「' + sec.title + '」模块及其全部条目吗？')) return;
        state.sections.splice(si, 1); break;
      case 'item-add': {
        const it = newItem(sec.type);
        sec.items.push(it); newItemId = it.id; break;
      }
      case 'item-del': {
        const it = sec.items[ii];
        if (it && (it.title || it.subtitle || it.points) && !confirm('确定删除「' + (it.title || '该条目') + '」吗？')) return;
        sec.items.splice(ii, 1); break;
      }
      case 'item-up':   if (ii > 0) sec.items.splice(ii - 1, 0, sec.items.splice(ii, 1)[0]); break;
      case 'item-down': if (ii < sec.items.length - 1) sec.items.splice(ii + 1, 0, sec.items.splice(ii, 1)[0]); break;
      default: return;
    }
    if (needRender) renderSections();
    const target = newItemId ? editorRoot.querySelector('[data-item-id="' + newItemId + '"]') : null;
    afterChange(target);
  });

  // 排版设置：预设按钮 + 自定义数值
  function enterCustom(which) {
    const s = state.settings;
    if (which === 'fontSize') {
      if (!s.custom.fontTouched) s.custom.fontSize = effectiveFont();
      s.fontSize = 'custom';
    } else {
      if (!s.custom.spacingTouched) {
        const d = effectiveDensity();
        s.custom.lineHeight = d.lh;
        s.custom.itemGap = d.itemGap;
        s.custom.secGap = d.secGap;
      }
      s.density = 'custom';
    }
  }
  $('#settingsCard').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-setting]');
    if (!btn || btn.dataset.setting === 'showFooter') return;
    const name = btn.dataset.setting, value = btn.dataset.value;
    if ((name === 'fontSize' || name === 'density') && value === 'custom') enterCustom(name);
    else state.settings[name] = value;
    renderSettings();
    afterChange();
  });
  // 自定义数值只更新状态与预览，不重建面板（避免拖动滑块时丢焦点）
  $('#settingsCard').addEventListener('input', (e) => {
    const el = e.target;
    const key = el.dataset && el.dataset.custom;
    if (!key || el.value === '') return;
    const l = CUSTOM_LIMITS[key];
    let v = Number(el.value);
    if (!isFinite(v)) return;
    v = Math.min(l.max, Math.max(l.min, v));
    state.settings.custom[key] = v;
    if (key === 'fontSize') state.settings.custom.fontTouched = true;
    else state.settings.custom.spacingTouched = true;
    $('#settingsCard').querySelectorAll('[data-custom="' + key + '"]').forEach(x => { if (x !== el) x.value = v; });
    debounceSave();
    schedulePreview();
  });
  // 数字框失焦时把越界输入修正为生效值
  $('#settingsCard').addEventListener('change', (e) => {
    const el = e.target, key = el.dataset && el.dataset.custom;
    if (!key || el.type !== 'number') return;
    el.value = state.settings.custom[key];
  });

  $('#toggleSettings').addEventListener('click', () => {
    ui.settingsOpen = !ui.settingsOpen;
    renderSettings();
    if (ui.settingsOpen) $('#settingsCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  /* ---------------- 拖拽排序 ---------------- */
  document.addEventListener('dragstart', (e) => {
    const h = e.target.closest && e.target.closest('[data-drag]');
    if (!h) return;
    ui.drag = { type: h.dataset.drag, id: h.dataset.id, sec: h.dataset.sec };
    document.body.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', ui.drag.id); } catch (_) {}
    setTimeout(() => { const c = h.closest('.item-card, .section-card'); if (c) c.classList.add('dragging'); }, 0);
  });
  document.addEventListener('dragover', (e) => {
    if (!ui.drag) return;
    const sel = ui.drag.type === 'section' ? '.section-card' : '.item-card';
    const target = e.target.closest && e.target.closest(sel);
    if (!target || target.classList.contains('dragging')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDropMark();
    const r = target.getBoundingClientRect();
    ui.dropPlace = (e.clientY < r.top + r.height / 2) ? 'before' : 'after';
    ui.dropEl = target;
    target.classList.add('drop-' + ui.dropPlace);
  });
  document.addEventListener('drop', (e) => {
    if (!ui.drag || !ui.dropEl) return;
    e.preventDefault();
    const d = ui.drag, target = ui.dropEl, place = ui.dropPlace;
    clearDropMark(); endDrag();
    if (d.type === 'section') {
      const list = state.sections;
      const from = list.findIndex(s => s.id === d.id);
      if (from < 0) return;
      const toId = target.dataset.secId;
      const moved = list.splice(from, 1)[0];
      let idx = list.findIndex(s => s.id === toId);
      if (idx < 0) { list.splice(from, 0, moved); return; }
      list.splice(place === 'before' ? idx : idx + 1, 0, moved);
    } else {
      const sec = state.sections.find(s => s.id === d.sec);
      const targetSec = state.sections.find(s => s.id === target.dataset.secId);
      if (!sec || !targetSec || sec !== targetSec) { toast('条目只能在同一模块内调整顺序'); renderSections(); return; }
      const from = sec.items.findIndex(i => i.id === d.id);
      if (from < 0) return;
      const toId = target.dataset.itemId;
      const moved = sec.items.splice(from, 1)[0];
      let idx = sec.items.findIndex(i => i.id === toId);
      if (idx < 0) { sec.items.splice(from, 0, moved); return; }
      sec.items.splice(place === 'before' ? idx : idx + 1, 0, moved);
    }
    renderSections();
    afterChange();
  });
  document.addEventListener('dragend', () => { clearDropMark(); endDrag(); renderSections(); });
  function clearDropMark() {
    document.querySelectorAll('.drop-before, .drop-after').forEach(el => el.classList.remove('drop-before', 'drop-after'));
    ui.dropEl = null; ui.dropPlace = null;
  }
  function endDrag() { ui.drag = null; document.body.classList.remove('is-dragging'); }

  /* ============================================================
   *  预览内容 HTML
   * ============================================================ */
  const ICONS = {
    phone: '<path d="M5 3h3l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    email: '<path d="M3 6h18v12H3z"/><path d="m3 7 9 6 9-6"/>',
    location: '<path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>'
  };
  function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  }
  function headerHtml() {
    const b = state.basics;
    const contacts = [
      ['phone', b.phone], ['email', b.email], ['location', b.location], ['link', b.website]
    ].filter(c => c[1] && String(c[1]).trim());
    return `<div class="r-head">
      <h1 class="r-name">${rich(b.name || '你的姓名')}</h1>
      ${b.jobTitle ? `<div class="r-jobtitle">${rich(b.jobTitle)}</div>` : ''}
      ${contacts.length ? `<div class="r-contacts">${contacts.map(c => `<span class="r-contact">${icon(c[0])}${rich(c[1])}</span>`).join('')}</div>` : ''}
      <div class="r-head-accent"></div>
      ${b.summary ? `<div class="r-summary">${rich(b.summary)}</div>` : ''}
    </div>`;
  }
  function sectionHeadHtml(sec) {
    return `<div class="r-sec-title"><span class="bar"></span>${rich(sec.title || TYPES[sec.type].label)}<span class="en">${esc(TYPES[sec.type].en)}</span></div>`;
  }
  // 技能整块：一整块文本框里每行一条技能 → 悬挂缩进的小圆点列表
  // 所有行的文字左边缘一致，长句换行后与首行对齐，不再有两列错落的问题
  function skillBlockHtml(sec) {
    const lines = String(sec.content || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) return '';
    return `<div class="r-skill-block"><ul class="r-points r-skill-lines">${lines.map(l => `<li>${rich(l)}</li>`).join('')}</ul></div>`;
  }
  function itemHtml(sec, it) {
    const points = String(it.points || '').split('\n').map(s => s.trim()).filter(Boolean);
    return `<div class="r-item">
      <div class="r-item-top"><span class="r-item-title">${rich(it.title)}</span>${it.date ? `<span class="r-item-date">${rich(it.date)}</span>` : ''}</div>
      ${it.subtitle ? `<div class="r-item-sub">${rich(it.subtitle)}</div>` : ''}
      ${it.meta ? `<div class="r-item-meta">${rich(it.meta)}</div>` : ''}
      ${it.link ? `<div class="r-item-link">${rich(it.link)}</div>` : ''}
      ${points.length ? `<ul class="r-points">${points.map(p => `<li>${rich(p)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  /* ============================================================
   *  A4 分页引擎
   * ============================================================ */
  function buildUnits() {
    const units = [{ cls: 'u-header', html: headerHtml(), kind: 'header' }];
    state.sections.filter(s => s.visible).forEach(sec => {
      const isSkill = sec.type === 'skill';
      const blockHtml = isSkill ? skillBlockHtml(sec) : '';
      // 空模块不渲染标题，避免简历里出现孤立标题
      if (isSkill ? !blockHtml : !sec.items.length) return;
      units.push({ cls: 'u-section-head', html: sectionHeadHtml(sec), kind: 'head', keepWithNext: true, sec });
      if (isSkill) {
        // 技能整块：一个不可拆的内容单元，分页时整体移动
        units.push({ cls: 'u-item', html: blockHtml, kind: 'skill-block', sec });
      } else {
        sec.items.forEach(it => units.push({ cls: 'u-item', html: itemHtml(sec, it), kind: 'item', sec, it }));
      }
    });
    return units;
  }

  function measure(units, extra) {
    measureHost.innerHTML = `<div class="measure-page" ${pageAttrs()}><div class="page-inner"><div class="page-content" id="measureContent"></div></div></div>`;
    const box = $('#measureContent');
    const all = units.concat(extra || []);
    all.forEach(u => {
      const d = document.createElement('div');
      d.className = u.cls;
      d.innerHTML = u.html;
      box.appendChild(d);
      u.el = d;
      u.h = d.offsetHeight;
    });
    return all;
  }

  // 极长条目 / 技能整块：拆成「标题块」+「逐条要点」，保证不会溢出纸张
  function explodeTall(u, capacity) {
    if (u.h <= capacity || !['item', 'skill-block'].includes(u.kind)) return null;
    const lis = Array.from(u.el.querySelectorAll('.r-points li'));
    if (lis.length < 2) return null;
    const head = u.el.cloneNode(true);
    head.querySelectorAll('.r-points').forEach(n => n.remove());
    const open = u.kind === 'skill-block' ? '<div class="r-skill-block">' : '<div>';
    const out = [{ cls: 'u-item', html: head.innerHTML, kind: 'frag-head', keepWithNext: true }];
    lis.forEach(li => {
      out.push({
        cls: 'u-item u-frag',
        html: `${open}<div style="display:flow-root"><ul class="r-points">${li.outerHTML}</ul></div></div>`,
        kind: 'frag'
      });
    });
    return out;
  }

  function renderPreview() {
    const s = state.settings;
    const pad = MARGIN[s.margin] || 52;
    const capacity = PAGE_H - 2 * pad - 22; // 页脚上方留白
    let units = buildUnits();

    // 第一次测量
    measure(units);

    // 超高条目拆分后重新测量（最多一轮）
    let extra = [];
    const expanded = [];
    units.forEach(u => {
      const parts = explodeTall(u, capacity);
      if (parts) expanded.push(...parts); else expanded.push(u);
    });
    units = expanded;
    measure(units, extra);

    // 贪心装页；keepWithNext 保证模块标题不与其第一个条目分离
    const pages = [[]];
    let used = 0;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      let need = u.h;
      const next = units[i + 1];
      if (u.keepWithNext && next && next.h <= capacity) need += next.h;
      if (used > 0 && used + need > capacity) { pages.push([]); used = 0; }
      pages[pages.length - 1].push(u);
      used += u.h;
    }
    if (!pages.length) pages.push([]);

    // 生成页面 DOM：直接移动已测量元素，保证样式与高度完全一致
    const total = pages.length;
    let html = '';
    pages.forEach((list, idx) => {
      const footer = s.showFooter
        ? `<div class="page-footer"><span class="pf-name">${plain(state.basics.name || '个人简历')}</span><span>第 ${idx + 1} / ${total} 页</span></div>`
        : '';
      html += `<div class="page" ${pageAttrs()}><div class="page-inner"><div class="page-content" data-page="${idx}"></div>${footer}</div></div>`;
    });
    paperStage.innerHTML = html;
    const contents = paperStage.querySelectorAll('.page-content');
    pages.forEach((list, idx) => {
      const c = contents[idx];
      list.forEach((u, j) => {
        if (j === 0) u.el.classList.add('u-first');
        c.appendChild(u.el);
      });
    });
    measureHost.innerHTML = '';

    $('#pageCounter').textContent = total + ' 页';
    applyZoom();
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 70);
  }

  /* ---------------- 缩放 ---------------- */
  function currentScale() {
    if (zoomMode === 'fit') {
      // 预览面板在移动端初始是隐藏的，clientWidth 可能为 0，用视口宽度兜底
      const avail = (previewScroll.clientWidth || window.innerWidth) - 44;
      return Math.min(1, Math.max(0.28, avail / PAGE_W));
    }
    return zoomManual;
  }
  function applyZoom() {
    const s = currentScale();
    const cw = previewScroll.clientWidth || window.innerWidth;
    const visualW = PAGE_W * s;
    const canCenter = visualW <= cw + 1;
    // zoom 会连同布局尺寸一起缩放，滚动范围与视觉一致；transform 则不会
    paperStage.style.zoom = s;
    paperStage.style.height = '';
    previewScroll.classList.toggle('is-zoomed', !canCenter);
    $('#zoomLabel').textContent = zoomMode === 'fit' ? '适应宽度' : Math.round(s * 100) + '%';
  }
  // 小屏「放大阅读」：一键按原始大小查看，再次点击回到适应宽度
  function updateReadModeBtn() {
    $('#readModeBtn').textContent = zoomMode === 'read' ? '适应宽度' : '放大阅读';
  }
  $('#readModeBtn').addEventListener('click', () => {
    if (zoomMode === 'read') {
      zoomMode = 'fit';
    } else {
      zoomMode = 'read'; zoomManual = 1;
      toast('已按原始大小显示，可左右滑动查看', 3000);
    }
    updateReadModeBtn();
    applyZoom();
  });
  $('#zoomIn').addEventListener('click', () => {
    zoomManual = Math.min(1.6, currentScale() + 0.12); zoomMode = 'manual'; updateReadModeBtn(); applyZoom();
  });
  $('#zoomOut').addEventListener('click', () => {
    zoomManual = Math.max(0.35, currentScale() - 0.12); zoomMode = 'manual'; updateReadModeBtn(); applyZoom();
  });
  $('#zoomFit').addEventListener('click', () => { zoomMode = 'fit'; updateReadModeBtn(); applyZoom(); });
  window.addEventListener('resize', () => {
    if (zoomMode === 'fit') applyZoom();
    // 从手机宽度放大到桌面宽度时，退出「放大阅读」回到自适应
    if (zoomMode === 'read' && window.innerWidth > 820) { zoomMode = 'fit'; updateReadModeBtn(); applyZoom(); }
  });
  window.addEventListener('orientationchange', () => setTimeout(applyZoom, 260));

  /* ============================================================
   *  导出
   * ============================================================ */
  function safeFileName() {
    const n = (state.basics.name || '我的简历').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
    return n + '_简历';
  }
  function startPrint(btn) {
    clearTimeout(previewTimer);
    renderPreview();                 // 打印前强制同步最新内容
    closeDropdowns();
    // iOS / Android 的系统打印对固定 px 的 @page 尺寸支持不一致，
    // 1123px 的页面略大于实际可打印区时会被拆成「内容页 + 空白页」。
    // 小屏改走本地生成的 PDF：每页由代码显式 addPage，页数与预览严格一致。
    if (window.innerWidth <= 820) {
      exportDownload(btn || $('#exportMain'));
      return;
    }
    toast('在打印窗口选择「另存为 PDF」即可保存', 5000);
    setTimeout(() => window.print(), 160);
  }
  function handleAction(action, el) {
    switch (action) {
      case 'close-modal': closeModal(); break;
      case 'export-print': startPrint(el); break;
      case 'export-help': $('#printHint').hidden = false; break;
      case 'export-download': exportDownload(el); break;
      case 'export-json': {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8' });
        downloadBlob(blob, safeFileName() + '.json');
        toast('简历数据已导出'); break;
      }
      case 'import-json': $('#fileInput').click(); break;
      case 'load-demo':
        openModal('载入示例简历',
          '<p>这会<b>覆盖当前所有编辑内容</b>，并恢复示例简历与默认排版。建议先导出数据备份。</p>',
          '<button class="btn btn-ghost" data-action="close-modal">取消</button><button class="btn btn-primary" data-action="confirm-demo">确认载入</button>');
        break;
      case 'confirm-demo':
        state = normalize(clone(DEMO)); ui.collapsed.clear(); closeModal(); fullRefresh(); toast('已载入示例简历'); break;
      case 'clear-all':
        openModal('清空全部内容',
          '<p>将清空基本信息与所有模块，<b>此操作不可撤销</b>。排版设置会保留。</p>',
          '<button class="btn btn-ghost" data-action="close-modal">取消</button><button class="btn btn-danger" data-action="confirm-clear">确认清空</button>');
        break;
      case 'confirm-clear': {
        const settings = clone(state.settings);
        state = normalize({ basics: {}, sections: [], settings });
        ui.collapsed.clear(); closeModal(); fullRefresh(); toast('已清空，可点击「添加模块」重新开始'); break;
      }
      case 'confirm-print': $('#printHint').hidden = true; startPrint($('#exportMain')); break;
      case 'print-hint-close': $('#printHint').hidden = true; break;
      case 'help': showHelp(); break;
    }
  }
  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function showHelp() {
    openModal('使用说明', `
      <ul>
        <li><b>编辑</b>：左侧直接填写，右侧实时同步；每个模块、条目都可新增 / 删除 / 上移下移，也可拖拽手柄排序。</li>
        <li><b>文字加粗</b>：在任何输入框里<b>选中要加粗的文字</b>，点上方 B 按钮或按 <b>Ctrl / ⌘ + B</b>，预览中即刻加粗；再按一次取消。也可以直接输入 <b>**文字**</b>。姓名、公司名、要点等所有字段都支持。</li>
        <li><b>描述要点</b>：每行一条，预览中自动转为项目符号，条目不会被拆到两页。</li>
        <li><b>技能模块</b>：整个模块就是<b>一个整块文本框</b>，每行写一条技能，预览自动加小圆点；长句换行时文字与首行整齐对齐，不会出现左右两列错落。行首写 <b>**类别**：</b> 可加粗分类名。</li>
        <li><b>模块标题</b>：点击模块名即可重命名；「◉」可临时隐藏某个模块。</li>
        <li><b>排版设置</b>：3 套模板、主题色、页边距、字体与页码开关。字号和「行距 / 条目间距 / 模块间距」既可用预设（小 / 标准 / 大、紧凑 / 标准 / 宽松），也可选「自定义」拖滑块或输入精确数值；<b>点回预设按钮即可随时恢复默认值</b>，自定义数值会保留。</li>
        <li><b>分页</b>：右侧是真实 A4 页面（794 × 1123 px），屏幕所见即打印所得。</li>
        <li><b>导出 PDF</b>：电脑上点顶部「一键导出 PDF」打开打印窗口，选「另存为 PDF」即可（矢量文字、可选中、离线可用）；右侧 ▾ 里还可「直接下载 PDF 文件」。<b>手机上会自动走直接下载</b>，因为 iOS / Android 的系统打印常把每页拆出一个空白页；渲染组件已内置，离线可用。</li>
        <li><b>数据安全</b>：内容仅保存在本机浏览器（localStorage），不会上传；可用「数据 → 导出简历数据」备份。</li>
      </ul>`);
  }

  $('#fileInput').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!d || typeof d !== 'object') throw new Error('文件格式不正确');
        state = normalize(d); ui.collapsed.clear(); fullRefresh(); toast('导入成功');
      } catch (err) { toast('导入失败：' + err.message); }
    };
    reader.readAsText(f, 'utf-8');
    e.target.value = '';
  });

  function fullRefresh() { renderEditor(); renderPreview(); debounceSave(); }

  /* ---------- 直接下载 PDF（联网时动态加载渲染组件） ---------- */
  // 渲染组件优先使用项目内的本地副本（离线可用），失败再尝试公共 CDN
  const LIB_SOURCES = {
    html2canvas: [
      'vendor/html2canvas.min.js',
      'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
      'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js'
    ],
    jspdf: [
      'vendor/jspdf.umd.min.js',
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
    ]
  };
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[data-src="' + src + '"][data-ok="1"]')) return resolve();
      const s = document.createElement('script');
      s.src = src; s.dataset.src = src;
      s.onload = () => { s.dataset.ok = '1'; resolve(); };
      s.onerror = () => { s.remove(); reject(new Error('加载失败')); };
      document.head.appendChild(s);
    });
  }
  async function loadLib(name, check) {
    if (check()) return;
    for (const src of LIB_SOURCES[name]) {
      try { await loadScript(src); if (check()) return; } catch (_) {}
    }
    throw new Error('无法加载 PDF 渲染组件，请改用「打印 / 另存为 PDF」');
  }
  async function exportDownload(btn) {
    const old = btn.innerHTML;
    btn.innerHTML = '正在生成…'; btn.disabled = true;
    toast('正在生成 PDF，请稍候…', 5000);
    let holder = null;
    try {
      await loadLib('html2canvas', () => !!window.html2canvas);
      await loadLib('jspdf', () => !!(window.jspdf && window.jspdf.jsPDF));

      const pages = Array.from(paperStage.querySelectorAll('.page'));
      if (!pages.length) throw new Error('没有可导出的页面');

      const { jsPDF } = window.jspdf;
      // A4 = 595.28 × 841.89 pt
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [595.28, 841.89], compress: true });

      for (let i = 0; i < pages.length; i++) {
        // 复制一页到无缩放的离屏容器，避免 transform 影响截图
        const cloneEl = pages[i].cloneNode(true);
        cloneEl.style.margin = '0';
        cloneEl.style.boxShadow = 'none';
        if (!holder) {
          holder = document.createElement('div');
          holder.style.cssText = 'position:fixed;left:-20000px;top:0;width:794px;height:1123px;z-index:-1;';
          document.body.appendChild(holder);
        }
        holder.innerHTML = '';
        holder.appendChild(cloneEl);
        const canvas = await window.html2canvas(cloneEl, {
          scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
          width: PAGE_W, height: PAGE_H, windowWidth: PAGE_W, windowHeight: PAGE_H
        });
        if (i > 0) pdf.addPage([595.28, 841.89], 'portrait');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 595.28, 841.89);
      }
      pdf.save(safeFileName() + '.pdf');
      toast('PDF 已生成，共 ' + pages.length + ' 页');
    } catch (err) {
      toast(err.message, 4200);
    } finally {
      if (holder) holder.remove();
      btn.innerHTML = old; btn.disabled = false;
    }
  }

  /* ============================================================
   *  全局交互
   * ============================================================ */
  function closeDropdowns() { document.querySelectorAll('.dropdown-panel.open').forEach(p => p.classList.remove('open')); }
  document.addEventListener('click', (e) => {
    const ddBtn = e.target.closest('[data-dropdown]');
    if (ddBtn) {
      const panel = document.getElementById(ddBtn.dataset.dropdown);
      const willOpen = !panel.classList.contains('open');
      closeDropdowns();
      if (willOpen) panel.classList.add('open');
      return;
    }
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      const a = actionEl.dataset.action;
      closeDropdowns();
      handleAction(a, actionEl);
      return;
    }
    if (!e.target.closest('.dropdown-panel')) closeDropdowns();
  });
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', (e) => { if (e.target === $('#modalBackdrop')) closeModal(); });
  $('#helpBtn').addEventListener('click', () => handleAction('help'));
  $('#exportMain').addEventListener('click', () => startPrint($('#exportMain')));
  $('#printHintClose').addEventListener('click', () => handleAction('confirm-print'));
  $('#printHint').addEventListener('click', (e) => {
    if (e.target.id === 'printHint') $('#printHint').hidden = true;
  });

  // 添加模块菜单
  const addMenu = $('#addSectionMenu');
  addMenu.innerHTML = Object.keys(TYPES).map(k => `<button data-type="${k}">+ ${TYPES[k].label}</button>`).join('');
  $('#addSectionBtn').addEventListener('click', (e) => { e.stopPropagation(); addMenu.hidden = !addMenu.hidden; });
  addMenu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    const type = b.dataset.type;
    const sec = type === 'skill'
      ? { id: uid(), type, title: TYPES[type].label, visible: true, content: '', items: [] }
      : { id: uid(), type, title: TYPES[type].label, visible: true, items: [newItem(type)] };
    state.sections.push(sec);
    addMenu.hidden = true;
    renderSections();
    afterChange(editorRoot.querySelector('[data-sec-id="' + sec.id + '"]'));
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#addSectionMenu') && !e.target.closest('#addSectionBtn')) addMenu.hidden = true;
  });

  // 移动端视图切换
  document.querySelectorAll('.mobile-tabs button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.mobile-tabs button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      $('#app').dataset.view = b.dataset.view;
      if (b.dataset.view === 'preview') {
        // 面板从隐藏变为可见后需等布局完成再测量容器宽度
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(applyZoom, 60)));
      }
    });
  });

  // Ctrl/Cmd + P 由浏览器原生处理，此处保证预览先刷新
  window.addEventListener('beforeprint', () => { renderPreview(); });

  /* ---------------- 启动 ---------------- */
  // 默认折叠除每个模块第一条之外的条目
  $('#app').dataset.view = 'edit';
  state.sections.forEach(sec => sec.items.slice(1).forEach(it => ui.collapsed.add(it.id)));
  fullRefresh();
  // 字体加载完成后再测一次高度，避免分页偏差
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderPreview);
})();
