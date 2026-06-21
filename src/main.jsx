import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import BreakOverlay from "./BreakOverlay";
import { currentRoute, defaultSettings, load, normalizeAppearanceMode, normalizeLanguageMode, normalizeSettings } from "./app/domain";
import { languageLocales, resolveLanguage } from "./app/i18n";
import "./styles.css";

const route = currentRoute();
const appRoot = document.querySelector("#app");
const settings = normalizeSettings(load("fate:settings", defaultSettings));
const appearanceMode = normalizeAppearanceMode(settings.appearanceMode);
const languageMode = normalizeLanguageMode(settings.languageMode);
const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
const theme = appearanceMode === "system" && prefersDark ? "dark" : appearanceMode === "dark" ? "dark" : "light";

document.documentElement.dataset.appearanceMode = appearanceMode;
document.documentElement.dataset.theme = theme;
document.documentElement.style.colorScheme = theme;
document.documentElement.dataset.languageMode = languageMode;
document.documentElement.lang = languageMode === "system" ? languageLocales[resolveLanguage("system")] : languageLocales[languageMode];

if (route === "overlay") {
  document.body.classList.add("overlay-page");
  appRoot.classList.add("overlay-root");
}

createRoot(appRoot).render(route === "overlay" ? <BreakOverlay /> : <App />);
