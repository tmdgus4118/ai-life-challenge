const constants = require('../../src/shared/constants');

describe('shared/constants', () => {
  test('소음원 그룹은 7개이고 기타는 기준 유형이 없다', () => {
    expect(constants.SOURCE_GROUPS).toHaveLength(7);
    expect(constants.getSourceGroup('other').type).toBeNull();
    expect(constants.getSourceGroup('footstep').type).toBe('impact');
  });

  test('수신자 3 × 말투 3 조합이 정의되어 있다', () => {
    expect(constants.RECIPIENT_KEYS).toEqual(['neighbor', 'management', 'center']);
    expect(constants.TONE_KEYS).toEqual(['soft', 'basic', 'firm']);
  });

  test('getSourceGroup: 없는 키는 null', () => {
    expect(constants.getSourceGroup('unknown')).toBeNull();
    expect(constants.getSourceGroup(undefined)).toBeNull();
  });

  test('기본 설정은 야간 22~06, 민감도 3초', () => {
    expect(constants.DEFAULT_SETTINGS.night_start).toBe(22);
    expect(constants.DEFAULT_SETTINGS.night_end).toBe(6);
    expect(constants.DEFAULT_SETTINGS.min_duration_sec).toBe(3);
  });
});

describe('providerLabel / ASK_QUESTIONS', () => {
  test('모델·회사 이름 대신 AI로 표시, 모르는 값도 AI', () => {
    expect(constants.providerLabel('anthropic')).toBe('AI');
    expect(constants.providerLabel('template')).toBe('규칙 기반 작성기');
    expect(constants.providerLabel('x')).toBe('AI');
  });
  test('추천 질문은 모두 존댓말 의문문', () => {
    constants.ASK_QUESTIONS.forEach((q) => expect(q.label).toMatch(/(가요|나요)\?$/));
  });
});
