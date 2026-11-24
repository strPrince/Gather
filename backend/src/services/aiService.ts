import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export interface AssistRequest {
  selection: string;
  action: 'rewrite' | 'summarize' | 'expand';
  tone?: string;
  context?: string;
}

export interface AssistResponse {
  variants: string[];
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export const aiService = {
  /**
   * Call OpenAI API for text assist
   */
  assist: async (req: AssistRequest): Promise<AssistResponse> => {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const systemPrompts = {
      rewrite: 'You are an expert editor. Rewrite the provided text in 3 different styles: concise, detailed, and creative. Return as JSON array.',
      summarize: 'Summarize the provided text in 3 ways: bullet points, one sentence, and key takeaway. Return as JSON array.',
      expand: 'Expand the provided text in 3 ways: add examples, add context, add emotional appeal. Return as JSON array.',
    };

    const userPrompt = `${systemPrompts[req.action]}\n\nText: "${req.selection}"\n\nTone: ${req.tone || 'professional'}`;

    try {
      const response = await axios.post(
        `${OPENAI_BASE_URL}/chat/completions`,
        {
          model: OPENAI_MODEL,
          messages: [
            {
              role: 'system',
              content: systemPrompts[req.action],
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Try to parse as JSON array, fallback to string split
      let variants: string[] = [];
      try {
        const parsed = JSON.parse(content);
        variants = Array.isArray(parsed) ? parsed : [content];
      } catch {
        variants = content.split('\n').filter((line: string) => line.trim());
      }

      return {
        variants: variants.slice(0, 3),
        usage: {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
        },
      };
    } catch (error: any) {
      console.error('OpenAI API error:', error.response?.data || error.message);
      throw new Error(`AI assist failed: ${error.message}`);
    }
  },
};
