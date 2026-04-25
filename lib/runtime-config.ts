import "server-only";

import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

export type RuntimeConfigFile = {
  databaseUrl?: string;
  authSecret?: string;
  setupComplete?: boolean;
  visibleGenerations?: number;
};

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "runtime-config.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadRuntimeConfig(): RuntimeConfigFile {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as RuntimeConfigFile;
  } catch {
    return {};
  }
}

export function saveRuntimeConfig(patch: Partial<RuntimeConfigFile>): void {
  ensureDataDir();
  const cur = loadRuntimeConfig();
  const next = { ...cur, ...patch };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8");
}

export function getEffectiveDatabaseUrl(): string | undefined {
  const env = process.env.DATABASE_URL?.trim();
  if (env) return env;
  return loadRuntimeConfig().databaseUrl?.trim();
}

export function getEffectiveAuthSecret(): string | undefined {
  const env = process.env.AUTH_SECRET?.trim();
  if (env && env.length >= 16) return env;
  const f = loadRuntimeConfig().authSecret?.trim();
  if (f && f.length >= 16) return f;
  return undefined;
}

export function getVisibleGenerations(): number {
  const config = loadRuntimeConfig();
  const env = process.env.DEFAULT_VISIBLE_GENERATIONS;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return config.visibleGenerations ?? 5;
}

export function generateAuthSecret(): string {
  return randomBytes(32).toString("hex");
}

/** 将连接信息写入 .env.local，便于下次启动时中间件也能读取（需重启 dev 服务器） */
export function mergeEnvLocal(databaseUrl: string, authSecret: string): void {
  const envPath = path.join(process.cwd(), ".env.local");
  let lines: string[] = [];
  if (fs.existsSync(envPath)) {
    lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  }
  const setKey = (key: string, value: string) => {
    const esc = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const line = `${key}="${esc}"`;
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (idx >= 0) lines[idx] = line;
    else lines.push(line);
  };
  setKey("DATABASE_URL", databaseUrl);
  setKey("AUTH_SECRET", authSecret);
  if (lines.length && !lines[lines.length - 1].endsWith("\n")) {
    lines.push("");
  }
  fs.writeFileSync(envPath, lines.filter((l, i) => l.length > 0 || i === lines.length - 1).join("\n") + "\n", "utf-8");
}
