const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

/**
 * JSON 파일 하나를 컬렉션처럼 다루는 저장소.
 * 쓰기는 프로미스 체인으로 직렬화해 동시 요청에도 파일이 깨지지 않게 한다.
 */
class JsonStore {
  constructor(filePath, defaultValue = []) {
    if (!filePath || typeof filePath !== 'string') throw new TypeError('filePath is required');
    this.filePath = filePath;
    this.defaultValue = defaultValue;
    this.queue = Promise.resolve();
    this.cache = null;
  }

  ensureFile() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(this.defaultValue, null, 2), 'utf8');
    }
  }

  /** 파일 내용을 읽는다. 손상된 JSON이면 예외를 던진다. */
  async read() {
    if (this.cache) return this.clone(this.cache);
    this.ensureFile();
    const raw = await fsp.readFile(this.filePath, 'utf8');
    let data;
    try {
      data = raw.trim() ? JSON.parse(raw) : this.clone(this.defaultValue);
    } catch (err) {
      throw new Error(`JSON 파일이 손상되었습니다: ${this.filePath}`);
    }
    this.cache = data;
    return this.clone(data);
  }

  /** 전체 내용을 덮어쓴다. */
  async write(data) {
    if (data === undefined) throw new TypeError('data is required');
    const task = this.queue.then(async () => {
      this.ensureFile();
      const tmp = `${this.filePath}.${process.pid}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
      await fsp.rename(tmp, this.filePath);
      this.cache = this.clone(data);
    });
    this.queue = task.catch(() => {});
    await task;
    return this.clone(data);
  }

  /** 읽고-변경하고-쓰는 작업을 원자적으로 수행한다. */
  async update(mutator) {
    if (typeof mutator !== 'function') throw new TypeError('mutator must be a function');
    const task = this.queue.then(async () => {
      this.ensureFile();
      let data;
      if (this.cache) {
        data = this.clone(this.cache);
      } else {
        const raw = await fsp.readFile(this.filePath, 'utf8');
        try {
          data = raw.trim() ? JSON.parse(raw) : this.clone(this.defaultValue);
        } catch (err) {
          throw new Error(`JSON 파일이 손상되었습니다: ${this.filePath}`);
        }
      }
      const result = await mutator(data);
      const next = result === undefined ? data : result;
      const tmp = `${this.filePath}.${process.pid}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(next, null, 2), 'utf8');
      await fsp.rename(tmp, this.filePath);
      this.cache = this.clone(next);
      return this.clone(next);
    });
    this.queue = task.catch(() => {});
    return task;
  }

  clearCache() {
    this.cache = null;
  }

  clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }
}

module.exports = { JsonStore };
