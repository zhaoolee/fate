import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Circle, CircleDot } from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { NativeSelect } from "./components/ui/native-select";
import { Textarea } from "./components/ui/textarea";
import goldenFingerIcon from "./assets/tools/golden-finger.png";
import { languageLocales, useI18n } from "./app/i18n";
import { useStableImageSrc } from "./app/images";
import {
  achievementIcons,
  activityRingState,
  activitySampleTotals,
  aiGeneratedSections,
  aiSectionTitle,
  aiTipSourceText,
  appearanceModes,
  calendarMonthStart,
  clampActivityHour,
  dayKeyFromDate,
  deskDecorChoiceFromTips,
  deskDecorUnlockStates,
  fmtTime,
  formatCalendarMonth,
  formatHistoryTime,
  customAiPlaceholders,
  hasOfficialDefaultAiConfig,
  languageModes,
  marqueeDurationMs,
  marqueeSlideMs,
  navIcons,
  normalizeAchievementCount,
  percent,
  sameCalendarMonth,
  shuffleMarqueeItems,
  tabs
} from "./app/domain";

function decorDisplayName(t, name) {
  return t(`decorName.${name}`);
}

function aiSectionText(t, section, field) {
  return t(`ai.${section.id}.${field}`);
}

const StableImage = memo(function StableImage({ src, alt, ...props }) {
  const [stableSrc, handleImageError] = useStableImageSrc(src);
  const displaySrc = stableSrc || src || "";

  if (!displaySrc) return null;

  return (
    <img
      {...props}
      src={displaySrc}
      alt={alt}
      decoding="async"
      onError={() => handleImageError(displaySrc)}
    />
  );
});

const Header = memo(function Header({ pinned, snapshot, activitySlot = null, onPinnedChange }) {
  const { t } = useI18n();
  const pinLabel = pinned ? t("topbar.unpin") : t("topbar.pin");
  const keyboardCount = Number(snapshot?.keyboardCount ?? 0);
  const mouseCount = Number(snapshot?.mouseClickCount ?? snapshot?.mouseMoveCount ?? 0);

  return (
    <header className="topbar app-toolbar">
      <div className="topbar-activity-slot">
        <InputActivityMeters
          className="topbar-input-meters"
          keyboardCount={keyboardCount}
          mouseCount={mouseCount}
        />
        {activitySlot}
      </div>
      <div className="topbar-actions">
        <button
          className={`pin-button ${pinned ? "active" : ""}`}
          type="button"
          aria-label={pinLabel}
          title={pinLabel}
          onClick={() => onPinnedChange(!pinned)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M9 4.75h6v4.4l2.1 2.1c0.48 0.48 0.14 1.3-0.54 1.3H7.44c-0.68 0-1.02-0.82-0.54-1.3L9 9.15v-4.4Z" />
            <path d="M12 12.55v6.7" />
            <path d="M10.65 19.25h2.7" />
          </svg>
        </button>
      </div>
    </header>
  );
});

const TipMarquee = memo(function TipMarquee({ items, className = "" }) {
  const itemsKey = useMemo(() => items.join("\u0001"), [items]);
  const [queue, setQueue] = useState(() => shuffleMarqueeItems(items));
  const [activeIndex, setActiveIndex] = useState(0);
  const [sliding, setSliding] = useState(false);
  const activeItem = queue[activeIndex] ?? null;
  const nextQueue = useMemo(() => {
    if (!activeItem || activeIndex < queue.length - 1) return [];
    return shuffleMarqueeItems(items, activeItem.text);
  }, [activeIndex, activeItem, items, queue.length]);
  const nextItem = queue[activeIndex + 1] ?? nextQueue[0] ?? activeItem;
  const durationMs = activeItem ? marqueeDurationMs(activeItem.text) : 0;

  useEffect(() => {
    setQueue(shuffleMarqueeItems(items));
    setActiveIndex(0);
    setSliding(false);
  }, [items, itemsKey]);

  useEffect(() => {
    if (!activeItem || !items.length) return undefined;
    const slideTimer = setTimeout(() => {
      setSliding(true);
    }, durationMs);
    const advanceTimer = setTimeout(() => {
      if (activeIndex < queue.length - 1) {
        setActiveIndex(previousIndex => previousIndex + 1);
      } else {
        setQueue(nextQueue.length ? nextQueue : shuffleMarqueeItems(items, activeItem.text));
        setActiveIndex(0);
      }
      setSliding(false);
    }, durationMs + marqueeSlideMs);

    return () => {
      clearTimeout(slideTimer);
      clearTimeout(advanceTimer);
    };
  }, [activeIndex, activeItem, durationMs, items, itemsKey, nextQueue, queue.length]);

  const renderItem = (item, slot) => {
    const text = item?.text ?? "";

    return (
      <span className={`tip-marquee-item ${slot}`} aria-hidden={slot === "next" ? "true" : undefined}>
        <KaraokeText text={text} durationMs={durationMs} />
      </span>
    );
  };

  return (
    <div className={`tip-marquee ${className} ${activeItem ? "" : "empty"}`} aria-live="polite">
      {activeItem ? (
        <div
          key={`${activeItem.key}-${nextItem?.key ?? "empty"}`}
          className={`tip-marquee-track ${sliding ? "sliding" : ""}`}
          style={{
            "--marquee-slide-duration": `${marqueeSlideMs}ms`
          }}
        >
          {renderItem(activeItem, "active")}
          {renderItem(nextItem, "next")}
        </div>
      ) : null}
    </div>
  );
});

function isTipLineBreakChar(character) {
  return /[\s,，.。;；:：!！?？、]/.test(character);
}

function isTipLeadingPunctuation(character) {
  return /[,，.。;；:：!！?？、]/.test(character);
}

function splitTipTextIntoLines(text, maxWidth, font) {
  const characters = Array.from(text);
  if (!characters.length || maxWidth <= 0 || typeof document === "undefined") return [text];

  const context = document.createElement("canvas").getContext("2d");
  if (!context) return [text];
  context.font = font;

  const measure = value => context.measureText(value).width;
  const totalWidth = measure(text);
  const lineCount = Math.min(3, Math.max(1, Math.ceil(totalWidth / maxWidth)));
  if (lineCount === 1) return [text];

  const lines = [];
  let start = 0;

  for (let lineIndex = 0; lineIndex < lineCount - 1; lineIndex += 1) {
    const remainingText = characters.slice(start).join("");
    const targetWidth = measure(remainingText) / (lineCount - lineIndex);
    let bestEnd = start + 1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = start; index < characters.length; index += 1) {
      const candidate = characters.slice(start, index + 1).join("");
      const width = measure(candidate);

      const balancePenalty = Math.abs(width - targetWidth);
      const overflowPenalty = width > maxWidth ? (width - maxWidth) * 3 : 0;
      const punctuationBonus = isTipLineBreakChar(characters[index]) && width >= targetWidth * 0.76
        ? targetWidth * 0.1
        : 0;
      const score = balancePenalty + overflowPenalty - punctuationBonus;

      if (score < bestScore) {
        bestScore = score;
        bestEnd = index + 1;
      }

      if (width >= targetWidth * 1.18) {
        break;
      }
    }

    while (bestEnd < characters.length && isTipLeadingPunctuation(characters[bestEnd])) {
      bestEnd += 1;
    }

    const line = characters.slice(start, bestEnd).join("").trim();
    if (line) lines.push(line);
    start = bestEnd;
    while (characters[start] === " ") start += 1;
  }

  const tail = characters.slice(start).join("").trim();
  if (tail) lines.push(tail);
  return lines.length ? lines : [text];
}

function useKaraokeLines(text) {
  const textRef = useRef(null);
  const [lines, setLines] = useState([text]);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return undefined;

    const updateLines = () => {
      const styles = window.getComputedStyle(element);
      const nextLines = splitTipTextIntoLines(text, element.clientWidth, styles.font);
      setLines(previousLines => (
        previousLines.join("\u0001") === nextLines.join("\u0001") ? previousLines : nextLines
      ));
    };

    updateLines();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateLines);
      return () => window.removeEventListener("resize", updateLines);
    }

    const observer = new ResizeObserver(updateLines);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return [textRef, lines];
}

const KaraokeText = memo(function KaraokeText({ text, durationMs }) {
  const [textRef, lines] = useKaraokeLines(text);
  const lineDuration = Math.max(360, Math.floor(durationMs / Math.max(1, lines.length)));

  return (
    <span
      className={`tip-marquee-text lines-${Math.min(3, lines.length)}`}
      ref={textRef}
      aria-label={text}
      style={{ "--tip-karaoke-line-duration": `${lineDuration}ms` }}
    >
      {lines.map((line, index) => (
        <span
          aria-hidden="true"
          className="tip-marquee-line"
          data-text={line}
          key={`${line}-${index}`}
          style={{ "--tip-karaoke-line-index": index }}
        >
          {line}
        </span>
      ))}
    </span>
  );
});

const InputActivityMeters = memo(function InputActivityMeters({ className = "", keyboardCount, mouseCount }) {
  return (
    <div className={`input-activity-meters ${className}`} aria-hidden="true">
      <InputActivityMeter tone="keyboard" count={keyboardCount} />
      <InputActivityMeter tone="mouse" count={mouseCount} />
    </div>
  );
});

const inputMeterCells = Array.from({ length: 32 }, (_, index) => index);
const inputMeterMaxLevel = inputMeterCells.length;
const inputMeterPeakLevel = inputMeterMaxLevel;
const inputMeterRiseMs = 280;

function inputMeterNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function inputMeterRiseEase(progress) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - ((-2 * progress + 2) ** 3) / 2;
}

function useInputMeterLevel(count) {
  const previousCountRef = useRef(Number(count ?? 0));
  const holdUntilRef = useRef(0);
  const levelRef = useRef(0);
  const frameRef = useRef(0);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const nextCount = Number(count ?? 0);
    const delta = Math.max(0, nextCount - previousCountRef.current);
    previousCountRef.current = nextCount;
    if (!delta) return;

    holdUntilRef.current = Date.now() + Math.min(620, 180 + delta * 90);
    const startLevel = levelRef.current;
    const lift = 10 + Math.min(8, delta * 2);
    const targetLevel = Math.min(inputMeterPeakLevel, Math.max(14, startLevel + lift));
    const startedAt = inputMeterNow();

    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const tick = () => {
      const progress = Math.min(1, (inputMeterNow() - startedAt) / inputMeterRiseMs);
      const nextLevel = startLevel + (targetLevel - startLevel) * inputMeterRiseEase(progress);
      levelRef.current = nextLevel;
      setLevel(nextLevel);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = 0;
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [count]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() < holdUntilRef.current) return;
      if (frameRef.current) return;
      setLevel(previousLevel => {
        const nextLevel = Math.max(0, previousLevel - 3);
        levelRef.current = nextLevel;
        return nextLevel;
      });
    }, 46);

    return () => {
      clearInterval(timer);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return level;
}

const InputActivityMeter = memo(function InputActivityMeter({ tone, count }) {
  const level = useInputMeterLevel(count);

  return (
    <div className={`input-activity-meter ${tone}`}>
      <span className="input-meter-cells">
        {inputMeterCells.map(index => (
          <span
            className={`input-meter-cell ${index < level ? "active" : ""}`}
            key={`${tone}-${index}`}
          />
        ))}
      </span>
    </div>
  );
});

const IpodSkipIcon = memo(function IpodSkipIcon({ direction }) {
  const transform = direction === "previous" ? "translate(32 0) scale(-1 1)" : undefined;

  return (
    <svg className="ipod-skip-icon" aria-hidden="true" viewBox="0 0 32 32">
      <g transform={transform}>
        <path d="M5.6 7.2 15.3 14.95 15.3 7.2 25.8 16 15.3 24.8 15.3 17.05 5.6 24.8Z" />
        <rect x="26.2" y="6.6" width="3.4" height="18.8" rx="1.15" />
      </g>
    </svg>
  );
});

const Tabs = memo(function Tabs({ tab, onChange }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const selectTab = useCallback((id) => {
    onChange(id);
    setOpen(false);
  }, [onChange]);

  useEffect(() => {
    document.documentElement.classList.toggle("side-nav-open", open);
    return () => document.documentElement.classList.remove("side-nav-open");
  }, [open]);

  return (
    <nav className={`side-nav ${open ? "open" : ""}`} aria-label={t("nav.main")}>
      <button
        className="side-nav-toggle"
        type="button"
        aria-label={open ? t("nav.collapse") : t("nav.expand")}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      {open ? (
        <button
          className="side-nav-scrim"
          type="button"
          aria-label={t("nav.close")}
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className="side-nav-items">
        <div className="side-nav-tabs">
          {tabs.map(([id, , , iconKey]) => {
            const label = t(`tab.${id}`);
            const shortLabel = t(`tabShort.${id}`);
            return (
            <button
              key={id}
              className={`side-nav-item ${tab === id ? "active" : ""}`}
              type="button"
              aria-current={tab === id ? "page" : undefined}
              aria-label={label}
              title={label}
              onClick={() => selectTab(id)}
            >
              {navIcons[iconKey] ? (
                <img className="side-nav-icon" src={navIcons[iconKey]} alt="" aria-hidden="true" />
              ) : (
                <span className="side-nav-short" aria-hidden="true">{shortLabel}</span>
              )}
              <span className="side-nav-label">{label}</span>
            </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
});

const nixieDigitPaths = {
  0: "M50 18 C27 18 18 45 18 90 C18 135 27 162 50 162 C73 162 82 135 82 90 C82 45 73 18 50 18 Z",
  1: "M36 42 L54 20 L54 160 M38 160 L70 160",
  2: "M22 48 C28 24 72 20 80 50 C86 73 68 86 52 101 L22 160 L82 160",
  3: "M24 28 L78 28 L52 87 C83 88 91 128 70 151 C55 167 28 158 21 145",
  4: "M75 160 L75 20 M75 100 L18 100 L66 22",
  5: "M80 26 L28 26 L23 87 C54 79 84 96 82 128 C80 160 47 168 22 149",
  6: "M78 34 C51 18 23 45 20 88 C17 132 36 161 62 158 C84 155 90 128 76 111 C61 92 33 98 22 118",
  7: "M18 28 L84 28 L42 160",
  8: "M50 18 C28 18 22 48 36 70 C48 88 52 88 64 70 C78 48 72 18 50 18 Z M50 89 C25 89 20 125 35 148 C48 168 52 168 65 148 C80 125 75 89 50 89 Z",
  9: "M76 82 C71 111 29 111 23 78 C16 42 44 18 68 32 C92 46 88 92 72 126 L58 160"
};

const nixieSymbolPaths = {
  ...nixieDigitPaths,
  "-": "M26 91 L74 91"
};

function formatNixieHourLabel(hour, maxHour, now = new Date()) {
  const currentHour = clampActivityHour(maxHour);
  const labelHour = String(clampActivityHour(hour)).padStart(2, "0");
  if (hour !== currentHour) return `${labelHour}:--`;
  return `${labelHour}:${String(now.getMinutes()).padStart(2, "0")}`;
}

const NixieDigit = memo(function NixieDigit({ value }) {
  const digitPath = nixieSymbolPaths[value] ?? nixieDigitPaths[0];
  const ghostPath = nixieDigitPaths[8];

  return (
    <svg className="nixie-digit" viewBox="0 0 100 180" aria-hidden="true">
      <path className="nixie-digit-ghost" d={ghostPath} />
      <path className="nixie-digit-glow" d={digitPath} />
      <path className="nixie-digit-lit" d={digitPath} />
    </svg>
  );
});

const NixieSeparator = memo(function NixieSeparator() {
  return (
    <span className="nixie-tube nixie-separator-tube">
      <svg className="nixie-separator-mark" viewBox="0 0 100 180" aria-hidden="true">
        <path className="nixie-separator-ghost" d="M32 28 C58 22 78 45 76 82 C73 119 47 138 22 154 M28 42 L78 108 M22 74 L68 152" />
        <circle className="nixie-separator-dot" cx="72" cy="146" r="5" />
      </svg>
    </span>
  );
});

const NixieTime = memo(function NixieTime({ value }) {
  return (
    <span className="nixie-time" aria-hidden="true">
      {Array.from(value).map((character, index) => (
        character === ":" ? (
          <NixieSeparator key={`${character}-${index}`} />
        ) : (
          <span className="nixie-tube" key={`${character}-${index}`}>
            <NixieDigit value={character} />
          </span>
        )
      ))}
    </span>
  );
});

const TodayView = memo(function TodayView({
  active,
  today,
  activitySamples,
  activityHour,
  activityMaxHour,
  deskDecorItem,
  tickerItems,
  onActivityHourChange
}) {
  const { t } = useI18n();
  const [nixieNow, setNixieNow] = useState(() => new Date());
  const selectedHour = clampActivityHour(activityHour, activityMaxHour);
  const ring = useMemo(() => activityRingState(activitySamples, selectedHour), [activitySamples, selectedHour]);
  const selectedHourLabel = formatNixieHourLabel(selectedHour, activityMaxHour, nixieNow);
  const [decorImageSrc, handleDecorImageError] = useStableImageSrc(deskDecorItem?.url ?? "");
  const [ringTooltip, setRingTooltip] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNixieNow(new Date()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const updateRingTooltip = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = event.clientX - rect.left - centerX;
    const y = event.clientY - rect.top - centerY;
    const radius = Math.min(rect.width, rect.height) / 2;

    if (Math.hypot(x, y) > radius) {
      setRingTooltip(null);
      return;
    }

    const angle = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
    const segmentIndex = Math.min(
      ring.segments.length - 1,
      Math.max(0, Math.floor(angle / (360 / ring.segments.length)))
    );
    const segment = ring.segments[segmentIndex];
    if (!segment || segment.state === "future") {
      setRingTooltip(null);
      return;
    }

    setRingTooltip({
      key: `${selectedHour}-${segment.index}`,
      left: Math.min(rect.width - 96, Math.max(96, event.clientX - rect.left)),
      top: Math.min(rect.height - 48, Math.max(42, event.clientY - rect.top)),
      text: t("today.segmentTitle", {
        label: segment.label,
        keyboard: segment.keyboardCount,
        mouse: segment.mouseClickCount
      })
    });
  }, [ring.segments, selectedHour, t]);
  const hideRingTooltip = useCallback(() => setRingTooltip(null), []);

  return (
    <section className={`view ${active ? "active" : ""}`} data-view="today">
      <div className="today-layout">
        <div className="watch-ring-area">
          <div
            className="watch-ring"
            onPointerLeave={hideRingTooltip}
            onPointerMove={updateRingTooltip}
            style={{ "--segments": ring.gradient }}
          >
            <div className="ring-segment-layer">
              {ring.segments.map(segment => (
                <button
                  className={`ring-segment ${segment.state}`}
                  key={`${selectedHour}-${segment.index}`}
                  type="button"
                  aria-label={segment.state === "future"
                    ? segment.label
                    : t("today.segmentTitle", {
                      label: segment.label,
                      keyboard: segment.keyboardCount,
                      mouse: segment.mouseClickCount
                    })}
                  style={{ "--angle": `${segment.angle}deg` }}
                />
              ))}
            </div>
            <div className="watch-ring-center">
              <span className="watch-ring-bagua" aria-hidden="true" />
              {decorImageSrc ? (
                <img
                  className="watch-ring-decor"
                  src={decorImageSrc}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  onError={() => handleDecorImageError(decorImageSrc)}
                />
              ) : null}
            </div>
            {ringTooltip ? (
              <span
                className="ring-hover-tooltip"
                key={ringTooltip.key}
                style={{
                  "--tooltip-left": `${ringTooltip.left}px`,
                  "--tooltip-top": `${ringTooltip.top}px`
                }}
              >
                {ringTooltip.text}
              </span>
            ) : null}
          </div>
          <TipMarquee items={tickerItems} className="today-tip-marquee" />
          <div className="ring-controls">
            <div className="ring-hour-stepper">
              <button
                type="button"
                aria-label={t("today.prevHour")}
                onClick={() => onActivityHourChange(-1)}
                disabled={selectedHour <= 0}
              >
                <IpodSkipIcon direction="previous" />
              </button>
              <button
                type="button"
                aria-label={t("today.nextHour")}
                onClick={() => onActivityHourChange(1)}
                disabled={selectedHour >= activityMaxHour}
              >
                <IpodSkipIcon direction="next" />
              </button>
            </div>
            <span className="ring-hour-label" aria-label={selectedHourLabel}>
              <NixieTime value={selectedHourLabel} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
});

const InputPermissionOverlay = memo(function InputPermissionOverlay({ onRequest }) {
  const { t } = useI18n();

  return (
    <div className="input-permission-overlay" role="status" aria-live="polite">
      <button type="button" onClick={onRequest}>
        {t("permission.enable")}
      </button>
    </div>
  );
});

const calendarWeekdays = ["日", "一", "二", "三", "四", "五", "六"];

const CalendarView = memo(function CalendarView({
  active,
  today,
  calendarStats,
  activitySamples,
  month,
  onMonthChange,
  onMonthReset
}) {
  const { language, t } = useI18n();
  const days = useMemo(
    () => calendarDays(today, calendarStats, month, activitySamples),
    [today, calendarStats, month, activitySamples]
  );
  const isCurrentMonth = sameCalendarMonth(month, new Date());
  const locale = languageLocales[language];

  return (
    <section className={`view ${active ? "active" : ""}`} data-view="calendar">
      <div className="calendar-head">
        <h2>{formatCalendarMonth(month, locale)}</h2>
        <div className="calendar-controls" aria-label={t("calendar.switchMonth")}>
          <button type="button" aria-label={t("calendar.prevMonth")} onClick={() => onMonthChange(-1)}>←</button>
          <button type="button" aria-label={t("calendar.currentMonth")} onClick={onMonthReset} disabled={isCurrentMonth}>{t("calendar.currentMonth")}</button>
          <button type="button" aria-label={t("calendar.nextMonth")} onClick={() => onMonthChange(1)}>→</button>
        </div>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {calendarWeekdays.map((day, index) => <span key={day}>{t(`calendar.week.${index}`)}</span>)}
      </div>
      <div className="calendar-grid">
        {days.map(day => (
          <CalendarCell key={day.key} day={day} />
        ))}
      </div>
    </section>
  );
});

function calendarDays(today, calendarStats = {}, reference = new Date(), activitySamples = []) {
  const now = new Date();
  const first = calendarMonthStart(reference);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const todaySampleTotals = activitySampleTotals(activitySamples, now.getTime());
  const hasTodaySamples = todaySampleTotals.workSecs + todaySampleTotals.restSecs > 0;

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const isToday = date.toDateString() === now.toDateString();
    const key = dayKeyFromDate(date);
    const stats = isToday
      ? {
          ...calendarStats[key],
          workSecs: hasTodaySamples ? todaySampleTotals.workSecs : today.workSecs,
          restSecs: hasTodaySamples ? todaySampleTotals.restSecs : today.restSecs
        }
      : calendarStats[key];
    return {
      date,
      key,
      isToday,
      muted: date.getMonth() !== first.getMonth(),
      work: stats?.workSecs ?? 0,
      rest: stats?.restSecs ?? 0
    };
  });
}

const CalendarCell = memo(function CalendarCell({ day }) {
  const { t } = useI18n();
  const total = Math.max(1, day.work + day.rest);
  const work = percent(day.work, total);
  const rest = percent(day.rest, total);
  return (
    <div
      className={`day ${day.muted ? "muted" : ""} ${day.isToday ? "today" : ""}`}
      title={t("calendar.dayTitle", {
        day: day.key,
        work: fmtTime(day.work),
        rest: fmtTime(day.rest)
      })}
    >
      <div
        className="calendar-day-ring"
        style={{
          "--work": work,
          "--rest": rest
        }}
      >
        <div className="calendar-day-inner">
          <span>{day.date.getDate()}</span>
        </div>
      </div>
    </div>
  );
});

const AiView = memo(function AiView({
  active,
  achievementCount,
  results,
  history,
  extraPrompts,
  promptOpen,
  aiStatus,
  aiErrors,
  unlockedDeskDecorItems,
  onGenerate,
  onPromptToggle,
  onPromptInput
}) {
  const { language, t } = useI18n();
  const generatedHistory = useMemo(
    () => history.filter(run => aiGeneratedSections.some(section => section.id === run.kind)),
    [history]
  );
  const locale = languageLocales[language];

  return (
    <section className={`view ${active ? "active" : ""}`} data-view="ai">
      <div className="stack">
        {aiGeneratedSections.map(section => (
          section.id === "talisman" ? (
            <TalismanTipPanel
              key={section.id}
              section={section}
              tips={results[section.id] ?? []}
              extraPrompt={extraPrompts[section.id] ?? ""}
              promptOpen={Boolean(promptOpen[section.id])}
              status={aiStatus[section.id] ?? "idle"}
              error={aiErrors[section.id] ?? ""}
              unlockedDeskDecorItems={unlockedDeskDecorItems}
              onGenerate={() => onGenerate(section.id)}
              onPromptToggle={() => onPromptToggle(section.id)}
              onPromptInput={value => onPromptInput(section.id, value)}
            />
          ) : (
            <AiTipPanel
              key={section.id}
              section={section}
              tips={results[section.id] ?? []}
              extraPrompt={extraPrompts[section.id] ?? ""}
              promptOpen={Boolean(promptOpen[section.id])}
              status={aiStatus[section.id] ?? "idle"}
              error={aiErrors[section.id] ?? ""}
              onGenerate={() => onGenerate(section.id)}
              onPromptToggle={() => onPromptToggle(section.id)}
              onPromptInput={value => onPromptInput(section.id, value)}
            />
          )
        ))}
        <article className="panel ai-history-panel">
          <div className="ai-history-head">
            <h2>{t("ai.history")}</h2>
          </div>
          {generatedHistory.length ? (
            <div className="ai-history-list">
              {generatedHistory.slice(0, 9).map(run => (
                <div className="ai-history-item" key={`${run.createdAt}-${run.kind}-${run.day}-${run.source}`}>
                  <div className="ai-history-meta">
                    <strong>{t(`ai.${run.kind}.title`, { title: aiSectionTitle(run.kind) })} · {run.day}</strong>
                    <span>{t(`source.${run.source}`, { source: aiTipSourceText(run.source) })} · {formatHistoryTime(run.createdAt, locale)}</span>
                  </div>
                  <div className="ai-history-tips">
                    {run.tips.map((tip, index) => (
                      <span className="ai-tip-pill" key={`${run.createdAt}-${tip}-${index}`}>{tip}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-history">{t("ai.historyEmpty")}</p>
          )}
        </article>
      </div>
    </section>
  );
});

const AiTipPanel = memo(function AiTipPanel({
  section,
  tips,
  extraPrompt,
  promptOpen,
  status,
  error,
  onGenerate,
  onPromptToggle,
  onPromptInput
}) {
  const { t } = useI18n();
  const loading = status === "loading";
  const title = aiSectionText(t, section, "title");

  return (
    <article className="panel ai-tips-panel">
      <div className="ai-tips-toolbar">
        <h2>{title}</h2>
        <button onClick={onGenerate} disabled={loading}>
          {loading ? aiSectionText(t, section, "loading") : aiSectionText(t, section, "action")}
        </button>
      </div>
      {error ? <p className="ai-error">{error}</p> : null}
      <div className={`ai-tip-list ${tips.length ? "" : "empty"}`}>
        {tips.length ? (
          tips.map((tip, index) => (
            <span className="ai-tip-pill" key={`${section.id}-${tip}-${index}`}>{tip}</span>
          ))
        ) : (
          <span>{t("ai.waitingOutput")}</span>
        )}
      </div>
      <div className={`ai-extra-prompt ${promptOpen ? "open" : ""}`}>
        <button className="ai-extra-toggle" type="button" onClick={onPromptToggle}>
          <span>{t("ai.extraPrompt")}</span>
          <span>{promptOpen ? t("ai.collapse") : extraPrompt.trim() ? t("ai.configured") : t("ai.expand")}</span>
        </button>
        {promptOpen ? (
          <textarea
            value={extraPrompt}
            onInput={event => onPromptInput(event.currentTarget.value)}
            placeholder={t("ai.promptPlaceholder", { title })}
          />
        ) : null}
      </div>
    </article>
  );
});

const TalismanTipPanel = memo(function TalismanTipPanel({
  section,
  tips,
  extraPrompt,
  promptOpen,
  status,
  error,
  unlockedDeskDecorItems,
  onGenerate,
  onPromptToggle,
  onPromptInput
}) {
  const { t } = useI18n();
  const loading = status === "loading";
  const choice = useMemo(
    () => deskDecorChoiceFromTips(tips, unlockedDeskDecorItems),
    [tips, unlockedDeskDecorItems]
  );

  const title = aiSectionText(t, section, "title");
  const choiceName = choice ? decorDisplayName(t, choice.name) : "";

  return (
    <article className="panel ai-tips-panel">
      <div className="ai-tips-toolbar">
        <h2>{title}</h2>
        <button onClick={onGenerate} disabled={loading || !unlockedDeskDecorItems.length}>
          {loading ? aiSectionText(t, section, "loading") : aiSectionText(t, section, "action")}
        </button>
      </div>
      {error ? <p className="ai-error">{error}</p> : null}
      <div className={`talisman-choice ${choice ? "" : "empty"}`}>
        {choice ? (
          <article className="decor-choice-card">
            <StableImage src={choice.item.url} alt={choiceName} loading="lazy" />
            <div>
              <strong>{choiceName}</strong>
              <p>{choice.description || t("ai.talismanFallback")}</p>
            </div>
          </article>
        ) : (
          <span>{unlockedDeskDecorItems.length ? t("ai.talismanWaiting") : t("ai.talismanEmpty")}</span>
        )}
      </div>
      <div className={`ai-extra-prompt ${promptOpen ? "open" : ""}`}>
        <button className="ai-extra-toggle" type="button" onClick={onPromptToggle}>
          <span>{t("ai.extraPrompt")}</span>
          <span>{promptOpen ? t("ai.collapse") : extraPrompt.trim() ? t("ai.configured") : t("ai.expand")}</span>
        </button>
        {promptOpen ? (
          <textarea
            value={extraPrompt}
            onInput={event => onPromptInput(event.currentTarget.value)}
            placeholder={t("ai.promptPlaceholder", { title })}
          />
        ) : null}
      </div>
    </article>
  );
});

const DecorGalleryPanel = memo(function DecorGalleryPanel({ achievementCount }) {
  const { t } = useI18n();
  const stars = normalizeAchievementCount(achievementCount);
  const decorStates = useMemo(
    () => deskDecorUnlockStates(stars)
      .map((decor, index) => ({ ...decor, sourceIndex: index }))
      .sort((left, right) => {
        if (left.unlocked !== right.unlocked) return left.unlocked ? -1 : 1;
        if (!left.unlocked && left.requiredStars !== right.requiredStars) {
          return left.requiredStars - right.requiredStars;
        }
        return left.sourceIndex - right.sourceIndex;
      }),
    [stars]
  );
  const unlockedCount = decorStates.filter(decor => decor.unlocked).length;

  return (
    <article className="panel decor-gallery-panel">
      <div className="ai-tips-toolbar decor-gallery-toolbar">
        <h2>{t("decor.galleryTitle")}</h2>
        <span className="decor-gallery-meter">{t("decor.meter", { stars, unlocked: unlockedCount, total: decorStates.length })}</span>
      </div>
      <div className="decor-gallery-grid" aria-label={t("decor.unlockedAria", { unlocked: unlockedCount, total: decorStates.length })}>
        {decorStates.map(decor => {
          const name = decorDisplayName(t, decor.name);
          return (
            <article
              className={`decor-gallery-cell ${decor.unlocked ? "unlocked" : "locked"}`}
              key={decor.item.name}
              title={decor.unlocked ? t("decor.unlockedTitle", { name }) : t("decor.lockedTitle", { name, stars: decor.requiredStars })}
              aria-label={decor.unlocked ? t("decor.unlockedTitle", { name }) : t("decor.lockedTitle", { name, stars: decor.requiredStars })}
            >
            <StableImage src={decor.item.url} alt={name} loading="lazy" />
            <span className="decor-gallery-name">{name}</span>
            {decor.unlocked ? null : (
              <span className="decor-lock-badge">{t("decor.lockBadge", { stars: decor.requiredStars })}</span>
            )}
          </article>
          );
        })}
      </div>
    </article>
  );
});

const AchievementView = memo(function AchievementView({ active, count }) {
  const { t } = useI18n();
  const normalizedCount = normalizeAchievementCount(count);
  const visibleStarCount = Math.min(normalizedCount, 48);
  const hiddenStarCount = Math.max(0, normalizedCount - visibleStarCount);
  const starItems = Array.from({ length: Math.max(1, visibleStarCount) }, (_, index) => ({
    key: `star-${index}`,
    empty: normalizedCount === 0
  }));

  return (
    <section className={`view ${active ? "active" : ""}`} data-view="achievements">
      <article className="panel achievement-star-panel" aria-label={t("achievement.panelAria", { count: normalizedCount })}>
        <div className="achievement-title-row">
          <h2>{t("achievement.restStars")}</h2>
          <span className="decor-gallery-meter">{t("achievement.starMeter", { count: normalizedCount })}</span>
        </div>
        <div className="achievement-star-shelf" aria-label={t("achievement.shelfAria", { count: normalizedCount })}>
          {starItems.map(star => (
            <div
              className={`achievement-star ${star.empty ? "empty" : ""}`}
              key={star.key}
              title={star.empty ? t("achievement.emptyStar") : t("achievement.starTitle")}
            >
              {achievementIcons.star ? (
                <img className="achievement-icon" src={achievementIcons.star} alt="" aria-hidden="true" />
              ) : (
                <span aria-hidden="true">★</span>
              )}
            </div>
          ))}
          {hiddenStarCount > 0 ? <span className="achievement-more">+{hiddenStarCount}</span> : null}
        </div>
        <p className="achievement-note">
          {t("achievement.note", { count: normalizedCount })}
        </p>
      </article>
      <DecorGalleryPanel achievementCount={normalizedCount} />
    </section>
  );
});

const SettingsView = memo(function SettingsView({
  active,
  settings,
  llmTestStatus,
  llmTestMessage,
  llmTestTips,
  inputMonitorPermission,
  dataMessage,
  onSettingInput,
  onSettingToggle,
  onSettingCommit,
  onTestModel,
  onInputMonitorRequest,
  onExport,
  onImport
}) {
  const { t } = useI18n();

  return (
    <section className={`view ${active ? "active" : ""}`} data-view="settings">
      {inputMonitorPermission.requiresPermission ? (
        <InputPermissionModule
          status={inputMonitorPermission}
          onRequest={onInputMonitorRequest}
        />
      ) : null}
      <div className="settings-field profile memory-field">
        <Label className="settings-section-title" htmlFor="profile">{t("settings.memory")}</Label>
        <Textarea
          id="profile"
          value={settings.profile}
          onInput={event => onSettingInput("profile", event.currentTarget.value)}
          onBlur={onSettingCommit}
        />
      </div>
      <section className="settings-module loop-settings-module" aria-label={t("settings.loop")}>
        <div className="settings-module-title">{t("settings.loop")}</div>
        <div className="settings-grid loop-settings-grid">
          <SettingInput
            label={t("settings.workMinutes")}
            id="workMinutes"
            type="number"
            min="1"
            max="180"
            value={settings.workMinutes}
            onInput={onSettingInput}
            onCommit={onSettingCommit}
          />
          <SettingInput
            label={t("settings.restMinutes")}
            id="restMinutes"
            type="number"
            min="1"
            max="60"
            value={settings.restMinutes}
            onInput={onSettingInput}
            onCommit={onSettingCommit}
          />
        </div>
      </section>
      <section className="settings-module appearance-settings-module" aria-label={t("settings.appearance")}>
        <div className="settings-module-title">{t("settings.appearance")}</div>
        <SettingSelect
          label={t("settings.theme")}
          id="appearanceMode"
          value={settings.appearanceMode ?? "system"}
          onInput={onSettingInput}
          onCommit={onSettingCommit}
          commitOnChange
        >
          {appearanceModes.map(mode => (
            <option key={mode.id} value={mode.id}>{t(`appearance.${mode.id}`)}</option>
          ))}
        </SettingSelect>
        <SettingSelect
          label={t("settings.language")}
          id="languageMode"
          value={settings.languageMode ?? "system"}
          onInput={onSettingInput}
          onCommit={onSettingCommit}
          commitOnChange
        >
          {languageModes.map(mode => (
            <option key={mode.id} value={mode.id}>{t(`language.${mode.id}`)}</option>
          ))}
        </SettingSelect>
      </section>
      <section className="settings-module birth-info-module" aria-label={t("settings.birthInfo")}>
        <div className="settings-module-title">{t("settings.birthInfo")}</div>
        <div className="birth-info-grid">
          <SettingInput
            label={t("settings.name")}
            id="birthName"
            value={settings.birthName ?? ""}
            autoComplete="name"
            onInput={onSettingInput}
            onCommit={onSettingCommit}
          />
          <SettingSelect
            label={t("settings.gender")}
            id="birthGender"
            value={settings.birthGender ?? ""}
            onInput={onSettingInput}
            onCommit={onSettingCommit}
          >
            <option value="">{t("settings.unset")}</option>
            <option value="男">{t("settings.male")}</option>
            <option value="女">{t("settings.female")}</option>
            <option value="其他">{t("settings.other")}</option>
          </SettingSelect>
          <BirthDateSelects
            settings={settings}
            onInput={onSettingInput}
            onCommit={onSettingCommit}
          />
          <BirthTimeSelects
            value={settings.birthTime ?? ""}
            onInput={onSettingInput}
            onCommit={onSettingCommit}
          />
        </div>
      </section>
      <section className="settings-module ai-settings-module" aria-label={t("settings.aiAccess")}>
        <div className="settings-module-title">{t("settings.aiAccess")}</div>
        <div className="ai-access-options" role="radiogroup" aria-label={t("settings.aiAccessMode")}>
          {hasOfficialDefaultAiConfig ? (
            <button
              type="button"
              className={`ai-access-option ${settings.useCustomAi === true ? "" : "active"}`}
              role="radio"
              aria-checked={settings.useCustomAi !== true}
              onClick={() => onSettingToggle("useCustomAi", false)}
            >
              {settings.useCustomAi === true ? (
                <Circle aria-hidden="true" />
              ) : (
                <CircleDot aria-hidden="true" />
              )}
              <span>{t("settings.officialDefault")}</span>
            </button>
          ) : null}
          <button
            type="button"
            className={`ai-access-option ${settings.useCustomAi === true ? "active" : ""}`}
            role="radio"
            aria-checked={settings.useCustomAi === true}
            onClick={() => onSettingToggle("useCustomAi", true)}
          >
            {settings.useCustomAi === true ? (
              <CircleDot aria-hidden="true" />
            ) : (
              <Circle aria-hidden="true" />
            )}
            <span>{t("settings.customAccess")}</span>
          </button>
        </div>
        {settings.useCustomAi === true ? (
          <div className="settings-field ai-config-field">
            <div className="ai-custom-fields">
              <div className="settings-field">
                <Label htmlFor="llmEndpoint">Base URL</Label>
                <Input
                  id="llmEndpoint"
                  placeholder={customAiPlaceholders.llmEndpoint}
                  value={settings.llmEndpoint}
                  onInput={event => onSettingInput("llmEndpoint", event.currentTarget.value)}
                  onBlur={onSettingCommit}
                />
              </div>
              <div className="settings-field">
                <Label htmlFor="llmApiKey">API Key</Label>
                <Input
                  id="llmApiKey"
                  type="password"
                  autoComplete="off"
                  placeholder={customAiPlaceholders.llmApiKey}
                  value={settings.llmApiKey}
                  onInput={event => onSettingInput("llmApiKey", event.currentTarget.value)}
                  onBlur={onSettingCommit}
                />
              </div>
              <div className="settings-field">
                <Label htmlFor="llmModel">{t("settings.model")}</Label>
                <Input
                  id="llmModel"
                  placeholder={customAiPlaceholders.llmModel}
                  value={settings.llmModel}
                  onInput={event => onSettingInput("llmModel", event.currentTarget.value)}
                  onBlur={onSettingCommit}
                />
              </div>
            </div>
            <div className="model-test-row">
              <Button type="button" onClick={onTestModel} disabled={llmTestStatus === "loading"}>
                {llmTestStatus === "loading" ? t("settings.testing") : t("settings.testModel")}
              </Button>
              <span className={llmTestStatus === "error" ? "error" : ""}>{llmTestMessage}</span>
            </div>
            {llmTestTips.length ? (
              <pre className="model-test-output">{JSON.stringify(llmTestTips, null, 2)}</pre>
            ) : null}
          </div>
        ) : null}
      </section>
      <div className="settings-grid">
        <SettingCheckbox
          className="llm-field"
          label={t("settings.goldenFinger")}
          id="showRocketTools"
          checked={settings.showRocketTools === true}
          onToggle={onSettingToggle}
        />
      </div>
      <div className="actions">
        <Button type="button" onClick={onExport}>{t("settings.exportData")}</Button>
        <label className="file-button">
          {t("settings.importData")}
          <input type="file" accept="application/json" onChange={onImport} />
        </label>
      </div>
      {dataMessage ? <p className="data-message">{dataMessage}</p> : null}
    </section>
  );
});

const InputPermissionModule = memo(function InputPermissionModule({ status, onRequest }) {
  const { t } = useI18n();
  const ready = status.supported && status.authorized && status.listening;
  const label = ready ? t("settings.permissionReady") : t("settings.permissionRequest");

  return (
    <section className="input-permission" aria-label={t("settings.permissionAria")}>
      <span className="input-permission-title settings-section-title">{t("settings.permission")}</span>
      <div className="input-permission-list">
        <div className="input-permission-row">
          <button
            type="button"
            className="input-permission-button"
            onClick={onRequest}
            disabled={!status.supported}
          >
            {status.supported ? label : t("settings.permissionUnsupported")}
          </button>
          <span
            className={`input-permission-dot ${ready ? "ready" : ""}`}
            aria-label={ready ? t("settings.permissionReadyAria") : t("settings.permissionMissingAria")}
          />
        </div>
      </div>
    </section>
  );
});

const birthYearOptions = Array.from(
  { length: Math.max(1, new Date().getFullYear() - 1899) },
  (_, index) => String(new Date().getFullYear() - index)
);
const birthMonthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const birthHourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const birthMinuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

const BirthDateSelects = memo(function BirthDateSelects({ settings, onInput, onCommit }) {
  const { t } = useI18n();
  const year = String(settings.birthYear ?? "");
  const month = String(settings.birthMonth ?? "");
  const day = String(settings.birthDay ?? "");
  const dayOptions = useMemo(() => {
    const count = daysInBirthMonth(year, month);
    return Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, "0"));
  }, [year, month]);

  const updatePart = useCallback((id, value) => {
    const next = {
      birthYear: year,
      birthMonth: month,
      birthDay: day,
      [id]: value
    };
    const maxDay = daysInBirthMonth(next.birthYear, next.birthMonth);
    onInput(id, value);
    if (Number(next.birthDay) > maxDay) {
      onInput("birthDay", "");
    }
    onCommit();
  }, [day, month, onCommit, onInput, year]);

  return (
    <div className="settings-field birth-date-field">
      <Label htmlFor="birthYear">{t("birth.date")}</Label>
      <div className="birth-date-selects">
        <NativeSelect
          id="birthYear"
          value={year}
          onChange={event => updatePart("birthYear", event.currentTarget.value)}
        >
          <option value="">{t("birth.year")}</option>
          {birthYearOptions.map(option => (
            <option key={option} value={option}>{t("birth.yearValue", { value: Number(option) })}</option>
          ))}
        </NativeSelect>
        <NativeSelect
          id="birthMonth"
          value={month}
          onChange={event => updatePart("birthMonth", event.currentTarget.value)}
        >
          <option value="">{t("birth.month")}</option>
          {birthMonthOptions.map(option => (
            <option key={option} value={option}>{t("birth.monthValue", { value: Number(option) })}</option>
          ))}
        </NativeSelect>
        <NativeSelect
          id="birthDay"
          value={dayOptions.includes(day) ? day : ""}
          onChange={event => updatePart("birthDay", event.currentTarget.value)}
        >
          <option value="">{t("birth.day")}</option>
          {dayOptions.map(option => (
            <option key={option} value={option}>{t("birth.dayValue", { value: Number(option) })}</option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
});

const BirthTimeSelects = memo(function BirthTimeSelects({ value, onInput, onCommit }) {
  const { t } = useI18n();
  const { hour, minute } = birthTimeParts(value);
  const updateTime = useCallback((nextHour, nextMinute) => {
    const next = nextHour ? `${nextHour}:${nextMinute || "00"}` : "";
    onInput("birthTime", next);
    onCommit();
  }, [onCommit, onInput]);

  return (
    <div className="settings-field birth-time-field">
      <Label htmlFor="birthHour">{t("birth.time")}</Label>
      <div className="birth-time-selects">
        <NativeSelect
          id="birthHour"
          value={hour}
          onChange={event => updateTime(event.currentTarget.value, minute)}
        >
          <option value="">{t("birth.hour")}</option>
          {birthHourOptions.map(option => (
            <option key={option} value={option}>{t("birth.hourValue", { value: option })}</option>
          ))}
        </NativeSelect>
        <NativeSelect
          id="birthMinute"
          value={hour ? minute : ""}
          onChange={event => updateTime(hour || "00", event.currentTarget.value)}
          disabled={!hour}
        >
          <option value="">{t("birth.minute")}</option>
          {birthMinuteOptions.map(option => (
            <option key={option} value={option}>{t("birth.minuteValue", { value: option })}</option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
});

function daysInBirthMonth(year, month) {
  const normalizedMonth = Number(month);
  if (!Number.isInteger(normalizedMonth) || normalizedMonth < 1 || normalizedMonth > 12) return 31;
  const normalizedYear = Number(year) || 2000;
  return new Date(normalizedYear, normalizedMonth, 0).getDate();
}

function birthTimeParts(value) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return { hour: "", minute: "" };
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return {
    hour: String(hour).padStart(2, "0"),
    minute: String(minute).padStart(2, "0")
  };
}

const SettingCheckbox = memo(function SettingCheckbox({
  className = "",
  label,
  id,
  checked,
  onToggle
}) {
  return (
    <label className={`settings-toggle ${className}`}>
      <span>{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={Boolean(checked)}
        onChange={event => onToggle(id, event.currentTarget.checked)}
      />
    </label>
  );
});

const SettingInput = memo(function SettingInput({
  className = "",
  label,
  id,
  value,
  onInput,
  onCommit,
  ...inputProps
}) {
  const fieldClassName = ["settings-field", className].filter(Boolean).join(" ");
  return (
    <div className={fieldClassName}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onInput={event => onInput(id, event.currentTarget.value)}
        onBlur={onCommit}
        {...inputProps}
      />
    </div>
  );
});

const SettingSelect = memo(function SettingSelect({
  className = "",
  label,
  id,
  value,
  onInput,
  onCommit,
  commitOnChange = false,
  children,
  ...selectProps
}) {
  const fieldClassName = ["settings-field", className].filter(Boolean).join(" ");
  return (
    <div className={fieldClassName}>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        value={value}
        onChange={event => {
          onInput(id, event.currentTarget.value);
          if (commitOnChange) onCommit();
        }}
        onBlur={onCommit}
        {...selectProps}
      >
        {children}
      </NativeSelect>
    </div>
  );
});

const RocketTools = memo(function RocketTools({
  open,
  achievementCount,
  message,
  debug,
  onToggle,
  onClose,
  onPreview,
  onAchievementCountChange
}) {
  const { t } = useI18n();
  const normalizedAchievementCount = normalizeAchievementCount(achievementCount);
  const changeAchievementCount = (value) => {
    onAchievementCountChange(normalizeAchievementCount(value));
  };

  return (
    <div className={`rocket-tools ${open ? "open" : ""}`}>
      {open ? (
        <div className="rocket-panel">
          <div className="rocket-panel-head">
            <strong>{t("tools.title")}</strong>
            <button type="button" aria-label={t("tools.close")} onClick={onClose}>×</button>
          </div>
          <div className="rocket-tool-row">
            <span>{t("tools.overlay")}</span>
            <button type="button" onClick={onPreview}>{t("tools.show")}</button>
          </div>
          <div className="rocket-tool-row rocket-count-row">
            <span>{t("tools.achievementCount")}</span>
            <div className="rocket-count-stepper">
              <button
                type="button"
                aria-label={t("tools.decrementAchievement")}
                disabled={normalizedAchievementCount <= 0}
                onClick={() => changeAchievementCount(normalizedAchievementCount - 1)}
              >
                -
              </button>
              <Input
                className="rocket-count-input"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                aria-label={t("tools.editAchievement")}
                value={normalizedAchievementCount}
                onChange={event => changeAchievementCount(event.currentTarget.value)}
              />
              <button
                type="button"
                aria-label={t("tools.incrementAchievement")}
                onClick={() => changeAchievementCount(normalizedAchievementCount + 1)}
              >
                +
              </button>
            </div>
          </div>
          {message ? <p className="rocket-message">{message}</p> : null}
          {debug ? (
            <pre className="rocket-debug">{formatRocketDebug(debug)}</pre>
          ) : null}
        </div>
      ) : null}
      <button className="rocket-toggle" type="button" aria-label={t("tools.open")} onClick={onToggle}>
        <img className="rocket-toggle-icon" src={goldenFingerIcon} alt="" aria-hidden="true" />
      </button>
    </div>
  );
});

function formatRocketDebug(debug) {
  if (!debug || typeof debug !== "object") return String(debug ?? "");

  const lines = [
    `ok: ${debug.ok}`,
    debug.phase ? `phase: ${debug.phase}` : "",
    debug.error ? `error: ${debug.error}` : "",
    debug.hint ? `hint: ${debug.hint}` : "",
    Number.isFinite(debug.elapsedMs) ? `elapsedMs: ${debug.elapsedMs}` : "",
    debug.route ? `route: ${debug.route}` : "",
    debug.location ? `location: ${debug.location}` : "",
    `label: ${debug.label ?? ""}`,
    `requestedUrl: ${debug.requestedUrl ?? ""}`,
    `fullUrl: ${debug.fullUrl ?? ""}`,
    `geometry: ${Math.round(Number(debug.logicalWidth ?? 0))}x${Math.round(Number(debug.logicalHeight ?? 0))} @ ${Math.round(Number(debug.logicalX ?? 0))},${Math.round(Number(debug.logicalY ?? 0))}`,
    `existingWindowDestroyed: ${debug.existingWindowDestroyed ?? ""}`,
    `buildOk: ${debug.buildOk ?? ""}`,
    `evalRequested: ${debug.evalRequested ?? ""}`,
    `mainWindowExists: ${debug.mainWindowExists ?? ""}`,
    `overlayWindowExists: ${debug.overlayWindowExists ?? ""}`,
    `previewWindowExists: ${debug.previewWindowExists ?? ""}`,
    `timestamp: ${debug.timestampUnixMs ? new Date(Number(debug.timestampUnixMs)).toISOString() : debug.time ?? ""}`,
    Array.isArray(debug.notes) && debug.notes.length ? `notes:\n${debug.notes.map(note => `- ${note}`).join("\n")}` : ""
  ];

  return lines.filter(Boolean).join("\n");
}

export {
  AchievementView,
  AiView,
  CalendarView,
  Header,
  InputPermissionOverlay,
  RocketTools,
  SettingsView,
  Tabs,
  TodayView
};
