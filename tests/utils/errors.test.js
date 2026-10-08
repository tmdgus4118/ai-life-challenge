const { AppError, ValidationError, NotFoundError, ForbiddenError, LlmError } = require('../../src/utils/errors');

describe('errors', () => {
  test('AppError 기본값과 toJSON', () => {
    const e = new AppError('boom');
    expect(e.status).toBe(500);
    expect(e.toJSON()).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'boom', details: null } });
  });
  test('하위 에러 상태 코드', () => {
    expect(new ValidationError('bad', { f: 1 }).status).toBe(400);
    expect(new NotFoundError().status).toBe(404);
    expect(new ForbiddenError().status).toBe(403);
    expect(new LlmError().status).toBe(502);
    expect(new ValidationError('bad').toJSON().error.code).toBe('VALIDATION_ERROR');
  });
  test('instanceof 체인 유지', () => {
    expect(new NotFoundError()).toBeInstanceOf(AppError);
    expect(new NotFoundError()).toBeInstanceOf(Error);
  });
});
