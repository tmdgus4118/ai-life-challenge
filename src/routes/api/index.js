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
  router.get('/health', (req, res) => res.json({ ok: true, service: '이웃소리', llm: meta.llmInfo || null, time: new Date().toISOString() }));
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
