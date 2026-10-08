const { CreateEventsDto, EventInputDto, EventQueryDto, UpdateEventMemoDto, ReportQueryDto, GenerateMessageDto, UpdateSettingsDto } = require('../../src/dtos');
const { BaseDto } = require('../../src/dtos/BaseDto');
const { ValidationError } = require('../../src/utils/errors');
const { sampleEventInput } = require('../helpers');

describe('BaseDto helpers', () => {
  test('number: 문자열 숫자 변환, 범위·정수 검증', () => {
    expect(BaseDto.number('5', 'f')).toBe(5);
    expect(BaseDto.number(undefined, 'f', { required: false })).toBeUndefined();
    expect(() => BaseDto.number(undefined, 'f')).toThrow(ValidationError);
    expect(() => BaseDto.number('x', 'f')).toThrow(ValidationError);
    expect(() => BaseDto.number(1.5, 'f', { integer: true })).toThrow(ValidationError);
    expect(() => BaseDto.number(11, 'f', { max: 10 })).toThrow(ValidationError);
  });
  test('isoDate / oneOf / string / boolean', () => {
    expect(BaseDto.isoDate('2026-09-28T13:00:00Z', 'd')).toBe('2026-09-28T13:00:00.000Z');
    expect(() => BaseDto.isoDate('nope', 'd')).toThrow(ValidationError);
    expect(BaseDto.oneOf('a', 'f', ['a', 'b'])).toBe('a');
    expect(BaseDto.oneOf(undefined, 'f', ['a'], { required: false, fallback: 'a' })).toBe('a');
    expect(() => BaseDto.oneOf('z', 'f', ['a'])).toThrow(ValidationError);
    expect(BaseDto.string('  hi ', 'f')).toBe('hi');
    expect(() => BaseDto.string(1, 'f')).toThrow(ValidationError);
    expect(() => BaseDto.string('', 'f', { required: true })).toThrow(ValidationError);
    expect(() => BaseDto.string('abc', 'f', { maxLength: 2 })).toThrow(ValidationError);
    expect(BaseDto.boolean('true', 'f')).toBe(true);
    expect(BaseDto.boolean(undefined, 'f', false)).toBe(false);
    expect(() => BaseDto.boolean('maybe', 'f')).toThrow(ValidationError);
    expect(() => BaseDto.requireObject([])).toThrow(ValidationError);
  });
});

describe('EventInputDto', () => {
  test('성공: 정상 입력', () => {
    const dto = EventInputDto.from(sampleEventInput({ memo: ' 아이 깸 ' }));
    expect(dto.source_group).toBe('footstep');
    expect(dto.memo).toBe('아이 깸');
    expect(dto.excluded).toBe(false);
  });
  test('db_series: 소수 1자리 반올림, null 허용 / 실패: 배열 아님, 범위 밖, 3600 초과', () => {
    expect(EventInputDto.from(sampleEventInput({ db_series: [40.14, null, '45'] })).db_series).toEqual([40.1, null, 45]);
    expect(EventInputDto.from(sampleEventInput()).db_series).toBeUndefined();
    expect(() => EventInputDto.from(sampleEventInput({ db_series: 'x' }))).toThrow(ValidationError);
    expect(() => EventInputDto.from(sampleEventInput({ db_series: [200] }))).toThrow(ValidationError);
    expect(() => EventInputDto.from(sampleEventInput({ db_series: Array(3601).fill(40) }))).toThrow(ValidationError);
  });
  test('바닥 진동: 초·최고·1초별(0/1/null) / 없으면 undefined', () => {
    const dto = EventInputDto.from(sampleEventInput({ vibration_sec: 2, vibration_peak_mg: 18.4, vibration_series: [1, 0, null, 1] }));
    expect(dto).toMatchObject({ vibration_sec: 2, vibration_peak_mg: 18.4, vibration_series: [1, 0, null, 1] });
    const none = EventInputDto.from(sampleEventInput());
    expect(none.vibration_sec).toBeUndefined();
    expect(none.vibration_series).toBeUndefined();
  });
  test('바닥 진동 실패: 정수 아님, 범위 밖, 값이 0/1/null 아님, 3600 초과', () => {
    expect(() => EventInputDto.from(sampleEventInput({ vibration_sec: 1.5 }))).toThrow(ValidationError);
    expect(() => EventInputDto.from(sampleEventInput({ vibration_sec: -1 }))).toThrow(ValidationError);
    expect(() => EventInputDto.from(sampleEventInput({ vibration_peak_mg: 20000 }))).toThrow(ValidationError);
    expect(() => EventInputDto.from(sampleEventInput({ vibration_series: [2] }))).toThrow(ValidationError);
    expect(() => EventInputDto.from(sampleEventInput({ vibration_series: 'x' }))).toThrow(ValidationError);
    expect(() => EventInputDto.from(sampleEventInput({ vibration_series: Array(3601).fill(0) }))).toThrow(ValidationError);
  });
  test('실패: 종료가 시작보다 빠름, 모르는 소음원, dB 범위', () => {
    expect(() => EventInputDto.from(sampleEventInput({ ended_at: '2026-09-28T13:00:00Z' }))).toThrow(ValidationError);
    expect(() => EventInputDto.from(sampleEventInput({ source_group: 'ufo' }))).toThrow(ValidationError);
    expect(() => EventInputDto.from(sampleEventInput({ avg_db: 200 }))).toThrow(ValidationError);
    expect(() => EventInputDto.from(null)).toThrow(ValidationError);
  });
});

describe('CreateEventsDto', () => {
  test('성공: 배열 또는 {events: []}', () => {
    expect(CreateEventsDto.from([sampleEventInput()]).events).toHaveLength(1);
    expect(CreateEventsDto.from({ events: [sampleEventInput(), sampleEventInput()] }).events).toHaveLength(2);
  });
  test('실패: 배열 아님, 빈 배열, 500건 초과', () => {
    expect(() => CreateEventsDto.from({})).toThrow(ValidationError);
    expect(() => CreateEventsDto.from([])).toThrow(ValidationError);
    expect(() => CreateEventsDto.from(Array(501).fill(sampleEventInput()))).toThrow(ValidationError);
  });
});

describe('EventQueryDto', () => {
  test('성공: 빈 쿼리, 필터', () => {
    expect(EventQueryDto.from({}).source).toBeNull();
    const dto = EventQueryDto.from({ from: '2026-09-01', to: '2026-09-08', source: 'pet', limit: '10' });
    expect(dto.source).toBe('pet');
    expect(dto.limit).toBe(10);
  });
  test('실패: to < from, 잘못된 소음원', () => {
    expect(() => EventQueryDto.from({ from: '2026-09-08', to: '2026-09-01' })).toThrow(ValidationError);
    expect(() => EventQueryDto.from({ source: 'x' })).toThrow(ValidationError);
  });
});

describe('UpdateEventMemoDto', () => {
  test('성공: 빈 문자열(메모 삭제) 허용', () => {
    expect(UpdateEventMemoDto.from({ memo: '' }).memo).toBe('');
    expect(UpdateEventMemoDto.from({ memo: ' x ' }).memo).toBe('x');
  });
  test('실패: memo 누락, 201자', () => {
    expect(() => UpdateEventMemoDto.from({})).toThrow(ValidationError);
    expect(() => UpdateEventMemoDto.from({ memo: 'a'.repeat(201) })).toThrow(ValidationError);
  });
});

describe('ReportQueryDto', () => {
  test('성공: 기본 7, 문자열 14', () => {
    expect(ReportQueryDto.from({}).days).toBe(7);
    expect(ReportQueryDto.from({ days: '14' }).days).toBe(14);
  });
  test('실패: 10일은 허용 안 됨', () => {
    expect(() => ReportQueryDto.from({ days: 10 })).toThrow(ValidationError);
    expect(() => ReportQueryDto.from({ days: 'x' })).toThrow(ValidationError);
  });
});

describe('GenerateMessageDto', () => {
  test('성공: 말투 기본값 basic, days 기본 7', () => {
    const dto = GenerateMessageDto.from({ recipient: 'neighbor' });
    expect(dto.tone).toBe('basic');
    expect(dto.days).toBe(7);
    expect(dto.report_id).toBeNull();
  });
  test('실패: 수신자 누락·오류, 말투 오류', () => {
    expect(() => GenerateMessageDto.from({})).toThrow(ValidationError);
    expect(() => GenerateMessageDto.from({ recipient: 'police' })).toThrow(ValidationError);
    expect(() => GenerateMessageDto.from({ recipient: 'neighbor', tone: 'angry' })).toThrow(ValidationError);
  });
});

describe('UpdateSettingsDto', () => {
  test('성공: 역할·테마 선택지 / 실패: 허용되지 않은 값', () => {
    expect(UpdateSettingsDto.from({ role: 'maker', theme: 'auto' })).toEqual({ role: 'maker', theme: 'auto' });
    expect(() => UpdateSettingsDto.from({ role: 'x' })).toThrow(ValidationError);
  });
  test('성공: 오래된 단지 불리언 / 실패: 불리언 아님', () => {
    expect(UpdateSettingsDto.from({ legacy_building: true })).toEqual({ legacy_building: true });
    expect(UpdateSettingsDto.from({ legacy_building: 'false' })).toEqual({ legacy_building: false });
    expect(UpdateSettingsDto.from({ vibration_enabled: false, care_alert: 'true' })).toEqual({ vibration_enabled: false, care_alert: true });
    expect(() => UpdateSettingsDto.from({ legacy_building: 'maybe' })).toThrow(ValidationError);
  });
  test('성공: 일부 필드만, 모르는 필드는 무시', () => {
    const dto = UpdateSettingsDto.from({ night_start: '21', foo: 1 });
    expect(dto).toEqual({ night_start: 21 });
  });
  test('실패: 변경 항목 없음, 범위 밖, 시작==종료', () => {
    expect(() => UpdateSettingsDto.from({})).toThrow(ValidationError);
    expect(() => UpdateSettingsDto.from({ night_start: 25 })).toThrow(ValidationError);
    expect(() => UpdateSettingsDto.from({ min_duration_sec: 2.5 })).toThrow(ValidationError);
    expect(() => UpdateSettingsDto.from({ night_start: 5, night_end: 5 })).toThrow(ValidationError);
  });
});
