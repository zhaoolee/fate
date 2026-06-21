import { useCallback, useEffect, useRef, useState } from "react";

const imageCache = new Map();

export function preloadImage(src) {
  if (!src) return Promise.reject(new Error("Missing image source"));

  const cached = imageCache.get(src);
  if (cached?.status === "loaded") return Promise.resolve(src);
  if (cached?.promise) return cached.promise;

  const image = new Image();
  image.decoding = "async";

  const promise = new Promise((resolve, reject) => {
    image.onload = () => {
      imageCache.set(src, { status: "loaded", image, promise: Promise.resolve(src) });
      resolve(src);
    };
    image.onerror = () => {
      imageCache.delete(src);
      reject(new Error(`Failed to load image: ${src}`));
    };
  });

  imageCache.set(src, { status: "loading", image, promise });
  image.src = src;
  return promise;
}

export function preloadImages(sources) {
  for (const src of sources) {
    preloadImage(src).catch(() => {});
  }
}

export function useStableImageSrc(src) {
  const [stableSrc, setStableSrc] = useState("");
  const previousGoodSrcRef = useRef("");

  useEffect(() => {
    const nextSrc = String(src ?? "");

    if (!nextSrc) {
      previousGoodSrcRef.current = "";
      setStableSrc("");
      return undefined;
    }

    let cancelled = false;
    preloadImage(nextSrc)
      .then(() => {
        if (cancelled) return;
        setStableSrc(current => {
          if (current && current !== nextSrc) previousGoodSrcRef.current = current;
          return nextSrc;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [src]);

  const handleImageError = useCallback((failedSrc) => {
    imageCache.delete(failedSrc);
    setStableSrc(current => {
      if (current !== failedSrc) return current;
      return previousGoodSrcRef.current && previousGoodSrcRef.current !== failedSrc ? previousGoodSrcRef.current : "";
    });
  }, []);

  return [stableSrc, handleImageError];
}
