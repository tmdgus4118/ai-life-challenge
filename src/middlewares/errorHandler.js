const { AppError } = require('../utils/errors');

/** 404 */
const notFound = (req, res, next) => {
  const err = new AppError('페이지를 찾을 수 없습니다.', 404, 'NOT_FOUND');
  next(err);
};

/** 공통 에러 응답: API는 JSON, 페이지는 에러 화면 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const isApp = err instanceof AppError;
  const status = isApp ? err.status : err.type === 'entity.parse.failed' ? 400 : err.status || 500;
  const code = isApp ? err.code : err.type === 'entity.parse.failed' ? 'INVALID_JSON' : 'INTERNAL_ERROR';
  const message = isApp || status < 500 ? err.message : '서버 오류가 발생했습니다.';
  if (status >= 500 && process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  const wantsJson = req.originalUrl.startsWith('/api') || req.xhr || (req.get('accept') || '').includes('application/json');
  if (wantsJson) {
    return res.status(status).json({ error: { code, message, details: isApp ? err.details : null } });
  }
  return res.status(status).render('pages/error', { title: '오류', status, message, page: 'error' });
};

module.exports = { notFound, errorHandler };
