import { LANGUAGE_CODES, type Language } from "./options";

export function translatorEnabled(): boolean {
    return Boolean(process.env.AZURE_TRANSLATOR_KEY);
}

export async function translate(texts: string[], language: Language): Promise<string[] | null> {
    const key = process.env.AZURE_TRANSLATOR_KEY;
    if (!key || language === "English" || texts.length === 0) return null;

    const endpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT || "https://api.cognitive.microsofttranslator.com").replace(/\/$/, "");
    const headers: Record<string, string> = {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/json",
    };
    if (process.env.AZURE_TRANSLATOR_REGION) headers["Ocp-Apim-Subscription-Region"] = process.env.AZURE_TRANSLATOR_REGION;

    try {
        const res = await fetch(
            `${endpoint}/translate?api-version=3.0&from=en&to=${LANGUAGE_CODES[language]}`,
            { method: "POST", headers, body: JSON.stringify(texts.map((Text) => ({ Text }))) },
        );
        if (!res.ok) {
            console.error("Translator error:", res.status, await res.text());
            return null;
        }
        const data = (await res.json()) as { translations: { text: string }[] }[];
        return data.map((d) => d.translations[0]?.text ?? "");
    } catch (err) {
        console.error("Translator failed:", err);
        return null;
    }
}