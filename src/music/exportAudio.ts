export type AudioFormat = "mp3" | "wav";

export function encodeMp3(samples: Float32Array, rate: number) {
  return new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(new URL("./mp3.worker.ts", import.meta.url), { type: "module" });
    function settle(result: Blob | Error) {
      worker.terminate();
      if (result instanceof Blob) resolve(result);
      else reject(result);
    }
    worker.onmessage = (event: MessageEvent<Blob | string>) => {
      settle(typeof event.data === "string" ? new Error(event.data) : event.data);
    };
    worker.onerror = () => settle(new Error("Could not start the MP3 encoder."));
    try {
      const pcm = samples.slice();
      worker.postMessage({ samples: pcm, rate }, [pcm.buffer]);
    } catch (error) {
      settle(error instanceof Error ? error : new Error("Could not send the song to the MP3 encoder."));
    }
  });
}

export function encodeWav(samples: Float32Array, rate: number) {
  const bytes = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const ascii = (start: number, value: string) => [...value].forEach((letter, index) => bytes.setUint8(start + index, letter.charCodeAt(0)));
  ascii(0, "RIFF"); bytes.setUint32(4, bytes.byteLength - 8, true); ascii(8, "WAVE");
  ascii(12, "fmt "); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true);
  bytes.setUint32(24, rate, true); bytes.setUint32(28, rate * 2, true); bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true);
  ascii(36, "data"); bytes.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => bytes.setInt16(44 + index * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true));
  return new Blob([bytes.buffer], { type: "audio/wav" });
}
