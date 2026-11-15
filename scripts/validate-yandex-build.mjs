import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sdkPath = path.join(root, "yandex-sdk.js");

for (const required of [
  '<script src="/sdk.js"></script>',
  '<script src="yandex-sdk.js"></script>',
  'window.YandexGame?.init()'
]) {
  if (!html.includes(required)) throw new Error("Missing required Yandex integration: " + required);
}
if (!fs.existsSync(sdkPath)) throw new Error("yandex-sdk.js is missing");
if (/socket\.io|online-client\.js/.test(html)) {
  throw new Error("Yandex archive must not load the unconfigured Socket.IO multiplayer client");
}

function checkJavaScript(source, name) {
  const file = path.join(os.tmpdir(), "yandex-check-" + name.replace(/[^a-z0-9]/gi, "_") + ".js");
  fs.writeFileSync(file, source);
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  fs.rmSync(file, { force: true });
  if (result.status !== 0) throw new Error(name + " syntax error:\n" + result.stderr);
}

checkJavaScript(fs.readFileSync(sdkPath, "utf8"), "yandex-sdk.js");

const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .filter(match => match[1].trim().length > 0);

if (!inlineScripts.length) throw new Error("No inline game script found");

inlineScripts.forEach((match, index) => {
  checkJavaScript(match[1], "inline-" + index);
});

console.log("Yandex build validation passed.");
