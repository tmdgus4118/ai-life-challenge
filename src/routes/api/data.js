const express = require('express');

const createDataRouter = (controller) => {
  const router = express.Router();
  router.delete('/', controller.deleteAll);
  router.post('/demo', controller.seedDemo);
  return router;
};

module.exports = { createDataRouter };
