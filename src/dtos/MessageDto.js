const { BaseDto } = require('./BaseDto');
const { RECIPIENT_KEYS, TONE_KEYS, REPORT_PERIODS } = require('../shared/constants');

/** POST /messages/generate {recipient, tone, days?, report_id?} */
class GenerateMessageDto extends BaseDto {
  constructor(data) {
    super();
    Object.assign(this, data);
  }

  static from(body) {
    const b = BaseDto.requireObject(body);
    const rawDays = b.days === undefined || b.days === null || b.days === '' ? 7 : b.days;
    return new GenerateMessageDto({
      recipient: BaseDto.oneOf(b.recipient, 'recipient', RECIPIENT_KEYS),
      tone: BaseDto.oneOf(b.tone, 'tone', TONE_KEYS, { required: false, fallback: 'basic' }),
      days: BaseDto.oneOf(BaseDto.number(rawDays, 'days', { integer: true }), 'days', REPORT_PERIODS),
      report_id: BaseDto.string(b.report_id, 'report_id', { maxLength: 100 }) || null,
    });
  }
}

module.exports = { GenerateMessageDto };
