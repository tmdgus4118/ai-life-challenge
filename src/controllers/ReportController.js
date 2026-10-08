const { ReportQueryDto, AskDto } = require('../dtos');
const { SseWriter } = require('../utils/sse');
const { streamResponse } = require('./streamResponse');

/** /api/reports */
class ReportController {
  constructor({ reportService }) {
    if (!reportService) throw new TypeError('reportService is required');
    this.reportService = reportService;
  }

  summary = async (req, res, next) => {
    try {
      const dto = ReportQueryDto.from(req.query);
      const summary = await this.reportService.getSummary(req.userId, dto.days);
      res.json({ summary });
    } catch (err) {
      next(err);
    }
  };

  generate = async (req, res, next) => {
    try {
      const dto = ReportQueryDto.from(req.body);
      const report = await this.reportService.generate(req.userId, dto.days);
      res.status(201).json({ report });
    } catch (err) {
      next(err);
    }
  };

  /** SSE: 요약문이 써지는 과정을 실시간 전송 */
  generateStream = async (req, res, next) => {
    try {
      const dto = ReportQueryDto.from(req.body);
      await streamResponse(new SseWriter(res), res, (opts) => this.reportService.generate(req.userId, dto.days, new Date(), opts), (report) => ({ report }));
    } catch (err) {
      next(err);
    }
  };

  /** SSE: 기록에게 묻기 */
  askStream = async (req, res, next) => {
    try {
      const dto = AskDto.from(req.body);
      await streamResponse(new SseWriter(res), res, (opts) => this.reportService.ask(req.userId, dto.days, { question: dto.question, questionKey: dto.questionKey }, opts), (result) => result);
    } catch (err) {
      next(err);
    }
  };

  latest = async (req, res, next) => {
    try {
      const dto = ReportQueryDto.from(req.query);
      const report = await this.reportService.getLatest(req.userId, dto.days);
      res.json({ report });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { ReportController };
