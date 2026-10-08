const { ClassificationSmoother } = require('../../src/shared/smoother');

describe('ClassificationSmoother', () => {
  test('3개 중 2개가 같은 그룹이면 안정 판정', () => {
    const s = new ClassificationSmoother({ windowSize: 3 });
    expect(s.push({ group: 'footstep', confidence: 0.6 }).stable).toBe(false); // 1개는 아직 불안정(과반 2 필요)
    expect(s.push({ group: 'footstep', confidence: 0.7 })).toMatchObject({ group: 'footstep', stable: true });
    expect(s.push({ group: 'pet', confidence: 0.9 }).group).toBe('footstep'); // 한 번 튀어도 유지
  });
  test('깜빡임: 번갈아 나오면 가중치 큰 쪽', () => {
    const s = new ClassificationSmoother({ windowSize: 3 });
    s.push({ group: 'footstep', confidence: 0.4 });
    s.push({ group: 'pet', confidence: 0.9 });
    const r = s.push({ group: 'pet', confidence: 0.9 });
    expect(r.group).toBe('pet');
  });
  test('other만 들어오면 other, reset 후 초기화', () => {
    const s = new ClassificationSmoother({ windowSize: 3 });
    s.push({ group: 'other', confidence: 0.1 });
    expect(s.push({ group: 'other', confidence: 0.1 }).group).toBe('other');
    s.push({ group: 'music', confidence: 0.8 });
    s.push({ group: 'music', confidence: 0.8 });
    s.reset();
    expect(s.history).toHaveLength(0);
  });
  test('평균 신뢰도가 하한 미만이면 other', () => {
    const s = new ClassificationSmoother({ windowSize: 3, confidenceThreshold: 0.5 });
    s.push({ group: 'footstep', confidence: 0.3 });
    expect(s.push({ group: 'footstep', confidence: 0.35 }).group).toBe('other');
  });
  test('실패: 잘못된 입력·창 크기', () => {
    expect(() => new ClassificationSmoother({ windowSize: 0 })).toThrow(TypeError);
    expect(() => new ClassificationSmoother().push({ group: 1 })).toThrow(TypeError);
  });
});
