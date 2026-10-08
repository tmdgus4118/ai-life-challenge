const { PwaController } = require('../../src/controllers/PwaController');

describe('PwaController', () => {
  test('script: 버전별 캐시 이름, 미리 받을 파일, API·공유 링크 제외 규칙', () => {
    const js = new PwaController({ version: '9.9.9' }).script();
    expect(js).toContain('"neighbor-sound-9.9.9"');
    expect(js).toContain('/models/yamnet_class_map.csv');
    expect(js).toContain("url.pathname.startsWith('/api/')");
    expect(js).toContain("url.pathname.startsWith('/s/')");
    expect(() => new Function(js)).not.toThrow();
  });
  test('serve: JS 헤더와 본문 / 실패: 버전 없음, 오류는 next', () => {
    const res = { set: jest.fn(), send: jest.fn() };
    new PwaController({ version: '1' }).serve({}, res, jest.fn());
    expect(res.set.mock.calls[0][0]['Content-Type']).toContain('javascript');
    expect(res.send.mock.calls[0][0]).toContain('neighbor-sound-1');
    expect(() => new PwaController({})).toThrow(TypeError);
    const next = jest.fn();
    new PwaController({ version: '1' }).serve({}, { set: () => { throw new Error('x'); } }, next);
    expect(next).toHaveBeenCalled();
  });
});
