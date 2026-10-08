const express = require('express');

const createShareRouter = (controller) => {
  const router = express.Router();
  router.post('/', controller.create);
  router.get('/', controller.list);
  router.delete('/:id', controller.revoke);
  return router;
};

module.exports = { createShareRouter };
