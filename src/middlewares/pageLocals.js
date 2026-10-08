const icons = require('../shared/icons');
const { timeUtil } = require('../utils/time');

/**
 * 화면(SSR) 공통 값: 테마(야간 자동), 아이콘 도우미, 사용자 설정.
 * API 요청에는 쓰지 않는다.
 */
const createPageLocals = (settingsService, time = timeUtil) => {
  if (!settingsService) throw new TypeError('settingsService is required');
  return async (req, res, next) => {
    try {
      const settings = await settingsService.get(req.userId);
      const { hour } = time.getParts(new Date());
      res.locals.userSettings = settings;
      res.locals.theme = settingsService.resolveTheme(settings, hour);
      res.locals.icon = icons.icon;
      res.locals.iconSprite = icons.sprite();
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = { createPageLocals };
