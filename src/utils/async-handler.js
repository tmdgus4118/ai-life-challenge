/**
 * 컨트롤러 핸들러의 비동기 예외를 next()로 넘겨 주는 래퍼.
 * 컨트롤러 안에서 try/catch를 쓰더라도 누락된 예외를 한 번 더 받는다.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { asyncHandler };
