const fs = require('fs');
const path = require('path');
const { KO_CLASS, koName, subjectJosa, explain } = require('../../src/shared/lab-explain');
const { SourceMapper } = require('../../src/shared/source-mapper');
const { SOURCE_GROUPS } = require('../../src/shared/constants');

const frame = (group, name, confidence = 0.6) => ({ group, confidence, top: name ? [{ name, score: confidence }] : [] });

describe('koName', () => {
  test('YAMNet 이름을 한국어로 바꾼다', () => {
    expect(koName('Speech')).toBe('말소리');
    expect(koName('Walk, footsteps')).toBe('발걸음');
  });
  test('사전에 없는 이름은 그대로 돌려준다', () => {
    expect(koName('Didgeridoo')).toBe('Didgeridoo');
  });
  test('사전의 모든 이름은 실제 YAMNet 클래스다', () => {
    const csv = fs.readFileSync(path.join(__dirname, '../../src/public/models/yamnet_class_map.csv'), 'utf8');
    const names = new Set(SourceMapper.parseClassMapCsv(csv));
    expect(Object.keys(KO_CLASS).filter((k) => !names.has(k))).toEqual([]);
  });
  test('실패: 빈 값이나 문자열이 아니면 TypeError', () => {
    expect(() => koName('')).toThrow(TypeError);
    expect(() => koName(null)).toThrow(TypeError);
  });
});

describe('subjectJosa', () => {
  test('받침 유무에 따라 이/가', () => {
    expect(subjectJosa('발걸음')).toBe('이');
    expect(subjectJosa('망치·공사')).toBe('가');
    expect(subjectJosa('말소리·TV')).toBe('가');
  });
});

describe('explain', () => {
  test('틀린 측정: 분포, 들은 소리, 이유, 확인할 점', () => {
    const frames = [frame('voice', 'Speech'), frame('voice', 'Speech'), frame('voice', 'Narration, monologue'), frame('footstep', 'Walk, footsteps'), frame('other', 'Heart sounds, heartbeat', 0.1)];
    const r = explain(frames, { expected: 'footstep', predicted: 'voice', groups: SOURCE_GROUPS });
    expect(r.correct).toBe(false);
    expect(r.total).toBe(5);
    expect(r.frame_hits).toBe(1);
    expect(r.frame_accuracy).toBe(20);
    expect(r.distribution[0]).toMatchObject({ key: 'voice', label: '말소리·TV', count: 3, pct: 60 });
    expect(r.heard[0]).toEqual({ name: 'Speech', ko: '말소리', count: 2 });
    expect(r.reason).toContain('기타를 뺀 4번');
    expect(r.reason).toContain('말소리·TV가 3번');
    expect(r.reason).toContain('말소리(Speech)');
    expect(r.tips).toHaveLength(2);
    expect(r.tips[0]).toContain('해설');
  });
  test('맞은 측정은 확인할 점이 없고 받침 있는 이름에는 "이"', () => {
    const r = explain([frame('footstep', 'Walk, footsteps'), frame('footstep', 'Run')], { expected: 'footstep', predicted: 'footstep', groups: SOURCE_GROUPS });
    expect(r.correct).toBe(true);
    expect(r.frame_accuracy).toBe(100);
    expect(r.reason).toContain('발걸음이 2번');
    expect(r.tips).toEqual([]);
  });
  test('모두 기타면 기타 판정 이유와 소리 크기 안내', () => {
    const r = explain([frame('other', 'Silence', 0.1), frame('other', null, 0.1)], { expected: 'pet', predicted: 'other', groups: SOURCE_GROUPS });
    expect(r.reason).toContain('모두 기타');
    expect(r.heard).toEqual([{ name: 'Silence', ko: '조용함', count: 1 }]);
    expect(r.tips[0]).toContain('더 크게');
  });
  test('실패: 빈 frames, 정답·판정 누락, groups 누락', () => {
    expect(() => explain([], { expected: 'pet', predicted: 'pet', groups: SOURCE_GROUPS })).toThrow(TypeError);
    expect(() => explain([frame('pet', 'Dog')], { predicted: 'pet', groups: SOURCE_GROUPS })).toThrow(TypeError);
    expect(() => explain([frame('pet', 'Dog')], { expected: 'pet', predicted: 'pet' })).toThrow(TypeError);
  });
});
