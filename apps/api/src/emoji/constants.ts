// Limits from Linear's emoji dialog: 500 KB images, names of 1-256 characters
// made of lowercase letters, digits, "_" and "-".
export const EMOJI_MAX_BYTES = 500_000;
export const EMOJI_NAME_PATTERN = /^[a-z0-9_-]+$/;
export const EMOJI_NAME_MAX_LENGTH = 256;
export const EMOJI_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

/** The `:name:` form stored in `comment_reaction.emoji`. */
export const customEmojiShortcode = (name: string) => `:${name}:`;
export const CUSTOM_EMOJI_SHORTCODE = /^:([a-z0-9_-]+):$/;
