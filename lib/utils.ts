import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 构建/文档用：中间件仅识别 process.env 中的配置 */
export const hasEnvVars =
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16);

export const FAMILY_SURNAME = process.env.NEXT_PUBLIC_FAMILY_SURNAME || "陈";
