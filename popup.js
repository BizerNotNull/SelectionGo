const STORAGE_KEY = "selectionGoSearchers";
const LANGUAGE_KEY = "selectionGoLanguage";
const DEFAULT_LANGUAGE = "zh";
const SAVE_DEBOUNCE = 500;

const DEFAULT_ENGINES = [
  {
    id: "bing",
    name: "Bing",
    url: "https://www.bing.com/search?q=SelectionGo",
    level: "primary"
  },
  {
    id: "baidu",
    name: "Baidu",
    url: "https://www.baidu.com/s?wd=SelectionGo",
    level: "primary"
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    url: "https://en.wikipedia.org/wiki/Special:Search?search=SelectionGo",
    level: "secondary"
  },
  {
    id: "google",
    name: "Google",
    url: "https://www.google.com/search?q=SelectionGo",
    level: "secondary"
  }
];

const translations = {
  zh: {
    title: "SelectionGo 搜索配置",
    description: "自由添加搜索方式，URL 中使用 SelectionGo 表示被选中的文本，可选择放在一级菜单或二级菜单。",
    languageLabel: "界面语言",
    addEngine: "添加搜索方式",
    exportConfig: "导出配置",
    importConfig: "导入配置",
    fieldName: "显示名称",
    fieldUrl: "搜索 URL",
    fieldLevel: "菜单层级",
    optionPrimary: "一级菜单",
    optionSecondary: "二级菜单",
    deleteEngine: "删除",
    placeholderName: "例如：Bing",
    placeholderUrl: "https://example.com?q=SelectionGo",
    //// statusSaved: "已保存",
    statusNeedOne: "至少需要一个有效的搜索配置",
    statusExported: "导出完成",
    statusImportSuccess: "导入成功",
    statusImportFail: "导入失败：{message}",
    statusInvalidJson: "配置格式不正确",
    statusNoValidImport: "未找到有效的搜索配置"
  },
  en: {
    title: "SelectionGo Search Settings",
    description: "Add custom search targets. Use SelectionGo inside the URL where the highlighted text should go, and choose whether it sits in the primary or secondary menu.",
    languageLabel: "Interface language",
    addEngine: "Add search",
    exportConfig: "Export",
    importConfig: "Import",
    fieldName: "Display name",
    fieldUrl: "Search URL",
    fieldLevel: "Menu level",
    optionPrimary: "Primary menu",
    optionSecondary: "Secondary menu",
    deleteEngine: "Delete",
    placeholderName: "e.g. Bing",
    placeholderUrl: "https://example.com?q=SelectionGo",
    //// statusSaved: "Saved",
    statusNeedOne: "Enter at least one valid search configuration",
    statusExported: "Export finished",
    statusImportSuccess: "Import succeeded",
    statusImportFail: "Import failed: {message}",
    statusInvalidJson: "Invalid configuration format",
    statusNoValidImport: "No valid search entry found"
  }
};

const enginesContainer = document.getElementById("engines");
const statusEl = document.getElementById("status");
const addEngineBtn = document.getElementById("addEngine");
const exportBtn = document.getElementById("exportConfig");
const importInput = document.getElementById("importFile");
const languageSelect = document.getElementById("languageSelect");

let currentLanguage = DEFAULT_LANGUAGE;
let saveTimer;

init();

async function init() {
  const stored = await chrome.storage.sync.get([STORAGE_KEY, LANGUAGE_KEY]);
  const storedLang = stored[LANGUAGE_KEY];
  if (translations[storedLang]) {
    currentLanguage = storedLang;
  } else {
    currentLanguage = detectPreferredLanguage();
    await chrome.storage.sync.set({ [LANGUAGE_KEY]: currentLanguage });
  }
  languageSelect.value = currentLanguage;
  applyTranslations();

  const engines =
    Array.isArray(stored[STORAGE_KEY]) && stored[STORAGE_KEY].length > 0 ? stored[STORAGE_KEY] : DEFAULT_ENGINES;
  renderEngines(engines);

  addEngineBtn.addEventListener("click", () => {
    addEngineRow(createEmptyEngine());
  });
  exportBtn.addEventListener("click", exportConfig);
  importInput.addEventListener("change", handleImport);
  languageSelect.addEventListener("change", onLanguageChange);
}

function t(key, vars = {}) {
  const template =
    (translations[currentLanguage] && translations[currentLanguage][key]) ||
    (translations[DEFAULT_LANGUAGE] && translations[DEFAULT_LANGUAGE][key]) ||
    key;
  return template.replace(/\{(\w+)\}/g, (_, token) => (vars[token] ?? ""));
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
}

function renderEngines(list) {
  enginesContainer.innerHTML = "";
  const items = list.length ? list : [createEmptyEngine()];
  items.forEach((engine) => addEngineRow(engine));
}

function addEngineRow(engine) {
  const item = document.createElement("div");
  item.className = "engine";
  item.dataset.id = engine.id || crypto.randomUUID();

  item.innerHTML = `
    <label class="field">
      <span>${t("fieldName")}</span>
      <input type="text" name="name" placeholder="${escapeHtml(t("placeholderName"))}" value="${escapeHtml(
        engine.name || ""
      )}" />
    </label>
    <label class="field">
      <span>${t("fieldUrl")}</span>
      <input type="text" name="url" placeholder="${escapeHtml(t("placeholderUrl"))}" value="${escapeHtml(
        engine.url || ""
      )}" />
    </label>
    <div class="engine-actions">
      <label>
        <span>${t("fieldLevel")}</span>
        <select name="level">
          <option value="primary" ${engine.level !== "secondary" ? "selected" : ""}>${t("optionPrimary")}</option>
          <option value="secondary" ${engine.level === "secondary" ? "selected" : ""}>${t("optionSecondary")}</option>
        </select>
      </label>
      <button class="danger" type="button">${t("deleteEngine")}</button>
    </div>
  `;

  const deleteButton = item.querySelector("button");
  deleteButton.addEventListener("click", () => {
    item.remove();
    if (!enginesContainer.children.length) {
      addEngineRow(createEmptyEngine());
    }
    scheduleSave();
  });

  item.querySelectorAll("input, select").forEach((element) => {
    const eventType = element.tagName === "SELECT" ? "change" : "input";
    element.addEventListener(eventType, scheduleSave);
    if (eventType === "input") {
      element.addEventListener("blur", scheduleSave);
    }
  });

  enginesContainer.appendChild(item);
}

function createEmptyEngine() {
  return {
    id: crypto.randomUUID(),
    name: "",
    url: "",
    level: "primary"
  };
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveEngines, SAVE_DEBOUNCE);
}

async function saveEngines() {
  const engines = collectEnginesFromDom().filter((engine) => engine.name && engine.url);
  if (!engines.length) {
    showStatus(t("statusNeedOne"), true);
    return;
  }
  await chrome.storage.sync.set({ [STORAGE_KEY]: engines });
  //// showStatus(t("statusSaved"));
}

function collectEnginesFromDom() {
  return Array.from(enginesContainer.querySelectorAll(".engine")).map((item) => {
    const name = item.querySelector('input[name="name"]').value.trim();
    const url = item.querySelector('input[name="url"]').value.trim();
    const level = item.querySelector('select[name="level"]').value === "secondary" ? "secondary" : "primary";
    const id = item.dataset.id || crypto.randomUUID();
    return { id, name, url, level };
  });
}

async function onLanguageChange(event) {
  const nextLang = event.target.value;
  currentLanguage = translations[nextLang] ? nextLang : DEFAULT_LANGUAGE;
  languageSelect.value = currentLanguage;
  await chrome.storage.sync.set({ [LANGUAGE_KEY]: currentLanguage });
  applyTranslations();
  const snapshot = collectEnginesFromDom();
  renderEngines(snapshot);
}

async function exportConfig() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const engines = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  const data = JSON.stringify(engines, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `selectiongo-config-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showStatus(t("statusExported"));
}

async function handleImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error(t("statusInvalidJson"));
    }
    const sanitized = parsed
      .map((entry) => ({
        id: entry.id || crypto.randomUUID(),
        name: typeof entry.name === "string" ? entry.name.trim() : "",
        url: typeof entry.url === "string" ? entry.url.trim() : "",
        level: entry.level === "secondary" ? "secondary" : "primary"
      }))
      .filter((entry) => entry.name && entry.url);

    if (!sanitized.length) {
      throw new Error(t("statusNoValidImport"));
    }

    await chrome.storage.sync.set({ [STORAGE_KEY]: sanitized });
    renderEngines(sanitized);
    showStatus(t("statusImportSuccess"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showStatus(t("statusImportFail", { message }), true);
  } finally {
    event.target.value = "";
  }
}

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#dc2626" : "#2563eb";
  if (!message) {
    return;
  }
  window.setTimeout(() => {
    if (statusEl.textContent === message) {
      statusEl.textContent = "";
    }
  }, 4000);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function detectPreferredLanguage() {
  const locale =
    (chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) ||
    (typeof navigator === "object" && navigator.language) ||
    DEFAULT_LANGUAGE;
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}
