const express = require('express');
const { createEventRouter } = require('./events');
const { createReportRouter } = require('./reports');
const { createMessageRouter } = require('./messages');
const { createSettingsRouter } = require('./settings');
const { createDataRouter } = require('./data');
const { createLabRouter } = require('./lab');
const { createShareRouter } = require('./shares');

const createApiRouter = (controllers, meta = {}) => {
  const router = express.Router();
  // keep_alive: 무료 호스팅 깨우기 상태(서버가 자기 공개 주소를 몇 번 호출했는지). 밖에서 잠듦 원인을 진단할 때 쓴다
  router.get('/health', (req, res) => {
    const ka = req.app.locals.keepAlive;
    res.json({
      ok: true,
      service: '이웃소리',
      llm: meta.llmInfo || null,
      keep_alive: ka ? { enabled: ka.enabled, url: ka.url || null, interval_min: ka.intervalMs / 60000, pings: ka.pings, failures: ka.failures, uptime_sec: Math.round(process.uptime()) } : null,
      time: new Date().toISOString(),
    });
  });
  router.use('/events', createEventRouter(controllers.eventController));
  router.use('/reports', createReportRouter(controllers.reportController));
  router.use('/messages', createMessageRouter(controllers.messageController));
  router.use('/settings', createSettingsRouter(controllers.settingsController));
  router.use('/data', createDataRouter(controllers.dataController));
  router.use('/lab', createLabRouter(controllers.labController));
  router.use('/shares', createShareRouter(controllers.shareController));
  return router;
};

module.exports = { createApiRouter };
