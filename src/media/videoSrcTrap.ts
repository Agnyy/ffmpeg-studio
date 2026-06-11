import { hasFailedNativePreview } from "./nativePreviewCache";

import { normalizePreviewCachePath } from "./nativePreviewCache";



function filePathFromMediaSrc(src: string): string | null {

  const trimmed = src.trim();

  if (!trimmed) {

    return null;

  }

  if (trimmed.startsWith("file://")) {

    try {

      const url = new URL(trimmed);

      let pathname = decodeURIComponent(url.pathname);

      if (/^\/[a-zA-Z]:/.test(pathname)) {

        pathname = pathname.slice(1);

      }

      return normalizePreviewCachePath(pathname);

    } catch {

      return null;

    }

  }

  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith("\\\\")) {

    return normalizePreviewCachePath(trimmed);

  }

  return null;

}



type MediaSrcKind = "original" | "proxy" | "blob" | "data" | "other";



function classifyMediaSrc(src: string, filePath: string | null): MediaSrcKind {

  const trimmed = src.trim();

  if (trimmed.startsWith("blob:")) {

    return "blob";

  }

  if (trimmed.startsWith("data:")) {

    return "data";

  }

  if (filePath) {

    const lower = filePath.toLowerCase();

    if (lower.includes("proxy") || lower.includes(".proxies")) {

      return "proxy";

    }

    return "original";

  }

  return "other";

}



function wouldChromiumGateBlock(filePath: string): boolean {

  return hasFailedNativePreview(filePath);

}



function logVideoSrcTrap(

  filePath: string | null,

  src: string,

  method: string,

  kind: MediaSrcKind

): void {

  const filename = filePath

    ? filePath.replace(/^.*[\\/]/, "")

    : src.slice(0, 80);

  const allowed = filePath ? !wouldChromiumGateBlock(filePath) : true;

  console.warn(

    `[VIDEO_SRC_TRAP] Chromium video src assigned\n` +

      `file: ${filename}\n` +

      `kind: ${kind}\n` +

      `allowed: ${allowed}\n` +

      `method: ${method}\n` +

      `src: ${src.slice(0, 120)}\n` +

      `stack:\n${new Error().stack ?? "(no stack)"}`

  );

}



function postTrapLog(payload: Record<string, unknown>): void {

  // #region agent log

  fetch("http://127.0.0.1:7400/ingest/4bd8dcf8-9a73-40e1-9eb2-acf915cc121b", {

    method: "POST",

    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d95e91" },

    body: JSON.stringify({ sessionId: "d95e91", ...payload, timestamp: Date.now() }),

  }).catch(() => {});

  // #endregion

}



function inspectMediaSrcAssignment(

  element: Element,

  src: string,

  method: string

): void {

  if (!(element instanceof HTMLMediaElement)) {

    return;

  }

  const filePath = filePathFromMediaSrc(src);

  const kind = classifyMediaSrc(src, filePath);

  logVideoSrcTrap(filePath, src, method, kind);

  postTrapLog({

    location: "videoSrcTrap.ts",

    message: "VIDEO_SRC_TRAP",

    hypothesisId: "trap-log-only",

    data: {

      file: filePath,

      filename: filePath ? filePath.replace(/^.*[\\/]/, "") : null,

      kind,

      allowed: filePath ? !wouldChromiumGateBlock(filePath) : true,

      method,

      tag: element.tagName,

      src: src.slice(0, 160),

      stack: new Error().stack,

    },

  });

}



let trapInstalled = false;



/** DEV-only: log local file assignments to &lt;video&gt; src (never blocks playback). */

export function installVideoSrcTrap(): void {

  if (trapInstalled) {

    return;

  }

  trapInstalled = true;



  const originalSetAttribute = Element.prototype.setAttribute;

  Element.prototype.setAttribute = function (

    this: Element,

    qualifiedName: string,

    value: string

  ) {

    if (

      qualifiedName.toLowerCase() === "src" &&

      typeof value === "string" &&

      value

    ) {

      inspectMediaSrcAssignment(this, value, "setAttribute");

    }

    return originalSetAttribute.call(this, qualifiedName, value);

  };



  const srcDescriptor = Object.getOwnPropertyDescriptor(

    HTMLMediaElement.prototype,

    "src"

  );

  if (srcDescriptor?.get && srcDescriptor?.set) {

    Object.defineProperty(HTMLMediaElement.prototype, "src", {

      configurable: true,

      enumerable: srcDescriptor.enumerable,

      get: srcDescriptor.get,

      set(this: HTMLMediaElement, value: string) {

        inspectMediaSrcAssignment(this, value, "src setter");

        srcDescriptor.set!.call(this, value);

      },

    });

  }

}


