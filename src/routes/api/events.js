const express = require('express');

const createEventRouter = (controller) => {
  const router = express.Router();
  router.post('/', controller.create);
  router.get('/', controller.list);
  router.get('/recent', controller.recent);
  router.get('/export.csv', controller.exportCsv);
  router.patch('/:id', controller.updateMemo);
  router.delete('/:id', controller.remove);
  return router;
};

module.exports = { createEventRouter };
