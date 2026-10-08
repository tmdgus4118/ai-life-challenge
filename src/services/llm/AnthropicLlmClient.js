const { LlmClient } = require('./LlmClient');
const { LlmError } = require('../../utils/errors');

/**
 * Anthropic Claude 호출 구현체. 프롬프트는 PromptBuilder가 만들고 여기서는 호출만 한다.
 */
class AnthropicLlmClient extends LlmClient {
  constructor({ apiKey, model = 'claude-opus-5-5', sdk = null, maxTokens = 1024 } = {}) {
    super('anthropic');
    if (!apiKey && !sdk) throw new TypeError('apiKey is required');
    this.model = model;
    this.maxTokens = maxTokens;
    if (sdk) {
      this.client = sdk;
    } else {
      // eslint-disable-next-line global-require
      const Anthropic = require('@anthropic-ai/sdk');
      this.client = new Anthropic({ apiKey });
    }
  }

  buildParams(task) {
    this.validateTask(task);
    if (!task.system || !task.prompt) throw new TypeError('task.system and task.prompt are required');
    return {
      model: this.model,
      max_tokens: this.maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: task.system,
      messages: [{ role: 'user', content: task.prompt }],
    };
  }

  async generate(task) {
    const params = this.buildParams(task);
    let response;
    try {
      response = await this.client.beta.messages.create(params);
    } catch (err) {
      throw new LlmError('AI 호출에 실패했습니다.', { cause: err.message, status: err.status });
    }
    return this.extractText(response);
  }

  /** 실제 스트리밍: 모델이 쓰는 글자를 받는 즉시 onDelta로 넘긴다 */
  async stream(task, onDelta, { signal = null } = {}) {
    if (typeof onDelta !== 'function') throw new TypeError('onDelta must be a function');
    const params = this.buildParams(task);
    let final;
    try {
      const stream = this.client.beta.messages.stream(params, signal ? { signal } : undefined);
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta && event.delta.type === 'text_delta') {
          onDelta(event.delta.text);
        }
      }
      final = await stream.finalMessage();
    } catch (err) {
      throw new LlmError('AI 호출에 실패했습니다.', { cause: err.message, status: err.status });
    }
    return this.extractText(final);
  }

  extractText(response) {
    if (!response) throw new LlmError('AI 응답이 비어 있습니다.');
    if (response.stop_reason === 'refusal') {
      throw new LlmError('AI가 요청을 거절했습니다.', { category: response.stop_details && response.stop_details.category });
    }
    const text = (response.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) throw new LlmError('AI 응답이 비어 있습니다.');
    return text;
  }
}

module.exports = { AnthropicLlmClient };
