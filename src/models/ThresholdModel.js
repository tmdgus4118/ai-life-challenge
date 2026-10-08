const fs = require('fs');
const path = require('path');
const { BaseModel } = require('./BaseModel');

const DEFAULT_PATH = path.join(__dirname, '..', 'config', 'default-thresholds.json');

/**
 * thresholds 테이블: source_type(impact/airborne), metric(avg1min/max/avg5min), day_db, night_db, source
 * 파일이 비어 있으면 기본 기준표로 채운다. 법이 바뀌면 db/thresholds.json만 고치면 된다.
 */
class ThresholdModel extends BaseModel {
  constructor(dbDir) {
    super(dbDir, 'thresholds', JSON.parse(fs.readFileSync(DEFAULT_PATH, 'utf8')));
  }

  async findAll(predicate = null) {
    const rows = await super.findAll(predicate);
    if (rows.length === 0 && !predicate) {
      const defaults = JSON.parse(fs.readFileSync(DEFAULT_PATH, 'utf8'));
      await this.store.write(defaults);
      return defaults;
    }
    return ThresholdModel.fillMissing(rows, JSON.parse(fs.readFileSync(DEFAULT_PATH, 'utf8')));
  }

  /**
   * 예전에 만들어진 기준표 파일에 새 규칙 필드(가산값, 1시간 횟수 등)가 없으면 기본표에서 채운다.
   * 이미 있는 값은 절대 덮어쓰지 않는다 (법 개정으로 사용자가 고친 값 보존).
   */
  static fillMissing(rows, defaults) {
    if (!Array.isArray(rows) || !Array.isArray(defaults)) throw new TypeError('rows and defaults must be arrays');
    return rows.map((row) => {
      const base = defaults.find((d) => d.source_type === row.source_type && d.metric === row.metric);
      if (!base) return row;
      const merged = { ...row };
      Object.keys(base).forEach((k) => { if (merged[k] === undefined) merged[k] = base[k]; });
      return merged;
    });
  }

  async findBySourceType(sourceType) {
    if (!sourceType) throw new TypeError('sourceType is required');
    const rows = await this.findAll();
    return rows.filter((t) => t.source_type === sourceType);
  }

  /** 기준값 조회 */
  async getLimit(sourceType, metric, isNight) {
    const rows = await this.findAll();
    const row = rows.find((t) => t.source_type === sourceType && t.metric === metric);
    if (!row) throw new RangeError(`threshold not found: ${sourceType}/${metric}`);
    return isNight ? row.night_db : row.day_db;
  }
}

module.exports = { ThresholdModel };
