import { AzureOpenAI } from "openai";

let client: AzureOpenAI | null | undefined;

export function getAI(): AzureOpenAI | null {
  if (client !== undefined) return client;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  client =
    endpoint && apiKey && deployment
      ? new AzureOpenAI({
          endpoint,
          apiKey,
          deployment,
          apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21",
        })
      : null;
  return client;
}

/** Asks the model for a JSON response. Returns null if AI isn't configured or the JSON is invalid. */
export async function askJSON<T>(system: string, user: string, temperature = 0.4): Promise<T | null> {
  const ai = getAI();
  if (!ai) return null;

  const res = await ai.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature,
    max_tokens: 800,
    response_format: { type: "json_object" },
  });

  try {
    return JSON.parse(res.choices[0]?.message?.content ?? "") as T;
  } catch {
    return null;
  }
}
