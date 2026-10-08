const { LabRunDto } = require('../dtos');

/** /api/lab */
class LabController {
  constructor({ labService }) {
    if (!labService) throw new TypeError('labService is required');
    this.labService = labService;
  }

  record = async (req, res, next) => {
    try {
      const dto = LabRunDto.from(req.body);
      const run = await this.labService.record(req.userId, dto);
      const summary = await this.labService.summary(req.userId);
      res.status(201).json({ run, summary });
    } catch (err) {
      next(err);
    }
  };

  summary = async (req, res, next) => {
    try {
      res.json({ summary: await this.labService.summary(req.userId) });
    } catch (err) {
      next(err);
    }
  };

  clear = async (req, res, next) => {
    try {
      res.json({ deleted: await this.labService.clear(req.userId) });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { LabController };
