const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { AppConfig } = require('./config/env');
const { createModels } = require('./models');
const { createServices } = require('./services');
const { createControllers } = require('./controllers');
const { createApiRouter } = require('./routes/api');
const { createPageRouter } = require('./routes/pages');
const { userIdentity } = require('./middlewares/userIdentity');
const { requestLogger } = require('./middlewares/requestLogger');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { createPageLocals } = require('./middlewares/pageLocals');
const { PwaController } = require('./controllers/PwaController');
const icons = require('./shared/icons');
const dial = require('./shared/dial');
const { AssetVersion } = require('./utils/asset-version');
const constants = require('./shared/constants');
const { timeUtil } = require('./utils/time');

/**
 * Express 앱 팩토리. 테스트에서 DB 디렉터리와 LLM 클라이언트를 주입할 수 있다.
 */
const createApp = ({ config = new AppConfig(), llmClient = null } = {}) => {
  const app = express();
  const models = createModels(config.dbDir);
  const services = createServices(models, config, { llmClient });
  const controllers = createControllers(services, config);

  app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.locals.constants = constants;
  app.locals.time = timeUtil;
  app.locals.appName = '이웃소리';
  app.locals.appVersion = require('../package.json').version;
  // 정적 파일 내용이 바뀌면 바뀌는 값: ?v= 와 서비스 워커 캐시 이름에 쓴다
  app.locals.assetVersion = AssetVersion.compute([path.join(__dirname, 'public', 'css'), path.join(__dirname, 'public', 'js'), path.join(__dirname, 'shared')], app.locals.appVersion);
  app.locals.dial = dial;

  app.use(requestLogger);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use('/shared', express.static(path.join(__dirname, 'shared')));
  app.use('/fonts', express.static(path.join(__dirname, '..', 'node_modules', 'pretendard-gov', 'dist', 'web', 'variable'), { maxAge: config.nodeEnv === 'production' ? '30d' : 0 }));
  app.get('/config/source-mapping.json', (req, res) => res.sendFile(path.join(__dirname, 'config', 'source-mapping.json')));
  app.use(express.static(path.join(__dirname, 'public'), { maxAge: config.nodeEnv === 'production' ? '1h' : 0 }));
  app.use(userIdentity);

  app.get('/sw.js', new PwaController({ version: app.locals.assetVersion }).serve);
  app.use('/api', createApiRouter(controllers, { llmInfo: services.llmInfo }));
  app.use('/', createPageLocals(services.settingsService), createPageRouter(controllers.pageController));

  // 404 화면에서도 아이콘·테마가 필요하다
  app.locals.icon = icons.icon;
  app.locals.iconSprite = icons.sprite();
  app.locals.theme = 'light';
  app.use(notFound);
  app.use(errorHandler);

  app.locals.services = services;
  app.locals.models = models;
  return app;
};

module.exports = { createApp };
