const { createModels } = require('../../src/models');
const { LabService } = require('../../src/services/LabService');
const { DataService } = require('../../src/services/DataService');
const { LabRunDto } = require('../../src/dtos');
const { ValidationError } = require('../../src/utils/errors');
const { makeTempDbDir, removeDir, USER_A, USER_B } = require('../helpers');

const f = (group, confidence = 0.6, top = null) => ({ group, confidence, top_class: top });

describe('LabRunDto', () => {
  test('성공: 정답 소음원과 프레임', () => {
    const dto = LabRunDto.from({ expected_group: 'pet', frames: [f('pet', 0.7, 'Bark')] });
    expect(dto.frames[0]).toEqual({ group: 'pet', confidence: 0.7, top_class: 'Bark' });
  });
  test('실패: 기타는 정답이 될 수 없음, 프레임 없음·초과·잘못된 그룹', () => {
    expect(() => LabRunDto.from({ expected_group: 'other', frames: [f('pet')] })).toThrow(ValidationError);
    expect(() => LabRunDto.from({ expected_group: 'pet', frames: [] })).toThrow(ValidationError);
    expect(() => LabRunDto.from({ expected_group: 'pet', frames: Array(121).fill(f('pet')) })).toThrow(ValidationError);
    expect(() => LabRunDto.from({ expected_group: 'pet', frames: [f('cat')] })).toThrow(ValidationError);
    expect(() => LabRunDto.from({ expected_group: 'pet', frames: [{ group: 'pet', confidence: 2 }] })).toThrow(ValidationError);
  });
});

describe('LabService', () => {
  let dir; let m; let lab;
  beforeEach(() => { dir = makeTempDbDir(); m = createModels(dir); lab = new LabService({ labRunModel: m.labRunModel }); });
  afterEach(() => removeDir(dir));

  test('실패: 모델 누락', () => { expect(() => new LabService({})).toThrow(TypeError); });

  test('predict: 기타를 뺀 다수결, 동률은 신뢰도, 전부 기타면 기타 / 실패: 빈 배열', () => {
    expect(LabService.predict([f('pet'), f('other'), f('other'), f('pet'), f('voice')])).toBe('pet');
    expect(LabService.predict([f('pet', 0.4), f('voice', 0.9)])).toBe('voice');
    expect(LabService.predict([f('other'), f('other')])).toBe('other');
    expect(() => LabService.predict([])).toThrow(TypeError);
  });

  test('record: 예측·정답 여부·프레임 정확도 저장', async () => {
    const run = await lab.record(USER_A, { expected_group: 'footstep', frames: [f('footstep'), f('footstep'), f('furniture'), f('other')] });
    expect(run).toMatchObject({ predicted_group: 'footstep', correct: true, frame_accuracy: 50 });
    const miss = await lab.record(USER_A, { expected_group: 'footstep', frames: [f('furniture'), f('furniture')] });
    expect(miss.correct).toBe(false);
    await expect(lab.record(null, { expected_group: 'pet', frames: [f('pet')] })).rejects.toThrow(ValidationError);
  });

  test('summary: 소음원별·전체 정확도, 혼동 행렬, 다른 사용자 분리', async () => {
    await lab.record(USER_A, { expected_group: 'footstep', frames: [f('footstep')] });
    await lab.record(USER_A, { expected_group: 'footstep', frames: [f('furniture')] });
    await lab.record(USER_A, { expected_group: 'pet', frames: [f('pet')] });
    await lab.record(USER_B, { expected_group: 'music', frames: [f('music')] });
    const s = await lab.summary(USER_A);
    expect(s).toMatchObject({ total_runs: 3, correct: 2, accuracy: 67 });
    expect(s.by_group.find((g) => g.key === 'footstep')).toMatchObject({ runs: 2, correct: 1, accuracy: 50 });
    expect(s.by_group.find((g) => g.key === 'music').accuracy).toBeNull();
    expect(s.matrix.footstep.furniture).toBe(1);
    expect(s.matrix.pet.pet).toBe(1);
    expect(s.recent).toHaveLength(3);
    expect((await lab.summary(USER_B)).total_runs).toBe(1);
    await expect(lab.summary()).rejects.toThrow(ValidationError);
  });

  test('summary: 측정 없으면 정확도 null', async () => {
    expect((await lab.summary(USER_A)).accuracy).toBeNull();
  });

  test('clear / DataService.deleteAll이 측정 기록도 지운다', async () => {
    await lab.record(USER_A, { expected_group: 'pet', frames: [f('pet')] });
    expect(await lab.clear(USER_A)).toBe(1);
    await lab.record(USER_A, { expected_group: 'pet', frames: [f('pet')] });
    const r = await new DataService(m).deleteAll(USER_A);
    expect(r.lab_runs).toBe(1);
    await expect(lab.clear()).rejects.toThrow(ValidationError);
  });
});
