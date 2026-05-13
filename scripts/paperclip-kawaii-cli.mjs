#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import os from "node:os";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const homeDir = os.homedir();
const stateRoot = join(homeDir, ".paperclip-kawaii");
const runPidFile = join(stateRoot, "run.pid");
const runLogFile = join(stateRoot, "run.log");
const worktreesDir = join(stateRoot, "worktrees");
const codexLogDir = join(stateRoot, "logs", "codex");
const launchdLabel = "com.paperclip.kawaii";
const launchdPlistPath = join(homeDir, "Library", "LaunchAgents", `${launchdLabel}.plist`);
const launchdOutLogFile = join(stateRoot, "launchd.out.log");
const launchdErrLogFile = join(stateRoot, "launchd.err.log");
const defaultInstance = "default";
const defaultPort = 3101;
const defaultPortRangeEnd = 3199;
const defaultHost = "0.0.0.0";

const routesForScreenshots = [
  ["dashboard", "/dashboard"],
  ["staff", "/agents"],
  ["approvals", "/approvals"],
  ["settings", "/settings"],
];

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  mkdirSync(stateRoot, { recursive: true });

  switch (command) {
    case "run":
    case "start":
      await startCommand(options);
      return;
    case "serve":
      await serveCommand(options);
      return;
    case "stop":
      await stopCommand(options);
      return;
    case "restart":
      await stopCommand({ ...options, quiet: true });
      await startCommand(options);
      return;
    case "status":
      await statusCommand(options);
      return;
    case "doctor":
      await doctorCommand(options);
      return;
    case "upgrade-check":
      await upgradeCheckCommand(options);
      return;
    case "upgrade":
      await upgradeCommand(options);
      return;
    case "screenshots":
      await screenshotsCommand(options);
      return;
    case "launchd":
      await launchdCommand(options);
      return;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
    default:
      throw new Error(`Unknown command '${command}'. Run ./paperclip-kawaii help.`);
  }
}

function parseArgs(argv) {
  if (argv[0] === "--help" || argv[0] === "-h") {
    return { command: "help", options: { _: [] } };
  }

  const command = argv[0] && !argv[0].startsWith("-") ? argv[0] : "run";
  const rest = command === "run" && (argv[0]?.startsWith("-") || argv.length === 0) ? argv : argv.slice(1);
  const options = { _: [] };

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) {
      options._.push(token);
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = rawKey.replaceAll("-", "_");
    if (inlineValue !== undefined) {
      options[key] = inlineValue;
      continue;
    }

    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    i += 1;
  }

  return { command, options };
}

function printHelp() {
  console.log(`paperclip-kawaii

Usage:
  ./paperclip-kawaii run [--port 3101] [--host 0.0.0.0] [--instance default]
  ./paperclip-kawaii serve [--port 3101] [--host 0.0.0.0] [--instance default]
  ./paperclip-kawaii stop [--port 3101]
  ./paperclip-kawaii restart
  ./paperclip-kawaii status
  ./paperclip-kawaii doctor
  ./paperclip-kawaii upgrade-check
  ./paperclip-kawaii upgrade [--yes] [--force] [--fast] [--skip-codex]
  ./paperclip-kawaii screenshots [--url http://localhost:3100]
  ./paperclip-kawaii launchd install [--port 3101] [--host 0.0.0.0]
  ./paperclip-kawaii launchd status
  ./paperclip-kawaii launchd restart
  ./paperclip-kawaii launchd uninstall

Notes:
  - run builds the static kawaii UI first, then starts Paperclip without Vite middleware.
  - serve runs in the foreground and is intended for launchd.
  - launchd install registers this repo as a user LaunchAgent that restarts on login/crash.
  - upgrade prepares a tested worktree under ~/.paperclip-kawaii/worktrees.
  - Image generation stages stay in .codex-llm/pipeline.json.
  - Upgrade repair stages read .codex-llm/upgrade-pipeline.json and .codex-llm/models.json.
`);
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
}

function optionNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function resolveRuntimeOptions(options = {}) {
  const instance = String(options.instance ?? process.env.PAPERCLIP_INSTANCE_ID ?? defaultInstance);
  const paperclipHome = resolve(String(options.home ?? process.env.PAPERCLIP_HOME ?? join(homeDir, ".paperclip")));
  const config =
    options.config
      ? resolve(String(options.config))
      : resolve(paperclipHome, "instances", instance, "config.json");
  const port = resolveRuntimePort(options);
  const host = String(options.host ?? process.env.HOST ?? defaultHost);
  const bind = String(options.bind ?? (host === "0.0.0.0" ? "lan" : "loopback"));
  const publicUrl = String(
    options.public_url ??
      process.env.PAPERCLIP_PUBLIC_URL ??
      process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL ??
      process.env.BETTER_AUTH_URL ??
      defaultPublicUrl(port),
  );

  return { instance, paperclipHome, config, port, host, bind, publicUrl };
}

function resolveRuntimePort(options = {}) {
  const configured = options.port ?? process.env.PORT;
  if (configured !== undefined) return optionNumber(configured, defaultPort);

  for (let port = defaultPort; port <= defaultPortRangeEnd; port += 1) {
    if (portPids(port).length === 0) return port;
  }

  return defaultPort;
}

function buildRuntimeEnv(options = {}) {
  const runtime = resolveRuntimeOptions(options);
  const deploymentMode =
    options.deployment_mode ??
    process.env.PAPERCLIP_DEPLOYMENT_MODE ??
    (runtime.bind === "loopback" ? undefined : "authenticated");
  const deploymentExposure =
    options.deployment_exposure ??
    process.env.PAPERCLIP_DEPLOYMENT_EXPOSURE ??
    (deploymentMode === "authenticated" ? "private" : undefined);
  const env = {
    ...process.env,
    PAPERCLIP_HOME: runtime.paperclipHome,
    PAPERCLIP_INSTANCE_ID: runtime.instance,
    PAPERCLIP_CONFIG: runtime.config,
    PAPERCLIP_BIND: runtime.bind,
    PAPERCLIP_PUBLIC_URL: runtime.publicUrl,
    PAPERCLIP_AUTH_PUBLIC_BASE_URL: runtime.publicUrl,
    PAPERCLIP_UI_DEV_MIDDLEWARE: "false",
    PAPERCLIP_OPEN_ON_LISTEN: "false",
    BETTER_AUTH_URL: runtime.publicUrl,
    BETTER_AUTH_BASE_URL: runtime.publicUrl,
    SERVE_UI: "true",
    HOST: runtime.host,
    PORT: String(runtime.port),
  };
  if (deploymentMode) env.PAPERCLIP_DEPLOYMENT_MODE = String(deploymentMode);
  if (deploymentExposure) env.PAPERCLIP_DEPLOYMENT_EXPOSURE = String(deploymentExposure);
  return env;
}

function defaultPublicUrl(port) {
  const tailscaleIp = detectTailscaleIp();
  return tailscaleIp ? `http://${tailscaleIp}:${port}` : `http://localhost:${port}`;
}

function commandResult(command, args = [], opts = {}) {
  const result = spawnSync(command, args, {
    cwd: opts.cwd ?? repoRoot,
    env: opts.env ?? process.env,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: opts.timeout_ms ?? opts.timeoutMs,
    stdio: opts.stdio ?? "pipe",
  });

  const status = result.status ?? (result.error ? 1 : 0);
  if (opts.check !== false && status !== 0) {
    const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
    const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
    const detail = stderr || stdout || result.error?.message || `exit ${status}`;
    throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
  }

  return {
    status,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
    signal: result.signal,
    error: result.error,
  };
}

function run(command, args = [], opts = {}) {
  console.log(`$ ${[command, ...args].join(" ")}`);
  return commandResult(command, args, { ...opts, stdio: opts.stdio ?? "inherit" });
}

function capture(command, args = [], opts = {}) {
  return commandResult(command, args, { ...opts, stdio: "pipe" });
}

function commandExists(command) {
  const result = capture("sh", ["-lc", `command -v ${shellQuote(command)}`], { check: false });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

async function startCommand(options = {}) {
  const runtime = resolveRuntimeOptions(options);
  await stopCommand({ ...options, quiet: true });

  if (!options.no_build) {
    console.log("Building static kawaii UI...");
    run("pnpm", ["--filter", "@paperclipai/ui", "build"], {
      env: { ...process.env, CI: "1" },
    });
  } else if (!existsSync(join(repoRoot, "ui", "dist", "index.html"))) {
    throw new Error("ui/dist/index.html is missing. Re-run without --no-build.");
  }

  if (!existsSync(runtime.config)) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error(
        `No Paperclip config found at ${runtime.config}. Run ./paperclip-kawaii serve once in a terminal to complete onboarding.`,
      );
    }
    console.log("No Paperclip config found. Starting foreground onboarding instead of detached background mode.");
    await serveCommand({ ...options, no_build: true });
    return;
  }

  const out = openSync(runLogFile, "a");
  const env = buildRuntimeEnv(options);
  const args = ["paperclipai", "run", "--instance", runtime.instance, "--bind", runtime.bind];
  if (options.config) args.push("--config", runtime.config);

  writeFileSync(
    runLogFile,
    `\n\n# paperclip-kawaii start ${new Date().toISOString()}\n` +
      `repo=${repoRoot}\nconfig=${runtime.config}\nhost=${runtime.host}\nport=${runtime.port}\n`,
    { flag: "a" },
  );

  const child = spawn("pnpm", args, {
    cwd: repoRoot,
    detached: true,
    env,
    stdio: ["ignore", out, out],
  });
  child.unref();
  writeFileSync(runPidFile, `${child.pid}\n`);

  console.log(`Started Paperclip process group ${child.pid}`);
  await waitForHealth(`http://localhost:${runtime.port}/api/health`, 60_000);
  printRuntimeUrls(runtime.port);
  console.log(`Log: ${runLogFile}`);
}

async function serveCommand(options = {}) {
  const runtime = resolveRuntimeOptions(options);
  if (!options.build && !options.no_build && !existsSync(join(repoRoot, "ui", "dist", "index.html"))) {
    throw new Error("ui/dist/index.html is missing. Run ./paperclip-kawaii run once or use launchd install without --no-build.");
  }

  if (options.build && !options.no_build) {
    console.log("Building static kawaii UI...");
    run("pnpm", ["--filter", "@paperclipai/ui", "build"], {
      env: { ...process.env, CI: "1" },
    });
  }

  writeFileSync(
    runLogFile,
    `\n\n# paperclip-kawaii serve ${new Date().toISOString()}\n` +
      `repo=${repoRoot}\nconfig=${runtime.config}\nhost=${runtime.host}\nport=${runtime.port}\n`,
    { flag: "a" },
  );
  writeFileSync(runPidFile, `${process.pid}\n`);

  const env = buildRuntimeEnv(options);
  const args = ["paperclipai", "run", "--instance", runtime.instance, "--bind", runtime.bind];
  if (options.config) args.push("--config", runtime.config);

  console.log(`Serving Paperclip Kawaii on ${runtime.host}:${runtime.port}`);
  printRuntimeUrls(runtime.port);

  const child = spawn("pnpm", args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });

  let shuttingDown = false;
  const forwardSignal = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      child.kill(signal);
    } catch {
      // Ignore if already exited.
    }
  };

  process.once("SIGTERM", () => forwardSignal("SIGTERM"));
  process.once("SIGINT", () => forwardSignal("SIGINT"));

  const status = await new Promise((resolveChild) => {
    child.on("exit", (code, signal) => {
      resolveChild(code ?? signalToExitCode(signal));
    });
    child.on("error", (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      resolveChild(1);
    });
  });

  rmSync(runPidFile, { force: true });
  process.exitCode = status;
}

function signalToExitCode(signal) {
  if (!signal) return 1;
  const numbers = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 };
  return 128 + (numbers[signal] ?? 1);
}

async function stopCommand(options = {}) {
  const runtime = resolveRuntimeOptions(options);
  if (!options.no_launchd && process.platform === "darwin" && isLaunchdLoaded()) {
    if (!options.quiet) console.log(`Unloading launchd service ${launchdLabel}`);
    launchdUnload({ check: false });
  }

  const pid = readPid(runPidFile);
  if (pid && isProcessAlive(pid)) {
    if (!options.quiet) console.log(`Stopping Paperclip process group ${pid}`);
    await terminatePidGroup(pid);
  }

  const pids = portPids(runtime.port).filter((candidate) => candidate !== process.pid);
  if (pids.length > 0) {
    if (!options.quiet) console.log(`Stopping processes on port ${runtime.port}: ${pids.join(", ")}`);
    for (const portPid of pids) {
      try {
        process.kill(portPid, "SIGTERM");
      } catch {
        // Ignore stale pids.
      }
    }
    await delay(1000);
    for (const portPid of pids) {
      if (!isProcessAlive(portPid)) continue;
      try {
        process.kill(portPid, "SIGKILL");
      } catch {
        // Ignore stale pids.
      }
    }
  }

  rmSync(runPidFile, { force: true });
  if (!options.quiet) console.log("Stopped.");
}

function readPid(filePath) {
  try {
    const raw = readFileSync(filePath, "utf8").trim();
    const pid = Number(raw);
    return Number.isInteger(pid) && pid > 1 ? pid : null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function terminatePidGroup(pid) {
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    try {
      process.kill(-pid, signal);
    } catch {
      try {
        process.kill(pid, signal);
      } catch {
        // Ignore stale pids.
      }
    }
    await delay(signal === "SIGTERM" ? 1500 : 250);
    if (!isProcessAlive(pid)) return;
  }
}

function portPids(port) {
  const result = capture("lsof", ["-ti", `tcp:${port}`], { check: false });
  return result.stdout
    .split(/\s+/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 1);
}

async function waitForHealth(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const healthy = await isHealthy(url);
    if (healthy) return;
    await delay(1000);
  }

  const tail = tailFile(runLogFile, 60);
  throw new Error(`Paperclip did not become healthy at ${url}.\nLast log lines:\n${tail}`);
}

async function isHealthy(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function tailFile(filePath, lines) {
  try {
    return readFileSync(filePath, "utf8").split(/\r?\n/).slice(-lines).join("\n");
  } catch {
    return "";
  }
}

function printRuntimeUrls(port) {
  console.log(`Local URL: http://localhost:${port}`);
  const tailscaleIp = detectTailscaleIp();
  if (tailscaleIp) console.log(`Tailscale URL: http://${tailscaleIp}:${port}`);
}

function detectTailscaleIp() {
  if (!commandExists("tailscale")) return "";
  const result = capture("tailscale", ["ip", "-4"], { check: false });
  return result.stdout.split(/\s+/).find(Boolean) ?? "";
}

async function statusCommand(options = {}) {
  const runtime = resolveRuntimeOptions(options);
  const pid = readPid(runPidFile);
  const healthy = await isHealthy(`http://localhost:${runtime.port}/api/health`);
  const branch = capture("git", ["branch", "--show-current"], { check: false }).stdout.trim() || "(detached)";
  const commit = capture("git", ["rev-parse", "--short", "HEAD"], { check: false }).stdout.trim() || "unknown";

  console.log(`Repo: ${repoRoot}`);
  console.log(`Branch: ${branch} @ ${commit}`);
  console.log(`Config: ${runtime.config}`);
  console.log(`PID file: ${runPidFile}`);
  console.log(`Server PID: ${pid ?? "(none)"}`);
  console.log(`Port ${runtime.port}: ${portPids(runtime.port).join(", ") || "(none)"}`);
  console.log(`Health: ${healthy ? "ok" : "not reachable"}`);
  if (process.platform === "darwin") {
    console.log(`LaunchAgent: ${isLaunchdLoaded() ? "loaded" : "not loaded"}`);
    console.log(`LaunchAgent plist: ${launchdPlistPath}`);
  }
  printRuntimeUrls(runtime.port);
  console.log(`Log: ${runLogFile}`);
}

async function doctorCommand(options = {}) {
  const runtime = resolveRuntimeOptions(options);
  const rows = [];
  const check = (label, ok, detail = "") => rows.push({ label, ok, detail });

  check("repo root", existsSync(join(repoRoot, ".git")), repoRoot);
  check("pnpm", commandExists("pnpm"), capture("pnpm", ["--version"], { check: false }).stdout.trim());
  check("codex", commandExists("codex"), capture("codex", ["--version"], { check: false }).stdout.trim());
  check("config", existsSync(runtime.config), runtime.config);
  check("static UI", existsSync(join(repoRoot, "ui", "dist", "index.html")), "ui/dist/index.html");
  check("image pipeline", existsSync(join(repoRoot, ".codex-llm", "pipeline.json")), ".codex-llm/pipeline.json");
  check("upgrade pipeline", existsSync(join(repoRoot, ".codex-llm", "upgrade-pipeline.json")), ".codex-llm/upgrade-pipeline.json");
  check("models", existsSync(join(repoRoot, ".codex-llm", "models.json")), ".codex-llm/models.json");
  check("run wrapper", existsSync(join(repoRoot, "run.sh")), "run.sh");
  if (process.platform === "darwin") {
    check("launchd plist", existsSync(launchdPlistPath), launchdPlistPath);
    check("launchd state", isLaunchdLoaded(), isLaunchdLoaded() ? "loaded" : "not loaded");
  }

  const gitStatus = capture("git", ["status", "--short"], { check: false }).stdout.trim();
  check("working tree", gitStatus.length === 0, gitStatus || "clean");

  const healthy = await isHealthy(`http://localhost:${runtime.port}/api/health`);
  check("runtime health", healthy, `http://localhost:${runtime.port}/api/health`);

  const remote = capture("git", ["remote", "get-url", "upstream"], { check: false });
  check("upstream remote", remote.status === 0, remote.stdout.trim() || "missing");

  for (const row of rows) {
    const mark = row.ok ? "ok" : "warn";
    console.log(`${mark.padEnd(5)} ${row.label.padEnd(16)} ${row.detail}`);
  }

  if (options.strict && rows.some((row) => !row.ok)) {
    throw new Error("doctor --strict found warnings.");
  }
}

async function upgradeCheckCommand(options = {}) {
  const info = await computeUpgradeInfo(options);
  printUpgradeInfo(info);
}

async function computeUpgradeInfo(options = {}) {
  if (!options.no_fetch) {
    run("git", ["fetch", "upstream", "master"], { check: false });
  }

  const branch = capture("git", ["branch", "--show-current"], { check: false }).stdout.trim() || "(detached)";
  const head = capture("git", ["rev-parse", "--short", "HEAD"], { check: false }).stdout.trim();
  const upstream = capture("git", ["rev-parse", "--short", "upstream/master"], { check: false }).stdout.trim();
  const counts = capture("git", ["rev-list", "--left-right", "--count", "HEAD...upstream/master"], { check: false })
    .stdout
    .trim()
    .split(/\s+/)
    .map((value) => Number(value));
  const localPackageVersion =
    readJson(join(repoRoot, "package.json"))?.version ??
    readJson(join(repoRoot, "cli", "package.json"))?.version ??
    "unknown";
  const npmLatest = capture("npm", ["view", "paperclipai", "version"], { check: false }).stdout.trim() || "unknown";

  return {
    branch,
    head,
    upstream,
    ahead: Number.isFinite(counts[0]) ? counts[0] : null,
    behind: Number.isFinite(counts[1]) ? counts[1] : null,
    localPackageVersion,
    npmLatest,
  };
}

function printUpgradeInfo(info) {
  console.log(`Branch: ${info.branch} @ ${info.head || "unknown"}`);
  console.log(`upstream/master: ${info.upstream || "unknown"}`);
  console.log(`Ahead/behind upstream: ${info.ahead ?? "?"}/${info.behind ?? "?"}`);
  console.log(`Local package version: ${info.localPackageVersion}`);
  console.log(`Latest npm paperclipai: ${info.npmLatest}`);
  if (info.behind && info.behind > 0) {
    console.log(`Update available: upstream has ${info.behind} commit(s) not in this branch.`);
  } else {
    console.log("No upstream git update detected.");
  }
}

async function upgradeCommand(options = {}) {
  assertCleanWorkingTree();
  const info = await computeUpgradeInfo(options);
  printUpgradeInfo(info);

  if (!options.force && (!info.behind || info.behind <= 0)) {
    console.log("Nothing to upgrade. Use --force to still run the repair pipeline.");
    return;
  }

  if (!options.yes) {
    await confirmOrExit("Proceed with a disposable upgrade worktree and Codex repair?");
  }

  await runBackup(options);

  const stamp = timestamp();
  const worktreePath = join(worktreesDir, `upgrade-${stamp}`);
  const branch = `paperclip-kawaii/upgrade-${stamp}`;
  mkdirSync(worktreesDir, { recursive: true });

  run("git", ["worktree", "add", "-b", branch, worktreePath, "HEAD"]);
  console.log(`Upgrade worktree: ${worktreePath}`);

  if (!options.skip_codex) {
    await runCodexStage("analyze-upstream", worktreePath, {
      extra: `Current branch: ${info.branch}\nCurrent HEAD: ${info.head}\nTarget upstream/master: ${info.upstream}`,
    });
  }

  const merge = run("git", ["merge", "--no-edit", "upstream/master"], {
    cwd: worktreePath,
    check: false,
  });
  if (merge.status !== 0) {
    console.log("Merge reported conflicts. Codex repair stage will handle conflict resolution.");
  }

  if (!options.skip_codex) {
    await runCodexStage("repair-kawaii", worktreePath, {
      extra:
        "Resolve upstream integration issues, preserve the kawaii UI contract, and fix compile/test failures. " +
        "Read KAWAII-UI.md before changing UI behavior. Do not reintroduce the forbidden honorific text.",
    });
    assertNoUnmergedFiles(worktreePath);
    assertChangedFilesAllowed(worktreePath);
    await runCodexStage("review-repair", worktreePath, {
      extra: "Review the current diff for regressions, missing tests, broken routes, and KAWAII-UI.md violations.",
    });
  } else {
    assertNoUnmergedFiles(worktreePath);
  }

  runUpgradeGates(worktreePath, options);

  console.log("Upgrade candidate is ready.");
  console.log(`Worktree: ${worktreePath}`);
  console.log(`Branch: ${branch}`);
  console.log("Review and merge this branch when accepted.");
  if (process.platform === "darwin" && isLaunchdLoaded()) {
    console.log(`After accepting the candidate, run: ./paperclip-kawaii launchd restart`);
  }
}

async function launchdCommand(options = {}) {
  assertDarwin();
  const subcommand = String(options._?.[0] ?? "status");
  const runtimeOptions =
    subcommand === "restart" || subcommand === "status" || subcommand === "plist"
      ? launchdRuntimeOptions(options)
      : options;

  switch (subcommand) {
    case "install":
      await launchdInstall(options);
      return;
    case "uninstall":
      await launchdUninstall(options);
      return;
    case "restart":
      launchdRestart();
      await waitForHealth(`http://localhost:${resolveRuntimeOptions(runtimeOptions).port}/api/health`, 60_000);
      await statusCommand(runtimeOptions);
      return;
    case "status":
      launchdStatus();
      await statusCommand(runtimeOptions);
      return;
    case "plist":
      console.log(buildLaunchdPlist(runtimeOptions));
      return;
    default:
      throw new Error(`Unknown launchd command '${subcommand}'. Use install, uninstall, restart, status, or plist.`);
  }
}

function launchdRuntimeOptions(options = {}) {
  if (!existsSync(launchdPlistPath)) return options;
  const args = readLaunchdProgramArguments();
  return {
    ...options,
    port: options.port ?? readProgramArg(args, "--port"),
    host: options.host ?? readProgramArg(args, "--host"),
    instance: options.instance ?? readProgramArg(args, "--instance"),
    bind: options.bind ?? readProgramArg(args, "--bind"),
    config: options.config ?? readProgramArg(args, "--config"),
  };
}

function readLaunchdProgramArguments() {
  try {
    const raw = readFileSync(launchdPlistPath, "utf8");
    return Array.from(raw.matchAll(/<string>([\s\S]*?)<\/string>/g), (match) => xmlUnescape(match[1] ?? ""));
  } catch {
    return [];
  }
}

function readProgramArg(args, key) {
  const index = args.indexOf(key);
  if (index < 0) return undefined;
  return args[index + 1];
}

function assertDarwin() {
  if (process.platform !== "darwin") {
    throw new Error("launchd commands are only available on macOS.");
  }
}

async function launchdInstall(options = {}) {
  const runtime = resolveRuntimeOptions(options);
  mkdirSync(dirname(launchdPlistPath), { recursive: true });
  mkdirSync(stateRoot, { recursive: true });

  if (!options.no_build) {
    console.log("Building static kawaii UI before launchd install...");
    run("pnpm", ["--filter", "@paperclipai/ui", "build"], {
      env: { ...process.env, CI: "1" },
    });
  } else if (!existsSync(join(repoRoot, "ui", "dist", "index.html"))) {
    throw new Error("ui/dist/index.html is missing. Install without --no-build first.");
  }

  if (isLaunchdLoaded()) {
    launchdUnload({ check: false });
  }
  await stopCommand({ ...options, quiet: true, no_launchd: true });

  writeFileSync(launchdPlistPath, buildLaunchdPlist(options), { mode: 0o644 });

  run("launchctl", ["bootstrap", launchdDomain(), launchdPlistPath]);
  run("launchctl", ["enable", launchdServiceTarget()]);
  run("launchctl", ["kickstart", "-k", launchdServiceTarget()]);

  await waitForHealth(`http://localhost:${runtime.port}/api/health`, 60_000);
  console.log(`Installed LaunchAgent: ${launchdPlistPath}`);
  printRuntimeUrls(runtime.port);
  console.log(`stdout log: ${launchdOutLogFile}`);
  console.log(`stderr log: ${launchdErrLogFile}`);
}

async function launchdUninstall(options = {}) {
  if (isLaunchdLoaded()) {
    launchdUnload({ check: false });
  }
  await stopCommand({ ...options, quiet: true, no_launchd: true });
  if (!options.keep_plist) {
    rmSync(launchdPlistPath, { force: true });
    console.log(`Removed ${launchdPlistPath}`);
  }
}

function launchdRestart() {
  if (!existsSync(launchdPlistPath)) {
    throw new Error(`LaunchAgent plist is missing. Run ./paperclip-kawaii launchd install first.`);
  }
  if (!isLaunchdLoaded()) {
    run("launchctl", ["bootstrap", launchdDomain(), launchdPlistPath]);
    run("launchctl", ["enable", launchdServiceTarget()]);
  }
  run("launchctl", ["kickstart", "-k", launchdServiceTarget()]);
}

function launchdStatus() {
  const result = capture("launchctl", ["print", launchdServiceTarget()], { check: false });
  if (result.status !== 0) {
    console.log(`LaunchAgent ${launchdLabel}: not loaded`);
    return;
  }
  console.log(`LaunchAgent ${launchdLabel}: loaded`);
  const interesting = result.stdout
    .split(/\r?\n/)
    .filter((line) => /\b(pid|state|last exit code|program|working directory)\b/i.test(line))
    .slice(0, 20)
    .join("\n");
  if (interesting) console.log(interesting);
}

function launchdUnload({ check = false } = {}) {
  return run("launchctl", ["bootout", launchdDomain(), launchdPlistPath], {
    check,
    stdio: check ? "inherit" : "pipe",
  });
}

function isLaunchdLoaded() {
  if (process.platform !== "darwin") return false;
  return capture("launchctl", ["print", launchdServiceTarget()], { check: false }).status === 0;
}

function launchdDomain() {
  return `gui/${process.getuid()}`;
}

function launchdServiceTarget() {
  return `${launchdDomain()}/${launchdLabel}`;
}

function buildLaunchdPlist(options = {}) {
  const runtime = resolveRuntimeOptions(options);
  const env = buildRuntimeEnv(options);
  const pathValue = process.env.PATH || "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
  const args = [
    join(repoRoot, "paperclip-kawaii"),
    "serve",
    "--port",
    String(runtime.port),
    "--host",
    runtime.host,
    "--instance",
    runtime.instance,
    "--bind",
    runtime.bind,
  ];
  if (options.config) {
    args.push("--config", runtime.config);
  }

  const envPairs = {
    HOME: homeDir,
    PATH: pathValue,
    PAPERCLIP_HOME: env.PAPERCLIP_HOME,
    PAPERCLIP_INSTANCE_ID: env.PAPERCLIP_INSTANCE_ID,
    PAPERCLIP_CONFIG: env.PAPERCLIP_CONFIG,
    PAPERCLIP_BIND: env.PAPERCLIP_BIND,
    PAPERCLIP_DEPLOYMENT_MODE: env.PAPERCLIP_DEPLOYMENT_MODE,
    PAPERCLIP_DEPLOYMENT_EXPOSURE: env.PAPERCLIP_DEPLOYMENT_EXPOSURE,
    PAPERCLIP_PUBLIC_URL: env.PAPERCLIP_PUBLIC_URL,
    PAPERCLIP_AUTH_PUBLIC_BASE_URL: env.PAPERCLIP_AUTH_PUBLIC_BASE_URL,
    PAPERCLIP_UI_DEV_MIDDLEWARE: "false",
    PAPERCLIP_OPEN_ON_LISTEN: "false",
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    BETTER_AUTH_BASE_URL: env.BETTER_AUTH_BASE_URL,
    SERVE_UI: "true",
    HOST: env.HOST,
    PORT: env.PORT,
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(launchdLabel)}</string>
  <key>ProgramArguments</key>
  <array>
${args.map((arg) => `    <string>${xmlEscape(arg)}</string>`).join("\n")}
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(repoRoot)}</string>
  <key>EnvironmentVariables</key>
  <dict>
${Object.entries(envPairs).map(([key, value]) => `    <key>${xmlEscape(key)}</key>\n    <string>${xmlEscape(value)}</string>`).join("\n")}
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${xmlEscape(launchdOutLogFile)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(launchdErrLogFile)}</string>
</dict>
</plist>
`;
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlUnescape(value) {
  return String(value)
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function assertCleanWorkingTree() {
  const status = capture("git", ["status", "--short"], { check: false }).stdout.trim();
  if (status.length > 0) {
    throw new Error(`Working tree is not clean. Commit or stash before upgrade.\n${status}`);
  }
}

async function confirmOrExit(question) {
  if (!process.stdin.isTTY) {
    throw new Error("Refusing to continue non-interactively without --yes.");
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") {
      throw new Error("Cancelled.");
    }
  } finally {
    rl.close();
  }
}

async function runBackup(options = {}) {
  if (options.no_backup) {
    console.log("Skipping DB backup because --no-backup was provided.");
    return;
  }
  console.log("Creating Paperclip DB backup before upgrade...");
  const result = run("pnpm", ["paperclipai", "db:backup", "--filename-prefix", `paperclip-kawaii-upgrade-${timestamp()}`], {
    check: false,
  });
  if (result.status !== 0) {
    if (!options.yes) {
      await confirmOrExit("DB backup command failed. Continue anyway?");
    } else {
      console.log("Warning: DB backup failed, continuing because --yes was provided.");
    }
  }
}

function readCodexConfig(root) {
  const pipelinePath = join(root, ".codex-llm", "upgrade-pipeline.json");
  const modelsPath = join(root, ".codex-llm", "models.json");
  const pipeline = readJson(pipelinePath);
  const models = readJson(modelsPath);
  if (!pipeline || !models) throw new Error("Missing .codex-llm/upgrade-pipeline.json or .codex-llm/models.json");
  return { pipeline, models };
}

async function runCodexStage(stageName, worktreePath, input = {}) {
  const { pipeline, models } = readCodexConfig(worktreePath);
  const stage = pipeline.stages?.find((entry) => entry.name === stageName);
  if (!stage) throw new Error(`Unknown Codex stage '${stageName}'.`);
  if (!commandExists("codex")) throw new Error("Codex CLI is not installed or not on PATH.");

  const model = models[stage.model_type] ?? models.code ?? models.reasoning;
  if (!model) throw new Error(`No model configured for stage '${stageName}'.`);

  mkdirSync(join(codexLogDir, stageName), { recursive: true });
  const startedAt = new Date().toISOString();
  const constraints = buildConstraints(stage, worktreePath);
  const prompt = `${constraints}

[STAGE]
name: ${stage.name}
purpose: ${stage.purpose}
tier: ${stage.tier}
[/STAGE]

${input.extra ?? ""}

Return a concise stage summary at the end.`;

  const args = ["exec", "--model", model];
  if (stage.tier === "T2" || stage.tier === "T3") {
    args.push("--dangerously-bypass-approvals-and-sandbox");
  }
  args.push(prompt);

  console.log(`Running Codex stage ${stageName} with ${model} (${stage.tier})`);
  const result = capture("codex", args, {
    cwd: worktreePath,
    check: false,
    timeout_ms: stage.timeout_ms,
    env: { ...process.env, CODEX_LLM_STAGE: stageName },
  });

  const logPath = join(codexLogDir, stageName, `${timestamp()}.json`);
  writeFileSync(
    logPath,
    JSON.stringify(
      {
        stage: stageName,
        model,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: result.status,
        signal: result.signal,
        timeoutMs: stage.timeout_ms,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error?.message,
      },
      null,
      2,
    ) + "\n",
  );

  if (result.stdout.trim()) console.log(result.stdout.trim());
  if (result.stderr.trim()) console.error(result.stderr.trim());
  console.log(`Codex log: ${logPath}`);

  if (result.status !== 0) {
    throw new Error(`Codex stage ${stageName} failed with exit ${result.status}.`);
  }
}

function buildConstraints(stage, worktreePath) {
  const lines = [
    "[CONSTRAINTS]",
    `- Work only inside project root: ${worktreePath}`,
    "- Do not delete files.",
    "- Do not read or modify .env, credentials, private keys, or secrets files.",
    "- Do not run destructive git commands.",
    "- Do not install system packages or access system directories.",
    "- Do not invoke codex recursively.",
  ];

  if (stage.tier === "T1") {
    lines.push("- No file creation, modification, or deletion. Stdout text only.");
  }

  if (stage.tier === "T2") {
    lines.push("- Source-code files must not be created, modified, or deleted.");
    lines.push(`- Writable directories: ${(stage.allowed_dirs ?? []).join(", ") || "(none)"}`);
    lines.push(`- Writable extensions: ${(stage.allowed_extensions ?? []).join(", ") || "(none)"}`);
  }

  if (stage.tier === "T3") {
    lines.push(`- Writable directories: ${(stage.allowed_dirs ?? []).join(", ") || "(none)"}`);
    lines.push(`- Writable root files: ${(stage.allowed_files ?? []).join(", ") || "(none)"}`);
    lines.push("- Print a short change plan before editing.");
    lines.push("- Preserve the kawaii UI contract in KAWAII-UI.md.");
  }

  for (const pattern of stage.forbidden_patterns ?? []) {
    lines.push(`- The literal text '${pattern}' must not appear in code or docs.`);
  }
  for (const pattern of stage.forbidden_codepoints ?? []) {
    lines.push(`- The literal text '${decodeCodepoints(pattern)}' must not appear in code or docs.`);
  }

  lines.push("[/CONSTRAINTS]");
  return lines.join("\n");
}

function decodeCodepoints(values) {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))
    .map((value) => String.fromCodePoint(value))
    .join("");
}

function assertNoUnmergedFiles(worktreePath) {
  const unmerged = capture("git", ["diff", "--name-only", "--diff-filter=U"], {
    cwd: worktreePath,
    check: false,
  }).stdout.trim();
  if (unmerged.length > 0) {
    throw new Error(`Merge conflicts remain unresolved:\n${unmerged}`);
  }
}

function assertChangedFilesAllowed(worktreePath) {
  const { pipeline } = readCodexConfig(worktreePath);
  const repairStage = pipeline.stages?.find((entry) => entry.name === "repair-kawaii");
  const allowedDirs = new Set(repairStage?.allowed_dirs ?? []);
  const allowedFiles = new Set(repairStage?.allowed_files ?? []);
  const changed = new Set();

  const diff = capture("git", ["diff", "--name-only"], { cwd: worktreePath, check: false }).stdout;
  for (const line of diff.split(/\r?\n/)) {
    if (line.trim()) changed.add(line.trim());
  }

  const cached = capture("git", ["diff", "--cached", "--name-only"], { cwd: worktreePath, check: false }).stdout;
  for (const line of cached.split(/\r?\n/)) {
    if (line.trim()) changed.add(line.trim());
  }

  const untracked = capture("git", ["ls-files", "--others", "--exclude-standard"], {
    cwd: worktreePath,
    check: false,
  }).stdout;
  for (const line of untracked.split(/\r?\n/)) {
    if (line.trim()) changed.add(line.trim());
  }

  const forbidden = [...changed].filter((filePath) => {
    if (allowedFiles.has(filePath) || allowedFiles.has(basename(filePath))) return false;
    return ![...allowedDirs].some((dir) => filePath === dir || filePath.startsWith(`${dir}/`));
  });

  if (forbidden.length > 0) {
    throw new Error(`Codex changed files outside the allowed repair scope:\n${forbidden.join("\n")}`);
  }
}

function runUpgradeGates(worktreePath, options = {}) {
  run("git", ["diff", "--check"], { cwd: worktreePath });
  run("pnpm", ["install", "--frozen-lockfile"], { cwd: worktreePath });
  run("pnpm", ["-r", "typecheck"], { cwd: worktreePath });

  if (!options.fast) {
    run("pnpm", ["test:run"], { cwd: worktreePath });
    run("pnpm", ["build"], { cwd: worktreePath });
  } else {
    console.log("Skipping full test/build gates because --fast was provided.");
  }

  const forbidden = capture("rg", [
    "-n",
    "--fixed-strings",
    forbiddenHonorific(),
    ".",
    "--glob",
    "!node_modules",
    "--glob",
    "!.git",
    "--glob",
    "!ui/dist",
    "--glob",
    "!scripts/paperclip-kawaii-cli.mjs",
    "--glob",
    "!.codex-llm/upgrade-pipeline.json",
  ], {
    cwd: worktreePath,
    check: false,
  });
  if (forbidden.status === 0) {
    throw new Error(`Forbidden honorific text found:\n${forbidden.stdout}`);
  }
}

function forbiddenHonorific() {
  return String.fromCodePoint(0xd3d0, 0xd558);
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function screenshotsCommand(options = {}) {
  const runtime = resolveRuntimeOptions(options);
  const baseUrl = String(options.url ?? `http://localhost:${runtime.port}`).replace(/\/+$/, "");
  const outDir = resolveIcloudDownloadsDir();
  const prefix = String(options.prefix ?? `paperclip-kawaii-${timestamp()}`);
  await captureScreenshots(baseUrl, outDir, prefix);
}

function resolveIcloudDownloadsDir() {
  const icloud = join(homeDir, "Library", "Mobile Documents", "com~apple~CloudDocs", "Downloads");
  return existsSync(icloud) ? icloud : join(homeDir, "Downloads");
}

async function captureScreenshots(baseUrl, outDir, prefix) {
  mkdirSync(outDir, { recursive: true });
  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const written = [];

  try {
    for (const [slug, route] of routesForScreenshots) {
      const url = `${baseUrl}${route}`;
      const outPath = join(outDir, `${prefix}-${slug}.png`);
      await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
      await page.screenshot({ path: outPath, fullPage: true });
      written.push(outPath);
      console.log(`Screenshot: ${outPath}`);
    }
  } finally {
    await browser.close();
  }

  return written;
}

async function loadPlaywright() {
  try {
    return normalizePlaywrightModule(await import("playwright"));
  } catch {
    const packagePath = join(repoRoot, "node_modules", "playwright", "index.js");
    if (existsSync(packagePath)) {
      return normalizePlaywrightModule(await import(pathToFileURL(packagePath).href));
    }
    const pnpmPath = findPnpmPlaywrightEntrypoint();
    if (pnpmPath) {
      return normalizePlaywrightModule(await import(pathToFileURL(pnpmPath).href));
    }
    throw new Error("Playwright is not installed. Run pnpm install first.");
  }
}

function normalizePlaywrightModule(mod) {
  return mod.chromium ? mod : mod.default;
}

function findPnpmPlaywrightEntrypoint() {
  const pnpmRoot = join(repoRoot, "node_modules", ".pnpm");
  if (!existsSync(pnpmRoot)) return null;

  const entries = readdirSync(pnpmRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("playwright@"))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const entry of entries) {
    const candidate = join(pnpmRoot, entry, "node_modules", "playwright", "index.js");
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
