const express = require('express');

const createPageRouter = (controller) => {
  const router = express.Router();
  router.get('/', controller.home);
  router.get('/welcome', (req, res) => res.redirect(301, '/'));
  router.get('/detect', controller.detect);
  router.get('/records', controller.records);
  router.get('/report', controller.report);
  router.get('/report/print', controller.reportPrint);
  router.get('/mediate', controller.mediate);
  router.get('/settings', controller.settings);
  router.get('/guide', controller.guide);
  router.get('/lab', controller.lab);
  router.get('/s/:token', controller.shared);
  return router;
};

module.exports = { createPageRouter };
