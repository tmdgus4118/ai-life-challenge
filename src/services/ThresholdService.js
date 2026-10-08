const rules = require('../shared/threshold-rules');
const { timeUtil } = require('../utils/time');

/** 기준 테이블 조회와 사건 판정을 담당한다. */
class ThresholdService {
  constructor(thresholdModel, time = timeUtil) {
    if (!thresholdModel) throw new TypeError('thresholdModel is required');
    this.thresholdModel = thresholdModel;
    this.time = time;
  }

  async getAll() {
    return this.thresholdModel.findAll();
  }

  /** 사건 1건 판정: 시작 시각의 시(時)를 시간대 기준으로 뽑아 규칙에 넘긴다. */
  async evaluate(event, settings) {
    if (!event || !event.started_at) throw new TypeError('event.started_at is required');
    if (!settings) throw new TypeError('settings is required');
    const thresholds = await this.getAll();
    const { hour } = this.time.getParts(event.started_at);
    return rules.evaluate({ ...event, hour }, thresholds, settings);
  }

  /** 사건 시작 시각 기준 최고소음도 기준값 (공기전달·기타는 null) */
  async getMaxLimit(event, settings) {
    if (!event || !event.started_at) throw new TypeError('event.started_at is required');
    if (!settings) throw new TypeError('settings is required');
    const thresholds = await this.getAll();
    const { hour } = this.time.getParts(event.started_at);
    return rules.getMaxLimit(event.source_group, hour, thresholds, settings);
  }

  /** 감지 화면용: 현재 시각의 기준선 */
  async getCurrentLimit(sourceGroup, settings, now = new Date()) {
    const thresholds = await this.getAll();
    const { hour } = this.time.getParts(now);
    return rules.getCurrentLimit(sourceGroup || 'footstep', hour, thresholds, settings);
  }
}

module.exports = { ThresholdService };
