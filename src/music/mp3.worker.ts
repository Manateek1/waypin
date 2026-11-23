import { Mp3Encoder } from "@breezystack/lamejs";

self.addEventListener("message", (event: MessageEvent<{ samples: Float32Array; rate: number }>) => {
  try {
    const { samples, rate } = event.data;
    const encoder = new Mp3Encoder(1, rate, 128);
    const parts: BlobPart[] = [];
    const block = new Int16Array(1152);
    for (let offset = 0; offset < samples.length; offset += block.length) {
      const length = Math.min(block.length, samples.length - offset);
      for (let index = 0; index < length; index++) {
        block[index] = Math.round(Math.max(-1, Math.min(1, samples[offset + index])) * 32767);
      }
      const bytes = encoder.encodeBuffer(block.subarray(0, length));
      if (bytes.length) parts.push(new Uint8Array(bytes));
    }
    parts.push(new Uint8Array(encoder.flush()));
    self.postMessage(new Blob(parts, { type: "audio/mpeg" }));
  } catch (error) {
    self.postMessage(error instanceof Error ? error.message : "The MP3 could not be encoded.");
  }
});
