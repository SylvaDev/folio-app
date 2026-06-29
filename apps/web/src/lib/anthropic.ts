import Anthropic from '@anthropic-ai/sdk'

/**
 * Lazy-initialized Anthropic client.
 *
 * Why lazy: prevents the SDK from reading ANTHROPIC_API_KEY at module load
 * time, which would happen the moment any route imports this file. Lazy
 * keeps the key inside the function closure and only materializes the
 * client when actually needed.
 *
 * SERVER-ONLY: never import this from a Client Component or shared util.
 */

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (_client) return _client
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }
  _client = new Anthropic({ apiKey: key })
  return _client
}
