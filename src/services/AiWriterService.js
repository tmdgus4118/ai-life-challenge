const { PromptBuilder } = require('./llm/PromptBuilder');
const { TemplateLlmClient } = require('./llm/TemplateLlmClient');
const { SafetyChecker } = require('./SafetyChecker');
const { AggregationService } = require('./AggregationService');

/**
 * 생성 → 검사 → 재생성 루프를 담당한다.
 * 1차 클라이언트(LLM)가 검사에 계속 걸리면 규칙 기반 작성기로 대체한다.
 */
class AiWriterService {
  constructor({ llmClient, fallbackClient = new TemplateLlmClient(), safetyChecker = new SafetyChecker(), promptBuilder = new PromptBuilder(), aggregationService = new AggregationService(), maxAttempts = 3 }) {
    if (!llmClient) throw new TypeError('llmClient is required');
    this.llmClient = llmClient;
    this.fallbackClient = fallbackClient;
    this.safety = safetyChecker;
    this.prompts = promptBuilder;
    this.aggregation = aggregationService;
    this.maxAttempts = maxAttempts;
  }

  /** 입력 JSON·설정·기준표의 숫자를 허용 집합으로 만든다 */
  buildAllowedNumbers(summary, settings = {}, thresholds = []) {
    const allowed = this.aggregation.collectNumbers(summary);
    this.aggregation.collectNumbers(settings, allowed);
    this.aggregation.collectNumbers(thresholds, allowed);
    [1, 5, 24, 2, 3].forEach((n) => allowed.add(n)); // 1분·5분 평균, 2주 안내 등 고정 숫자
    return allowed;
  }

  async writeReport(summary, { settings = {}, thresholds = [], onEvent = null, signal = null } = {}) {
    if (!summary) throw new TypeError('summary is required');
    const allowed = this.buildAllowedNumbers(summary, settings, thresholds);
    const task = {
      type: 'report',
      summary,
      settings,
      system: PromptBuilder.REPORT_SYSTEM,
      prompt: this.prompts.buildReportPrompt(summary, settings),
    };
    return this.runWithGuard(task, (text) => this.safety.validateReport(text, allowed), { onEvent, signal });
  }

  async writeMessage(summary, recipient, tone, { settings = {}, thresholds = [], onEvent = null, signal = null } = {}) {
    if (!summary) throw new TypeError('summary is required');
    const allowed = this.buildAllowedNumbers(summary, settings, thresholds);
    const task = {
      type: 'message',
      summary,
      recipient,
      tone,
      settings,
      system: PromptBuilder.MESSAGE_SYSTEM,
      prompt: this.prompts.buildMessagePrompt(summary, recipient, tone, settings),
    };
    return this.runWithGuard(task, (text) => this.safety.validateMessage(text, allowed), { onEvent, signal });
  }

  /** 기록에게 묻기: 3문장 이내, 입력에 없는 숫자·금지 표현 검사 */
  async writeAnswer(context, { question, questionKey = null }, { settings = {}, thresholds = [], onEvent = null, signal = null } = {}) {
    if (!context) throw new TypeError('context is required');
    if (typeof question !== 'string' || !question.trim()) throw new TypeError('question is required');
    const allowed = this.buildAllowedNumbers(context, settings, thresholds);
    const task = {
      type: 'answer',
      summary: context,
      question,
      questionKey,
      settings,
      system: PromptBuilder.ASK_SYSTEM,
      prompt: this.prompts.buildAskPrompt(context, question, settings),
    };
    return this.runWithGuard(task, (text) => this.safety.validateReport(text, allowed, { maxSentences: 4 }), { onEvent, signal });
  }

  /** onEvent가 있으면 스트리밍, 없으면 완성문 생성 */
  async callClient(client, task, emit, signal) {
    if (!emit) return client.generate(task);
    return client.stream(task, (text) => emit('delta', { text }), { signal });
  }

  /**
   * 생성 후 검사, 걸리면 재생성, 끝까지 실패하면 대체 작성기.
   * 스트리밍 이벤트: attempt(시도 시작) → delta(글 조각) … → retry(검사 탈락, 화면 지우기) → fallback(대체 작성기로 전환)
   */
  async runWithGuard(task, validate, { onEvent = null, signal = null } = {}) {
    if (onEvent !== null && typeof onEvent !== 'function') throw new TypeError('onEvent must be a function');
    const emit = onEvent;
    const log = [];
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      if (signal && signal.aborted) throw new Error('aborted');
      if (emit) emit('attempt', { attempt, provider: this.llmClient.name });
      let text;
      try {
        text = await this.callClient(this.llmClient, task, emit, signal);
      } catch (err) {
        if (signal && signal.aborted) throw err;
        log.push({ attempt, error: err.message });
        if (emit) emit('retry', { attempt, problems: ['생성 실패'] });
        continue;
      }
      const result = validate(text);
      if (result.ok) {
        return { text, provider: this.llmClient.name, attempts: attempt, fallback: false, log };
      }
      log.push({ attempt, problems: result.problems });
      if (emit) emit('retry', { attempt, problems: result.problems });
    }
    if (signal && signal.aborted) throw new Error('aborted');
    if (emit) emit('fallback', { provider: this.fallbackClient.name });
    const text = await this.callClient(this.fallbackClient, task, emit, signal);
    const check = validate(text);
    return {
      text,
      provider: this.fallbackClient.name,
      attempts: this.maxAttempts,
      fallback: true,
      log: check.ok ? log : [...log, { fallback: true, problems: check.problems }],
    };
  }
}

module.exports = { AiWriterService };
