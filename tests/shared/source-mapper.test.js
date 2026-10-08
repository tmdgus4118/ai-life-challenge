const fs = require('fs');
const path = require('path');
const { SourceMapper } = require('../../src/shared/source-mapper');
const mapping = require('../../src/config/source-mapping.json');

const csv = fs.readFileSync(path.join(__dirname, '../../src/public/models/yamnet_class_map.csv'), 'utf8');
const names = SourceMapper.parseClassMapCsv(csv);

describe('SourceMapper.parseClassMapCsv', () => {
  test('521개 클래스, 따옴표 처리', () => {
    expect(names).toHaveLength(521);
    expect(names[0]).toBe('Speech');
    expect(names[48]).toBe('Walk, footsteps');
    expect(names[69]).toBe('Dog');
  });
  test('실패: 빈 문자열, 데이터 없음', () => {
    expect(() => SourceMapper.parseClassMapCsv('')).toThrow(TypeError);
    expect(() => SourceMapper.parseClassMapCsv('index,mid,display_name\n')).toThrow(TypeError);
  });
});

describe('SourceMapper.map', () => {
  const mapper = new SourceMapper(mapping, names);
  const scores = (pairs) => { const s = new Array(521).fill(0); Object.entries(pairs).forEach(([i, v]) => { s[Number(i)] = v; }); return s; };

  test('생성: 매핑 파일의 핵심 클래스가 모두 존재한다', () => {
    ['Walk, footsteps', 'Dog', 'Piano', 'Hammer', 'Speech', 'Slam'].forEach((n) => expect(mapper.unmatched).not.toContain(n));
    expect(mapper.groupIndices.footstep).toContain(48);
  });
  test('발걸음 0.8 → footstep', () => {
    const r = mapper.map(scores({ 48: 0.8, 0: 0.1 }));
    expect(r.group).toBe('footstep');
    expect(r.confidence).toBe(0.8);
    expect(r.topClass).toBe('Walk, footsteps');
  });
  test('개 짖음 → pet, 피아노 → music, 드릴 → hammer, 문 쾅 → furniture, TV → voice', () => {
    expect(mapper.map(scores({ 70: 0.6 })).group).toBe('pet');
    expect(mapper.map(scores({ 148: 0.6 })).group).toBe('music');
    expect(mapper.map(scores({ 419: 0.6 })).group).toBe('hammer');
    expect(mapper.map(scores({ 352: 0.6 })).group).toBe('furniture');
    expect(mapper.map(scores({ 518: 0.6 })).group).toBe('voice');
  });
  test('신뢰도 0.3 미만 → other, 매핑에 없는 클래스(Silence 등) → other', () => {
    expect(mapper.map(scores({ 48: 0.2 })).group).toBe('other');
    const r = mapper.map(scores({ 494: 0.9 })); // Silence
    expect(r.group).toBe('other');
    expect(r.rawTopClass).toBe('Silence');
  });
  test('setThreshold 반영 / 실패: 범위 밖', () => {
    const m = new SourceMapper(mapping, names, { confidenceThreshold: 0.5 });
    expect(m.map(scores({ 48: 0.4 })).group).toBe('other');
    m.setThreshold(0.3);
    expect(m.map(scores({ 48: 0.4 })).group).toBe('footstep');
    expect(() => m.setThreshold(2)).toThrow(RangeError);
  });
  test('실패: 길이 불일치, 잘못된 생성자 인자', () => {
    expect(() => mapper.map([0.1, 0.2])).toThrow(TypeError);
    expect(() => new SourceMapper({}, names)).toThrow(TypeError);
    expect(() => new SourceMapper(mapping, [])).toThrow(TypeError);
  });
  test('averageFrames 성공/실패', () => {
    expect(SourceMapper.averageFrames([[0, 1], [1, 1]])).toEqual([0.5, 1]);
    expect(() => SourceMapper.averageFrames([])).toThrow(TypeError);
    expect(() => SourceMapper.averageFrames([[0, 1], [1]])).toThrow(TypeError);
  });
});
