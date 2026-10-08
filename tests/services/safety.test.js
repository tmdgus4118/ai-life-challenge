const { SafetyChecker } = require('../../src/services/SafetyChecker');

const checker = new SafetyChecker();
const allowed = new Set([7, 61, 23, 9, 25, 10, 1, 58.3, 58, 22]);

describe('SafetyChecker', () => {
  test('checkForbidden: 위협·감정·추측 표현 검출 / 실패: 문자열 아님', () => {
    expect(checker.checkForbidden('더 이상 참을 만큼 참았습니다. 신고하겠습니다.')).toEqual(expect.arrayContaining(['신고하겠', '참을 만큼 참았']));
    expect(checker.checkForbidden('위층에서 일부러 뛰는 것 같습니다')).toEqual(expect.arrayContaining(['일부러', '위층']));
    expect(checker.checkForbidden('기록된 소음은 22~23시에 많았습니다.')).toEqual([]);
    expect(() => checker.checkForbidden(null)).toThrow(TypeError);
  });
  test('extractNumbers / checkNumbers', () => {
    expect(checker.extractNumbers('총 61건 중 23건, 58.3dB')).toEqual([61, 23, 58.3]);
    expect(checker.checkNumbers('총 61건 중 23건', allowed)).toEqual([]);
    expect(checker.checkNumbers('총 99건', allowed)).toEqual([99]);
    expect(() => checker.checkNumbers('x', [])).toThrow(TypeError);
  });
  test('countSentences: 소수점은 문장으로 세지 않는다', () => {
    expect(checker.countSentences('첫 문장입니다. 둘째 문장은 58.3dB입니다. 셋째!')).toBe(3);
    expect(checker.countSentences('마침표 없는 한 문장')).toBe(1);
    expect(checker.countSentences('')).toBe(0);
    expect(() => checker.countSentences(5)).toThrow(TypeError);
  });
  test('validateReport 성공/실패', () => {
    const ok = checker.validateReport('기록된 소음은 22시에 7건이었습니다. 총 61건 중 23건이 기준을 넘었습니다.', allowed);
    expect(ok.ok).toBe(true);
    const bad = checker.validateReport('위층이 99건이나 뛰었습니다. 하나. 둘. 셋. 넷. 다섯. 여섯.', allowed);
    expect(bad.ok).toBe(false);
    expect(bad.problems).toHaveLength(3);
    expect(checker.validateReport('', allowed).ok).toBe(false);
  });
  test('validateMessage 성공/실패(길이·금지어)', () => {
    expect(checker.validateMessage('안녕하세요. 22~23시에 7건 기록되었습니다. 신경 써 주시면 감사하겠습니다.', allowed).ok).toBe(true);
    const long = checker.validateMessage('가'.repeat(301), allowed);
    expect(long.ok).toBe(false);
    expect(long.problems[0]).toContain('길이 초과');
    expect(checker.validateMessage('고소하겠습니다', allowed).problems[0]).toContain('금지 표현');
    expect(checker.validateMessage(null, allowed).ok).toBe(false);
  });
  test('사용자 정의 금지어 목록', () => {
    const custom = new SafetyChecker({ forbidden: ['바나나'] });
    expect(custom.checkForbidden('바나나 신고하겠다')).toEqual(['바나나']);
  });
});
