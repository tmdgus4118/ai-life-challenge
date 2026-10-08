const express = require('express');

const createLabRouter = (controller) => {
  const router = express.Router();
  router.post('/runs', controller.record);
  router.get('/summary', controller.summary);
  router.delete('/runs', controller.clear);
  return router;
};

module.exports = { createLabRouter };
