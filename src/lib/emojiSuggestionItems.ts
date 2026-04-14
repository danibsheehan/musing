import { emojis, type EmojiItem } from "@tiptap/extension-emoji";

/** Shortcodes / names shown when the user types only `:`. */
const POPULAR_EMOJI_NAMES = new Set([
  "smile",
  "joy",
  "rofl",
  "laughing",
  "wink",
  "heart",
  "sparkling_heart",
  "thumbsup",
  "pray",
  "clap",
  "fire",
  "sparkles",
  "eyes",
  "thinking",
  "sunglasses",
  "cry",
  "weary",
  "muscle",
  "ok_hand",
  "raised_hands",
  "tada",
  "rocket",
  "star",
  "100",
  "white_check_mark",
  "x",
  "warning",
  "bulb",
  "speech_balloon",
  "heart_eyes",
  "kissing_heart",
  "sob",
  "face_with_raised_eyebrow",
  "face_with_monocle",
  "nerd_face",
  "partying_face",
  "handshake",
  "pencil2",
  "memo",
  "coffee",
  "pizza",
]);

const popularList: EmojiItem[] = (() => {
  const byName = new Map(emojis.map((e) => [e.name, e]));
  const out: EmojiItem[] = [];
  for (const name of POPULAR_EMOJI_NAMES) {
    const item = byName.get(name);
    if (item?.emoji) out.push(item);
  }
  return out;
})();

function matchesQuery(item: EmojiItem, q: string): boolean {
  if (item.name.includes(q)) return true;
  if (item.shortcodes.some((s) => s.includes(q))) return true;
  if (item.tags.some((t) => t.includes(q))) return true;
  return false;
}

const MAX_ITEMS = 48;

/**
 * Items for TipTap Emoji `suggestion.items` — filtered by typed query after `:`.
 */
export function getEmojiSuggestionItems(query: string): EmojiItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return popularList.slice(0, MAX_ITEMS);
  }
  const out: EmojiItem[] = [];
  for (const item of emojis) {
    if (!item.emoji) continue;
    if (!matchesQuery(item, q)) continue;
    out.push(item);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}
