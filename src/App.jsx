import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  AchievementView,
  AiView,
  CalendarView,
  Header,
  InputPermissionOverlay,
  RocketTools,
  SettingsView,
  Tabs,
  TodayView
} from "./views";
import {
  activitySampleMs,
  addCalendarMonths,
  aiAutoAttemptKey,
  aiGeneratedSections,
  aiProfilePrompt,
  birthDateValue,
  birthYearMonthValue,
  aiTipsValidationMessage,
  calendarMonthStart,
  clampActivityHour,
  currentMaxActivityHour,
  currentRoute,
  currentWindowInfo,
  defaultSettings,
  deskDecorBackgrounds,
  deskDecorChoiceFromTips,
  deskDecorItems,
  deskDecorStem,
  deskDecorUnlockStates,
  effectiveAiConfig,
  inferWindowSizeModeFromSize,
  initialAiExtraPrompts,
  initialAiResultDays,
  initialAiResults,
  initialInputMonitorPermission,
  initialSnapshot,
  load,
  marqueeTipItems,
  needsInputMonitorPermissionAction,
  normalizeAchievementCount,
  normalizeActivitySamples,
  normalizeAiExtraPrompts,
  normalizeAiKind,
  normalizeAiResultDays,
  normalizeAiResults,
  normalizeAiTipHistory,
  normalizeCalendarStats,
  normalizeDeskBackgroundIndex,
  normalizeInputMonitorPermission,
  normalizeLanguageMode,
  normalizeSettings,
  normalizeSnapshot,
  normalizeTips,
  normalizeWindowSizeMode,
  normalizeAppearanceMode,
  pickDeskBackgroundIndex,
  save,
  syncHealthTips,
  todayKey,
  todayTotals,
  viewportWindowSizeMode
} from "./app/domain";
import { preloadImage, preloadImages } from "./app/images";
import {
  loadPersistedState,
  persistAiTipsRun,
  persistSettingsToDb,
  persistSnapshot,
  replaceAiTipHistoryInDb
} from "./app/persistence";
import { I18nProvider, languageLocales, resolveLanguage } from "./app/i18n";

export default function App() {
  const [tab, setTab] = useState("today");
  const [settings, setSettings] = useState(() => normalizeSettings(load("fate:settings", defaultSettings)));
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [todayBase, setTodayBase] = useState({ workSecs: 0, restSecs: 0, reminderCount: 0 });
  const [calendarStats, setCalendarStats] = useState(() => normalizeCalendarStats(load("fate:calendarStats", [])));
  const [calendarMonth, setCalendarMonth] = useState(() => calendarMonthStart());
  const [achievementCount, setAchievementCount] = useState(() => normalizeAchievementCount(load("fate:achievementCount", 0)));
  const [activitySamples, setActivitySamples] = useState(() => normalizeActivitySamples(load("fate:activitySamples", [])));
  const [activityHour, setActivityHour] = useState(() => currentMaxActivityHour());
  const [activityMaxHour, setActivityMaxHour] = useState(() => currentMaxActivityHour());
  const [aiResults, setAiResults] = useState(initialAiResults);
  const [aiResultDays, setAiResultDays] = useState(initialAiResultDays);
  const [aiHistory, setAiHistory] = useState(() => normalizeAiTipHistory(load("fate:aiHistory", [])));
  const [aiExtraPrompts, setAiExtraPrompts] = useState(initialAiExtraPrompts);
  const [aiPromptOpen, setAiPromptOpen] = useState({});
  const [aiStatus, setAiStatus] = useState({});
  const [aiErrors, setAiErrors] = useState({});
  const [llmTestStatus, setLlmTestStatus] = useState("idle");
  const [llmTestMessage, setLlmTestMessage] = useState("");
  const [llmTestTips, setLlmTestTips] = useState([]);
  const [inputMonitorPermission, setInputMonitorPermission] = useState(initialInputMonitorPermission);
  const [dataMessage, setDataMessage] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsMessage, setToolsMessage] = useState("");
  const [toolsDebug, setToolsDebug] = useState(null);
  const [windowPinned, setWindowPinned] = useState(() => Boolean(load("fate:windowPinned", false)));
  const [windowSizeMode, setWindowSizeMode] = useState(() => viewportWindowSizeMode());
  const [deskBgIndex, setDeskBgIndex] = useState(() => normalizeDeskBackgroundIndex(load("fate:deskBackgroundIndex", -1)));
  const deskBackgroundUrl = deskDecorBackgrounds[deskBgIndex] ?? "";
  const [deskBackgroundReady, setDeskBackgroundReady] = useState(false);
  const [deskBackgroundPaintKey, setDeskBackgroundPaintKey] = useState(0);

  const settingsRef = useRef(settings);
  const snapshotRef = useRef(snapshot);
  const deskBgIndexRef = useRef(deskBgIndex);
  const lastWorkCycleIdRef = useRef(null);
  const todayBaseRef = useRef(todayBase);
  const calendarStatsRef = useRef(calendarStats);
  const activitySamplesRef = useRef(activitySamples);
  const activityLastSampleAtRef = useRef(activitySamples[activitySamples.length - 1]?.at ?? 0);
  const activityLastKeyboardCountRef = useRef(null);
  const activityLastMouseClickCountRef = useRef(null);
  const activityMaxHourRef = useRef(activityMaxHour);
  const aiResultsRef = useRef(aiResults);
  const aiResultDaysRef = useRef(aiResultDays);
  const aiHistoryRef = useRef(aiHistory);
  const aiExtraPromptsRef = useRef(aiExtraPrompts);
  const aiAutoAttemptKeyRef = useRef({});
  const aiRequestInFlightRef = useRef({});
  const achievementPendingRef = useRef(Boolean(load("fate:achievementPending", false)));
  const lastReminderCountRef = useRef(Number(initialSnapshot.reminderCount ?? 0));
  const deskBackgroundPaintFrameRef = useRef(0);

  useEffect(() => {
    preloadImages([
      ...deskDecorBackgrounds,
      ...deskDecorItems.map(item => item.url)
    ]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDeskBackgroundReady(false);

    if (!deskBackgroundUrl) return undefined;

    preloadImage(deskBackgroundUrl)
      .then(() => {
        if (cancelled) return;
        window.cancelAnimationFrame(deskBackgroundPaintFrameRef.current);
        deskBackgroundPaintFrameRef.current = window.requestAnimationFrame(() => {
          if (cancelled) return;
          setDeskBackgroundReady(true);
          setDeskBackgroundPaintKey(key => key + 1);
        });
      })
      .catch(() => {
        if (!cancelled) setDeskBackgroundReady(false);
      });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(deskBackgroundPaintFrameRef.current);
    };
  }, [deskBackgroundUrl]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const mode = normalizeAppearanceMode(settingsRef.current.appearanceMode);
      const resolvedMode = mode === "system" && media?.matches ? "dark" : mode === "dark" ? "dark" : "light";
      document.documentElement.dataset.appearanceMode = mode;
      document.documentElement.dataset.theme = resolvedMode;
      document.documentElement.style.colorScheme = resolvedMode;
    };

    applyTheme();
    media?.addEventListener?.("change", applyTheme);
    return () => media?.removeEventListener?.("change", applyTheme);
  }, [settings.appearanceMode]);

  useEffect(() => {
    const language = normalizeLanguageMode(settings.languageMode);
    const systemLanguage = languageLocales[resolveLanguage("system")];
    document.documentElement.dataset.languageMode = language;
    document.documentElement.lang = language === "system" ? systemLanguage : languageLocales[language];
  }, [settings.languageMode]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    let disposed = false;
    let unlisten = null;

    listen("input://activity", event => {
      if (disposed) return;

      const payload = event.payload ?? {};
      setSnapshot(previous => {
        const next = {
          ...previous,
          keyboardCount: Math.max(
            0,
            Number(payload.keyboardCount ?? previous.keyboardCount ?? 0)
          ),
          mouseClickCount: Math.max(
            0,
            Number(payload.mouseClickCount ?? payload.mouseMoveCount ?? previous.mouseClickCount ?? 0)
          ),
          lastEventUnixMs: Number(payload.lastEventUnixMs ?? previous.lastEventUnixMs ?? 0)
        };
        snapshotRef.current = next;
        return next;
      });
    }).then(callback => {
      unlisten = callback;
    }).catch(() => {});

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    deskBgIndexRef.current = deskBgIndex;
    save("fate:deskBackgroundIndex", deskBgIndex);
  }, [deskBgIndex]);

  useEffect(() => {
    todayBaseRef.current = todayBase;
  }, [todayBase]);

  useEffect(() => {
    calendarStatsRef.current = calendarStats;
  }, [calendarStats]);

  useEffect(() => {
    activitySamplesRef.current = activitySamples;
  }, [activitySamples]);

  const syncWindowSizeModeFromActual = useCallback(async (physicalSize = null) => {
    const { window: tauriWindow, label } = currentWindowInfo();
    if (!tauriWindow || label !== "main") {
      setWindowSizeMode(viewportWindowSizeMode());
      return;
    }

    try {
      const scaleFactor = Number(await tauriWindow.scaleFactor()) || 1;
      const size = physicalSize ?? await tauriWindow.outerSize();
      setWindowSizeMode(inferWindowSizeModeFromSize({
        width: Number(size.width) / scaleFactor,
        height: Number(size.height) / scaleFactor
      }));
    } catch {
      setWindowSizeMode(viewportWindowSizeMode());
    }
  }, []);

  useEffect(() => {
    const { window: tauriWindow, label } = currentWindowInfo();
    if (!tauriWindow || label !== "main") {
      const syncFromViewport = () => setWindowSizeMode(viewportWindowSizeMode());
      syncFromViewport();
      window.addEventListener("resize", syncFromViewport);
      return () => window.removeEventListener("resize", syncFromViewport);
    }

    let cancelled = false;
    let removeResizeListener = null;
    syncWindowSizeModeFromActual();
    tauriWindow.onResized(({ payload }) => {
      if (!cancelled) syncWindowSizeModeFromActual(payload);
    })
      .then(unlisten => {
        if (cancelled) {
          unlisten();
        } else {
          removeResizeListener = unlisten;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (removeResizeListener) removeResizeListener();
    };
  }, [syncWindowSizeModeFromActual]);

  useEffect(() => {
    let hideTimer = 0;
    const root = document.documentElement;
    const showScrollbar = () => {
      root.classList.add("scrollbar-active");
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        root.classList.remove("scrollbar-active");
      }, 800);
    };

    document.addEventListener("scroll", showScrollbar, { passive: true, capture: true });
    window.addEventListener("wheel", showScrollbar, { passive: true });
    window.addEventListener("touchmove", showScrollbar, { passive: true });

    return () => {
      window.clearTimeout(hideTimer);
      root.classList.remove("scrollbar-active");
      document.removeEventListener("scroll", showScrollbar, { capture: true });
      window.removeEventListener("wheel", showScrollbar);
      window.removeEventListener("touchmove", showScrollbar);
    };
  }, []);

  useEffect(() => {
    setActivitySamples(previous => {
      const next = normalizeActivitySamples(previous);
      activitySamplesRef.current = next;
      save("fate:activitySamples", next);
      return next;
    });
  }, []);

  useEffect(() => {
    const syncActivityMaxHour = () => {
      const maxHour = currentMaxActivityHour();
      const previousMaxHour = activityMaxHourRef.current;
      activityMaxHourRef.current = maxHour;
      setActivityMaxHour(maxHour);
      setActivityHour(hour => {
        const nextHour = hour >= previousMaxHour ? maxHour : clampActivityHour(hour, maxHour);
        return nextHour;
      });
    };

    syncActivityMaxHour();
    const timer = setInterval(syncActivityMaxHour, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    aiResultsRef.current = aiResults;
  }, [aiResults]);

  useEffect(() => {
    aiResultDaysRef.current = aiResultDays;
  }, [aiResultDays]);

  useEffect(() => {
    aiHistoryRef.current = aiHistory;
  }, [aiHistory]);

  useEffect(() => {
    aiExtraPromptsRef.current = aiExtraPrompts;
  }, [aiExtraPrompts]);

  const today = useMemo(() => todayTotals(todayBase, snapshot), [todayBase, snapshot]);
  const resolvedLanguage = useMemo(() => resolveLanguage(settings.languageMode), [settings.languageMode]);
  const unlockedDeskDecorItems = useMemo(
    () => deskDecorUnlockStates(achievementCount)
      .filter(decor => decor.unlocked)
      .map(decor => decor.item),
    [achievementCount]
  );
  const unlockedDeskDecorNames = useMemo(
    () => unlockedDeskDecorItems.map(item => deskDecorStem(item)),
    [unlockedDeskDecorItems]
  );

  const saveSettings = useCallback((nextSettings = settingsRef.current) => {
    save("fate:settings", nextSettings);
    persistSettingsToDb(nextSettings).catch(() => {});
    invoke("update_settings", {
      settings: {
        workMinutes: Number(nextSettings.workMinutes),
        restMinutes: Number(nextSettings.restMinutes)
      }
    }).catch(() => {});
  }, []);

  const updateSetting = useCallback((id, rawValue) => {
    const value = id.includes("Minutes") ? Number(rawValue) : rawValue;
    const next = { ...settingsRef.current, [id]: value };

    if (["birthYear", "birthMonth", "birthDay"].includes(id)) {
      next.birthDate = birthDateValue(next);
      next.birthYearMonth = birthYearMonthValue(next);
    }

    settingsRef.current = next;
    setSettings(next);
  }, []);

  const updateBooleanSetting = useCallback((id, checked) => {
    const next = { ...settingsRef.current, [id]: Boolean(checked) };
    settingsRef.current = next;
    setSettings(next);
    saveSettings(next);
    if (id === "useCustomAi") {
      setLlmTestMessage("");
      setLlmTestStatus("idle");
      setLlmTestTips([]);
    }
  }, [saveSettings]);

  const commitSettings = useCallback(() => {
    saveSettings(settingsRef.current);
  }, [saveSettings]);

  const refreshInputMonitorPermission = useCallback((quiet = false) => {
    if (!quiet) {
      setInputMonitorPermission(previous => ({
        ...previous,
        message: "正在检查输入监测权限"
      }));
    }

    invoke("get_input_monitor_permission_status")
      .then(status => {
        setInputMonitorPermission(previous => normalizeInputMonitorPermission(status, previous));
      })
      .catch(() => {
        setInputMonitorPermission(previous => ({
          ...previous,
          listening: false,
          message: "无法读取输入监测权限"
        }));
      });
  }, []);

  const requestInputMonitorPermission = useCallback(() => {
    setInputMonitorPermission(previous => ({
      ...previous,
      message: "正在请求输入监测权限"
    }));

    invoke("request_input_monitor_permission")
      .then(status => {
        setInputMonitorPermission(previous => normalizeInputMonitorPermission(status, previous));
      })
      .catch(() => {
        setInputMonitorPermission(previous => ({
          ...previous,
          listening: false,
          message: "无法请求输入监测权限"
        }));
      });
  }, []);

  useEffect(() => {
    refreshInputMonitorPermission(false);
    const timer = setInterval(() => refreshInputMonitorPermission(true), 8_000);
    return () => clearInterval(timer);
  }, [refreshInputMonitorPermission]);

  useEffect(() => {
    if (!settings.showRocketTools) {
      setToolsOpen(false);
    }
  }, [settings.showRocketTools]);

  const recordActivitySample = useCallback((nextSnapshot, now = Date.now(), force = false) => {
    if (!force && now - activityLastSampleAtRef.current < activitySampleMs) return;
    activityLastSampleAtRef.current = now;
    const keyboardCount = Math.max(0, Number(nextSnapshot.keyboardCount ?? 0));
    const mouseClickCount = Math.max(0, Number(nextSnapshot.mouseClickCount ?? nextSnapshot.mouseMoveCount ?? 0));
    const keyboardDelta = activityLastKeyboardCountRef.current == null
      ? 0
      : Math.max(0, keyboardCount - activityLastKeyboardCountRef.current);
    const mouseClickDelta = activityLastMouseClickCountRef.current == null
      ? 0
      : Math.max(0, mouseClickCount - activityLastMouseClickCountRef.current);
    activityLastKeyboardCountRef.current = keyboardCount;
    activityLastMouseClickCountRef.current = mouseClickCount;

    setActivitySamples(previous => {
      const next = normalizeActivitySamples([
        ...previous,
        {
          at: now,
          state: keyboardDelta + mouseClickDelta > 0 ? "active" : "idle",
          keyboardCount: keyboardDelta,
          mouseClickCount: mouseClickDelta
        }
      ], now);
      activitySamplesRef.current = next;
      save("fate:activitySamples", next);
      return next;
    });
  }, []);

  const recordAchievementProgress = useCallback((nextSnapshot) => {
    const reminderCount = Math.max(0, Number(nextSnapshot.reminderCount ?? 0));
    const previousReminderCount = Math.max(0, Number(lastReminderCountRef.current ?? 0));
    if (reminderCount > previousReminderCount) {
      achievementPendingRef.current = true;
      save("fate:achievementPending", true);
    }
    lastReminderCountRef.current = reminderCount;

    const restGoalSecs = Math.max(1, Number(nextSnapshot.restGoalSecs ?? defaultSettings.restMinutes * 60));
    const idleSecs = Math.max(0, Number(nextSnapshot.idleSecs ?? 0));
    const completedPromptedRest =
      achievementPendingRef.current &&
      nextSnapshot.status === "resting" &&
      idleSecs >= restGoalSecs;

    if (!completedPromptedRest) return;

    achievementPendingRef.current = false;
    save("fate:achievementPending", false);
    setAchievementCount(previous => {
      const next = normalizeAchievementCount(previous) + 1;
      save("fate:achievementCount", next);
      return next;
    });
  }, []);

  const updateAchievementCount = useCallback((value) => {
    const next = normalizeAchievementCount(value);
    setAchievementCount(next);
    save("fate:achievementCount", next);
    setToolsMessage(`成就数量已更新为 ${next}`);
  }, []);

  const changeActivityHour = useCallback((direction) => {
    setActivityHour(hour => {
      const nextHour = clampActivityHour(hour + direction, activityMaxHour);
      return nextHour;
    });
  }, [activityMaxHour]);

  const changeCalendarMonth = useCallback((direction) => {
    setCalendarMonth(month => addCalendarMonths(month, direction));
  }, []);

  const resetCalendarMonth = useCallback(() => {
    setCalendarMonth(calendarMonthStart());
  }, []);

  const persistAiTips = useCallback(async (kind, tips, { day = todayKey(), source = "manual" } = {}) => {
    const normalizedKind = normalizeAiKind(kind);
    const aiConfig = effectiveAiConfig(settingsRef.current);
    const run = {
      id: Date.now(),
      kind: normalizedKind,
      day,
      tips,
      extraPrompt: aiExtraPromptsRef.current[normalizedKind] ?? "",
      model: aiConfig.llmModel,
      baseUrl: aiConfig.llmEndpoint,
      source,
      createdAt: Date.now()
    };

    const nextResults = { ...aiResultsRef.current, [normalizedKind]: tips };
    const nextDays = { ...aiResultDaysRef.current, [normalizedKind]: day };
    aiResultsRef.current = nextResults;
    aiResultDaysRef.current = nextDays;
    setAiResults(nextResults);
    setAiResultDays(nextDays);
    save("fate:aiResults", nextResults);
    save("fate:aiResultDays", nextDays);

    if (normalizedKind === "health") {
      save("fate:healthTips", tips);
      save("fate:healthTipsDay", day);
    }

    setAiHistory(previous => {
      const next = [run, ...previous].slice(0, 60);
      aiHistoryRef.current = next;
      save("fate:aiHistory", next);
      return next;
    });
    persistAiTipsRun(run).catch(() => {});
    if (normalizedKind === "health") {
      await syncHealthTips(tips);
    }
  }, []);

  const previewBreakOverlay = useCallback(async () => {
    const startedAt = Date.now();
    setToolsMessage("正在创建浮层...");
    setToolsDebug({
      ok: "pending",
      phase: "calling preview_break_overlay",
      location: window.location.href,
      route: currentRoute(),
      time: new Date(startedAt).toISOString()
    });
    const timeoutId = window.setTimeout(() => {
      setToolsMessage("浮层命令仍在等待返回");
      setToolsDebug(previous => ({
        ...(previous && typeof previous === "object" ? previous : {}),
        ok: "timeout",
        phase: "preview_break_overlay still pending",
        elapsedMs: Date.now() - startedAt,
        hint: "Rust IPC 命令还没有返回，优先检查新窗口创建或 WebView 初始化是否阻塞。"
      }));
    }, 3000);
    try {
      const debug = await invoke("preview_break_overlay");
      window.clearTimeout(timeoutId);
      setToolsDebug({
        ...debug,
        phase: "preview_break_overlay returned",
        elapsedMs: Date.now() - startedAt
      });
      setToolsMessage(debug?.ok ? "浮层创建命令已执行" : "浮层创建命令已返回，但状态异常");
    } catch (error) {
      window.clearTimeout(timeoutId);
      setToolsMessage(String(error || "浮层展示失败"));
      setToolsDebug({
        ok: false,
        phase: "preview_break_overlay failed",
        error: String(error || "浮层展示失败"),
        elapsedMs: Date.now() - startedAt,
        time: new Date().toISOString()
      });
    }
  }, []);

  const toggleTools = useCallback(() => {
    setToolsOpen(open => !open);
  }, []);

  const closeTools = useCallback(() => {
    setToolsOpen(false);
  }, []);

  const setPinned = useCallback((pinned) => {
    setWindowPinned(pinned);
    save("fate:windowPinned", pinned);
    invoke("set_main_window_pinned", { pinned }).catch(() => {
      setWindowPinned(!pinned);
      save("fate:windowPinned", !pinned);
    });
  }, []);

  const changeDeskScene = useCallback(() => {
    setDeskBgIndex(previous => {
      const next = pickDeskBackgroundIndex(previous);
      deskBgIndexRef.current = next;
      save("fate:deskBackgroundIndex", next);
      return next;
    });
  }, []);

  const syncDeskBackgroundCycle = useCallback((nextSnapshot) => {
    const nextCycleId = Number(nextSnapshot.workCycleId ?? 0);
    const previousCycleId = lastWorkCycleIdRef.current;

    if (previousCycleId == null) {
      lastWorkCycleIdRef.current = nextCycleId;
      return;
    }

    if (nextCycleId !== previousCycleId) {
      lastWorkCycleIdRef.current = nextCycleId;
      changeDeskScene();
    }
  }, [changeDeskScene]);

  const testLlmModel = useCallback(async () => {
    const current = settingsRef.current;
    setLlmTestMessage("");
    setLlmTestTips([]);

    const validationMessage = aiTipsValidationMessage(current);
    if (validationMessage) {
      setLlmTestStatus("error");
      setLlmTestMessage(validationMessage.replace("。", ""));
      return;
    }

    setLlmTestStatus("loading");
    try {
      saveSettings(current);
      const aiConfig = effectiveAiConfig(current);
      const tips = normalizeTips(await invoke("test_llm_model", {
        request: {
          baseUrl: aiConfig.llmEndpoint,
          model: aiConfig.llmModel,
          apiKey: aiConfig.llmApiKey,
          profile: aiProfilePrompt(current)
        }
      }));
      setLlmTestTips(tips);
      await persistAiTips("health", tips, { source: "test" });
      setLlmTestMessage(`已生成 ${tips.length} 条健康建议`);
      setLlmTestStatus("success");
    } catch (error) {
      setLlmTestStatus("error");
      setLlmTestMessage(String(error || "测试失败"));
    }
  }, [persistAiTips, saveSettings]);

  const requestAiTips = useCallback(async (kind, { automatic = false } = {}) => {
    const normalizedKind = normalizeAiKind(kind);
    if (!aiGeneratedSections.some(section => section.id === normalizedKind)) return false;

    const current = settingsRef.current;
    const snap = snapshotRef.current;
    const total = todayTotals(todayBaseRef.current, snap);
    const validationMessage = aiTipsValidationMessage(current);

    if (validationMessage) {
      if (!automatic) setAiErrors(previous => ({ ...previous, [normalizedKind]: validationMessage }));
      return false;
    }

    if (aiRequestInFlightRef.current[normalizedKind]) return false;
    aiRequestInFlightRef.current = { ...aiRequestInFlightRef.current, [normalizedKind]: true };
    setAiErrors(previous => ({ ...previous, [normalizedKind]: "" }));
    setAiStatus(previous => ({ ...previous, [normalizedKind]: "loading" }));

    try {
      saveSettings(current);
      const aiConfig = effectiveAiConfig(current);
      const tips = normalizeTips(await invoke("generate_ai_tips", {
        request: {
          kind: normalizedKind,
          baseUrl: aiConfig.llmEndpoint,
          model: aiConfig.llmModel,
          apiKey: aiConfig.llmApiKey,
          profile: aiProfilePrompt(current),
          extraPrompt: aiExtraPromptsRef.current[normalizedKind] ?? "",
          decorOptions: normalizedKind === "talisman" ? unlockedDeskDecorNames : [],
          language: resolvedLanguage,
          currentDay: todayKey(),
          status: snap.status,
          periodElapsedSecs: snap.periodElapsedSecs,
          idleSecs: snap.idleSecs,
          todayWorkSecs: total.workSecs,
          todayRestSecs: total.restSecs
        }
      }));
      await persistAiTips(normalizedKind, tips, { source: automatic ? "auto" : "manual" });
      return true;
    } catch (error) {
      if (!automatic) setAiErrors(previous => ({ ...previous, [normalizedKind]: String(error || "生成失败") }));
      return false;
    } finally {
      aiRequestInFlightRef.current = { ...aiRequestInFlightRef.current, [normalizedKind]: false };
      setAiStatus(previous => ({ ...previous, [normalizedKind]: "idle" }));
    }
  }, [persistAiTips, resolvedLanguage, saveSettings, unlockedDeskDecorNames]);

  const maybeAutoGenerateAiTips = useCallback(() => {
    const current = settingsRef.current;
    if (aiTipsValidationMessage(current)) return;

    for (const section of aiGeneratedSections) {
      const tips = aiResultsRef.current[section.id] ?? [];
      const currentDayResultExists = aiResultDaysRef.current[section.id] === todayKey() && tips.length;
      if (currentDayResultExists) {
        const talismanChoiceValid =
          section.id !== "talisman" ||
          Boolean(deskDecorChoiceFromTips(tips, unlockedDeskDecorItems));
        if (talismanChoiceValid) continue;
      }
      if (aiRequestInFlightRef.current[section.id]) continue;

      const extraPrompt = aiExtraPromptsRef.current[section.id] ?? "";
      const decorKey = section.id === "talisman" ? unlockedDeskDecorNames.join("|") : "";
      const attemptKey = aiAutoAttemptKey(section.id, current, [extraPrompt, decorKey, resolvedLanguage].filter(Boolean).join("\n"));
      if (aiAutoAttemptKeyRef.current[section.id] === attemptKey) continue;
      aiAutoAttemptKeyRef.current = { ...aiAutoAttemptKeyRef.current, [section.id]: attemptKey };
      requestAiTips(section.id, { automatic: true }).then(success => {
        if (success) return;
        aiAutoAttemptKeyRef.current = {
          ...aiAutoAttemptKeyRef.current,
          [section.id]: ""
        };
      });
    }
  }, [requestAiTips, resolvedLanguage, unlockedDeskDecorItems, unlockedDeskDecorNames]);

  const exportData = useCallback(async () => {
    const payload = JSON.stringify({
      settings: settingsRef.current,
      todayStats: todayTotals(todayBaseRef.current, snapshotRef.current),
      achievementCount,
      calendarStats: calendarStatsRef.current,
      activitySamples: activitySamplesRef.current,
      aiResults: aiResultsRef.current,
      aiResultDays: aiResultDaysRef.current,
      aiHistory: aiHistoryRef.current,
      aiExtraPrompts: aiExtraPromptsRef.current,
      healthTips: aiResultsRef.current.health,
      healthTipsDay: aiResultDaysRef.current.health,
      healthTipHistory: aiHistoryRef.current.filter(run => run.kind === "health"),
      healthExtraPrompt: aiExtraPromptsRef.current.health,
      exportedAt: new Date().toISOString()
    }, null, 2);

    setDataMessage("正在导出数据");
    try {
      const path = await invoke("export_app_data", {
        fileName: `fate-${todayKey()}.json`,
        payload
      });
      setDataMessage(`已导出到 ${path}`);
    } catch (error) {
      setDataMessage(String(error || "导出失败"));
    }
  }, [achievementCount]);

  const importData = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then(text => {
      const payload = JSON.parse(text);
      const nextSettings = normalizeSettings(payload.settings);
      const nextAchievementCount = normalizeAchievementCount(payload.achievementCount);
      const nextCalendarStats = normalizeCalendarStats(payload.calendarStats);
      const nextActivitySamples = normalizeActivitySamples(payload.activitySamples);
      const nextAiResults = normalizeAiResults(payload.aiResults ?? { health: payload.healthTips });
      const nextAiResultDays = normalizeAiResultDays(payload.aiResultDays ?? { health: payload.healthTipsDay });
      const nextAiHistory = normalizeAiTipHistory(payload.aiHistory ?? payload.healthTipHistory);
      const nextAiExtraPrompts = normalizeAiExtraPrompts(
        payload.aiExtraPrompts ?? { health: payload.healthExtraPrompt }
      );
      settingsRef.current = nextSettings;
      calendarStatsRef.current = nextCalendarStats;
      activitySamplesRef.current = nextActivitySamples;
      activityLastSampleAtRef.current = nextActivitySamples[nextActivitySamples.length - 1]?.at ?? 0;
      aiResultsRef.current = nextAiResults;
      aiResultDaysRef.current = nextAiResultDays;
      aiHistoryRef.current = nextAiHistory;
      aiExtraPromptsRef.current = nextAiExtraPrompts;
      setSettings(nextSettings);
      setAchievementCount(nextAchievementCount);
      setCalendarStats(nextCalendarStats);
      setActivitySamples(nextActivitySamples);
      setAiResults(nextAiResults);
      setAiResultDays(nextAiResultDays);
      setAiHistory(nextAiHistory);
      setAiExtraPrompts(nextAiExtraPrompts);
      saveSettings(nextSettings);
      save("fate:achievementCount", nextAchievementCount);
      save("fate:achievementPending", false);
      achievementPendingRef.current = false;
      save("fate:calendarStats", nextCalendarStats);
      save("fate:activitySamples", nextActivitySamples);
      save("fate:aiResults", nextAiResults);
      save("fate:aiResultDays", nextAiResultDays);
      save("fate:aiHistory", nextAiHistory);
      save("fate:aiExtraPrompts", nextAiExtraPrompts);
      save("fate:healthTips", nextAiResults.health);
      save("fate:healthTipsDay", nextAiResultDays.health);
      save("fate:healthExtraPrompt", nextAiExtraPrompts.health);
      syncHealthTips(nextAiResults.health).catch(() => {});
      replaceAiTipHistoryInDb(nextAiHistory).catch(() => {});
    }).catch(() => {});
    event.target.value = "";
  }, [saveSettings]);

  useEffect(() => {
    let disposed = false;

    loadPersistedState().then(patch => {
      if (disposed) return;
      const nextSettings = patch.settings ?? settingsRef.current;
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      if (patch.todayBase) setTodayBase(patch.todayBase);
      if (patch.calendarStats) {
        setCalendarStats(patch.calendarStats);
        calendarStatsRef.current = patch.calendarStats;
        save("fate:calendarStats", patch.calendarStats);
      }
      if (patch.aiHistory) {
        setAiHistory(patch.aiHistory);
        aiHistoryRef.current = patch.aiHistory;
        save("fate:aiHistory", patch.aiHistory);
      }
      if (patch.aiResults) {
        const nextResults = normalizeAiResults({ ...aiResultsRef.current, ...patch.aiResults });
        setAiResults(nextResults);
        aiResultsRef.current = nextResults;
        save("fate:aiResults", nextResults);
        save("fate:healthTips", nextResults.health);
      }
      if (patch.aiResultDays) {
        const nextDays = normalizeAiResultDays({ ...aiResultDaysRef.current, ...patch.aiResultDays });
        setAiResultDays(nextDays);
        aiResultDaysRef.current = nextDays;
        save("fate:aiResultDays", nextDays);
        save("fate:healthTipsDay", nextDays.health);
      }
      saveSettings(nextSettings);
      syncHealthTips(aiResultsRef.current.health).catch(() => {});
      setTimeout(maybeAutoGenerateAiTips, 0);
    }).catch(() => {});

    invoke("get_snapshot").then(next => {
      if (disposed) return;
      const normalized = normalizeSnapshot(next, snapshotRef.current);
      recordAchievementProgress(normalized);
      snapshotRef.current = normalized;
      syncDeskBackgroundCycle(normalized);
      setSnapshot(normalized);
      recordActivitySample(normalized, Date.now(), !activitySamplesRef.current.length);
    }).catch(() => {
      if (!disposed) {
        setSnapshot(previous => ({ ...previous, message: "正在等待 Tauri 后端连接" }));
      }
    });

    let unlisten = null;
    listen("activity://snapshot", event => {
      const next = normalizeSnapshot(event.payload, snapshotRef.current);
      recordAchievementProgress(next);
      snapshotRef.current = next;
      syncDeskBackgroundCycle(next);
      setSnapshot(next);
      recordActivitySample(next);
      const totals = todayTotals(todayBaseRef.current, next);
      setCalendarStats(previous => {
        const nextStats = { ...previous, [todayKey()]: totals };
        calendarStatsRef.current = nextStats;
        save("fate:calendarStats", nextStats);
        return nextStats;
      });
      persistSnapshot(totals).catch(() => {});
    }).then(callback => {
      unlisten = callback;
    }).catch(() => {});

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [maybeAutoGenerateAiTips, recordAchievementProgress, recordActivitySample, saveSettings, syncDeskBackgroundCycle]);

  useEffect(() => {
    maybeAutoGenerateAiTips();
    const timer = setInterval(maybeAutoGenerateAiTips, 5 * 60_000);
    return () => clearInterval(timer);
  }, [maybeAutoGenerateAiTips]);

  useEffect(() => {
    window.addEventListener("focus", maybeAutoGenerateAiTips);
    window.addEventListener("online", maybeAutoGenerateAiTips);
    document.addEventListener("visibilitychange", maybeAutoGenerateAiTips);

    return () => {
      window.removeEventListener("focus", maybeAutoGenerateAiTips);
      window.removeEventListener("online", maybeAutoGenerateAiTips);
      document.removeEventListener("visibilitychange", maybeAutoGenerateAiTips);
    };
  }, [maybeAutoGenerateAiTips]);

  useEffect(() => {
    invoke("set_main_window_pinned", { pinned: windowPinned }).catch(() => {});
  }, [windowPinned]);

  const todayTalismanTips = aiResultDays.talisman === todayKey() ? aiResults.talisman : [];
  const todayDeskDecorChoice = useMemo(
    () => deskDecorChoiceFromTips(todayTalismanTips, unlockedDeskDecorItems),
    [todayTalismanTips, unlockedDeskDecorItems]
  );
  const tickerItems = useMemo(() => marqueeTipItems(aiResults), [aiResults]);
  const showInputPermissionOverlay = needsInputMonitorPermissionAction(inputMonitorPermission);
  const changeWindowSizeMode = useCallback((mode) => {
    const nextMode = normalizeWindowSizeMode(mode);
    invoke("set_main_window_size_mode", { mode: nextMode })
      .then(() => window.setTimeout(() => syncWindowSizeModeFromActual(), 80))
      .catch(() => syncWindowSizeModeFromActual());
  }, [syncWindowSizeModeFromActual]);

  return (
    <I18nProvider language={resolvedLanguage}>
      <div className="app-frame">
      {deskBackgroundUrl ? (
        <div
          aria-hidden="true"
          className={`desk-background ${deskBackgroundReady ? "ready" : ""}`}
          data-paint-key={deskBackgroundPaintKey}
        >
          <img
            key={deskBackgroundUrl}
            className="desk-background-image"
            src={deskBackgroundUrl}
            alt=""
            decoding="async"
            fetchPriority="high"
            onLoad={() => {
              window.cancelAnimationFrame(deskBackgroundPaintFrameRef.current);
              deskBackgroundPaintFrameRef.current = window.requestAnimationFrame(() => {
                setDeskBackgroundReady(true);
                setDeskBackgroundPaintKey(key => key + 1);
              });
            }}
            onError={() => setDeskBackgroundReady(false)}
          />
        </div>
      ) : null}
      <div className="app-content">
        <div className="app-chrome">
          <Tabs
            tab={tab}
            onChange={setTab}
            windowSizeMode={windowSizeMode}
            onWindowSizeModeChange={changeWindowSizeMode}
          />
          <Header
            pinned={windowPinned}
            snapshot={snapshot}
            onPinnedChange={setPinned}
          />
        </div>
        <main className="main-panel">
          {tab === "today" ? (
            <TodayView
              active
              today={today}
              activitySamples={activitySamples}
              activityHour={activityHour}
              activityMaxHour={activityMaxHour}
              deskDecorItem={todayDeskDecorChoice?.item ?? null}
              tickerItems={tickerItems}
              onActivityHourChange={changeActivityHour}
            />
          ) : null}
          {tab === "calendar" ? (
            <CalendarView
              active
              today={today}
              calendarStats={calendarStats}
              activitySamples={activitySamples}
              month={calendarMonth}
              onMonthChange={changeCalendarMonth}
              onMonthReset={resetCalendarMonth}
            />
          ) : null}
          {tab === "ai" ? (
            <AiView
              active
              achievementCount={achievementCount}
              results={aiResults}
              history={aiHistory}
              extraPrompts={aiExtraPrompts}
              promptOpen={aiPromptOpen}
              aiStatus={aiStatus}
              aiErrors={aiErrors}
              unlockedDeskDecorItems={unlockedDeskDecorItems}
              onGenerate={kind => requestAiTips(kind, { automatic: false })}
              onPromptToggle={kind => setAiPromptOpen(previous => ({ ...previous, [kind]: !previous[kind] }))}
              onPromptInput={(kind, value) => {
                const normalizedKind = normalizeAiKind(kind);
                const next = { ...aiExtraPromptsRef.current, [normalizedKind]: value };
                aiExtraPromptsRef.current = next;
                setAiExtraPrompts(next);
                save("fate:aiExtraPrompts", next);
                if (normalizedKind === "health") save("fate:healthExtraPrompt", value);
              }}
            />
          ) : null}
          {tab === "achievements" ? (
            <AchievementView
              active
              count={achievementCount}
            />
          ) : null}
          {tab === "settings" ? (
            <SettingsView
              active
              settings={settings}
              llmTestStatus={llmTestStatus}
              llmTestMessage={llmTestMessage}
              llmTestTips={llmTestTips}
              inputMonitorPermission={inputMonitorPermission}
              dataMessage={dataMessage}
              onSettingInput={updateSetting}
              onSettingToggle={updateBooleanSetting}
              onSettingCommit={commitSettings}
              onTestModel={testLlmModel}
              onInputMonitorRequest={requestInputMonitorPermission}
              onExport={exportData}
              onImport={importData}
            />
          ) : null}
        </main>
        {settings.showRocketTools ? (
          <RocketTools
            open={toolsOpen}
            achievementCount={achievementCount}
            message={toolsMessage}
            debug={toolsDebug}
            onToggle={toggleTools}
            onClose={closeTools}
            onPreview={previewBreakOverlay}
            onAchievementCountChange={updateAchievementCount}
          />
        ) : null}
        {showInputPermissionOverlay ? (
          <InputPermissionOverlay onRequest={requestInputMonitorPermission} />
        ) : null}
      </div>
      </div>
    </I18nProvider>
  );
}
