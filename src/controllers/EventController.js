const { CreateEventsDto, EventQueryDto, UpdateEventMemoDto } = require('../dtos');

/** /api/events */
class EventController {
  constructor({ eventService }) {
    if (!eventService) throw new TypeError('eventService is required');
    this.eventService = eventService;
  }

  create = async (req, res, next) => {
    try {
      const dto = CreateEventsDto.from(req.body);
      const rows = await this.eventService.createMany(req.userId, dto.events);
      res.status(201).json({ events: rows.map((r) => this.eventService.decorate(r)), count: rows.length });
    } catch (err) {
      next(err);
    }
  };

  list = async (req, res, next) => {
    try {
      const dto = EventQueryDto.from(req.query);
      const rows = await this.eventService.list(req.userId, dto);
      res.json({ events: rows.map((r) => this.eventService.decorate(r)), count: rows.length });
    } catch (err) {
      next(err);
    }
  };

  exportCsv = async (req, res, next) => {
    try {
      const dto = EventQueryDto.from(req.query);
      const csv = await this.eventService.exportCsv(req.userId, dto);
      const stamp = new Date().toISOString().slice(0, 10);
      res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="neighbor-sound-events-${stamp}.csv"` });
      res.send(csv);
    } catch (err) {
      next(err);
    }
  };

  recent = async (req, res, next) => {
    try {
      const rows = await this.eventService.getRecent(req.userId, 3);
      res.json({ events: rows.map((r) => this.eventService.decorate(r)) });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      const removed = await this.eventService.remove(req.userId, req.params.id);
      res.json({ deleted: true, id: removed.id });
    } catch (err) {
      next(err);
    }
  };

  updateMemo = async (req, res, next) => {
    try {
      const dto = UpdateEventMemoDto.from(req.body);
      const row = await this.eventService.updateMemo(req.userId, req.params.id, dto.memo);
      res.json({ event: this.eventService.decorate(row) });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { EventController };
