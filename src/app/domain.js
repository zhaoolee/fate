import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const deskDecorBackgrounds = Object.entries(
  import.meta.glob("../../desk-decor-bg/*.{png,jpg,jpeg,webp,avif}", {
    eager: true,
    import: "default",
    query: "?url"
  })
)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([, url]) => url);

export const deskDecorItems = Object.entries(
  import.meta.glob("../../desk-decor/*.{png,jpg,jpeg,webp,avif}", {
    eager: true,
    import: "default",
    query: "?url"
  })
)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, url]) => ({ name: path.split("/").pop(), url }));

export const defaultUnlockedDeskDecorStems = ["水晶洞", "五帝钱", "金蟾"];
export const deskDecorUnlockStarStep = 4;
const defaultUnlockedDeskDecorStemSet = new Set(defaultUnlockedDeskDecorStems);

export function deskDecorStem(item) {
  return String(typeof item === "string" ? item : item?.name ?? "").replace(/\.[^.]+$/, "");
}

export function deskDecorUnlockStates(count) {
  const stars = normalizeAchievementCount(count);
  let gatedIndex = 0;

  return deskDecorItems.map(item => {
    const name = deskDecorStem(item);
    const defaultUnlocked = defaultUnlockedDeskDecorStemSet.has(name);
    let requiredStars = 0;

    if (!defaultUnlocked) {
      gatedIndex += 1;
      requiredStars = gatedIndex * deskDecorUnlockStarStep;
    }

    return {
      item,
      name,
      defaultUnlocked,
      requiredStars,
      unlocked: defaultUnlocked || stars >= requiredStars
    };
  });
}

export const navIcons = Object.fromEntries(
  Object.entries(
    import.meta.glob("../assets/nav-icons/*.png", {
      eager: true,
      import: "default",
      query: "?url"
    })
  ).map(([path, url]) => [path.split("/").pop().replace(/\.[^.]+$/, ""), url])
);

export const achievementIcons = Object.fromEntries(
  Object.entries(
    import.meta.glob("../assets/achievements/*.png", {
      eager: true,
      import: "default",
      query: "?url"
    })
  ).map(([path, url]) => [path.split("/").pop().replace(/\.[^.]+$/, ""), url])
);

const localAiConfigModule = Object.values(
  import.meta.glob("./ai-config.local.js", {
    eager: true
  })
)[0];

export const hasOfficialDefaultAiConfig = Boolean(localAiConfigModule);

export const customAiPlaceholders = {
  llmEndpoint: "https://api.deepseek.com/chat/completions",
  llmModel: "deepseek-v4-flash",
  llmApiKey: ""
};

export const defaultAiConfig = {
  ...customAiPlaceholders,
  ...(localAiConfigModule?.default ?? {})
};

export const defaultSettings = {
  workMinutes: 45,
  restMinutes: 15,
  appearanceMode: "system",
  languageMode: "system",
  useCustomAi: false,
  llmEndpoint: "",
  llmModel: "",
  llmApiKey: "",
  profile: "我是一个男性程序员\n最近屏幕看久了，眼睛有些干涩",
  birthName: "",
  birthGender: "",
  birthYear: "",
  birthMonth: "",
  birthDay: "",
  birthDate: "",
  birthYearMonth: "",
  birthTime: "",
  showRocketTools: false
};

export const initialSnapshot = {
  status: "waiting",
  workCycleId: 0,
  periodElapsedSecs: 0,
  idleSecs: 0,
  workGoalSecs: defaultSettings.workMinutes * 60,
  restGoalSecs: defaultSettings.restMinutes * 60,
  todayWorkSecs: 0,
  todayRestSecs: 0,
  reminderCount: 0,
  lastEventUnixMs: Date.now(),
  keyboardCount: 0,
  mouseClickCount: 0,
  message: "等待第一次键盘或鼠标点击"
};

export const initialInputMonitorPermission = {
  supported: false,
  authorized: false,
  listening: false,
  requiresPermission: false,
  needsPermission: false,
  keyboardCount: 0,
  mouseClickCount: 0,
  lastEventUnixMs: 0,
  message: "正在读取输入监测权限"
};

export const legacyLlmDefaults = {
  llmEndpoint: "https://api.openai.com/v1",
  llmModel: "gpt-4.1-mini"
};

export const legacyDeepSeekEndpoint = "https://api.deepseek.com";
export const activitySampleMs = 10_000;
export const activityRingMinutes = 60;
export const activityRingMs = activityRingMinutes * 60_000;
export const activitySegmentCount = activityRingMs / activitySampleMs;
export const activityHourCount = 24;
export const aiTipSections = [
  { id: "health", title: "健康建议", action: "生成建议", loading: "生成中" },
  { id: "fortune", title: "今日运势", action: "生成运势", loading: "生成中" },
  { id: "talisman", title: "今日最合适的趋吉避凶摆件", action: "生成摆件", loading: "生成中" }
];
export const aiGeneratedSections = aiTipSections;
export const aiTipSectionMap = Object.fromEntries(aiTipSections.map(section => [section.id, section]));
export const defaultHealthExtraPrompt =
  "请用资深中医的语气，结合中医理论（如阴阳五行、脏腑经络、辨证论治等），用温和、专业、富有文化底蕴的语言，引用一些道德经名言，给出健康建议";
export const defaultFortuneExtraPrompt =
  "请用专业卜算师的语气，根据用户的八字信息和当前流年，分析今日在事业工作、财运、感情人际、健康等方面的运势情况，给出今日宜忌建议";
export const defaultAiExtraPrompts = {
  health: defaultHealthExtraPrompt,
  fortune: defaultFortuneExtraPrompt,
  talisman: ""
};
export const shortTextTipKinds = ["health", "fortune"];
export const shortTextPromptCacheVersion = "short-text-v7";
export const defaultBreakTip = "离开屏幕，站起来活动肩颈，给眼睛一点远处的光。";

export const tabs = [
  ["today", "今日", "今", "today"],
  ["calendar", "往日", "往", "history"],
  ["ai", "AI 健康", "AI", "ai"],
  ["achievements", "成就", "成", "achievements"],
  ["settings", "设置", "设", "settings"]
];

export const windowSizeModes = [
  { id: "mini", label: "迷你版" },
  { id: "wide", label: "宽屏版" }
];

export const appearanceModes = [
  { id: "system", label: "跟随系统" },
  { id: "light", label: "亮色模式" },
  { id: "dark", label: "暗色模式" }
];

export const languageModes = [
  { id: "system", label: "跟随系统" },
  { id: "zh", label: "中文" },
  { id: "en", label: "英文" }
];

export const mainWindowLogicalSizes = {
  mini: { width: 390, height: 631 },
  wide: { width: 960, height: 640 }
};

export function normalizeAppearanceMode(value) {
  return appearanceModes.some(mode => mode.id === value) ? value : "system";
}

export function normalizeLanguageMode(value) {
  return languageModes.some(mode => mode.id === value) ? value : "system";
}

export function normalizeWindowSizeMode(value) {
  return windowSizeModes.some(mode => mode.id === value) ? value : "mini";
}

export function inferWindowSizeModeFromSize(size = {}) {
  const width = Number(size.width ?? 0);
  const height = Number(size.height ?? 0);
  const widthThreshold = (mainWindowLogicalSizes.mini.width + mainWindowLogicalSizes.wide.width) / 2;
  const heightThreshold = (mainWindowLogicalSizes.mini.height + mainWindowLogicalSizes.wide.height) / 2;
  return width >= widthThreshold || height >= heightThreshold ? "wide" : "mini";
}

export function viewportWindowSizeMode() {
  if (typeof window === "undefined") return "mini";
  return inferWindowSizeModeFromSize({ width: window.innerWidth, height: window.innerHeight });
}

export function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function currentRoute() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("route") === "overlay") return "overlay";
  return "app";
}

export function currentWindowInfo() {
  try {
    const window = getCurrentWindow();
    return { window, label: window.label };
  } catch {
    return { window: null, label: "" };
  }
}

export function pickDeskBackgroundIndex(currentIndex = -1) {
  if (!deskDecorBackgrounds.length) return -1;
  if (deskDecorBackgrounds.length === 1) return 0;
  const current = Number.isInteger(currentIndex) ? currentIndex : -1;
  let next = Math.floor(Math.random() * (deskDecorBackgrounds.length - 1));
  if (next >= current && current >= 0 && current < deskDecorBackgrounds.length) {
    next += 1;
  }
  return next;
}

export function normalizeDeskBackgroundIndex(value) {
  const index = Number(value);
  if (Number.isInteger(index) && index >= 0 && index < deskDecorBackgrounds.length) return index;
  return pickDeskBackgroundIndex();
}

export function normalizeSettings(settings) {
  const raw = settings && typeof settings === "object" ? settings : {};
  const normalized = { ...defaultSettings, ...raw };
  const birthParts = normalizeBirthParts(raw);

  normalized.useCustomAi = hasOfficialDefaultAiConfig ? raw.useCustomAi === true : true;
  normalized.showRocketTools = raw.showRocketTools === true;
  normalized.appearanceMode = normalizeAppearanceMode(raw.appearanceMode);
  normalized.languageMode = normalizeLanguageMode(raw.languageMode);
  normalized.birthYear = birthParts.year;
  normalized.birthMonth = birthParts.month;
  normalized.birthDay = birthParts.day;
  normalized.birthDate = birthDateValue(birthParts);
  normalized.birthYearMonth = birthYearMonthValue(birthParts);
  const hasLegacyLlmDefaults =
    normalized.llmEndpoint === legacyLlmDefaults.llmEndpoint &&
    normalized.llmModel === legacyLlmDefaults.llmModel &&
    !normalized.llmApiKey;

  if (hasLegacyLlmDefaults) {
    normalized.llmEndpoint = defaultSettings.llmEndpoint;
    normalized.llmModel = defaultSettings.llmModel;
  } else if (normalized.llmEndpoint === legacyDeepSeekEndpoint) {
    normalized.llmEndpoint = defaultSettings.llmEndpoint;
  }

  return normalized;
}

export function normalizeBirthParts(settings = {}) {
  const fromBirthDate = parseBirthDateParts(settings.birthDate);
  const fromLegacyMonth = parseBirthDateParts(settings.birthYearMonth);
  const parts = {
    year: normalizeBirthPart(settings.birthYear, 1900, 2100) || fromBirthDate.year || fromLegacyMonth.year,
    month: normalizeBirthPart(settings.birthMonth, 1, 12) || fromBirthDate.month || fromLegacyMonth.month,
    day: normalizeBirthPart(settings.birthDay, 1, 31) || fromBirthDate.day
  };
  const maxDay = birthMonthDayCount(parts.year, parts.month);

  if (Number(parts.day) > maxDay) {
    parts.day = "";
  }

  return parts;
}

function parseBirthDateParts(value) {
  const match = String(value ?? "").trim().match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
  if (!match) return { year: "", month: "", day: "" };

  return {
    year: normalizeBirthPart(match[1], 1900, 2100),
    month: normalizeBirthPart(match[2], 1, 12),
    day: normalizeBirthPart(match[3], 1, 31)
  };
}

function normalizeBirthPart(value, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) return "";
  return String(number).padStart(max >= 100 ? 4 : 2, "0");
}

export function birthDateValue(parts = {}) {
  const year = normalizeBirthPart(parts.year, 1900, 2100);
  const month = normalizeBirthPart(parts.month, 1, 12);
  const day = normalizeBirthPart(parts.day, 1, 31);
  return year && month && day ? `${year}-${month}-${day}` : "";
}

export function birthYearMonthValue(parts = {}) {
  const year = normalizeBirthPart(parts.year, 1900, 2100);
  const month = normalizeBirthPart(parts.month, 1, 12);
  return year && month ? `${year}-${month}` : "";
}

function birthMonthDayCount(year, month) {
  const normalizedMonth = Number(month);
  if (!Number.isInteger(normalizedMonth) || normalizedMonth < 1 || normalizedMonth > 12) return 31;
  return new Date(Number(year) || 2000, normalizedMonth, 0).getDate();
}

export function effectiveAiConfig(settings) {
  if (!settings?.useCustomAi) {
    return defaultAiConfig;
  }

  return {
    llmEndpoint: String(settings.llmEndpoint ?? "").trim(),
    llmModel: String(settings.llmModel ?? "").trim(),
    llmApiKey: String(settings.llmApiKey ?? "").trim()
  };
}

export function settingText(value) {
  return String(value ?? "").trim();
}

export function birthInfoPrompt(settings) {
  const birthDate = birthDatePrompt(settings);
  const entries = [
    ["姓名", settings?.birthName],
    ["性别", settings?.birthGender],
    ["出生日期", birthDate],
    ["出生时间", settings?.birthTime]
  ]
    .map(([label, value]) => [label, settingText(value)])
    .filter(([, value]) => value);

  if (!entries.length) return "";
  return ["生辰信息：", ...entries.map(([label, value]) => `${label}：${value}`)].join("\n");
}

export function aiProfilePrompt(settings) {
  return [settingText(settings?.profile), birthInfoPrompt(settings)].filter(Boolean).join("\n\n");
}

export function birthDatePrompt(settings = {}) {
  const parts = normalizeBirthParts(settings);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  if (year && month && day) return `${year}年${month}月${day}日`;
  if (year && month) return `${year}年${month}月`;
  if (year) return `${year}年`;
  return "";
}

export function normalizeTips(value) {
  if (Array.isArray(value)) {
    return value.map(tipValueToText).map(cleanTipText).filter(Boolean);
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    return normalizeTips(JSON.parse(value));
  } catch {
    return value
      .split(/\n+/)
      .map(cleanTipText)
      .filter(Boolean);
  }
}

export function tipValueToText(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const name = value.image ?? value.imageName ?? value.image_name ?? value.name ?? value.file ?? "";
  const description = value.description ?? value.text ?? value.reason ?? value.tip ?? "";
  if (name && description) return `${name}：${description}`;
  return name || description;
}

export function cleanTipText(value) {
  return String(value)
    .replace(/^\s*\d+[.)、]\s*/, "")
    .replace(/\*\*/g, "")
    .trim();
}

export function deskDecorChoiceFromTips(tips, items = deskDecorItems) {
  const choices = normalizeTips(tips);
  const candidates = items.map(item => ({
    item,
    name: deskDecorStem(item),
    fileName: String(item?.name ?? "")
  }));

  for (const tip of choices) {
    const text = cleanTipText(tip);
    if (!text) continue;

    const [rawName, ...rawDescription] = text.split(/[:：]/);
    const normalizedName = deskDecorStem(rawName.trim());
    const match =
      candidates.find(candidate => normalizedName === candidate.name || normalizedName === deskDecorStem(candidate.fileName)) ??
      candidates.find(candidate => text.startsWith(candidate.fileName) || text.startsWith(candidate.name));

    if (!match) continue;

    const description = rawDescription.length
      ? rawDescription.join("：").trim()
      : text
        .slice(text.startsWith(match.fileName) ? match.fileName.length : match.name.length)
        .replace(/^[\s:：\-—]+/, "")
        .trim();

    return {
      item: match.item,
      name: match.name,
      description
    };
  }

  return null;
}

export function marqueeTipItems(results) {
  return ["health", "fortune"]
    .flatMap(kind => results?.[kind] ?? [])
    .map(cleanTipText)
    .filter(Boolean);
}

export function shuffleMarqueeItems(items, previousText = "") {
  const queue = items.map((text, index) => ({
    text,
    key: `${index}-${stableHash(text)}`
  }));

  for (let index = queue.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [queue[index], queue[swapIndex]] = [queue[swapIndex], queue[index]];
  }

  if (queue.length > 1 && queue[0]?.text === previousText) {
    const swapIndex = queue.findIndex(item => item.text !== previousText);
    if (swapIndex > 0) {
      [queue[0], queue[swapIndex]] = [queue[swapIndex], queue[0]];
    }
  }

  return queue;
}

export function marqueeDurationMs(text) {
  return Math.max(1, Array.from(cleanTipText(text)).length) * 1000;
}

export const marqueeSlideMs = 720;

export function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function localDayKey(value = Date.now()) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function localDayStartMs(day = todayKey()) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).getTime();
}

export function currentActivityHour(now = Date.now()) {
  return new Date(now).getHours();
}

export function currentMaxActivityHour(now = Date.now()) {
  return clampActivityHour(currentActivityHour(now), activityHourCount - 1);
}

export function clampActivityHour(hour, maxHour = currentMaxActivityHour()) {
  return Math.min(maxHour, Math.max(0, Number(hour) || 0));
}

export function formatHourPoint(hour) {
  return `${String(clampActivityHour(hour)).padStart(2, "0")}:00`;
}

export function formatHourRange(hour) {
  const start = clampActivityHour(hour);
  return `${String(start).padStart(2, "0")}:00 - ${String(start + 1).padStart(2, "0")}:00`;
}

export function normalizeActivitySamples(value, now = Date.now()) {
  const day = localDayKey(now);
  if (!Array.isArray(value)) return [];
  return value
    .map(sample => {
      const keyboardCount = Math.max(0, Number(sample.keyboardCount ?? 0));
      const mouseClickCount = Math.max(0, Number(sample.mouseClickCount ?? sample.mouseMoveCount ?? 0));
      return {
        at: Number(sample.at),
        state: keyboardCount + mouseClickCount > 0 ? "active" : "idle",
        keyboardCount,
        mouseClickCount
      };
    })
    .filter(sample => Number.isFinite(sample.at) && sample.at <= now && localDayKey(sample.at) === day)
    .sort((a, b) => a.at - b.at);
}

export function activityBuckets(samples, hour, now = Date.now()) {
  const selectedHour = clampActivityHour(hour, currentMaxActivityHour(now));
  const start = localDayStartMs(todayKey()) + selectedHour * activityRingMs;
  const end = start + activityRingMs;
  const buckets = Array.from({ length: activitySegmentCount }, (_, index) => ({
    at: start + index * activitySampleMs,
    state: "unknown",
    keyboardCount: 0,
    mouseClickCount: 0
  }));

  for (const sample of normalizeActivitySamples(samples, now)) {
    if (sample.at < start || sample.at >= end) continue;
    const index = Math.min(
      activitySegmentCount - 1,
      Math.max(0, Math.floor((sample.at - start) / activitySampleMs))
    );
    buckets[index] = {
      at: buckets[index].at,
      state: "idle",
      keyboardCount: buckets[index].keyboardCount + sample.keyboardCount,
      mouseClickCount: buckets[index].mouseClickCount + sample.mouseClickCount
    };
    buckets[index].state =
      buckets[index].keyboardCount + buckets[index].mouseClickCount > 0 ? "active" : "idle";
  }

  return buckets;
}

export function activityRingState(samples, hour, now = Date.now()) {
  const buckets = activityBuckets(samples, hour, now);
  const step = 360 / activitySegmentCount;
  const gap = 0;
  let activeCount = 0;
  let idleCount = 0;
  const stops = buckets.flatMap((bucket, index) => {
    const state = bucket.state;
    if (state === "active") activeCount += 1;
    if (state === "idle") idleCount += 1;
    const start = index * step;
    const end = (index + 1) * step;
    const color = state === "active" ? "var(--gold)" : state === "idle" ? "var(--green)" : "var(--watch-ring-track)";
    const solidEnd = Math.max(start, end - gap);
    return [
      `${color} ${start.toFixed(2)}deg ${solidEnd.toFixed(2)}deg`,
      `var(--watch-ring-gap) ${solidEnd.toFixed(2)}deg ${end.toFixed(2)}deg`
    ];
  });

  return {
    activeSecs: activeCount * activitySampleMs / 1000,
    idleSecs: idleCount * activitySampleMs / 1000,
    segments: buckets.map((bucket, index) => ({
      ...bucket,
      index,
      angle: index * step,
      label: `${formatClockTime(bucket.at)} - ${formatClockTime(bucket.at + activitySampleMs)}`
    })),
    gradient: `conic-gradient(${stops.join(", ")})`
  };
}

export function activitySampleTotals(samples, now = Date.now()) {
  return normalizeActivitySamples(samples, now).reduce(
    (totals, sample) => {
      if (sample.state === "active") totals.workSecs += activitySampleMs / 1000;
      if (sample.state === "idle") totals.restSecs += activitySampleMs / 1000;
      return totals;
    },
    { workSecs: 0, restSecs: 0 }
  );
}

export function formatClockTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

export function aiTipsValidationMessage(settings) {
  const aiConfig = effectiveAiConfig(settings);
  if (!aiConfig.llmApiKey) return "请先在设置页填写 API Key。";
  if (!aiConfig.llmModel) return "请先填写模型名称。";
  if (!settings.profile?.trim()) return "请先录入个性化记忆。";
  return "";
}

export function aiAutoAttemptKey(kind, settings, extraPrompt) {
  const aiConfig = effectiveAiConfig(settings);
  return `${todayKey()}:${kind}:${stableHash([
    aiConfig.llmEndpoint,
    aiConfig.llmModel,
    aiConfig.llmApiKey,
    aiProfilePrompt(settings),
    extraPrompt
  ].join("\n"))}`;
}

export function normalizeAiKind(kind) {
  return aiTipSectionMap[kind] ? kind : "health";
}

export function aiSectionTitle(kind) {
  return aiTipSectionMap[normalizeAiKind(kind)].title;
}

export function normalizeAiResults(value) {
  return Object.fromEntries(
    aiTipSections.map(section => [section.id, normalizeTips(value?.[section.id] ?? [])])
  );
}

export function normalizeAiResultDays(value) {
  return Object.fromEntries(
    aiTipSections.map(section => [section.id, String(value?.[section.id] ?? "")])
  );
}

export function normalizeAiExtraPrompts(value) {
  const raw = value && typeof value === "object" ? value : {};

  return Object.fromEntries(
    aiTipSections.map(section => {
      const prompt = Object.prototype.hasOwnProperty.call(raw, section.id)
        ? String(raw[section.id] ?? "")
        : defaultAiExtraPrompts[section.id] ?? "";

      return [
        section.id,
        !prompt.trim() && defaultAiExtraPrompts[section.id] ? defaultAiExtraPrompts[section.id] : prompt
      ];
    })
  );
}

export function initialAiResults() {
  return normalizeAiResults(load("fate:aiResults", null) ?? { health: load("fate:healthTips", []) });
}

export function initialAiResultDays() {
  return normalizeAiResultDays(load("fate:aiResultDays", null) ?? { health: load("fate:healthTipsDay", "") });
}

export function initialAiExtraPrompts() {
  const saved = load("fate:aiExtraPrompts", null);
  if (saved) return normalizeAiExtraPrompts(saved);

  const legacyHealthPrompt = load("fate:healthExtraPrompt", null);
  return normalizeAiExtraPrompts(legacyHealthPrompt === null ? null : { health: legacyHealthPrompt });
}

export function refreshShortTextTipCache() {
  if (load("fate:shortTextPromptCacheVersion", "") === shortTextPromptCacheVersion) return false;

  const aiResults = load("fate:aiResults", {});
  const aiResultDays = load("fate:aiResultDays", {});
  for (const kind of shortTextTipKinds) {
    delete aiResults[kind];
    delete aiResultDays[kind];
  }

  save("fate:aiResults", aiResults);
  save("fate:aiResultDays", aiResultDays);
  localStorage.removeItem("fate:healthTips");
  localStorage.removeItem("fate:healthTipsDay");
  save("fate:shortTextPromptCacheVersion", shortTextPromptCacheVersion);
  return true;
}

export const shortTextTipCacheRefreshed = refreshShortTextTipCache();

export function normalizeAiTipHistory(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(row => ({
      id: Number(row.id ?? row.createdAt ?? row.created_at ?? Date.now()),
      kind: normalizeAiKind(row.kind),
      day: String(row.day ?? ""),
      tips: normalizeTips(row.tips ?? row.tipsJson ?? row.tips_json ?? []),
      extraPrompt: String(row.extraPrompt ?? row.extra_prompt ?? ""),
      model: String(row.model ?? ""),
      baseUrl: String(row.baseUrl ?? row.base_url ?? ""),
      source: String(row.source ?? "manual"),
      createdAt: Number(row.createdAt ?? row.created_at ?? 0)
    }))
    .filter(row => row.day && row.tips.length)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function latestAiStateFromHistory(history, ignoredKinds = []) {
  const aiResults = {};
  const aiResultDays = {};
  const ignored = new Set(ignoredKinds);

  for (const run of history) {
    if (run.day !== todayKey()) continue;
    if (ignored.has(run.kind)) continue;
    if (aiResults[run.kind]?.length) continue;
    aiResults[run.kind] = run.tips;
    aiResultDays[run.kind] = run.day;
  }

  return { aiResults, aiResultDays };
}

export function todayKey() {
  return localDayKey();
}

export function dayKeyFromDate(date) {
  return localDayKey(date.getTime());
}

export function calendarMonthStart(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

export function addCalendarMonths(value, amount) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

export function sameCalendarMonth(left, right) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function formatCalendarMonth(value, locale = "zh-CN") {
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(value);
}

export function todayTotals(todayBase, snap) {
  return {
    workSecs: Math.max(0, todayBase.workSecs + Number(snap.todayWorkSecs ?? 0)),
    restSecs: Math.max(0, todayBase.restSecs + Number(snap.todayRestSecs ?? 0)),
    reminderCount: Math.max(0, todayBase.reminderCount + Number(snap.reminderCount ?? 0))
  };
}

export function normalizeCalendarStats(rows) {
  if (rows && !Array.isArray(rows) && typeof rows === "object") {
    return normalizeCalendarStats(
      Object.entries(rows).map(([day, stats]) => ({
        day,
        workSecs: stats?.workSecs,
        restSecs: stats?.restSecs,
        reminderCount: stats?.reminderCount
      }))
    );
  }
  if (!Array.isArray(rows)) return {};
  return Object.fromEntries(
    rows
      .map(row => [
        String(row.day ?? ""),
        {
          workSecs: Math.max(0, Number(row.workSecs ?? row.work_secs ?? 0)),
          restSecs: Math.max(0, Number(row.restSecs ?? row.rest_secs ?? 0)),
          reminderCount: Math.max(0, Number(row.reminderCount ?? row.reminder_count ?? 0))
        }
      ])
      .filter(([day, stats]) => day && (stats.workSecs > 0 || stats.restSecs > 0 || stats.reminderCount > 0))
  );
}

export function fmtTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

export function percent(value, total) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

export function normalizeAchievementCount(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

export function formatHistoryTime(timestamp, locale = "zh-CN") {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

export function aiTipSourceText(source) {
  if (source === "auto") return "自动";
  if (source === "test") return "测试";
  return "手动";
}

export function normalizeSnapshot(snapshot, previous = initialSnapshot) {
  return {
    ...previous,
    ...snapshot,
    workCycleId: Number(snapshot.workCycleId ?? previous.workCycleId ?? 0),
    workGoalSecs: Number(snapshot.workGoalSecs),
    restGoalSecs: Number(snapshot.restGoalSecs),
    keyboardCount: Number(snapshot.keyboardCount ?? previous.keyboardCount ?? 0),
    mouseClickCount: Number(snapshot.mouseClickCount ?? snapshot.mouseMoveCount ?? previous.mouseClickCount ?? previous.mouseMoveCount ?? 0)
  };
}

export function normalizeInputMonitorPermission(status, previous = initialInputMonitorPermission) {
  return {
    ...previous,
    ...status,
    supported: Boolean(status?.supported),
    authorized: Boolean(status?.authorized),
    listening: Boolean(status?.listening),
    requiresPermission: Boolean(status?.requiresPermission),
    needsPermission: Boolean(status?.needsPermission),
    keyboardCount: Math.max(0, Number(status?.keyboardCount ?? previous.keyboardCount ?? 0)),
    mouseClickCount: Math.max(0, Number(status?.mouseClickCount ?? status?.mouseMoveCount ?? previous.mouseClickCount ?? previous.mouseMoveCount ?? 0)),
    lastEventUnixMs: Number(status?.lastEventUnixMs ?? previous.lastEventUnixMs ?? 0),
    message: status?.message || previous.message
  };
}

export function needsInputMonitorPermissionAction(status) {
  return Boolean(status?.requiresPermission && status?.needsPermission);
}

export function syncHealthTips(tips) {
  return invoke("set_health_tips", { tips });
}
