export type AudioFormat = "mp3" | "wav";

export function encodeMp3(left: Float32Array, right: Float32Array, rate: number) {
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
      const leftChannel = left.slice();
      const rightChannel = right.slice();
      worker.postMessage({ left: leftChannel, right: rightChannel, rate }, [leftChannel.buffer, rightChannel.buffer]);
    } catch (error) {
      settle(error instanceof Error ? error : new Error("Could not send the song to the MP3 encoder."));
    }
  });
}

export function encodeWav(left: Float32Array, right: Float32Array, rate: number) {
  const bytes = new DataView(new ArrayBuffer(44 + left.length * 4));
  const ascii = (start: number, value: string) => [...value].forEach((letter, index) => bytes.setUint8(start + index, letter.charCodeAt(0)));
  ascii(0, "RIFF"); bytes.setUint32(4, bytes.byteLength - 8, true); ascii(8, "WAVE");
  ascii(12, "fmt "); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 2, true);
  bytes.setUint32(24, rate, true); bytes.setUint32(28, rate * 4, true); bytes.setUint16(32, 4, true); bytes.setUint16(34, 16, true);
  ascii(36, "data"); bytes.setUint32(40, left.length * 4, true);
  const pcm = (sample: number) => Math.round(Math.max(-1, Math.min(1, sample)) * 32767);
  for (let index = 0; index < left.length; index++) {
    bytes.setInt16(44 + index * 4, pcm(left[index]), true);
    bytes.setInt16(46 + index * 4, pcm(right[index]), true);
  }
  return new Blob([bytes.buffer], { type: "audio/wav" });
}
