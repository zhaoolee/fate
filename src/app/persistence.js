import Database from "@tauri-apps/plugin-sql";
import {
  latestAiStateFromHistory,
  load,
  normalizeAiKind,
  normalizeAiTipHistory,
  normalizeCalendarStats,
  normalizeSettings,
  save,
  shortTextTipCacheRefreshed,
  shortTextTipKinds,
  todayKey
} from "./domain";

const DB_PATH = "sqlite:fate.db";
let dbPromise = null;
let dbUnavailable = false;
let lastStatsPersistedAt = 0;

export async function getDb() {
  if (dbUnavailable) return null;
  if (!dbPromise) {
    dbPromise = Database.load(DB_PATH).catch(() => {
      dbUnavailable = true;
      return null;
    });
  }
  return dbPromise;
}

export async function loadPersistedState() {
  const db = await getDb();
  if (!db) return {};

  const patch = {};
  const settingsRows = await db.select("SELECT value FROM settings WHERE key = $1", ["app"]);
  if (settingsRows[0]?.value) {
    patch.settings = normalizeSettings(JSON.parse(settingsRows[0].value));
    save("fate:settings", patch.settings);
  }

  const todayRows = await db.select(
    "SELECT work_secs AS workSecs, rest_secs AS restSecs, reminder_count AS reminderCount FROM daily_stats WHERE day = $1",
    [todayKey()]
  );
  if (todayRows[0]) {
    patch.todayBase = {
      workSecs: Number(todayRows[0].workSecs ?? 0),
      restSecs: Number(todayRows[0].restSecs ?? 0),
      reminderCount: Number(todayRows[0].reminderCount ?? 0)
    };
  }

  const calendarRows = await db.select(
    "SELECT day, work_secs AS workSecs, rest_secs AS restSecs, reminder_count AS reminderCount FROM daily_stats ORDER BY day"
  );
  patch.calendarStats = normalizeCalendarStats(calendarRows);

  let historyRows = [];
  try {
    historyRows = await db.select(
      "SELECT id, kind, day, tips_json AS tipsJson, extra_prompt AS extraPrompt, model, base_url AS baseUrl, source, created_at AS createdAt FROM ai_tip_runs ORDER BY created_at DESC LIMIT 60"
    );
  } catch {
    try {
      historyRows = await db.select(
        "SELECT id, 'health' AS kind, day, tips_json AS tipsJson, extra_prompt AS extraPrompt, model, base_url AS baseUrl, source, created_at AS createdAt FROM health_tip_runs ORDER BY created_at DESC LIMIT 60"
      );
    } catch {
      historyRows = [];
    }
  }
  patch.aiHistory = normalizeAiTipHistory(historyRows);
  Object.assign(
    patch,
    latestAiStateFromHistory(
      patch.aiHistory,
      shortTextTipCacheRefreshed ? shortTextTipKinds : []
    )
  );

  return patch;
}

export async function persistSettingsToDb(settings) {
  const db = await getDb();
  if (!db) return;
  await db.execute(
    "INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    ["app", JSON.stringify(settings), Date.now()]
  );
}

export async function persistSnapshot(today) {
  const now = Date.now();
  if (now - lastStatsPersistedAt < 5000) return;
  lastStatsPersistedAt = now;

  const db = await getDb();
  if (!db) return;
  await db.execute(
    "INSERT INTO daily_stats (day, work_secs, rest_secs, reminder_count, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(day) DO UPDATE SET work_secs = excluded.work_secs, rest_secs = excluded.rest_secs, reminder_count = excluded.reminder_count, updated_at = excluded.updated_at",
    [todayKey(), today.workSecs, today.restSecs, today.reminderCount, now]
  );
}

export async function persistAiTipsRun(run) {
  const db = await getDb();
  if (!db) return;
  await db.execute(
    "INSERT INTO ai_tip_runs (kind, day, tips_json, extra_prompt, model, base_url, source, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [
      normalizeAiKind(run.kind),
      run.day,
      JSON.stringify(run.tips),
      run.extraPrompt,
      run.model,
      run.baseUrl,
      run.source,
      run.createdAt
    ]
  );
}

export async function replaceAiTipHistoryInDb(history) {
  const db = await getDb();
  if (!db) return;
  await db.execute("DELETE FROM ai_tip_runs");
  for (const run of history.slice().reverse()) {
    await persistAiTipsRun(run);
  }
}
