const { asyncHandler } = require('../../src/utils/async-handler');

describe('asyncHandler', () => {
  test('성공: 핸들러가 정상 종료하면 next를 호출하지 않는다', async () => {
    const next = jest.fn();
    await asyncHandler(async (req, res) => res.ok())({}, { ok: jest.fn() }, next);
    expect(next).not.toHaveBeenCalled();
  });
  test('실패: 예외는 next로 전달된다', async () => {
    const next = jest.fn();
    const err = new Error('x');
    await asyncHandler(async () => { throw err; })({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
