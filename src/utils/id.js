const crypto = require('crypto');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 식별자 생성·검증 유틸리티 */
class IdUtil {
  static generate() {
    return crypto.randomUUID();
  }

  static isValid(value) {
    return typeof value === 'string' && UUID_RE.test(value);
  }
}

module.exports = { IdUtil };
