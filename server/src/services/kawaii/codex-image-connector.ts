import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type CodexImageBatchInput = {
  requestPath: string;
  outDir: string;
  timeoutMs: number;
  quality: string;
};

export type CodexImageBatchResult = {
  stdout: string;
  stderr: string;
};

export async function runCodexImageBatch(input: CodexImageBatchInput): Promise<CodexImageBatchResult> {
  const bin = process.env.IMAGEGEN_CODEX_BIN?.trim() || "imagegen-codex";
  const result = await execFileAsync(
    bin,
    [
      "batch",
      input.requestPath,
      "--out-dir",
      input.outDir,
      "--json",
      "--quality",
      input.quality,
      "--timeout",
      String(input.timeoutMs),
      "--codex-sandbox",
      "workspace-write",
      "--shared-style",
      "--quiet",
    ],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 8, timeout: input.timeoutMs + 30_000 },
  );
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function safeCodexDiagnostics(stdout: string, stderr: string) {
  return {
    stdoutTail: stdout.slice(-4000),
    stderrTail: stderr.slice(-4000),
  };
}
