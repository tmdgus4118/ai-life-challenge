const express = require('express');

const createSettingsRouter = (controller) => {
  const router = express.Router();
  router.get('/', controller.get);
  router.put('/', controller.update);
  router.post('/calibrate', controller.calibrate);
  return router;
};

module.exports = { createSettingsRouter };
