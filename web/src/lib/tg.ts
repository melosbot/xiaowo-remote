/**
 * Telegram 推送配置
 *
 * 配置保存在 localStorage，Chat ID 同时发送到服务端按 VIN 存储以支持轮询推送。
 */

export interface TgConfig {
  chatId: string
}

const STORAGE_KEY = "volvo-pwa-tg"

export function loadTgConfig(): TgConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { chatId: "" }
    const config = JSON.parse(raw) as Partial<TgConfig>
    return { chatId: typeof config.chatId === "string" ? config.chatId.trim() : "" }
  } catch {
    return { chatId: "" }
  }
}

export function saveTgConfig(config: TgConfig): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ chatId: config.chatId.trim() }),
  )
}

export function clearTgConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}
