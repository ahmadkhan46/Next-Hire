// OpenAI Pricing (as of 2024)
const PRICING = {
  'gpt-4o-mini': {
    input: 0.150 / 1_000_000,  // $0.150 per 1M input tokens
    output: 0.600 / 1_000_000, // $0.600 per 1M output tokens
  },
  'gpt-4o': {
    input: 2.50 / 1_000_000,
    output: 10.00 / 1_000_000,
  },
} as const;

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing) return 0;
  
  return (inputTokens * pricing.input) + (outputTokens * pricing.output);
}

export function estimateResumeTokens(resumeText: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(resumeText.length / 4);
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${(cost * 100).toFixed(4)}¢`;
  return `$${cost.toFixed(4)}`;
}
