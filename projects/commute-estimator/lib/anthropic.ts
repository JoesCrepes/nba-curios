import Anthropic from '@anthropic-ai/sdk';
import type { Recommendation, Segment, WmataIncident } from './types';

// Small, cheap, fast model — this call is one structured request per estimate,
// not a chat. See Section 4 of the architecture doc.
const MODEL = 'claude-haiku-4-5-20251001';

const RECOMMENDATION_TOOL: Anthropic.Tool = {
  name: 'submit_recommendation',
  description: 'Submit the commute recommendation for the user.',
  input_schema: {
    type: 'object',
    properties: {
      chosenOption: {
        type: 'string',
        description: 'Must exactly match the "label" of one of the candidateSegmentSets passed in.',
      },
      summary: {
        type: 'string',
        description: 'One-sentence recommendation, e.g. "Bike to Dupont, Red Line to Friendship Heights, bike the rest."',
      },
      reasoning: {
        type: 'string',
        description: 'Short explanation of why this option beats the alternative right now.',
      },
      caveats: {
        type: 'array',
        items: { type: 'string' },
        description: 'Plain-language warnings, e.g. "Single-tracking on the Red Line — add a 5 min buffer."',
      },
      confidence: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Low if live data was stale/missing and this is a conservative guess.',
      },
    },
    required: ['chosenOption', 'summary', 'reasoning', 'caveats', 'confidence'],
  },
};

export type ReasoningInput = {
  candidateSegmentSets: { label: string; segments: Segment[]; totalMinutes: number }[];
  incidents: WmataIncident[];
  preferences: { bikeOverWalk: boolean; pace: 'casual' | 'brisk' };
  dataWarnings: string[];
};

export async function getRecommendation(input: ReasoningInput): Promise<Recommendation> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [RECOMMENDATION_TOOL],
    tool_choice: { type: 'tool', name: 'submit_recommendation' },
    messages: [
      {
        role: 'user',
        content: [
          'You are recommending a real-time bike+transit+bike commute route.',
          'Given the candidate route options below (each already computed from live data),',
          'active incidents, and the rider\'s preferences, pick the best option and explain it briefly.',
          'Handle judgment calls a calculator cannot: whether a delay is big enough to matter,',
          'whether an incident should change the recommended station, and how to caveat stale/missing data.',
          '',
          `Candidate options: ${JSON.stringify(input.candidateSegmentSets)}`,
          `Active incidents: ${JSON.stringify(input.incidents)}`,
          `Rider preferences: ${JSON.stringify(input.preferences)}`,
          `Data warnings (already known — factor into confidence): ${JSON.stringify(input.dataWarnings)}`,
        ].join('\n'),
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  if (!toolUse) {
    throw new Error('Anthropic response did not include the expected tool call');
  }

  return toolUse.input as Recommendation;
}
