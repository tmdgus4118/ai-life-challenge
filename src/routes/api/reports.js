const express = require('express');

const createReportRouter = (controller) => {
  const router = express.Router();
  router.get('/summary', controller.summary);
  router.get('/latest', controller.latest);
  router.post('/generate', controller.generate);
  router.post('/generate/stream', controller.generateStream);
  router.post('/ask/stream', controller.askStream);
  return router;
};

module.exports = { createReportRouter };
