const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

type VoyageEmbeddingResponse = {
  data: { embedding: number[]; index: number }[];
  model: string;
  usage: { total_tokens: number };
};

export async function embedTexts(
  texts: string[],
): Promise<{ embeddings: number[][]; tokensUsed: number }> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY must be set");
  }
  const model = process.env.EMBEDDING_MODEL;
  if (!model) {
    throw new Error("EMBEDDING_MODEL must be set");
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: texts, model }),
  });

  if (!response.ok) {
    throw new Error(
      `Voyage embeddings request failed: ${response.status} ${await response.text()}`,
    );
  }

  const body = (await response.json()) as VoyageEmbeddingResponse;
  const embeddings = body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  return { embeddings, tokensUsed: body.usage.total_tokens };
}
