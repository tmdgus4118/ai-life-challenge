const { BaseDto } = require('./BaseDto');
const { ValidationError } = require('../utils/errors');
const { SETTINGS_LIMITS, SETTINGS_BOOLEANS, SETTINGS_ENUMS } = require('../shared/constants');

/** PUT /settings */
class UpdateSettingsDto extends BaseDto {
  constructor(data) {
    super();
    Object.assign(this, data);
  }

  static from(body) {
    const b = BaseDto.requireObject(body);
    const patch = {};
    Object.entries(SETTINGS_LIMITS).forEach(([field, limit]) => {
      const integer = !['confidence_threshold', 'db_offset'].includes(field);
      const value = BaseDto.number(b[field], field, { ...limit, required: false, integer });
      if (value !== undefined) patch[field] = value;
    });
    SETTINGS_BOOLEANS.forEach((field) => {
      if (b[field] !== undefined && b[field] !== null) patch[field] = BaseDto.boolean(b[field], field);
    });
    Object.entries(SETTINGS_ENUMS).forEach(([field, allowed]) => {
      const value = BaseDto.oneOf(b[field], field, allowed, { required: false });
      if (value !== undefined) patch[field] = value;
    });
    if (Object.keys(patch).length === 0) {
      throw new ValidationError('변경할 설정 항목이 없습니다.');
    }
    if (patch.night_start !== undefined && patch.night_end !== undefined && patch.night_start === patch.night_end) {
      throw new ValidationError('야간 시작과 종료 시각은 같을 수 없습니다.', { field: 'night_end' });
    }
    return new UpdateSettingsDto(patch);
  }
}

module.exports = { UpdateSettingsDto };
