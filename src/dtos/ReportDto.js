const { BaseDto } = require('./BaseDto');
const { REPORT_PERIODS, ASK_QUESTIONS, ASK_KEYS, ASK_MAX_LENGTH } = require('../shared/constants');
const { ValidationError } = require('../utils/errors');

/** GET /reports/summary?days=7, POST /reports/generate {days} */
class ReportQueryDto extends BaseDto {
  constructor(days) {
    super();
    this.days = days;
  }

  static from(source = {}) {
    const s = source || {};
    const raw = s.days === undefined || s.days === null || s.days === '' ? 7 : s.days;
    const days = BaseDto.number(raw, 'days', { integer: true, min: 1, max: 365 });
    return new ReportQueryDto(BaseDto.oneOf(days, 'days', REPORT_PERIODS));
  }
}

/** POST /api/reports/ask/stream {days, question_key?, question?} */
class AskDto extends BaseDto {
  constructor(data) {
    super();
    Object.assign(this, data);
  }

  static from(body) {
    const b = BaseDto.requireObject(body);
    const { days } = ReportQueryDto.from(b);
    const key = BaseDto.oneOf(b.question_key, 'question_key', ASK_KEYS, { required: false, fallback: null });
    const free = BaseDto.string(b.question, 'question', { maxLength: ASK_MAX_LENGTH });
    if (!key && !free) throw new ValidationError('질문을 입력하거나 추천 질문을 골라 주세요.', { field: 'question' });
    const question = free || ASK_QUESTIONS.find((q) => q.key === key).label;
    return new AskDto({ days, questionKey: free ? null : key, question });
  }
}

module.exports = { ReportQueryDto, AskDto };
