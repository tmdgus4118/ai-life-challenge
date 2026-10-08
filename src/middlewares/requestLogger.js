/** 가벼운 요청 로그 (테스트 환경에서는 조용히) */
const requestLogger = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next();
  const start = Date.now();
  res.on('finish', () => {
    // eslint-disable-next-line no-console
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  return next();
};

module.exports = { requestLogger };
