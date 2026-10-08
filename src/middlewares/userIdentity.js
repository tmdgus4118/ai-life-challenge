const { IdUtil } = require('../utils/id');

const COOKIE_NAME = 'nsid';
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 365;

/**
 * 로그인 없이 익명 UUID로 사용자를 구분한다.
 * 우선순위: X-User-Id 헤더 → nsid 쿠키 → 새로 발급(쿠키 설정).
 */
const userIdentity = (req, res, next) => {
  try {
    const header = req.get('X-User-Id');
    const cookie = req.cookies ? req.cookies[COOKIE_NAME] : undefined;
    let userId = null;
    if (IdUtil.isValid(header)) userId = header;
    else if (IdUtil.isValid(cookie)) userId = cookie;

    if (!userId) {
      userId = IdUtil.generate();
      req.isNewUser = true;
    }
    if (cookie !== userId) {
      res.cookie(COOKIE_NAME, userId, { maxAge: COOKIE_MAX_AGE, httpOnly: false, sameSite: 'lax', secure: req.secure, path: '/' });
    }
    req.userId = userId;
    res.locals.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { userIdentity, COOKIE_NAME };
