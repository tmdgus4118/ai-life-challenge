const express = require('express');

const createMessageRouter = (controller) => {
  const router = express.Router();
  router.post('/generate', controller.generate);
  router.post('/generate/stream', controller.generateStream);
  router.get('/next-step', controller.nextStep);
  router.get('/history', controller.history);
  router.patch('/:id/delivered', controller.markDelivered);
  return router;
};

module.exports = { createMessageRouter };
