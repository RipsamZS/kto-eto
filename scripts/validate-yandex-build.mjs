import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const required of [
  '<script src="/sdk.js"></script>',
  '<script src="yandex-sdk.js"></script>',
  '<script src="online-client.js"></script>',
  "window.YandexGame?.init()"
]) {
  if (!html.includes(required)) throw new Error("Missing required integration: " + required);
}
for (const name of ["yandex-sdk.js", "online-client.js"]) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) throw new Error(name + " is missing");
  const temp = path.join(os.tmpdir(), "yandex-check-" + name.replace(/[^a-z0-9]/gi, "_") + ".js");
  fs.writeFileSync(temp, fs.readFileSync(file, "utf8"));
  const result = spawnSync(process.execPath, ["--check", temp], { encoding: "utf8" });
  fs.rmSync(temp, { force: true });
  if (result.status !== 0) throw new Error(name + " syntax error:\n" + result.stderr);
}
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .filter(match => match[1].trim().length > 0);
if (!inlineScripts.length) throw new Error("No inline game script found");
inlineScripts.forEach((match, index) => {
  const temp = path.join(os.tmpdir(), "yandex-inline-" + index + ".js");
  fs.writeFileSync(temp, match[1]);
  const result = spawnSync(process.execPath, ["--check", temp], { encoding: "utf8" });
  fs.rmSync(temp, { force: true });
  if (result.status !== 0) throw new Error("Inline script syntax error:\n" + result.stderr);
});
if (!html.includes("onlineGame.createRoom") || !html.includes("onlineGame.joinRoom")) {
  throw new Error("Multiplayer room controls are missing");
}
if (!/id="onlineGamePanel"[^>]*style="[^"]*display:\s*none/.test(html)) {
  throw new Error("Multiplayer panel must stay hidden in single-player mode");
}
console.log("Yandex build validation passed.");
