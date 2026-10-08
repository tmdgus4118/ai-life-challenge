const { BaseDto } = require('./BaseDto');
const { ValidationError } = require('../utils/errors');
const { SOURCE_KEYS } = require('../shared/constants');

/** POST /api/lab/runs : 정답 소음원 + 1초 단위 분류 결과 */
class LabRunDto extends BaseDto {
  constructor(data) {
    super();
    Object.assign(this, data);
  }

  static from(body) {
    const b = BaseDto.requireObject(body);
    const expected = BaseDto.oneOf(b.expected_group, 'expected_group', SOURCE_KEYS.filter((k) => k !== 'other'));
    if (!Array.isArray(b.frames) || b.frames.length === 0) throw new ValidationError('frames 배열이 필요합니다.', { field: 'frames' });
    if (b.frames.length > 120) throw new ValidationError('frames는 120개 이하여야 합니다.', { field: 'frames' });
    const frames = b.frames.map((f, i) => {
      BaseDto.requireObject(f, `frames[${i}]`);
      return {
        group: BaseDto.oneOf(f.group, `frames[${i}].group`, SOURCE_KEYS),
        confidence: BaseDto.number(f.confidence, `frames[${i}].confidence`, { min: 0, max: 1 }),
        top_class: BaseDto.string(f.top_class, `frames[${i}].top_class`, { maxLength: 80 }) || null,
      };
    });
    return new LabRunDto({ expected_group: expected, frames });
  }
}

module.exports = { LabRunDto };
