const { BaseDto } = require('./BaseDto');
const { ValidationError } = require('../utils/errors');
const { SOURCE_KEYS } = require('../shared/constants');

/** 사건 1건 입력 */
class EventInputDto extends BaseDto {
  constructor(data) {
    super();
    this.started_at = data.started_at;
    this.ended_at = data.ended_at;
    this.source_group = data.source_group;
    this.avg_db = data.avg_db;
    this.max_db = data.max_db;
    this.confidence = data.confidence;
    this.memo = data.memo;
    this.excluded = data.excluded;
    this.client_id = data.client_id;
    this.db_series = data.db_series;
    this.vibration_sec = data.vibration_sec;
    this.vibration_peak_mg = data.vibration_peak_mg;
    this.vibration_series = data.vibration_series;
  }

  /** 1초 단위 바닥 진동 (1=충격 진동, 0=없음, null=측정 안 됨). 최대 1시간 */
  static vibrationSeries(value) {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value)) throw new ValidationError('vibration_series는 배열이어야 합니다.', { field: 'vibration_series' });
    if (value.length > 3600) throw new ValidationError('vibration_series는 3600개 이하여야 합니다.', { field: 'vibration_series' });
    return value.map((v) => {
      if (v === null || v === 0 || v === 1) return v;
      throw new ValidationError('vibration_series 값은 0, 1, null이어야 합니다.', { field: 'vibration_series' });
    });
  }

  /** 1초 단위 dB 시퀀스 (숫자 또는 제외 구간 null). 최대 1시간 */
  static dbSeries(value) {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value)) throw new ValidationError('db_series는 배열이어야 합니다.', { field: 'db_series' });
    if (value.length > 3600) throw new ValidationError('db_series는 3600개 이하여야 합니다.', { field: 'db_series' });
    return value.map((v) => {
      if (v === null) return null;
      const n = Number(v);
      if (Number.isNaN(n) || n < 0 || n > 140) throw new ValidationError('db_series 값은 0~140 또는 null이어야 합니다.', { field: 'db_series' });
      return Math.round(n * 10) / 10;
    });
  }

  static from(body, index = 0) {
    const b = BaseDto.requireObject(body, `events[${index}]`);
    const started = BaseDto.isoDate(b.started_at, 'started_at');
    const ended = BaseDto.isoDate(b.ended_at, 'ended_at');
    if (new Date(ended) < new Date(started)) {
      throw new ValidationError('ended_at은 started_at보다 빠를 수 없습니다.', { field: 'ended_at' });
    }
    return new EventInputDto({
      started_at: started,
      ended_at: ended,
      source_group: BaseDto.oneOf(b.source_group, 'source_group', SOURCE_KEYS),
      avg_db: BaseDto.number(b.avg_db, 'avg_db', { min: 0, max: 140 }),
      max_db: BaseDto.number(b.max_db, 'max_db', { min: 0, max: 140 }),
      confidence: BaseDto.number(b.confidence, 'confidence', { min: 0, max: 1, required: false }),
      memo: BaseDto.string(b.memo, 'memo', { maxLength: 200 }),
      excluded: BaseDto.boolean(b.excluded, 'excluded', false),
      client_id: BaseDto.string(b.client_id, 'client_id', { maxLength: 100 }),
      db_series: EventInputDto.dbSeries(b.db_series),
      vibration_sec: BaseDto.number(b.vibration_sec, 'vibration_sec', { min: 0, max: 3600, integer: true, required: false }),
      vibration_peak_mg: BaseDto.number(b.vibration_peak_mg, 'vibration_peak_mg', { min: 0, max: 10000, required: false }),
      vibration_series: EventInputDto.vibrationSeries(b.vibration_series),
    });
  }
}

/** POST /events : 배열로 여러 건 */
class CreateEventsDto extends BaseDto {
  constructor(events) {
    super();
    this.events = events;
  }

  static from(body) {
    const list = Array.isArray(body) ? body : body && Array.isArray(body.events) ? body.events : null;
    if (!list) throw new ValidationError('events 배열이 필요합니다.');
    if (list.length === 0) throw new ValidationError('events 배열이 비어 있습니다.');
    if (list.length > 500) throw new ValidationError('한 번에 500건까지 저장할 수 있습니다.');
    return new CreateEventsDto(list.map((item, i) => EventInputDto.from(item, i)));
  }
}

/** GET /events?from=&to=&source= */
class EventQueryDto extends BaseDto {
  constructor(data) {
    super();
    Object.assign(this, data);
  }

  static from(query = {}) {
    const q = query || {};
    const from = BaseDto.isoDate(q.from, 'from', { required: false });
    const to = BaseDto.isoDate(q.to, 'to', { required: false });
    if (from && to && new Date(to) < new Date(from)) throw new ValidationError('to는 from보다 빠를 수 없습니다.');
    return new EventQueryDto({
      from,
      to,
      source: BaseDto.oneOf(q.source, 'source', SOURCE_KEYS, { required: false, fallback: null }),
      limit: BaseDto.number(q.limit, 'limit', { min: 1, max: 2000, required: false, integer: true }),
    });
  }
}

/** PATCH /events/:id : 메모 수정 */
class UpdateEventMemoDto extends BaseDto {
  constructor(memo) {
    super();
    this.memo = memo;
  }

  static from(body) {
    const b = BaseDto.requireObject(body);
    if (b.memo === undefined) throw new ValidationError('memo는 필수입니다.', { field: 'memo' });
    const memo = BaseDto.string(b.memo, 'memo', { maxLength: 200 });
    return new UpdateEventMemoDto(memo);
  }
}

module.exports = { EventInputDto, CreateEventsDto, EventQueryDto, UpdateEventMemoDto };
