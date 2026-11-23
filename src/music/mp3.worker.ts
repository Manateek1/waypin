import { Mp3Encoder } from "@breezystack/lamejs";

self.addEventListener("message", (event: MessageEvent<{ left: Float32Array; right: Float32Array; rate: number }>) => {
  try {
    const { left, right, rate } = event.data;
    const encoder = new Mp3Encoder(2, rate, 192);
    const parts: BlobPart[] = [];
    const leftBlock = new Int16Array(1152);
    const rightBlock = new Int16Array(leftBlock.length);
    const pcm = (sample: number) => Math.round(Math.max(-1, Math.min(1, sample)) * 32767);
    for (let offset = 0; offset < left.length; offset += leftBlock.length) {
      const length = Math.min(leftBlock.length, left.length - offset);
      for (let index = 0; index < length; index++) {
        leftBlock[index] = pcm(left[offset + index]);
        rightBlock[index] = pcm(right[offset + index]);
      }
      const bytes = encoder.encodeBuffer(leftBlock.subarray(0, length), rightBlock.subarray(0, length));
      if (bytes.length) parts.push(new Uint8Array(bytes));
    }
    parts.push(new Uint8Array(encoder.flush()));
    self.postMessage(new Blob(parts, { type: "audio/mpeg" }));
  } catch (error) {
    self.postMessage(error instanceof Error ? error.message : "The MP3 could not be encoded.");
  }
});
