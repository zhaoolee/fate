import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  currentWindowInfo,
  defaultBreakTip,
  deskDecorBackgrounds,
  load,
  normalizeDeskBackgroundIndex
} from "./app/domain";
import { useStableImageSrc } from "./app/images";

const BreakOverlay = memo(function BreakOverlay() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const deskBackgroundUrl = useMemo(() => {
    const backgroundIndex = normalizeDeskBackgroundIndex(load("fate:deskBackgroundIndex", -1));
    return deskDecorBackgrounds[backgroundIndex] ?? "";
  }, []);
  const [stableDeskBackgroundUrl, handleDeskBackgroundError] = useStableImageSrc(deskBackgroundUrl);
  const [{ window: overlayWindow, label }] = useState(currentWindowInfo);
  const isPreview = params.get("preview") === "1";
  const [selectedTip, setSelectedTip] = useState(() => params.get("tip") || defaultBreakTip);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const closedRef = useRef(false);
  const closingRef = useRef(false);

  const returnToMain = useCallback(() => {
    closedRef.current = true;
    window.location.replace("index.html");
  }, []);

  const closeOverlay = useCallback(async () => {
    if (closedRef.current || closingRef.current) return;
    if (label === "main") {
      returnToMain();
      return;
    }

    closingRef.current = true;
    try {
      await invoke(isPreview ? "close_break_overlay_preview" : "complete_break_reminder");
      closedRef.current = true;
    } catch (error) {
      console.error(error);
    }

    if (!closedRef.current && overlayWindow) {
      try {
        await overlayWindow.close();
        closedRef.current = true;
      } catch (error) {
        console.error(error);
      }
    }
    closingRef.current = false;
  }, [isPreview, label, overlayWindow, returnToMain]);

  useEffect(() => {
    if (label === "main") {
      returnToMain();
    }
  }, [label, returnToMain]);

  useEffect(() => {
    if (params.get("tip")) return undefined;

    let cancelled = false;
    invoke("get_break_overlay_tip")
      .then(tip => {
        if (!cancelled && typeof tip === "string" && tip.trim()) {
          setSelectedTip(tip);
        }
      })
      .catch(error => console.error(error));

    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (label === "main") return undefined;
    const timer = setInterval(() => {
      setSecondsLeft(previous => {
        const next = previous - 1;
        if (next <= 0) {
          clearInterval(timer);
          closeOverlay();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [closeOverlay, label]);

  return (
    <main className="break-overlay">
      {stableDeskBackgroundUrl ? (
        <div
          aria-hidden="true"
          className="break-background"
        >
          <img
            className="break-background-image"
            src={stableDeskBackgroundUrl}
            alt=""
            decoding="async"
            onError={() => handleDeskBackgroundError(stableDeskBackgroundUrl)}
          />
        </div>
      ) : null}
      <div className="break-copy">
        <p className="eyebrow">Fate</p>
        <h1>休息一下</h1>
        <p>{selectedTip}</p>
        <div className="countdown"><span>{secondsLeft}</span>s</div>
        <button className="break-close" type="button" onClick={closeOverlay}>关闭提醒</button>
      </div>
    </main>
  );
});

export default BreakOverlay;
