const { ValidationError } = require('../utils/errors');

/**
 * DTO 공통 검증 도우미. 각 DTO는 static from(body)로 생성하며 잘못된 값은 ValidationError를 던진다.
 */
class BaseDto {
  static requireObject(body, name = 'body') {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ValidationError(`${name}는 객체여야 합니다.`);
    }
    return body;
  }

  static number(value, field, { min = -Infinity, max = Infinity, required = true, integer = false } = {}) {
    if (value === undefined || value === null || value === '') {
      if (required) throw new ValidationError(`${field}는 필수입니다.`, { field });
      return undefined;
    }
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(num)) throw new ValidationError(`${field}는 숫자여야 합니다.`, { field });
    if (integer && !Number.isInteger(num)) throw new ValidationError(`${field}는 정수여야 합니다.`, { field });
    if (num < min || num > max) throw new ValidationError(`${field}는 ${min}~${max} 범위여야 합니다.`, { field });
    return num;
  }

  static isoDate(value, field, { required = true } = {}) {
    if (value === undefined || value === null || value === '') {
      if (required) throw new ValidationError(`${field}는 필수입니다.`, { field });
      return undefined;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new ValidationError(`${field}는 유효한 날짜여야 합니다.`, { field });
    return date.toISOString();
  }

  static oneOf(value, field, allowed, { required = true, fallback = undefined } = {}) {
    if (value === undefined || value === null || value === '') {
      if (required) throw new ValidationError(`${field}는 필수입니다.`, { field });
      return fallback;
    }
    if (!allowed.includes(value)) {
      throw new ValidationError(`${field}는 [${allowed.join(', ')}] 중 하나여야 합니다.`, { field });
    }
    return value;
  }

  static string(value, field, { required = false, maxLength = 1000 } = {}) {
    if (value === undefined || value === null) {
      if (required) throw new ValidationError(`${field}는 필수입니다.`, { field });
      return undefined;
    }
    if (typeof value !== 'string') throw new ValidationError(`${field}는 문자열이어야 합니다.`, { field });
    const trimmed = value.trim();
    if (required && !trimmed) throw new ValidationError(`${field}는 비어 있을 수 없습니다.`, { field });
    if (trimmed.length > maxLength) throw new ValidationError(`${field}는 ${maxLength}자 이내여야 합니다.`, { field });
    return trimmed;
  }

  static boolean(value, field, fallback = false) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    throw new ValidationError(`${field}는 불리언이어야 합니다.`, { field });
  }
}

module.exports = { BaseDto };
