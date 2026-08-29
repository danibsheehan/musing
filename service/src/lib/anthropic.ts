import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Resolves ANTHROPIC_API_KEY from the environment — see @anthropic-ai/sdk client init. */
export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}
