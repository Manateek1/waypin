export type AudioFormat = "mp3" | "wav";

export function createMp3Encoder(rate: number) {
  const worker = new Worker(new URL("./mp3.worker.ts", import.meta.url), { type: "module" });
  let pending: { resolve: (blob: Blob | null) => void; reject: (error: Error) => void } | undefined;
  let failed: Error | undefined;
  function fail(error: Error) {
    failed = error;
    pending?.reject(error);
    pending = undefined;
  }
  worker.onmessage = (event: MessageEvent<Blob | string | null>) => {
    if (typeof event.data === "string") fail(new Error(event.data));
    else {
      pending?.resolve(event.data);
      pending = undefined;
    }
  };
  worker.onerror = () => fail(new Error("Could not start the MP3 encoder."));
  worker.onmessageerror = () => fail(new Error("Could not read the MP3 encoder response."));
  function send(message: object, transfer: Transferable[] = []) {
    if (failed) return Promise.reject(failed);
    return new Promise<Blob | null>((resolve, reject) => {
      pending = { resolve, reject };
      try { worker.postMessage(message, transfer); }
      catch { fail(new Error("Could not send audio to the MP3 encoder.")); }
    });
  }
  return {
    start: () => send({ type: "start", rate }),
    write: (left: Float32Array<ArrayBuffer>, right: Float32Array<ArrayBuffer>) =>
      send({ type: "chunk", left, right }, [left.buffer, right.buffer]),
    async finish() {
      const result = await send({ type: "finish" });
      if (!result) throw new Error("MP3 encoder returned no audio.");
      return result;
    },
    close: () => {
      worker.terminate();
      fail(new DOMException("Export stopped.", "AbortError"));
    },
  };
}

export function wavChunk(left: Float32Array, right: Float32Array) {
  const bytes = new DataView(new ArrayBuffer(left.length * 4));
  const pcm = (sample: number) => Math.round(Math.max(-1, Math.min(1, sample)) * 32767);
  for (let index = 0; index < left.length; index++) {
    bytes.setInt16(index * 4, pcm(left[index]), true);
    bytes.setInt16(index * 4 + 2, pcm(right[index]), true);
  }
  return bytes.buffer;
}

export function wavFile(chunks: ArrayBuffer[], rate: number, frames: number) {
  const bytes = new DataView(new ArrayBuffer(44));
  const ascii = (start: number, value: string) => [...value].forEach((letter, index) => bytes.setUint8(start + index, letter.charCodeAt(0)));
  ascii(0, "RIFF"); bytes.setUint32(4, 36 + frames * 4, true); ascii(8, "WAVE");
  ascii(12, "fmt "); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 2, true);
  bytes.setUint32(24, rate, true); bytes.setUint32(28, rate * 4, true); bytes.setUint16(32, 4, true); bytes.setUint16(34, 16, true);
  ascii(36, "data"); bytes.setUint32(40, frames * 4, true);
  return new Blob([bytes.buffer, ...chunks], { type: "audio/wav" });
}
