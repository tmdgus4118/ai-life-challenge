/**
 * LLM 호출 계층의 공통 인터페이스. 구현체를 바꿔 끼울 수 있다.
 * task = { type: 'report'|'message'|'answer', system, prompt, summary, recipient, tone, question, questionKey, settings }
 */
class LlmClient {
  constructor(name) {
    this.name = name || 'llm';
  }

  // eslint-disable-next-line no-unused-vars
  async generate(task) {
    throw new Error('generate() must be implemented by subclass');
  }

  /**
   * 생성 과정을 조각(delta) 단위로 전달한다. 기본 구현은 완성문을 한 번에 넘긴다.
   * @returns {Promise<string>} 완성된 글
   */
  async stream(task, onDelta, { signal = null } = {}) {
    if (typeof onDelta !== 'function') throw new TypeError('onDelta must be a function');
    const text = await this.generate(task);
    if (signal && signal.aborted) throw new Error('aborted');
    onDelta(text);
    return text;
  }

  validateTask(task) {
    if (!task || typeof task !== 'object') throw new TypeError('task is required');
    if (!['report', 'message', 'answer'].includes(task.type)) throw new TypeError('task.type must be report, message or answer');
    if (!task.summary || typeof task.summary !== 'object') throw new TypeError('task.summary is required');
    return task;
  }
}

module.exports = { LlmClient };
