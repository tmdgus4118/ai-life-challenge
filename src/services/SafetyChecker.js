const { MESSAGE_MAX_LENGTH, REPORT_MAX_SENTENCES } = require('../shared/constants');

/**
 * 생성문 안전장치. 위협·비난·감정·추측 표현과 입력에 없는 숫자를 문자열 검사로 걸러낸다.
 */
class SafetyChecker {
  constructor({ forbidden = SafetyChecker.DEFAULT_FORBIDDEN } = {}) {
    this.forbidden = forbidden;
  }

  static get DEFAULT_FORBIDDEN() {
    return [
      // 위협·법적 경고
      '고소', '신고하겠', '신고할', '신고를 하', '경찰', '법적 조치', '법적조치', '소송', '손해배상', '가만두지', '가만히 있지', '각오',
      // 감정·비난
      '참을 만큼 참았', '참을만큼 참았', '짜증', '화가 나', '화가 납니다', '열받', '미치겠', '죽겠', '몰상식', '뻔뻔', '싸가지', '배려가 없', '배려 없', '무례', '제정신',
      // 추측·특정인 지목
      '일부러', '고의로', '위층', '윗집', '아랫집', '옆집', '당신',
    ];
  }

  /** 금지 표현 검사 → 걸린 표현 목록 */
  checkForbidden(text) {
    if (typeof text !== 'string') throw new TypeError('text must be a string');
    return this.forbidden.filter((word) => text.includes(word));
  }

  /** 본문에서 숫자(소수 포함)를 뽑는다 */
  extractNumbers(text) {
    if (typeof text !== 'string') throw new TypeError('text must be a string');
    return (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  }

  /** 허용 집합에 없는 숫자 목록 */
  checkNumbers(text, allowed) {
    if (!(allowed instanceof Set)) throw new TypeError('allowed must be a Set');
    return this.extractNumbers(text).filter((n) => !allowed.has(n));
  }

  /** 문장 수 (숫자 뒤의 소수점은 제외) */
  countSentences(text) {
    if (typeof text !== 'string') throw new TypeError('text must be a string');
    const matches = text.match(/[^\d\s][.!?](?=\s|$)/g);
    return matches ? matches.length : (text.trim() ? 1 : 0);
  }

  /** 리포트 요약문 검증 */
  validateReport(text, allowedNumbers, { maxSentences = REPORT_MAX_SENTENCES } = {}) {
    const problems = [];
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, problems: ['빈 응답'] };
    }
    const forbidden = this.checkForbidden(text);
    if (forbidden.length) problems.push(`금지 표현: ${forbidden.join(', ')}`);
    const unknown = this.checkNumbers(text, allowedNumbers);
    if (unknown.length) problems.push(`입력에 없는 숫자: ${unknown.join(', ')}`);
    const sentences = this.countSentences(text);
    if (sentences > maxSentences) problems.push(`문장 수 초과: ${sentences} > ${maxSentences}`);
    return { ok: problems.length === 0, problems };
  }

  /** 중재 메시지 검증 */
  validateMessage(text, allowedNumbers, { maxLength = MESSAGE_MAX_LENGTH } = {}) {
    const problems = [];
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, problems: ['빈 응답'] };
    }
    const forbidden = this.checkForbidden(text);
    if (forbidden.length) problems.push(`금지 표현: ${forbidden.join(', ')}`);
    const unknown = this.checkNumbers(text, allowedNumbers);
    if (unknown.length) problems.push(`입력에 없는 숫자: ${unknown.join(', ')}`);
    if (text.length > maxLength) problems.push(`길이 초과: ${text.length} > ${maxLength}`);
    return { ok: problems.length === 0, problems };
  }
}

module.exports = { SafetyChecker };
