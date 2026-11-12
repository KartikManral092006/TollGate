// Splitting an explanation into the chunks of a Nexconn stream message, so it appears in the
// room a sentence at a time. Pure, so it is unit-tested.

export const WHY_STREAM_MAX_CHUNKS = 12;

// Sentences (and line breaks), merged so there are at most WHY_STREAM_MAX_CHUNKS chunks.
// Joining the chunks gives back the text exactly.
export function whyChunks(text: string, max = WHY_STREAM_MAX_CHUNKS): string[] {
  const parts =
    text.match(/[^.!?\n]+(?:[.!?]+|\n+|$)\s*/g)?.filter((part) => part.length > 0) ?? [];
  if (parts.length === 0) return text ? [text] : [];
  const size = Math.ceil(parts.length / max);
  const chunks: string[] = [];
  for (let i = 0; i < parts.length; i += size) chunks.push(parts.slice(i, i + size).join(""));
  return chunks;
}
