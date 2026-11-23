import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const worker = await readFile(new URL("../dist/sw.js", import.meta.url), "utf8");
const origin = "https://example.test";
const scope = origin + "/waypin/";

function setup(fetch) {
  const listeners = {};
  const cached = [];
  const installSteps = [];
  runInNewContext(worker, {
    URL, Request, Response, fetch, location: { origin },
    self: {
      registration: { scope },
      addEventListener(type, listener) { listeners[type] = listener; },
      skipWaiting() { installSteps.push("activate"); },
    },
    caches: {
      async open() {
        return {
          addAll(requests) {
            assert.ok(requests.every((request) => request.cache === "reload"));
            installSteps.push("precache");
          },
          match(path) {
            cached.push(path);
            return new Response("Offline: " + path);
          },
        };
      },
    },
  });
  function navigate(path) {
    let result;
    listeners.fetch({
      request: { mode: "navigate", method: "GET", url: scope + path },
      respondWith(response) { result = response; },
    });
    return result;
  }
  return { navigate, cached, installSteps, listeners };
}

test("an installed update takes over as soon as its assets are cached", async () => {
  const { installSteps, listeners } = setup(async () => new Response());
  let install;
  listeners.install({ waitUntil(result) { install = result; } });
  await install;
  assert.deepEqual(installSteps, ["precache", "activate"]);
});

test("studio navigation uses the network even when an older release cache exists", async () => {
  const { navigate, cached } = setup(async (request, options) => {
    assert.equal(options.cache, "reload");
    assert.equal(request.url, scope + "studio/?example=game");
    return new Response("New studio");
  });
  assert.equal(await (await navigate("studio/?example=game")).text(), "New studio");
  assert.deepEqual(cached, []);
});

test("offline and failed deploys fall back to the matching cached page", async () => {
  for (const fetch of [
    async () => { throw new TypeError("Offline"); },
    async () => new Response("Deployment unavailable", { status: 503 }),
  ]) {
    const { navigate, cached } = setup(fetch);
    for (const [path, page] of [
      ["", "index.html"],
      ["studio/?example=game", "studio/index.html"],
      ["studio/index.html", "studio/index.html"],
      ["audit/", "audit/index.html"],
      ["field-guide", "field-guide/index.html"],
    ]) {
      assert.equal(await (await navigate(path)).text(), "Offline: /waypin/" + page);
    }
    assert.equal(cached.length, 5);
    assert.equal(navigate("unknown/"), undefined);
  }
});
