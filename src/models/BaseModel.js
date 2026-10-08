const path = require('path');
const { JsonStore } = require('./JsonStore');
const { IdUtil } = require('../utils/id');

/**
 * 컬렉션 공통 CRUD. 각 모델은 컬렉션 이름만 지정하고 필요한 조회 메서드를 추가한다.
 */
class BaseModel {
  constructor(dbDir, collection, defaultValue = []) {
    if (!dbDir) throw new TypeError('dbDir is required');
    if (!collection) throw new TypeError('collection is required');
    this.collection = collection;
    this.store = new JsonStore(path.join(dbDir, `${collection}.json`), defaultValue);
  }

  /**
   * 최신순 정렬. created_at이 같은 밀리초면 나중에 저장된 것(파일에서 뒤쪽)을 앞에 둔다.
   * rows는 저장 순서 그대로여야 한다(findAll 결과).
   */
  static sortNewestFirst(rows, field = 'created_at') {
    if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
    return rows
      .map((row, index) => ({ row, index, t: new Date(row[field]).getTime() }))
      .sort((a, b) => (b.t - a.t) || (b.index - a.index))
      .map((x) => x.row);
  }

  async findAll(predicate = null) {
    const rows = await this.store.read();
    if (predicate && typeof predicate !== 'function') throw new TypeError('predicate must be a function');
    return predicate ? rows.filter(predicate) : rows;
  }

  async findOne(predicate) {
    if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
    const rows = await this.store.read();
    return rows.find(predicate) || null;
  }

  async findById(id) {
    if (!id) throw new TypeError('id is required');
    return this.findOne((row) => row.id === id);
  }

  async count(predicate = null) {
    const rows = await this.findAll(predicate);
    return rows.length;
  }

  /** 문서를 추가한다. id, created_at을 채운다. */
  async insert(doc) {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new TypeError('doc must be an object');
    const row = { id: doc.id || IdUtil.generate(), ...doc, created_at: doc.created_at || new Date().toISOString() };
    await this.store.update((rows) => {
      rows.push(row);
    });
    return row;
  }

  async insertMany(docs) {
    if (!Array.isArray(docs)) throw new TypeError('docs must be an array');
    if (docs.some((d) => !d || typeof d !== 'object')) throw new TypeError('every doc must be an object');
    const now = new Date().toISOString();
    const rows = docs.map((doc) => ({ id: doc.id || IdUtil.generate(), ...doc, created_at: doc.created_at || now }));
    await this.store.update((existing) => {
      existing.push(...rows);
    });
    return rows;
  }

  async updateById(id, patch) {
    if (!id) throw new TypeError('id is required');
    if (!patch || typeof patch !== 'object') throw new TypeError('patch must be an object');
    let updated = null;
    await this.store.update((rows) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) return rows;
      rows[idx] = { ...rows[idx], ...patch, id: rows[idx].id, updated_at: new Date().toISOString() };
      updated = rows[idx];
      return rows;
    });
    return updated;
  }

  async deleteById(id) {
    if (!id) throw new TypeError('id is required');
    let removed = false;
    await this.store.update((rows) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) return rows;
      rows.splice(idx, 1);
      removed = true;
      return rows;
    });
    return removed;
  }

  /** 조건에 맞는 문서를 모두 삭제하고 삭제 건수를 돌려준다. */
  async deleteWhere(predicate) {
    if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
    let removed = 0;
    await this.store.update((rows) => {
      const kept = rows.filter((r) => !predicate(r));
      removed = rows.length - kept.length;
      return kept;
    });
    return removed;
  }
}

module.exports = { BaseModel };
