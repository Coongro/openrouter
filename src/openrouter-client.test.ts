import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OpenRouterConfig } from './config.js';
import { callOpenRouter, type ChatCompletionOptions } from './openrouter-client.js';

const config: OpenRouterConfig = {
  apiKey: 'test-key',
  defaultModel: 'test/model',
  models: { fast: 'test/fast', standard: 'test/standard', advanced: 'test/advanced' },
  taskCost: { fast: 1, standard: 1, advanced: 2 },
  skuCatalog: {},
  referer: 'https://test.local',
  title: 'Test',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function okFetch(content = '{"decision":"resolved"}') {
  return vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [{ message: { content }, finish_reason: 'stop' }],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 4,
            completion_tokens_details: { reasoning_tokens: 0 },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
  );
}

describe('callOpenRouter structured output', () => {
  it('envía JSON Schema estricto y exige un provider compatible', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    const options: ChatCompletionOptions = {
      messages: [{ role: 'user', content: 'resolvé' }],
      responseSchema: {
        name: 'agentic_binding_v1',
        schema: {
          type: 'object',
          properties: { decision: { type: 'string' } },
          required: ['decision'],
          additionalProperties: false,
        },
      },
      reasoning: { effort: 'none', exclude: true },
    };

    const result = await callOpenRouter(options, config);
    const init = fetchMock.mock.calls[0]?.[1];
    const parsed: unknown = JSON.parse(String(init?.body));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('payload de prueba inválido');
    }
    const body = parsed as Record<string, unknown>;

    expect(body.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'agentic_binding_v1',
        strict: true,
        schema: options.responseSchema?.schema,
      },
    });
    expect(body.provider).toEqual({ require_parameters: true });
    expect(body.reasoning).toEqual({ effort: 'none', exclude: true });
    expect(result.usage).toEqual({
      promptTokens: 12,
      completionTokens: 4,
      reasoningTokens: 0,
    });
    expect(result.finishReason).toBe('stop');
  });

  it('rechaza nombres de schema inválidos antes de llamar al proveedor', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callOpenRouter(
        {
          messages: [{ role: 'user', content: 'resolvé' }],
          responseSchema: { name: 'nombre con espacios', schema: { type: 'object' } },
        },
        config
      )
    ).rejects.toThrow('responseSchema.name');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
