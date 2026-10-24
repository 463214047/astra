/**
 * MediaInfo 文本输出解析器
 *
 * 输入: mediainfo CLI 的原始文本输出
 * 输出: { general, video, audio[] } 结构化元数据
 *
 * mediainfo 输出格式:
 *
 * General
 * Complete name                    : /path/to/file.mkv
 * Format                           : Matroska
 * Format version                   : 4
 * Duration                         : 1h 30mn
 *
 * Video #1
 * Format                           : AVC
 * Width                            : 1920
 * Height                           : 1080
 * Bit rate                         : 8 000 kbps
 * Frame rate                       : 24.000 fps
 *
 * Audio #1
 * Format                           : AAC
 * Bit rate                         : 256 kbps
 */

export interface MediaInfoStream {
  type: "Video" | "Audio" | "Text" | "Menu" | "Other";
  index: number;
  entries: { key: string; value: string }[];
}

export interface ParsedMediaInfo {
  general: { key: string; value: string }[];
  streams: MediaInfoStream[];
  raw: string;
}

const STREAM_HEADER_RE = /^([A-Za-z]+)\s*(?:#(\d+))?$/;

export function parseMediaInfo(text: string | null | undefined): ParsedMediaInfo | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const lines = trimmed.split(/\r?\n/);
  const general: { key: string; value: string }[] = [];
  const streams: MediaInfoStream[] = [];

  let currentSection: "general" | MediaInfoStream | null = null;

  for (const rawLine of lines) {
    const line = rawLine;

    // 空行 → 切 section
    if (!line.trim()) {
      if (currentSection && currentSection !== "general") {
        // 让 stream 保持引用不变
      }
      continue;
    }

    // Section header（顶格，无冒号）
    if (!line.includes(":") && !line.includes(" : ")) {
      const m = line.trim().match(STREAM_HEADER_RE);
      if (m) {
        const type = m[1] as MediaInfoStream["type"] | "General";
        if (type === "General") {
          currentSection = "general";
        } else {
          const index = m[2] ? parseInt(m[2], 10) : 1;
          // 合并同类型同 index 的连续 section（有些 mediainfo 版本会重复 header）
          let stream = streams.find((s) => s.type === type && s.index === index);
          if (!stream) {
            stream = { type, index, entries: [] };
            streams.push(stream);
          }
          currentSection = stream;
        }
        continue;
      }
    }

    // Key : Value 行
    const sepIdx = line.indexOf(" : ");
    if (sepIdx < 0) continue;
    const key = line.slice(0, sepIdx).trim();
    const value = line.slice(sepIdx + 3).trim();
    if (!key || !value) continue;

    if (currentSection === "general") {
      general.push({ key, value });
    } else if (currentSection && currentSection !== "general") {
      currentSection.entries.push({ key, value });
    }
    // 没 section header 之前的键值 → 也归 general
    else {
      general.push({ key, value });
    }
  }

  // 没解析到任何有效 section/key
  if (general.length === 0 && streams.length === 0) return null;

  return { general, streams, raw: trimmed };
}

/** 快捷查找 key 对应的值（不区分大小写，先精确匹配再模糊匹配） */
export function findValue(
  entries: { key: string; value: string }[],
  ...keyHints: string[]
): string | null {
  const lowerHints = keyHints.map((h) => h.toLowerCase());

  // 第一轮：精确匹配
  for (const hint of lowerHints) {
    const found = entries.find((e) => e.key.toLowerCase() === hint);
    if (found) return found.value;
  }
  // 第二轮：模糊包含（只有精确匹配全 miss 才走这里）
  for (const hint of lowerHints) {
    const found = entries.find((e) => e.key.toLowerCase().includes(hint));
    if (found) return found.value;
  }
  return null;
}
