import { Mp3Encoder } from "@breezystack/lamejs";

type Request = { type: "start"; rate: number }
  | { type: "chunk"; left: Float32Array; right: Float32Array }
  | { type: "finish" };

let encoder: Mp3Encoder | undefined;
const parts: BlobPart[] = [];
const leftBlock = new Int16Array(1152);
const rightBlock = new Int16Array(leftBlock.length);
const pcm = (sample: number) => Math.round(Math.max(-1, Math.min(1, sample)) * 32767);

self.addEventListener("message", (event: MessageEvent<Request>) => {
  try {
    const data = event.data;
    if (data.type === "start") {
      encoder = new Mp3Encoder(2, data.rate, 192);
      self.postMessage(null);
      return;
    }
    if (!encoder) throw new Error("MP3 encoder isn't ready.");
    if (data.type === "finish") {
      parts.push(new Uint8Array(encoder.flush()));
      self.postMessage(new Blob(parts, { type: "audio/mpeg" }));
      return;
    }
    for (let offset = 0; offset < data.left.length; offset += leftBlock.length) {
      const length = Math.min(leftBlock.length, data.left.length - offset);
      for (let index = 0; index < length; index++) {
        leftBlock[index] = pcm(data.left[offset + index]);
        rightBlock[index] = pcm(data.right[offset + index]);
      }
      const bytes = encoder.encodeBuffer(leftBlock.subarray(0, length), rightBlock.subarray(0, length));
      if (bytes.length) parts.push(new Uint8Array(bytes));
    }
    self.postMessage(null);
  } catch (error) {
    self.postMessage(error instanceof Error ? error.message : "The MP3 could not be encoded.");
  }
});
