const { userIdentity, COOKIE_NAME } = require('../../src/middlewares/userIdentity');
const { notFound, errorHandler } = require('../../src/middlewares/errorHandler');
const { requestLogger } = require('../../src/middlewares/requestLogger');
const { ValidationError } = require('../../src/utils/errors');
const { USER_A } = require('../helpers');

const mockRes = () => {
  const res = { locals: {}, cookies: {}, statusCode: 200 };
  res.cookie = jest.fn((k, v) => { res.cookies[k] = v; });
  res.status = jest.fn((s) => { res.statusCode = s; return res; });
  res.json = jest.fn(() => res);
  res.render = jest.fn(() => res);
  res.on = jest.fn();
  return res;
};

describe('userIdentity', () => {
  test('헤더 UUID 우선', () => {
    const req = { get: () => USER_A, cookies: { [COOKIE_NAME]: 'other' }, secure: false };
    const res = mockRes(); const next = jest.fn();
    userIdentity(req, res, next);
    expect(req.userId).toBe(USER_A);
    expect(res.cookie).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });
  test('쿠키 UUID 사용 시 쿠키 재설정 안 함', () => {
    const req = { get: () => undefined, cookies: { [COOKIE_NAME]: USER_A } };
    const res = mockRes();
    userIdentity(req, res, jest.fn());
    expect(req.userId).toBe(USER_A);
    expect(res.cookie).not.toHaveBeenCalled();
  });
  test('없거나 잘못된 값이면 새 UUID 발급 + 쿠키', () => {
    const req = { get: () => 'not-uuid', cookies: {} };
    const res = mockRes();
    userIdentity(req, res, jest.fn());
    expect(req.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.isNewUser).toBe(true);
    expect(res.cookies[COOKIE_NAME]).toBe(req.userId);
  });
  test('실패: req.get이 없으면 next(err)', () => {
    const next = jest.fn();
    userIdentity({}, mockRes(), next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});

describe('notFound / errorHandler', () => {
  test('notFound는 404 AppError 전달', () => {
    const next = jest.fn();
    notFound({}, {}, next);
    expect(next.mock.calls[0][0].status).toBe(404);
  });
  test('API 경로는 JSON', () => {
    const res = mockRes();
    errorHandler(new ValidationError('bad', { f: 1 }), { originalUrl: '/api/x', get: () => '' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'VALIDATION_ERROR', message: 'bad', details: { f: 1 } } });
  });
  test('페이지 경로는 에러 화면, 500은 메시지 숨김', () => {
    const res = mockRes();
    errorHandler(new Error('secret'), { originalUrl: '/records', get: () => 'text/html' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.render.mock.calls[0][1].message).toBe('서버 오류가 발생했습니다.');
  });
  test('JSON 파싱 실패는 400 INVALID_JSON', () => {
    const res = mockRes();
    errorHandler(Object.assign(new Error('parse'), { type: 'entity.parse.failed' }), { originalUrl: '/api/events', get: () => '' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.code).toBe('INVALID_JSON');
  });
});

describe('requestLogger', () => {
  test('테스트 환경에서는 바로 next', () => {
    const next = jest.fn();
    requestLogger({}, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
  test('비테스트 환경에서는 finish 리스너 등록', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const res = mockRes(); const next = jest.fn();
    requestLogger({ method: 'GET', originalUrl: '/' }, res, next);
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    res.on.mock.calls[0][1]();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    process.env.NODE_ENV = prev;
  });
});
