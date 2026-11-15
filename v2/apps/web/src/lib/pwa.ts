import { useSyncExternalStore } from "react";

/** Sự kiện Chrome/Edge/Android bắn ra khi app đủ điều kiện cài. Safari không có. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Gọi một lần khi khởi động app. Chỉ đăng ký service worker ở bản build, không ở chế độ dev. */
export function setupPwa() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("[sw]", error));
    });
  }
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export type InstallState = "installed" | "prompt" | "ios" | "unavailable";

function snapshot(): InstallState {
  if (isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIos()) return "ios";
  return "unavailable";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Trạng thái cài app: có nút cài (Android, máy tính), hướng dẫn (iPhone) hoặc đã cài. */
export function useInstall(): { state: InstallState; install: () => Promise<void> } {
  const state = useSyncExternalStore(subscribe, snapshot);
  return {
    state,
    async install() {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      notify();
    },
  };
}
