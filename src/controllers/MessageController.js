const { GenerateMessageDto } = require('../dtos');
const { SseWriter } = require('../utils/sse');
const { streamResponse } = require('./streamResponse');

/** /api/messages */
class MessageController {
  constructor({ messageService, stepGuideService }) {
    if (!messageService || !stepGuideService) throw new TypeError('services are required');
    this.messageService = messageService;
    this.stepGuideService = stepGuideService;
  }

  generate = async (req, res, next) => {
    try {
      const dto = GenerateMessageDto.from(req.body);
      const result = await this.messageService.generate(req.userId, dto);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  /** SSE: 메시지 초안이 써지는 과정을 실시간 전송 */
  generateStream = async (req, res, next) => {
    try {
      const dto = GenerateMessageDto.from(req.body);
      await streamResponse(new SseWriter(res), res, (opts) => this.messageService.generate(req.userId, dto, opts), (result) => result);
    } catch (err) {
      next(err);
    }
  };

  markDelivered = async (req, res, next) => {
    try {
      const body = req.body || {};
      const delivered = body.delivered === undefined ? true : body.delivered === true || body.delivered === 'true';
      const result = await this.messageService.markDelivered(req.userId, req.params.id, { delivered });
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  history = async (req, res, next) => {
    try {
      res.json({ messages: await this.messageService.getHistory(req.userId) });
    } catch (err) {
      next(err);
    }
  };

  nextStep = async (req, res, next) => {
    try {
      const guide = await this.stepGuideService.getGuide(req.userId);
      res.json({ next_step: guide });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { MessageController };
