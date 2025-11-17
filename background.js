const STORAGE_KEY = "selectionGoSearchers";
const LANGUAGE_KEY = "selectionGoLanguage";
const PLACEHOLDER = "SelectionGo";
const PLACEHOLDER_TOKENS = [PLACEHOLDER, "{{selection}}", "{{query}}"];
const COMMON_QUERY_KEYS = ["q", "query", "keyword", "wd", "text", "k", "search", "s", "term"];
const SECONDARY_PARENT_ID = "selectiongo-secondary-root";
const DEFAULT_LANGUAGE = "zh";

const MENU_TEXT = {
  zh: {
    useSearch: (name) => `使用 ${name} 搜索`,
    useOtherSearch: "使用其他搜索"
  },
  en: {
    useSearch: (name) => `Search with ${name}`,
    useOtherSearch: "Search with others"
  }
};

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

let engineMenuMap = {};

async function ensureDefaults() {
  const result = await chrome.storage.sync.get([STORAGE_KEY, LANGUAGE_KEY]);
  const updates = {};

  if (!Array.isArray(result[STORAGE_KEY]) || result[STORAGE_KEY].length === 0) {
    updates[STORAGE_KEY] = DEFAULT_ENGINES;
  }

  if (!result[LANGUAGE_KEY] || !getLanguageStrings(result[LANGUAGE_KEY])) {
    updates[LANGUAGE_KEY] = detectPreferredLanguage();
  }

  if (Object.keys(updates).length) {
    await chrome.storage.sync.set(updates);
  }
}

async function getEngines() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const rawList = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : DEFAULT_ENGINES;
  const sanitized = rawList
    .filter((engine) => engine && engine.name && engine.url)
    .map((engine) => ({
      id: engine.id || crypto.randomUUID(),
      name: engine.name,
      url: engine.url,
      level: engine.level === "secondary" ? "secondary" : "primary"
    }));

  const missingId = sanitized.some((engine, index) => rawList[index] && !rawList[index].id);
  if (missingId) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: sanitized });
  }
  return sanitized;
}

async function getLanguage() {
  const result = await chrome.storage.sync.get(LANGUAGE_KEY);
  const stored = result[LANGUAGE_KEY];
  if (stored && getLanguageStrings(stored)) {
    return stored;
  }
  const detected = detectPreferredLanguage();
  await chrome.storage.sync.set({ [LANGUAGE_KEY]: detected });
  return detected;
}

function detectPreferredLanguage() {
  const locale = (chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || DEFAULT_LANGUAGE;
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function getLanguageStrings(lang) {
  return MENU_TEXT[lang] || MENU_TEXT[DEFAULT_LANGUAGE];
}

function formatSearchUrl(template, selectionText) {
  if (!template || !selectionText) {
    return template;
  }
  const trimmed = selectionText.trim();
  if (!trimmed) {
    return template;
  }

  const query = encodeURIComponent(trimmed);
  for (const token of PLACEHOLDER_TOKENS) {
    if (template.includes(token)) {
      return template.split(token).join(query);
    }
    const encodedToken = encodeURIComponent(token);
    if (encodedToken !== token && template.includes(encodedToken)) {
      return template.split(encodedToken).join(query);
    }
  }

  const rewritten = replaceQueryValue(template, trimmed);
  if (rewritten) {
    return rewritten;
  }

  const delimiter = template.includes("?") ? "&" : "?";
  return `${template}${delimiter}q=${query}`;
}

function replaceQueryValue(template, rawSelection) {
  try {
    const parsed = new URL(template);
    if (!parsed.search) {
      return null;
    }
    const params = parsed.searchParams;
    const targetKey =
      COMMON_QUERY_KEYS.find((key) => params.has(key)) ||
      (() => {
        const iterator = params.keys();
        const first = iterator.next();
        return first.done ? null : first.value;
      })();

    if (!targetKey) {
      return null;
    }

    params.set(targetKey, rawSelection);
    return parsed.toString();
  } catch {
    return null;
  }
}

async function rebuildContextMenus() {
  const [engines, language] = await Promise.all([getEngines(), getLanguage()]);
  const strings = getLanguageStrings(language);
  engineMenuMap = {};
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => {
      engines
        .filter((engine) => engine.level === "primary")
        .forEach((engine) => createMenu(engine, undefined, strings));

      const secondary = engines.filter((engine) => engine.level === "secondary");
      if (secondary.length > 0) {
        chrome.contextMenus.create({
          id: SECONDARY_PARENT_ID,
          title: strings.useOtherSearch,
          contexts: ["selection"]
        });
        secondary.forEach((engine) => createMenu(engine, SECONDARY_PARENT_ID, strings));
      }

      resolve();
    });
  });
}

function createMenu(engine, parentId, strings) {
  const menuId = `selectiongo-${engine.id}`;
  engineMenuMap[menuId] = engine;
  chrome.contextMenus.create({
    id: menuId,
    parentId,
    title: strings.useSearch(engine.name),
    contexts: ["selection"]
  });
}

chrome.contextMenus.onClicked.addListener((info) => {
  const engine = engineMenuMap[info.menuItemId];
  if (!engine || !info.selectionText) {
    return;
  }
  const targetUrl = formatSearchUrl(engine.url, info.selectionText);
  if (!targetUrl) {
    return;
  }
  chrome.tabs.create({ url: targetUrl });
});

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  await rebuildContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await rebuildContextMenus();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && (changes[STORAGE_KEY] || changes[LANGUAGE_KEY])) {
    rebuildContextMenus();
  }
});
