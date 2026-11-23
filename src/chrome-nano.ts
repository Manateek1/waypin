export const chromeNanoAvailable = typeof LanguageModel !== "undefined";

export async function promptChromeNano(
  prompt: string,
  responseConstraint: Record<string, unknown>,
  onProgress: (percent: number) => void,
  image?: () => Promise<Blob>,
) {
  if (!chromeNanoAvailable) throw new Error("This browser does not expose Chrome’s Gemini Nano Prompt API.");
  const session = await LanguageModel.create({
    expectedInputs: [
      { type: "text", languages: ["en"] },
      ...(image ? [{ type: "image" as const }] : []),
    ],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
    signal: AbortSignal.timeout(300_000),
    monitor(monitor) {
      monitor.addEventListener("downloadprogress", (event) => onProgress(Math.round(event.loaded * 100)));
    },
  });
  try {
    const content: LanguageModelMessageContent[] = [{ type: "text", value: prompt }];
    if (image) content.push({ type: "image", value: await image() });
    return await session.prompt([{ role: "user", content }], { responseConstraint });
  } finally {
    session.destroy();
  }
}
