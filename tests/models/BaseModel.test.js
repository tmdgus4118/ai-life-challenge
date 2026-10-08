const { BaseModel } = require('../../src/models/BaseModel');
const { makeTempDbDir, removeDir } = require('../helpers');

describe('BaseModel', () => {
  let dir; let model;
  beforeEach(() => { dir = makeTempDbDir(); model = new BaseModel(dir, 'things'); });
  afterEach(() => removeDir(dir));

  test('실패: 생성자 인자 누락', () => {
    expect(() => new BaseModel(null, 'x')).toThrow(TypeError);
    expect(() => new BaseModel(dir)).toThrow(TypeError);
  });

  test('insert: id와 created_at을 채운다', async () => {
    const row = await model.insert({ name: 'a' });
    expect(row.id).toBeTruthy();
    expect(row.created_at).toBeTruthy();
    expect(await model.findById(row.id)).toMatchObject({ name: 'a' });
  });

  test('insert 실패: 객체가 아니면', async () => {
    await expect(model.insert('x')).rejects.toThrow(TypeError);
    await expect(model.insert([1])).rejects.toThrow(TypeError);
  });

  test('insertMany 성공/실패', async () => {
    const rows = await model.insertMany([{ n: 1 }, { n: 2 }]);
    expect(rows).toHaveLength(2);
    expect(await model.count()).toBe(2);
    await expect(model.insertMany('x')).rejects.toThrow(TypeError);
    await expect(model.insertMany([null])).rejects.toThrow(TypeError);
  });

  test('findAll with predicate / 실패: predicate가 함수가 아님', async () => {
    await model.insertMany([{ n: 1 }, { n: 2 }]);
    expect(await model.findAll((r) => r.n > 1)).toHaveLength(1);
    await expect(model.findAll('x')).rejects.toThrow(TypeError);
  });

  test('findOne/findById: 없으면 null, 인자 누락 시 TypeError', async () => {
    expect(await model.findOne(() => false)).toBeNull();
    expect(await model.findById('nope')).toBeNull();
    await expect(model.findById()).rejects.toThrow(TypeError);
    await expect(model.findOne(null)).rejects.toThrow(TypeError);
  });

  test('updateById: 병합 갱신, 없는 id는 null, id는 바뀌지 않는다', async () => {
    const row = await model.insert({ n: 1 });
    const updated = await model.updateById(row.id, { n: 5, id: 'hack' });
    expect(updated.n).toBe(5);
    expect(updated.id).toBe(row.id);
    expect(updated.updated_at).toBeTruthy();
    expect(await model.updateById('missing', { n: 1 })).toBeNull();
    await expect(model.updateById(row.id, null)).rejects.toThrow(TypeError);
  });

  test('deleteById: 성공 true, 없는 id false', async () => {
    const row = await model.insert({ n: 1 });
    expect(await model.deleteById(row.id)).toBe(true);
    expect(await model.deleteById(row.id)).toBe(false);
    await expect(model.deleteById()).rejects.toThrow(TypeError);
  });

  test('sortNewestFirst: 최신순, 같은 시각이면 나중에 저장된 것이 앞 / 실패', () => {
    const t = '2026-10-01T00:00:00.000Z';
    const rows = [{ id: 'a', created_at: t }, { id: 'b', created_at: '2026-09-01T00:00:00.000Z' }, { id: 'c', created_at: t }];
    expect(BaseModel.sortNewestFirst(rows).map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(BaseModel.sortNewestFirst([{ id: 'x', at: 2 }, { id: 'y', at: 1 }], 'at').map((r) => r.id)).toEqual(['x', 'y']);
    expect(() => BaseModel.sortNewestFirst(null)).toThrow(TypeError);
  });
  test('같은 밀리초에 저장된 메시지도 이력은 나중 것이 먼저', async () => {
    const { MessageModel } = require('../../src/models');
    const mm = new MessageModel(dir);
    const t = '2026-10-01T00:00:00.000Z';
    await mm.insert({ user_id: 'u', recipient_type: 'neighbor', created_at: t });
    await mm.insert({ user_id: 'u', recipient_type: 'management', created_at: t });
    expect((await mm.findByUser('u'))[0].recipient_type).toBe('management');
  });
  test('deleteWhere: 삭제 건수 반환 / 실패', async () => {
    await model.insertMany([{ n: 1 }, { n: 2 }, { n: 3 }]);
    expect(await model.deleteWhere((r) => r.n >= 2)).toBe(2);
    expect(await model.count()).toBe(1);
    await expect(model.deleteWhere(1)).rejects.toThrow(TypeError);
  });
});
