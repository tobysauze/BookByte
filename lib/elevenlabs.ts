const {
  ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID,
  ELEVENLABS_MODEL_ID,
} = process.env;

const DEFAULT_VOICE_ID = ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM"; // Rachel
const DEFAULT_MODEL_ID = ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

export type GenerateAudioParams = {
  text: string;
  voiceId?: string;
  modelId?: string;
  outputFormat?: "mp3_44100_128" | "mp3_44100_192" | "wav";
  signal?: AbortSignal;
};

export async function generateSpeechFromText({
  text,
  voiceId,
  modelId,
  outputFormat = "mp3_44100_128",
  signal,
}: GenerateAudioParams) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error(
      "ELEVENLABS_API_KEY is not configured. Add it to your environment variables.",
    );
  }

  if (!text.trim()) {
    throw new Error("Cannot synthesize empty text.");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId ?? DEFAULT_VOICE_ID}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: modelId ?? DEFAULT_MODEL_ID,
        output_format: outputFormat,
        text,
        voice_settings: {
          similarity_boost: 0.65,
          stability: 0.4,
          style: 0.3,
        },
      }),
      signal,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to generate audio: ${response.status} ${response.statusText} — ${errorText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

