const fs = require('fs');
const path = require('path');
const { JsonStore } = require('../../src/models/JsonStore');
const { makeTempDbDir, removeDir } = require('../helpers');

describe('JsonStore', () => {
  let dir;
  beforeEach(() => { dir = makeTempDbDir(); });
  afterEach(() => removeDir(dir));

  test('실패: 경로 없이 생성하면 TypeError', () => {
    expect(() => new JsonStore()).toThrow(TypeError);
  });

  test('read: 파일이 없으면 기본값으로 생성한다', async () => {
    const store = new JsonStore(path.join(dir, 'nested', 'a.json'), []);
    expect(await store.read()).toEqual([]);
    expect(fs.existsSync(path.join(dir, 'nested', 'a.json'))).toBe(true);
  });

  test('read 실패: 손상된 JSON', async () => {
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, '{ broken');
    await expect(new JsonStore(file).read()).rejects.toThrow('손상');
  });

  test('write/read: 저장한 값을 복제본으로 돌려준다', async () => {
    const store = new JsonStore(path.join(dir, 'w.json'));
    await store.write([{ a: 1 }]);
    const rows = await store.read();
    rows[0].a = 99;
    expect((await store.read())[0].a).toBe(1);
  });

  test('write 실패: undefined', async () => {
    const store = new JsonStore(path.join(dir, 'w.json'));
    await expect(store.write(undefined)).rejects.toThrow(TypeError);
  });

  test('update: 동시 호출이 직렬화되어 누락이 없다', async () => {
    const store = new JsonStore(path.join(dir, 'c.json'));
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.update((rows) => { rows.push(i); })));
    expect((await store.read()).length).toBe(20);
  });

  test('update: 반환값이 있으면 그것으로 교체한다', async () => {
    const store = new JsonStore(path.join(dir, 'u.json'));
    await store.update(() => [{ replaced: true }]);
    expect(await store.read()).toEqual([{ replaced: true }]);
  });

  test('update 실패: 함수가 아니면 TypeError', async () => {
    const store = new JsonStore(path.join(dir, 'u.json'));
    await expect(store.update('x')).rejects.toThrow(TypeError);
  });

  test('clearCache 후 디스크에서 다시 읽는다', async () => {
    const file = path.join(dir, 'cc.json');
    const store = new JsonStore(file);
    await store.write([1]);
    fs.writeFileSync(file, '[1,2,3]');
    expect(await store.read()).toEqual([1]);
    store.clearCache();
    expect(await store.read()).toEqual([1, 2, 3]);
  });
});
