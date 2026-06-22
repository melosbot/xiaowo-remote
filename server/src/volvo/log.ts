/**
 * 统一日志工具
 *
 * - 始终输出：warn / error / 启动信息
 * - VERBOSE=1 时输出 info / debug
 *
 * 用法：
 *   import { log } from "./volvo/log.js";
 *   log.info("tag", "message");
 *   log.warn("tag", "message");
 *   log.error("tag", "message");
 */

const VERBOSE = process.env.VERBOSE === "1";

function fmt(tag: string, msg: string): string {
  return `[${tag}] ${msg}`;
}

export const log = {
  /** 启动信息，始终输出 */
  startup(tag: string, msg: string): void {
    console.log(fmt(tag, msg));
  },
  /** 仅 VERBOSE=1 时输出 */
  info(tag: string, msg: string): void {
    if (VERBOSE) console.log(fmt(tag, msg));
  },
  /** 始终输出 */
  warn(tag: string, msg: string): void {
    console.warn(fmt(tag, msg));
  },
  /** 始终输出 */
  error(tag: string, msg: string): void {
    console.error(fmt(tag, msg));
  },
};
