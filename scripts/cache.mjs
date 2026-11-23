import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";

for (const route of ["audit", "field-guide", "studio"]) {
  await mkdir("dist/" + route, { recursive: true });
  await copyFile("dist/index.html", "dist/" + route + "/index.html");
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
self.addEventListener("install", (event) => {
  // Keep open pages on their current version until they have all closed.
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(files)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("waypin-") && name !== cacheName).map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin) return;
  if (request.mode === "navigate" && !url.search && ["", "audit", "audit/", "field-guide", "field-guide/", "studio", "studio/"].some((route) => url.pathname === scope + route)) {
    event.respondWith(caches.open(cacheName).then((cache) => cache.match(scope + "index.html")).then((cached) => cached || fetch(request)));
  } else if (files.includes(url.pathname)) {
    event.respondWith(caches.open(cacheName).then((cache) => cache.match(request)).then((cached) => cached || fetch(request)));
  }
});
`);
