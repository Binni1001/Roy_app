// Service worker của Roy Badminton v2.
// Mục tiêu: mở lại app tức thì và mở được khi mất mạng. Dữ liệu (API, Supabase) không bao giờ bị cache ở đây;
// phần đó do TanStack Query lo trong bộ nhớ của app.

const SHELL = "roy-shell-v1";
const ASSETS = "roy-assets-v1";
const FONTS = "roy-fonts-v1";
const KEEP = [SHELL, ASSETS, FONTS];
/** Mỗi lần build có file mới; giữ tối đa chừng này file cũ để cache không phình mãi. */
const MAX_ASSETS = 80;

const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icons/logo-96.webp",
  "/icons/logo-192.png",
  "/icons/favicon-48.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => !KEEP.includes(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

/** Trang HTML: lấy bản mới từ mạng; mất mạng thì dùng bản đã lưu để app vẫn mở được. */
async function navigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL);
      await cache.put("/", response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match("/");
    return cached ?? new Response("Không có mạng.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

/** File có mã băm trong tên (Vite) và font: không bao giờ đổi, lấy từ cache trước. */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    // keys() trả theo thứ tự thêm vào: xóa những file cũ nhất.
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((key) => cache.delete(key)));
  }
  return response;
}

/** Ảnh và file tĩnh khác: trả bản đã lưu ngay, đồng thời tải bản mới cho lần sau. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === "https://fonts.gstatic.com" || url.origin === "https://fonts.googleapis.com") {
    event.respondWith(cacheFirst(request, FONTS));
    return;
  }
  // API, Supabase và mọi nguồn khác: để trình duyệt tự xử lý, không đụng tới.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigation(request));
  } else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, ASSETS));
  } else if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(staleWhileRevalidate(request));
  }
});
