import { TOOL_DEFINITIONS, type CallModel, type ModelResponse } from './agent';

interface OpenAIChoice {
  message: {
    content: string | null;
    tool_calls?: { id: string; function: { name: string; arguments: string } }[];
  };
}

export function makeOpenAICaller(apiKey: string, model: string): CallModel {
  return async (messages, { allowTools }) => {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_completion_tokens: 1200,
      // Cheap + fast for retrieval-grounded answers. If the API rejects this
      // param for the configured model, delete this line.
      reasoning_effort: 'minimal',
    };
    if (allowTools) {
      body.tools = TOOL_DEFINITIONS;
      body.tool_choice = 'auto';
    }

    let response = await callOnce(apiKey, body);
    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      await new Promise((r) => setTimeout(r, 1000));
      response = await callOnce(apiKey, body);
    }
    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as { choices: OpenAIChoice[] };
    const message = json.choices[0].message;
    const result: ModelResponse = {};
    if (message.content) result.content = message.content;
    if (message.tool_calls?.length) {
      result.toolCalls = message.tool_calls.map((c) => ({
        id: c.id,
        name: c.function.name,
        arguments: c.function.arguments,
      }));
    }
    return result;
  };
}

function callOnce(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}
