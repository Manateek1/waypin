import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";

const pages = {
  audit: "Waypin — Field audit",
  "field-guide": "Waypin — Field guide",
  studio: "Toybox — Song Studio",
};
const shell = await readFile("dist/index.html", "utf8");
for (const [route, title] of Object.entries(pages)) {
  await mkdir("dist/" + route, { recursive: true });
  await writeFile("dist/" + route + "/index.html", shell.replace(/<title>.*?<\/title>/, "<title>" + title + "</title>"));
}

const files = (await readdir("dist", { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name !== "sw.js")
  .map(({ parentPath, name }) => (parentPath + "/" + name).replace(/\\/g, "/").replace(/^dist/, ""))
  .sort();
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile("dist" + file));
const name = "waypin-" + hash.digest("hex").slice(0, 12);
await writeFile("dist/sw.js", `
const cacheName = ${JSON.stringify(name)};
const scope = new URL(self.registration.scope).pathname;
const files = ${JSON.stringify(files)}.map((path) => scope + path.slice(1));
const routes = new Map(${JSON.stringify(["", ...Object.keys(pages)])}.flatMap((route) => {
  const directory = route ? route + "/" : "";
  const page = scope + directory + "index.html";
  return [[scope + route, page], [scope + directory, page], [page, page]];
}));
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(files.map((file) => new Request(new URL(file, self.registration.scope), { cache: "reload" })));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("waypin-") && name !== cacheName).map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin) return;
  const page = routes.get(url.pathname);
  if (request.mode === "navigate" && page) {
    event.respondWith((async () => {
      let response;
      try {
        response = await fetch(request, { cache: "reload" });
        if (response.ok) return response;
      } catch { /* Use the complete cached release while offline. */ }
      const cache = await caches.open(cacheName);
      return (await cache.match(page)) ?? response ?? Response.error();
    })());
  } else if (files.includes(url.pathname)) {
    event.respondWith(caches.open(cacheName).then((cache) => cache.match(request)).then((cached) => cached || fetch(request)));
  }
});
`);
