/**
 * 애플리케이션 공통 에러 클래스. HTTP 상태 코드를 함께 가진다.
 */
class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class NotFoundError extends AppError {
  constructor(message = '요청한 자원을 찾을 수 없습니다.') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ForbiddenError extends AppError {
  constructor(message = '권한이 없습니다.') {
    super(message, 403, 'FORBIDDEN');
  }
}

class LlmError extends AppError {
  constructor(message = 'AI 생성에 실패했습니다.', details = null) {
    super(message, 502, 'LLM_ERROR', details);
  }
}

module.exports = { AppError, ValidationError, NotFoundError, ForbiddenError, LlmError };
