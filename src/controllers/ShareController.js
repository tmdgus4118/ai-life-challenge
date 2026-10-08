const { ReportQueryDto } = require('../dtos');

/** /api/shares */
class ShareController {
  constructor({ shareService }) {
    if (!shareService) throw new TypeError('shareService is required');
    this.shareService = shareService;
  }

  create = async (req, res, next) => {
    try {
      const dto = ReportQueryDto.from(req.body);
      const share = await this.shareService.create(req.userId, dto.days);
      const origin = `${req.protocol}://${req.get('host')}`;
      res.status(201).json({ share: { ...share, url: origin + share.path } });
    } catch (err) {
      next(err);
    }
  };

  list = async (req, res, next) => {
    try {
      res.json({ shares: await this.shareService.list(req.userId) });
    } catch (err) {
      next(err);
    }
  };

  revoke = async (req, res, next) => {
    try {
      res.json({ share: await this.shareService.revoke(req.userId, req.params.id) });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { ShareController };
