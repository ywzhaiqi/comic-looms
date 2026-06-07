import { GM_getValue, GM_setValue } from "$";
import { b64EncodeUnicode } from "./random";

/** 阅读记录数据结构 */
export interface ReadingRecord {
  /** 阅读到的章节索引 */
  chapterIndex: number;
  /** 阅读到的页面索引 */
  pageIndex: number;
  /** 记录时间戳 */
  timestamp: number;
  /** 章节标题（用于显示） */
  chapterTitle: string;
}

const STORAGE_KEY = "cl-reading-records";
/** 过期时间：90天（毫秒） */
const EXPIRE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * 生成画廊的唯一存储键
 * @param siteName - 站点名称
 * @param galleryUrl - 画廊 URL
 */
function getGalleryKey(siteName: string, galleryUrl: string): string {
  return b64EncodeUnicode(`${siteName}:${galleryUrl}`);
}

/**
 * 获取所有阅读记录
 */
function getAllRecords(): Record<string, ReadingRecord> {
  const raw = GM_getValue<string>(STORAGE_KEY, "");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * 清理过期的阅读记录（超过 90 天）
 */
function cleanExpiredRecords(records: Record<string, ReadingRecord>): Record<string, ReadingRecord> {
  const now = Date.now();
  const cleaned: Record<string, ReadingRecord> = {};
  for (const [key, record] of Object.entries(records)) {
    if (now - record.timestamp < EXPIRE_MS) {
      cleaned[key] = record;
    }
  }
  return cleaned;
}

/**
 * 保存阅读记录
 * @param siteName - 站点名称
 * @param galleryUrl - 画廊 URL
 * @param record - 阅读记录
 */
export function saveReadingRecord(siteName: string, galleryUrl: string, record: ReadingRecord): void {
  const records = cleanExpiredRecords(getAllRecords());
  const key = getGalleryKey(siteName, galleryUrl);
  records[key] = { ...record, timestamp: Date.now() };
  GM_setValue(STORAGE_KEY, JSON.stringify(records));
}

/**
 * 读取阅读记录
 * @param siteName - 站点名称
 * @param galleryUrl - 画廊 URL
 * @returns 阅读记录，不存在或已过期则返回 null
 */
export function loadReadingRecord(siteName: string, galleryUrl: string): ReadingRecord | null {
  const records = getAllRecords();
  const key = getGalleryKey(siteName, galleryUrl);
  const record = records[key];
  if (!record) return null;
  // 检查是否过期
  if (Date.now() - record.timestamp > EXPIRE_MS) {
    return null;
  }
  return record;
}

/**
 * 清除指定画廊的阅读记录
 * @param siteName - 站点名称
 * @param galleryUrl - 画廊 URL
 */
export function clearReadingRecord(siteName: string, galleryUrl: string): void {
  const records = getAllRecords();
  const key = getGalleryKey(siteName, galleryUrl);
  delete records[key];
  GM_setValue(STORAGE_KEY, JSON.stringify(records));
}
