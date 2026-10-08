const { UpdateSettingsDto } = require('../dtos');
const { BaseDto } = require('../dtos/BaseDto');

/** /api/settings */
class SettingsController {
  constructor({ settingsService, thresholdService }) {
    if (!settingsService || !thresholdService) throw new TypeError('services are required');
    this.settingsService = settingsService;
    this.thresholdService = thresholdService;
  }

  get = async (req, res, next) => {
    try {
      const [settings, thresholds] = await Promise.all([this.settingsService.get(req.userId), this.thresholdService.getAll()]);
      res.json({ settings, thresholds });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const dto = UpdateSettingsDto.from(req.body);
      const settings = await this.settingsService.update(req.userId, { ...dto });
      res.json({ settings });
    } catch (err) {
      next(err);
    }
  };

  calibrate = async (req, res, next) => {
    try {
      const body = BaseDto.requireObject(req.body);
      const measured = BaseDto.number(body.measured_dbfs, 'measured_dbfs', { min: -120, max: 0 });
      const settings = await this.settingsService.calibrate(req.userId, measured);
      res.json({ settings });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { SettingsController };
