const { TemplateLlmClient } = require('./TemplateLlmClient');
const { AnthropicLlmClient } = require('./AnthropicLlmClient');

/** 환경 설정에 따라 LLM 구현체를 고른다 (모델 교체 가능 계층) */
class LlmClientFactory {
  /** API 키 형식 검사: 비어 있지 않고, 공백·한글 없이 ASCII로만 된 값 */
  static isValidApiKey(key) {
    return typeof key === 'string' && key.length >= 20 && /^[\x21-\x7e]+$/.test(key);
  }

  static create(config = {}) {
    const provider = (config.llmProvider || 'template').toLowerCase();
    const templateOptions = { chunkDelayMs: config.streamChunkDelayMs ?? 22, thinkMs: config.streamThinkMs ?? 900 };
    if (provider === 'anthropic') {
      if (!config.anthropicApiKey) {
        return { client: new TemplateLlmClient(templateOptions), fallbackReason: 'ANTHROPIC_API_KEY가 없어 규칙 기반 작성기로 대체' };
      }
      if (!LlmClientFactory.isValidApiKey(config.anthropicApiKey)) {
        return { client: new TemplateLlmClient(templateOptions), fallbackReason: 'ANTHROPIC_API_KEY 형식이 올바르지 않아(예시 문구, 한글, 공백 등) 규칙 기반 작성기로 대체' };
      }
      return { client: new AnthropicLlmClient({ apiKey: config.anthropicApiKey, model: config.llmModel }), fallbackReason: null };
    }
    if (provider !== 'template') {
      return { client: new TemplateLlmClient(templateOptions), fallbackReason: `알 수 없는 LLM_PROVIDER(${provider}) → 규칙 기반 작성기 사용` };
    }
    return { client: new TemplateLlmClient(templateOptions), fallbackReason: null };
  }
}

module.exports = { LlmClientFactory };
