type ChunkOptions = {
  chunkSize?: number;
  overlap?: number;
  maxChunks?: number;
};

const DEFAULT_CHUNK_SIZE = 4000;
const DEFAULT_OVERLAP = 250;

export function chunkText(text: string, options: ChunkOptions = {}) {
  const size = Math.max(1, options.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const overlapInput = options.overlap ?? DEFAULT_OVERLAP;
  const overlap = Math.min(overlapInput, size - 1);
  const step = Math.max(1, size - overlap);
  const maxChunks = Math.max(1, options.maxChunks ?? Number.POSITIVE_INFINITY);

  if (!text.length) {
    return [];
  }

  if (text.length <= size) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length && chunks.length < maxChunks) {
    const end = Math.min(text.length, start + size);
    chunks.push(text.slice(start, end));

    if (end === text.length) {
      break;
    }

    start += step;
  }

  return chunks;
}

export function mergeChunks(chunks: string[]) {
  return chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .join("\n\n");
}

