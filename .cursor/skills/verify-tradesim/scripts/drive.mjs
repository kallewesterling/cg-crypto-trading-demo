#!/usr/bin/env node
// Drive a verification TradeSim instance through system Chrome's DevTools port.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function assertChromeCanLaunch() {
  // Seatbelt denies the WindowServer mach lookup. Chrome then aborts in
  // _RegisterApplication and macOS shows "Google Chrome quit unexpectedly".
  if (process.env.CURSOR_SANDBOX) {
    throw new Error(
      "Refusing to launch Chrome while CURSOR_SANDBOX is set. The seatbelt sandbox blocks WindowServer registration, so Google Chrome aborts on startup and macOS shows \"Google Chrome quit unexpectedly\". Rerun drive.mjs start with the sandbox disabled."
    );
  }
}

function chromeBinary() {
  const candidates = [
    process.env.CHROME,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/local/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("Chrome not found. Set CHROME to the browser binary.");
  }
  return found;
}
const STATE_DIR = process.env.TRADESIM_VERIFY_STATE_DIR || "/tmp/tradesim-verify";

function usage() {
  console.log(`Usage: drive.mjs --port PORT <command>

  start
  goto PATH
  click --role ROLE --name NAME
  fill --role textbox --name NAME --value VALUE
  wait --text TEXT
  snapshot --out FILE
  screenshot --out FILE
  stop
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = value;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function statePath(port) {
  return `${STATE_DIR}/browser-${port}.env`;
}

async function readState(port) {
  const text = await readFile(statePath(port), "utf8");
  const state = {};
  for (const line of text.split("\n")) {
    const index = line.indexOf("=");
    if (index === -1) continue;
    state[line.slice(0, index)] = line.slice(index + 1);
  }
  return state;
}

async function writeState(port, state) {
  const body = Object.entries(state)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await writeFile(statePath(port), `${body}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLoad(session, url) {
  const path = new URL(url).pathname;
  for (let attempt = 0; attempt < 360; attempt += 1) {
    try {
      const info = await session.evaluate(
        `({ path: location.pathname, ready: document.readyState })`
      );
      if (info && info.ready === "complete" && info.path === path) {
        return;
      }
    } catch {
      // Page.navigate is still swapping the document.
    }
    await sleep(250);
  }
  throw new Error(`Timed out loading ${url}`);
}

async function waitForJson(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // Chrome is still starting.
    }
    await sleep(100);
  }
  throw new Error(`Chrome DevTools did not answer at ${url}`);
}

class Page {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, arg) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      ...(arg === undefined
        ? {}
        : { expression: `(${expression})(${JSON.stringify(arg)})` }),
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text
      );
    }
    return result.result?.value;
  }
}

const FIND_SCRIPT = `async (request) => {
  const interesting = (element) => {
    const role = element.getAttribute("role");
    const tag = element.tagName.toLowerCase();
    if (request.role === "link") return tag === "a" || role === "link";
    if (request.role === "button") {
      return tag === "button" || role === "button" || (tag === "input" && element.type === "submit");
    }
    if (request.role === "textbox") {
      return role === "textbox" || tag === "textarea" || (tag === "input" && !["hidden", "checkbox", "radio", "submit", "button"].includes(element.type));
    }
    return role === request.role;
  };
  const accessibleName = (element) => {
    const labelled = element.getAttribute("aria-label");
    if (labelled) return labelled.trim();
    if (element.id) {
      const label = document.querySelector(\`label[for="\${CSS.escape(element.id)}"]\`);
      if (label) return label.innerText.trim();
    }
    const wrapping = element.closest("label");
    if (wrapping) return wrapping.innerText.trim();
    return (element.innerText || element.getAttribute("placeholder") || element.value || "").trim();
  };
  const element = [...document.querySelectorAll("a,button,input,textarea,select,[role]")].find((candidate) => {
    return interesting(candidate) && accessibleName(candidate) === request.name;
  });
  if (!element) {
    const names = [...document.querySelectorAll("a,button,input,textarea,label")].map((candidate) => accessibleName(candidate)).filter(Boolean);
    throw new Error(\`No \${request.role} named "\${request.name}". Visible names: \${names.join(" | ")}\`);
  }
  if (element.disabled || element.getAttribute("aria-disabled") === "true") {
    throw new Error(\`\${request.role} named "\${request.name}" is disabled\`);
  }
  element.scrollIntoView({ block: "center" });
  if (request.value !== undefined) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(prototype.prototype, "value").set;
    setter.call(element, request.value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return { action: "fill", name: accessibleName(element) };
  }
  if (element.tagName === "A" && element.href) {
    return { action: "navigate", href: element.href, name: accessibleName(element) };
  }
  if (element.tagName === "BUTTON" && element.type === "submit" && element.form) {
    element.form.requestSubmit(element);
    return { action: "submit", name: accessibleName(element) };
  }
  element.click();
  return { action: "click", name: accessibleName(element) };
}`;

async function connect(port) {
  const state = await readState(port);
  const list = await fetch(`http://127.0.0.1:${state.CDP_PORT}/json/list`).then((response) =>
    response.json()
  );
  const page = list.find((target) => target.type === "page");
  if (!page) throw new Error("Chrome has no page target");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const session = new Page(ws);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  return { session, ws, state };
}

async function start(port) {
  assertChromeCanLaunch();
  const cdpPort = String(10000 + Number(port));
  const userDataDir = `${STATE_DIR}/chrome-${port}`;
  await mkdir(userDataDir, { recursive: true });
  const chrome = spawn(
    chromeBinary(),
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { detached: true, stdio: "ignore" }
  );
  chrome.unref();
  await waitForJson(`http://127.0.0.1:${cdpPort}/json/version`);
  await writeState(port, {
    APP_PORT: String(port),
    CDP_PORT: cdpPort,
    CHROME_PID: String(chrome.pid),
    PGID: String(chrome.pid),
  });
  console.log(`CHROME_PID=${chrome.pid}`);
  console.log(`CDP_PORT=${cdpPort}`);
}

async function stop(port) {
  let state = {};
  try {
    state = await readState(port);
  } catch {
    state = {};
  }
  const pid = Number(state.CHROME_PID);
  const pgid = Number(state.PGID || state.CHROME_PID);
  if (pgid) {
    try {
      process.kill(-pgid, "SIGTERM");
    } catch {
      // Already gone, or this pid is not a process-group leader.
    }
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!pid) break;
    try {
      process.kill(pid, 0);
      await sleep(100);
    } catch {
      break;
    }
  }
  if (pgid) {
    try {
      process.kill(-pgid, "SIGKILL");
    } catch {
      // The group has already exited.
    }
  }
  await rm(statePath(port), { force: true });
  await rm(`${STATE_DIR}/chrome-${port}`, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
  console.log(`Stopped Chrome pid ${state.CHROME_PID || "unknown"}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const port = args.port;
  const command = args._[0];
  if (!port || !command) {
    usage();
    process.exit(1);
  }

  if (command === "start") {
    await start(port);
    return;
  }
  if (command === "stop") {
    await stop(port);
    return;
  }

  const { session, ws } = await connect(port);
  try {
    if (command === "goto") {
      const path = args._[1] || "/";
      const url = `http://127.0.0.1:${port}${path.startsWith("/") ? path : `/${path}`}`;
      await session.send("Page.navigate", { url });
      await waitForLoad(session, url);
      console.log(url);
    } else if (command === "click") {
      const result = await session.evaluate(FIND_SCRIPT, {
        role: args.role,
        name: args.name,
      });
      if (result?.action === "navigate" && result.href) {
        await session.send("Page.navigate", { url: result.href });
        await waitForLoad(session, result.href);
      }
      console.log(`clicked ${args.role} ${args.name}`);
    } else if (command === "fill") {
      await session.evaluate(FIND_SCRIPT, {
        role: args.role || "textbox",
        name: args.name,
        value: args.value,
      });
      console.log(`filled ${args.name}`);
    } else if (command === "wait") {
      const text = args.text;
      let found = false;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const body = await session.evaluate(
          "document.body ? document.body.innerText : ''"
        );
        if (typeof body === "string" && body.includes(text)) {
          found = true;
          break;
        }
        await sleep(250);
      }
      if (!found) throw new Error(`Timed out waiting for ${text}`);
      console.log(`saw ${text}`);
    } else if (command === "snapshot") {
      await session.send("Accessibility.enable");
      const tree = await session.send("Accessibility.getFullAXTree");
      const nodes = new Map(tree.nodes.map((node) => [node.nodeId, node]));
      const lines = [];
      const visit = (nodeId, depth) => {
        const node = nodes.get(nodeId);
        if (!node) return;
        const role = node.role?.value || "";
        const name = node.name?.value || "";
        const disabled = (node.properties || []).some(
          (prop) => prop.name === "disabled" && prop.value?.value
        );
        if (role && role !== "none" && role !== "generic" && role !== "InlineTextBox") {
          lines.push(
            `${"  ".repeat(depth)}${role}${name ? ` "${name}"` : ""}${disabled ? " disabled" : ""}`
          );
        }
        for (const childId of node.childIds || []) visit(childId, depth + 1);
      };
      const root = tree.nodes.find((node) => !node.parentId) || tree.nodes[0];
      if (root) visit(root.nodeId, 0);
      await mkdir(dirname(args.out), { recursive: true });
      await writeFile(args.out, `${lines.join("\n")}\n`);
      console.log(args.out);
    } else if (command === "screenshot") {
      const shot = await session.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
      });
      await mkdir(dirname(args.out), { recursive: true });
      await writeFile(args.out, Buffer.from(shot.data, "base64"));
      console.log(args.out);
    } else {
      usage();
      process.exit(1);
    }
  } finally {
    ws.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
