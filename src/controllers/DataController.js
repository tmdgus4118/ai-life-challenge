/** /api/data */
class DataController {
  constructor({ dataService, demoDataService }) {
    if (!dataService || !demoDataService) throw new TypeError('services are required');
    this.dataService = dataService;
    this.demoDataService = demoDataService;
  }

  deleteAll = async (req, res, next) => {
    try {
      const result = await this.dataService.deleteAll(req.userId);
      res.json({ deleted: result });
    } catch (err) {
      next(err);
    }
  };

  seedDemo = async (req, res, next) => {
    try {
      const result = await this.demoDataService.seed(req.userId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { DataController };
