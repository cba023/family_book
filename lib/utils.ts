import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 会话与数据库是否已配置（构建/可选检查） */
export const hasEnvVars =
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16);

export const FAMILY_SURNAME = process.env.NEXT_PUBLIC_FAMILY_SURNAME || "陈";
