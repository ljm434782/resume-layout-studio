(() => {
  "use strict";

  const CURRENT_ID_KEY = "resume-layout-current-id-v1";

  const defaultStyle = {
    accent: "#2563eb",
    font: "yahei",
    titleFont: "simsun",
    bodySize: 10.3,
    lineHeight: 1.68,
    marginX: 11,
    marginY: 11,
    sectionGap: 5,
    entryGap: 4,
    bulletIndent: 0,
    photoSize: 24,
    showPhoto: true,
  };

  const fontMap = {
    yahei: '"Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
    dengxian: 'DengXian, "Microsoft YaHei UI", sans-serif',
    simhei: 'SimHei, "Microsoft YaHei UI", sans-serif',
    song: 'SimSun, "Songti SC", serif',
    system: 'Arial, "Noto Sans SC", sans-serif',
  };

  const titleFontMap = {
    simsun: 'SimSun, "Songti SC", serif',
    yahei: '"Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
    simhei: 'SimHei, "Microsoft YaHei UI", sans-serif',
    kaiti: 'KaiTi, STKaiti, SimSun, serif',
  };

  let state = null;
  let activeResume = false;
  let saveTimer = null;
  let toastTimer = null;
  let previewTimer = null;
  let fitEnabled = true;
  const elements = {
    serviceStatus: document.getElementById("service-status"),
    resumeName: document.getElementById("resume-name"),
    saveStatus: document.getElementById("save-status"),
    startPanel: document.getElementById("start-panel"),
    editorContent: document.getElementById("editor-content"),
    basicForm: document.getElementById("basic-form"),
    sectionsForm: document.getElementById("sections-form"),
    styleForm: document.getElementById("style-form"),
    previewStage: document.getElementById("preview-stage"),
    previewEmpty: document.getElementById("preview-empty"),
    resumePages: document.getElementById("resume-pages"),
    pageCount: document.getElementById("page-count"),
    overflowWarning: document.getElementById("overflow-warning"),
    resumeFileInput: document.getElementById("resume-file-input"),
    photoFileInput: document.getElementById("photo-file-input"),
    templateDrawer: document.getElementById("template-drawer"),
    libraryDrawer: document.getElementById("library-drawer"),
    drawerBackdrop: document.getElementById("drawer-backdrop"),
    libraryList: document.getElementById("library-list"),
    toast: document.getElementById("toast"),
  };

  function makeId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function inlineFormat(value) {
    return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function safePhoto(value) {
    return typeof value === "string" && /^data:image\/(png|jpe?g|webp);base64,/i.test(value) ? value : "";
  }

  function emptyItem() {
    return { id: makeId("item"), title: "", subtitle: "", date: "", summary: "", bullets: [] };
  }

  function blankResume() {
    return {
      id: makeId("resume"),
      name: "未命名简历",
      templateId: "classic_orange",
      basic: {
        name: "",
        email: "",
        phone: "",
        location: "",
        target: "",
        extra: "",
        photo: "",
        customFields: [],
      },
      sections: [
        { id: "education", title: "教育背景", items: [emptyItem()] },
        { id: "experience", title: "实习经历", items: [emptyItem()] },
        { id: "projects", title: "项目经历", items: [emptyItem()] },
        { id: "skills", title: "专业能力", items: [emptyItem()] },
      ],
      style: clone(defaultStyle),
      updatedAt: new Date().toISOString(),
    };
  }

  function normalizeResume(value) {
    const source = value && typeof value === "object" ? value : {};
    const basicSource = source.basic && typeof source.basic === "object" ? source.basic : {};
    const customFields = Array.isArray(basicSource.customFields)
      ? basicSource.customFields
      : Array.isArray(basicSource.fields)
        ? basicSource.fields
        : [];
    return {
      id: String(source.id || makeId("resume")),
      name: String(source.name || `${basicSource.name || "未命名"}简历`),
      templateId: source.templateId === "professional_blue" ? "professional_blue" : "classic_orange",
      basic: {
        name: String(basicSource.name || ""),
        email: String(basicSource.email || ""),
        phone: String(basicSource.phone || ""),
        location: String(basicSource.location || basicSource.city || ""),
        target: String(basicSource.target || ""),
        extra: String(basicSource.extra || ""),
        photo: safePhoto(basicSource.photo),
        customFields: customFields
          .filter((field) => field && typeof field === "object")
          .map((field) => ({ label: String(field.label || ""), value: String(field.value || "") })),
      },
      sections: (Array.isArray(source.sections) ? source.sections : []).map((section, sectionIndex) => ({
        id: String(section?.id || `section_${sectionIndex + 1}`),
        title: String(section?.title || "未命名模块"),
        items: (Array.isArray(section?.items) ? section.items : []).map((item) => ({
          id: String(item?.id || makeId("item")),
          title: String(item?.title || ""),
          subtitle: String(item?.subtitle || ""),
          date: String(item?.date || ""),
          summary: String(item?.summary || ""),
          bullets: (Array.isArray(item?.bullets) ? item.bullets : []).map(String).filter((text) => text.trim()),
        })),
      })),
      style: (() => {
        const style = { ...defaultStyle, ...(source.style && typeof source.style === "object" ? source.style : {}) };
        if (String(style.accent).toLowerCase() === "#ed5a0a") style.accent = "#2563eb";
        return style;
      })(),
      updatedAt: source.updatedAt || new Date().toISOString(),
    };
  }

  async function api(path, options = {}) {
    const response = await fetch(path, options);
    const type = response.headers.get("content-type") || "";
    const data = type.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const message = typeof data === "object" && data?.detail ? data.detail : `请求失败（${response.status}）`;
      throw new Error(message);
    }
    return data;
  }

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("is-error", isError);
    elements.toast.hidden = false;
    toastTimer = setTimeout(() => {
      elements.toast.hidden = true;
    }, 2600);
  }

  async function checkHealth() {
    try {
      const health = await api("/api/health");
      const aiText = health.ok ? "本地运行" : "服务异常";
      elements.serviceStatus.innerHTML = `<i></i>${escapeHtml(aiText)}`;
      elements.serviceStatus.title = aiText;
      elements.serviceStatus.className = `service-status ${health.ok ? "is-online" : "is-error"}`;
    } catch (_) {
      elements.serviceStatus.innerHTML = "<i></i>服务异常";
      elements.serviceStatus.title = "服务异常";
      elements.serviceStatus.className = "service-status is-error";
    }
  }

  function showStartPanel() {
    activeResume = false;
    state = null;
    elements.startPanel.hidden = false;
    elements.editorContent.hidden = true;
    elements.previewEmpty.hidden = false;
    elements.resumePages.hidden = true;
    elements.resumePages.innerHTML = "";
    elements.pageCount.textContent = "0 页";
    elements.resumeName.value = "未命名简历";
    elements.resumeName.disabled = true;
    elements.saveStatus.textContent = "尚未保存";
    localStorage.removeItem(CURRENT_ID_KEY);
  }

  async function loadResume(data, saveImmediately = false) {
    state = normalizeResume(data);
    activeResume = true;
    elements.startPanel.hidden = true;
    elements.editorContent.hidden = false;
    elements.previewEmpty.hidden = true;
    elements.resumePages.hidden = false;
    elements.resumeName.disabled = false;
    elements.resumeName.value = state.name;
    localStorage.setItem(CURRENT_ID_KEY, state.id);
    renderEditor();
    renderStyleForm();
    updateTemplateSelection();
    renderPages();
    if (saveImmediately) await saveNow();
    else elements.saveStatus.textContent = "已保存";
  }

  async function loadInitialResume() {
    const requestedResumeId = new URLSearchParams(window.location.search).get("resume");
    if (requestedResumeId) {
      try {
        const result = await api(`/api/resumes/${encodeURIComponent(requestedResumeId)}`);
        await loadResume(result.data, false);
        return;
      } catch (_) {
        showToast("链接中的简历不存在，已打开简历库中的内容", true);
      }
    }
    const currentId = localStorage.getItem(CURRENT_ID_KEY);
    if (currentId) {
      try {
        const result = await api(`/api/resumes/${encodeURIComponent(currentId)}`);
        await loadResume(result.data, false);
        return;
      } catch (_) {
        localStorage.removeItem(CURRENT_ID_KEY);
      }
    }

    try {
      const resumes = await api("/api/resumes");
      if (resumes.length) {
        const result = await api(`/api/resumes/${encodeURIComponent(resumes[0].id)}`);
        await loadResume(result.data, false);
        return;
      }
    } catch (_) {
      showToast("无法读取简历库", true);
    }
    showStartPanel();
  }

  function renderEditor() {
    if (!state) return;
    renderBasicForm();
    renderSections();
  }

  function renderBasicForm() {
    const basic = state.basic;
    const fields = [
      ["name", "姓名", "例如：林晓"],
      ["email", "邮箱", "name@example.com"],
      ["phone", "电话", "手机号码"],
      ["location", "所在地", "例如：长沙"],
      ["extra", "补充信息", "例如：CET-6、到岗时间"],
    ];
    elements.basicForm.innerHTML = fields
      .map(([key, label, placeholder]) => `<label class="field ${key === "extra" ? "full" : ""}"><span>${label}</span><input data-basic="${key}" value="${escapeHtml(basic[key])}" placeholder="${placeholder}" /></label>`)
      .join("");

    const customHtml = basic.customFields
      .map((field, index) => `<div class="field full custom-field-row" data-custom-index="${index}"><span>自定义信息</span><div class="custom-field-inputs"><input data-custom-label="${index}" value="${escapeHtml(field.label)}" placeholder="标签" /><input data-custom-value="${index}" value="${escapeHtml(field.value)}" placeholder="内容" /><button class="icon-button danger" type="button" data-remove-custom="${index}" aria-label="删除自定义信息">×</button></div></div>`)
      .join("");
    const photo = safePhoto(basic.photo);
    elements.basicForm.insertAdjacentHTML(
      "beforeend",
      `${customHtml}<label class="field full"><span>求职方向</span><input data-basic="target" value="${escapeHtml(basic.target)}" placeholder="例如：数据分析实习生" /></label><div class="photo-row"><img class="photo-thumb" src="${photo || emptyPhotoSvg()}" alt="证件照预览" /><div><span class="field-label">证件照（可选）</span><div class="photo-actions"><button class="button tiny" type="button" data-photo-action="select">选择照片</button><button class="button tiny ghost" type="button" data-photo-action="remove" ${photo ? "" : "disabled"}>移除</button></div></div></div>`,
    );

    elements.basicForm.querySelectorAll("[data-basic]").forEach((input) => {
      input.addEventListener("input", () => {
        state.basic[input.dataset.basic] = input.value;
        scheduleUpdate();
      });
    });
    elements.basicForm.querySelectorAll("[data-custom-label]").forEach((input) => {
      input.addEventListener("input", () => {
        state.basic.customFields[Number(input.dataset.customLabel)].label = input.value;
        scheduleUpdate();
      });
    });
    elements.basicForm.querySelectorAll("[data-custom-value]").forEach((input) => {
      input.addEventListener("input", () => {
        state.basic.customFields[Number(input.dataset.customValue)].value = input.value;
        scheduleUpdate();
      });
    });
  }

  function emptyPhotoSvg() {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="84" height="108"><rect width="100%" height="100%" fill="#eef1f4"/><circle cx="42" cy="38" r="15" fill="#c8ced5"/><path d="M17 95c2-23 12-35 25-35s23 12 25 35" fill="#c8ced5"/></svg>');
  }

  function renderSections() {
    elements.sectionsForm.innerHTML = state.sections.map((section, sectionIndex) => `
      <section class="section-card" data-section-index="${sectionIndex}">
        <header class="section-header">
          <input class="section-title-input" data-section-title="${sectionIndex}" value="${escapeHtml(section.title)}" aria-label="模块名称" />
          <div class="section-actions">
            <button class="icon-button" type="button" data-section-action="up" title="上移">↑</button>
            <button class="icon-button" type="button" data-section-action="down" title="下移">↓</button>
            <button class="icon-button" type="button" data-section-action="collapse" title="折叠">−</button>
            <button class="icon-button danger" type="button" data-section-action="delete" title="删除">×</button>
          </div>
        </header>
        <div class="section-body">
          ${section.items.map((item, itemIndex) => itemEditor(item, itemIndex)).join("")}
          <button class="add-item-button" type="button" data-section-action="add-item">＋ 新增条目</button>
        </div>
      </section>`).join("");

    elements.sectionsForm.querySelectorAll("[data-section-title]").forEach((input) => {
      input.addEventListener("input", () => {
        state.sections[Number(input.dataset.sectionTitle)].title = input.value;
        scheduleUpdate();
      });
    });
    elements.sectionsForm.querySelectorAll("[data-item-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const card = input.closest(".section-card");
        const section = state.sections[Number(card.dataset.sectionIndex)];
        const item = section.items[Number(input.dataset.itemIndex)];
        const key = input.dataset.itemField;
        item[key] = key === "bullets" ? input.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : input.value;
        scheduleUpdate();
      });
    });
  }

  function itemEditor(item, itemIndex) {
    return `<article class="item-card" data-item-index="${itemIndex}">
      <div class="item-top"><strong>条目 ${itemIndex + 1}</strong><div class="item-actions">
        <button class="icon-button" type="button" data-item-action="up" title="上移">↑</button>
        <button class="icon-button" type="button" data-item-action="down" title="下移">↓</button>
        <button class="icon-button danger" type="button" data-item-action="delete" title="删除">×</button>
      </div></div>
      <div class="item-grid">
        <label class="field"><span>主标题</span><input data-item-field="title" data-item-index="${itemIndex}" value="${escapeHtml(item.title)}" /></label>
        <label class="field"><span>日期</span><input data-item-field="date" data-item-index="${itemIndex}" value="${escapeHtml(item.date)}" /></label>
        <label class="field wide"><span>副标题</span><input data-item-field="subtitle" data-item-index="${itemIndex}" value="${escapeHtml(item.subtitle)}" /></label>
        <label class="field wide"><span>简介</span><textarea data-item-field="summary" data-item-index="${itemIndex}">${escapeHtml(item.summary)}</textarea></label>
        <label class="field wide"><span>要点（每行一条，**文字** 表示加粗）</span><textarea data-item-field="bullets" data-item-index="${itemIndex}">${escapeHtml(item.bullets.join("\n"))}</textarea></label>
      </div>
    </article>`;
  }

  function move(array, from, to) {
    if (to < 0 || to >= array.length || from === to) return false;
    const [value] = array.splice(from, 1);
    array.splice(to, 0, value);
    return true;
  }

  function scheduleUpdate() {
    schedulePreview();
    scheduleSave();
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPages, 80);
  }

  function scheduleSave() {
    if (!state) return;
    elements.saveStatus.textContent = "正在保存…";
    elements.saveStatus.classList.add("is-saving");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow().catch(() => {}), 650);
  }

  async function saveNow() {
    if (!state) return null;
    clearTimeout(saveTimer);
    state.name = elements.resumeName.value.trim() || "未命名简历";
    const submittedState = JSON.stringify(state);
    const result = await api("/api/resumes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: `{"data":${submittedState}}`,
    });
    // 保存期间可能继续输入；旧响应不能覆盖刚新增的字段或新内容。
    if (!state || JSON.stringify(state) !== submittedState) return normalizeResume(result.data);
    state = normalizeResume(result.data);
    elements.resumeName.value = state.name;
    elements.saveStatus.textContent = "已保存";
    elements.saveStatus.classList.remove("is-saving");
    localStorage.setItem(CURRENT_ID_KEY, state.id);
    return state;
  }

  function createPage() {
    const page = document.createElement("article");
    page.className = `resume-page template-${state.templateId}`;
    const style = state.style;
    page.style.setProperty("--resume-accent", style.accent);
    page.style.setProperty("--resume-font", fontMap[style.font] || fontMap.yahei);
    page.style.setProperty("--resume-title-font", titleFontMap[style.titleFont] || titleFontMap.simsun);
    page.style.setProperty("--resume-body-size", `${Number(style.bodySize) || 10.3}pt`);
    page.style.setProperty("--resume-line-height", Number(style.lineHeight) || 1.68);
    page.style.setProperty("--resume-margin-x", `${Number(style.marginX) || 11}mm`);
    page.style.setProperty("--resume-margin-y", `${Number(style.marginY) || 11}mm`);
    page.style.setProperty("--resume-section-gap", `${Number(style.sectionGap) || 5}mm`);
    page.style.setProperty("--resume-entry-gap", `${Number(style.entryGap) || 4}mm`);
    page.style.setProperty("--resume-bullet-indent", `${Math.max(0, Number(style.bulletIndent) || 0)}mm`);
    page.style.setProperty("--resume-photo-size", `${Number(style.photoSize) || 24}mm`);
    elements.resumePages.appendChild(page);
    return page;
  }

  function resumeHeader() {
    const basic = state.basic;
    const customFields = basic.customFields.filter((field) => field.value.trim());
    const photo = state.style.showPhoto ? safePhoto(basic.photo) : "";
    const header = document.createElement("header");
    header.className = `resume-header ${photo ? "" : "no-photo"}`;
    if (state.templateId === "professional_blue") {
      const title = document.createElement("h2");
      title.className = "resume-section-title";
      title.textContent = "基本信息";
      const body = document.createElement("div");
      body.className = "blue-header-body";
      const fields = [
        ["姓名", basic.name],
        ["电话", basic.phone],
        ["邮箱", basic.email],
        ["所在地", basic.location],
        ["补充信息", basic.extra],
        ...customFields.map((field) => [field.label, field.value]),
        ["求职意向", basic.target.replace(/^求职(方向|意向)[：:]?\s*/, "")],
      ].filter(([, value]) => String(value || "").trim());
      const info = document.createElement("div");
      info.className = "blue-info-grid";
      info.innerHTML = fields.map(([label, value]) => `<strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span>`).join("");
      body.append(info);
      header.append(title, body);
    } else {
      header.innerHTML = `<h1 class="resume-name">${escapeHtml(basic.name || "你的姓名")}</h1><div class="resume-meta"></div>`;
      const values = [basic.email, basic.phone, basic.location, basic.extra, ...customFields.map((field) => field.label.trim() ? `${field.label}：${field.value}` : field.value), basic.target]
        .filter((value) => String(value || "").trim());
      header.querySelector(".resume-meta").innerHTML = values.map((value) => `<span>${escapeHtml(value)}</span>`).join("");
    }
    if (photo) {
      const image = document.createElement("img");
      image.className = "resume-photo";
      image.src = photo;
      image.alt = "证件照";
      (header.querySelector(".blue-header-body") || header).appendChild(image);
    }
    return header;
  }

  function resumeEntry(item) {
    const hasContent = [item.title, item.subtitle, item.date, item.summary].some((value) => value.trim()) || item.bullets.length;
    if (!hasContent) return null;
    const entry = document.createElement("article");
    entry.className = "resume-entry";
    const hasHeading = [item.title, item.subtitle, item.date].some((value) => value.trim());
    entry.innerHTML = `${hasHeading ? `<div class="resume-entry-heading"><div class="resume-entry-title">${inlineFormat(item.title)}</div><div class="resume-entry-subtitle">${inlineFormat(item.subtitle)}</div><time class="resume-entry-date">${escapeHtml(item.date)}</time></div>` : ""}${item.summary ? `<div class="resume-entry-summary">${inlineFormat(item.summary)}</div>` : ""}${item.bullets.length ? `<ul class="resume-bullets">${item.bullets.map((bullet) => `<li>${inlineFormat(bullet)}</li>`).join("")}</ul>` : ""}`;
    return entry;
  }

  function sectionContainer(section) {
    const container = document.createElement("section");
    container.className = "resume-section";
    container.innerHTML = `<h2 class="resume-section-title">${escapeHtml(section.title || "未命名模块")}</h2><div class="resume-section-entries"></div>`;
    return container;
  }

  function pageOverflows(page) {
    return page.scrollHeight > page.clientHeight + 2;
  }

  function renderPages() {
    if (!state || !activeResume) return;
    elements.resumePages.hidden = false;
    elements.resumePages.style.zoom = "1";
    elements.resumePages.innerHTML = "";
    let overflow = false;
    let page = createPage();
    page.appendChild(resumeHeader());

    const usableSections = state.sections
      .map((section) => ({ section, entries: section.items.map(resumeEntry).filter(Boolean) }))
      .filter(({ entries }) => entries.length);

    if (!usableSections.length && !state.basic.name.trim()) {
      page.innerHTML = '<div class="resume-empty-page">在左侧填写内容，这里会显示分页预览。</div>';
    } else {
      for (const { section, entries } of usableSections) {
        let container = sectionContainer(section);
        page.appendChild(container);
        for (const entry of entries) {
          const entriesBox = container.querySelector(".resume-section-entries");
          entriesBox.appendChild(entry);
          if (pageOverflows(page)) {
            entriesBox.removeChild(entry);
            if (!entriesBox.children.length) container.remove();
            page = createPage();
            container = sectionContainer(section);
            page.appendChild(container);
            container.querySelector(".resume-section-entries").appendChild(entry);
            if (pageOverflows(page)) overflow = true;
          }
        }
      }
    }

    [...elements.resumePages.children].forEach((pageElement, index, pages) => {
      pageElement.dataset.pageLabel = `${index + 1} / ${pages.length}`;
    });
    const count = elements.resumePages.children.length;
    elements.pageCount.textContent = `${count} 页`;
    elements.overflowWarning.hidden = !overflow;
    if (fitEnabled) requestAnimationFrame(fitPreview);
  }

  function fitPreview() {
    if (!activeResume || !elements.resumePages.firstElementChild) return;
    const pageWidth = elements.resumePages.firstElementChild.offsetWidth;
    const available = Math.max(300, elements.previewStage.clientWidth - 52);
    const scale = Math.min(1, available / pageWidth);
    elements.resumePages.style.zoom = String(scale);
  }

  function renderStyleForm() {
    if (!state) return;
    const style = state.style;
    elements.styleForm.innerHTML = `
      <label class="field"><span>强调色</span><input type="color" data-style="accent" value="${escapeHtml(style.accent)}" /></label>
      <label class="field"><span>正文字体</span><select data-style="font"><option value="yahei">微软雅黑</option><option value="dengxian">等线</option><option value="simhei">黑体</option><option value="song">宋体</option><option value="system">系统无衬线</option></select></label>
      <label class="field"><span>标题字体</span><select data-style="titleFont"><option value="simsun">宋体</option><option value="yahei">微软雅黑</option><option value="simhei">黑体</option><option value="kaiti">楷体</option></select></label>
      ${rangeControl("bodySize", "正文字号", 8, 13, 0.1, "pt")}
      ${rangeControl("lineHeight", "正文行距", 1.25, 2, 0.01, "")}
      ${rangeControl("marginX", "左右页边距", 7, 22, 1, "mm")}
      ${rangeControl("marginY", "上下页边距", 7, 22, 1, "mm")}
      ${rangeControl("sectionGap", "模块间距", 2, 9, 0.5, "mm")}
      ${rangeControl("entryGap", "条目间距", 1, 7, 0.5, "mm")}
      ${rangeControl("bulletIndent", "要点缩进", 0, 12, 0.5, "mm")}
      ${rangeControl("photoSize", "照片宽度", 18, 34, 1, "mm")}
      <label class="toggle-row"><span>显示照片</span><input type="checkbox" data-style="showPhoto" ${style.showPhoto ? "checked" : ""} /></label>`;
    elements.styleForm.querySelector('[data-style="font"]').value = style.font;
    elements.styleForm.querySelector('[data-style="titleFont"]').value = style.titleFont;
  }

  function rangeControl(key, label, min, max, step, unit) {
    return `<label class="range-label"><span>${label}</span><output data-unit="${unit}">${state.style[key]}${unit}</output><input type="range" data-style="${key}" min="${min}" max="${max}" step="${step}" value="${state.style[key]}" /></label>`;
  }

  function updateTemplateSelection() {
    document.querySelectorAll("[data-template]").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.template === state?.templateId);
    });
  }

  function openDrawer(drawer) {
    closeDrawers();
    drawer.hidden = false;
    elements.drawerBackdrop.hidden = false;
  }

  function closeDrawers() {
    elements.templateDrawer.hidden = true;
    elements.libraryDrawer.hidden = true;
    elements.drawerBackdrop.hidden = true;
  }

  async function renderLibrary() {
    elements.libraryList.innerHTML = '<div class="library-empty">正在读取简历库…</div>';
    try {
      const resumes = await api("/api/resumes");
      elements.libraryList.innerHTML = resumes.length
        ? resumes.map((resume) => `<article class="library-card ${state?.id === resume.id ? "is-current" : ""}" data-library-id="${escapeHtml(resume.id)}"><div class="library-card-heading"><div><h3>${escapeHtml(resume.name)}</h3><p>${escapeHtml(formatDate(resume.updatedAt))}</p></div><span class="library-template-tag">${resume.templateId === "professional_blue" ? "专业蓝" : "经典橙"} · ${resume.hasPdf ? "PDF 已生成" : "尚未导出"}</span></div><div class="library-card-actions"><button class="button tiny" type="button" data-library-action="open">打开</button>${resume.hasPdf ? '<button class="button tiny ghost" type="button" data-library-action="download">下载 PDF</button>' : ""}<button class="button tiny ghost" type="button" data-library-action="duplicate">复制</button><button class="button tiny ghost" type="button" data-library-action="rename">重命名</button><button class="button tiny ghost" type="button" data-library-action="delete">删除</button></div></article>`).join("")
        : '<div class="library-empty">还没有简历。<br />上传一份文件或从空白开始。</div>';
    } catch (error) {
      elements.libraryList.innerHTML = `<div class="library-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
    } catch (_) {
      return value;
    }
  }

  async function importFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    showToast("正在导入简历…");
    const result = await api("/api/import", { method: "POST", body: formData });
    await loadResume(result.data, true);
    showToast(result.notice || "导入完成");
  }

  async function exportPdf() {
    if (!state) {
      showToast("请先创建或导入简历", true);
      return;
    }
    const button = document.getElementById("export-pdf-btn");
    button.disabled = true;
    button.textContent = "正在生成…";
    try {
      await saveNow();
      renderPages();
      const result = await api(`/api/resumes/${encodeURIComponent(state.id)}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages_html: elements.resumePages.innerHTML }),
      });
      const link = document.createElement("a");
      link.href = result.url;
      link.download = `${state.name}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast("PDF 已生成并保存到简历库");
    } catch (error) {
      showToast(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "导出 PDF";
    }
  }

  async function exportJson() {
    if (!state) return showToast("请先创建或导入简历", true);
    try {
      await saveNow();
      const link = document.createElement("a");
      link.href = `/api/resumes/${encodeURIComponent(state.id)}/json`;
      link.download = `${state.name}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast("JSON 已导出，可用于备份或重新导入");
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-import-trigger]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".more-actions[open]").forEach((menu) => { menu.open = false; });
        elements.resumeFileInput.click();
      });
    });
    document.getElementById("import-btn").addEventListener("click", () => elements.resumeFileInput.click());
    elements.resumeFileInput.addEventListener("change", async () => {
      const file = elements.resumeFileInput.files?.[0];
      elements.resumeFileInput.value = "";
      if (!file) return;
      try {
        await importFile(file);
      } catch (error) {
        showToast(error.message, true);
      }
    });
    document.getElementById("blank-resume-btn").addEventListener("click", () => loadResume(blankResume(), true));
    document.getElementById("example-btn").addEventListener("click", async () => {
      try {
        const result = await api("/api/example");
        await loadResume(result.data, true);
      } catch (error) {
        showToast(error.message, true);
      }
    });
    document.querySelectorAll("#export-json-btn, [data-json-trigger]").forEach((button) => {
      button.addEventListener("click", exportJson);
    });
    document.getElementById("new-resume-btn").addEventListener("click", async () => {
      if (state && !confirm("创建新简历吗？当前内容已经自动保存。")) return;
      closeDrawers();
      await loadResume(blankResume(), true);
    });
    document.getElementById("add-basic-field-btn").addEventListener("click", () => {
      if (!state) return;
      state.basic.customFields.push({ label: "", value: "" });
      renderBasicForm();
      scheduleUpdate();
      const labels = elements.basicForm.querySelectorAll("[data-custom-label]");
      labels[labels.length - 1]?.focus();
    });
    elements.resumeName.addEventListener("input", () => {
      if (!state) return;
      state.name = elements.resumeName.value;
      scheduleSave();
    });
    document.getElementById("add-section-btn").addEventListener("click", () => {
      state.sections.push({ id: makeId("section"), title: "新模块", items: [emptyItem()] });
      renderSections();
      scheduleUpdate();
    });
    elements.basicForm.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      if (!target || !state) return;
      if (target.dataset.photoAction === "select") elements.photoFileInput.click();
      if (target.dataset.photoAction === "remove") {
        state.basic.photo = "";
        renderBasicForm();
        scheduleUpdate();
      }
      if (target.dataset.removeCustom !== undefined) {
        state.basic.customFields.splice(Number(target.dataset.removeCustom), 1);
        renderBasicForm();
        scheduleUpdate();
      }
    });
    elements.photoFileInput.addEventListener("change", () => {
      const file = elements.photoFileInput.files?.[0];
      elements.photoFileInput.value = "";
      if (!file || file.size > 4 * 1024 * 1024) {
        if (file) showToast("照片不能超过 4 MB", true);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        state.basic.photo = String(reader.result || "");
        state.style.showPhoto = true;
        renderBasicForm();
        renderStyleForm();
        scheduleUpdate();
      };
      reader.readAsDataURL(file);
    });
    elements.sectionsForm.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      const card = event.target.closest(".section-card");
      if (!button || !card || !state) return;
      const sectionIndex = Number(card.dataset.sectionIndex);
      const section = state.sections[sectionIndex];
      if (button.dataset.sectionAction === "collapse") {
        card.classList.toggle("is-collapsed");
        button.textContent = card.classList.contains("is-collapsed") ? "+" : "−";
        return;
      }
      if (button.dataset.sectionAction === "add-item") section.items.push(emptyItem());
      if (button.dataset.sectionAction === "up") move(state.sections, sectionIndex, sectionIndex - 1);
      if (button.dataset.sectionAction === "down") move(state.sections, sectionIndex, sectionIndex + 1);
      if (button.dataset.sectionAction === "delete" && confirm(`删除模块“${section.title}”吗？`)) state.sections.splice(sectionIndex, 1);
      const itemCard = button.closest(".item-card");
      if (itemCard && button.dataset.itemAction) {
        const itemIndex = Number(itemCard.dataset.itemIndex);
        if (button.dataset.itemAction === "up") move(section.items, itemIndex, itemIndex - 1);
        if (button.dataset.itemAction === "down") move(section.items, itemIndex, itemIndex + 1);
        if (button.dataset.itemAction === "delete" && confirm("删除这个条目吗？")) section.items.splice(itemIndex, 1);
      }
      renderSections();
      scheduleUpdate();
    });
    document.getElementById("template-btn").addEventListener("click", () => {
      if (!state) return showToast("请先创建或导入简历", true);
      openDrawer(elements.templateDrawer);
    });
    document.querySelectorAll("#library-btn, [data-library-trigger]").forEach((button) => {
      button.addEventListener("click", async () => {
        document.querySelectorAll(".more-actions[open]").forEach((menu) => { menu.open = false; });
        openDrawer(elements.libraryDrawer);
        await renderLibrary();
      });
    });
    document.querySelectorAll(".drawer-close").forEach((button) => button.addEventListener("click", closeDrawers));
    elements.drawerBackdrop.addEventListener("click", closeDrawers);
    document.querySelectorAll("[data-template]").forEach((card) => {
      card.addEventListener("click", () => {
        const template = card.dataset.template;
        if (state.templateId !== template) {
          state.templateId = template;
          state.style.accent = template === "professional_blue" ? "#173f65" : "#2563eb";
          renderStyleForm();
          updateTemplateSelection();
          scheduleUpdate();
        }
      });
    });
    elements.styleForm.addEventListener("input", (event) => {
      const input = event.target.closest("[data-style]");
      if (!input || !state) return;
      const key = input.dataset.style;
      state.style[key] = input.type === "checkbox" ? input.checked : input.type === "range" ? Number(input.value) : input.value;
      const output = input.closest(".range-label")?.querySelector("output");
      if (output) output.textContent = `${input.value}${output.dataset.unit}`;
      scheduleUpdate();
    });
    elements.styleForm.addEventListener("change", (event) => {
      const input = event.target.closest("[data-style]");
      if (!input || !state) return;
      state.style[input.dataset.style] = input.type === "checkbox" ? input.checked : input.value;
      scheduleUpdate();
    });
    document.getElementById("fit-btn").addEventListener("click", (event) => {
      fitEnabled = !fitEnabled;
      event.currentTarget.textContent = fitEnabled ? "实际大小" : "适合窗口";
      elements.resumePages.style.zoom = fitEnabled ? elements.resumePages.style.zoom : "1";
      if (fitEnabled) fitPreview();
    });
    document.getElementById("export-pdf-btn").addEventListener("click", exportPdf);
    elements.libraryList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-library-action]");
      const card = event.target.closest("[data-library-id]");
      if (!button || !card) return;
      const id = card.dataset.libraryId;
      try {
        if (button.dataset.libraryAction === "open") {
          const result = await api(`/api/resumes/${encodeURIComponent(id)}`);
          await loadResume(result.data, false);
          closeDrawers();
        }
        if (button.dataset.libraryAction === "download") {
          const link = document.createElement("a");
          link.href = `/api/resumes/${encodeURIComponent(id)}/pdf`;
          link.click();
        }
        if (button.dataset.libraryAction === "duplicate") {
          const result = await api(`/api/resumes/${encodeURIComponent(id)}/duplicate`, { method: "POST" });
          await loadResume(result.data, false);
          closeDrawers();
          showToast("已复制简历");
        }
        if (button.dataset.libraryAction === "rename") {
          const result = await api(`/api/resumes/${encodeURIComponent(id)}`);
          const name = prompt("新的简历名称", result.data.name);
          if (name?.trim()) {
            result.data.name = name.trim();
            await api("/api/resumes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: result.data }) });
            if (state?.id === id) {
              state.name = name.trim();
              elements.resumeName.value = state.name;
            }
            await renderLibrary();
          }
        }
        if (button.dataset.libraryAction === "delete") {
          if (!confirm("删除这份简历及其最新 PDF 吗？此操作无法恢复。")) return;
          await api(`/api/resumes/${encodeURIComponent(id)}`, { method: "DELETE" });
          if (state?.id === id) showStartPanel();
          await renderLibrary();
          showToast("简历已删除");
        }
      } catch (error) {
        showToast(error.message, true);
      }
    });
    window.addEventListener("resize", () => fitEnabled && fitPreview());
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDrawers();
    });

  }

  async function initialize() {
    bindEvents();
    await Promise.all([checkHealth(), loadInitialResume()]);
  }

  initialize().catch((error) => {
    showToast(error.message || "应用初始化失败", true);
    showStartPanel();
  });
})();
