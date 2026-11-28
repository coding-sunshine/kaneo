import { HTTPException } from "hono/http-exception";

const DEFAULT_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_MODEL = "whisper-1";
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const SPEECH_TO_TEXT_OFF =
  "Speech to text is off on this server. Paste the transcript as text instead.";

/** Speech to text is on when the server has a key for it. */
export const isSpeechToTextEnabled = () =>
  Boolean(process.env.STT_API_KEY?.trim());

/**
 * Turns recorded audio into text with the OpenAI-compatible endpoint in
 * STT_API_URL. The audio is passed through and kept nowhere.
 */
export async function transcribe(file: File) {
  if (!isSpeechToTextEnabled())
    throw new HTTPException(404, { message: SPEECH_TO_TEXT_OFF });
  if (file.size > MAX_AUDIO_BYTES)
    throw new HTTPException(413, { message: "The recording is over 25 MB." });
  const form = new FormData();
  form.append("file", file, file.name || "meeting");
  form.append("model", process.env.STT_MODEL || DEFAULT_MODEL);
  const response = await fetch(process.env.STT_API_URL || DEFAULT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STT_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok)
    throw new HTTPException(502, {
      message: `Speech to text failed (HTTP ${response.status}).`,
    });
  const body = (await response.json()) as { text?: string };
  return { transcript: (body.text ?? "").trim() };
}
