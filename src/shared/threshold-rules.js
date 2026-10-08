/**
 * 층간소음 기준 판정 규칙 (UMD, 서버·브라우저 공용).
 * 기준값은 코드에 박지 않고 thresholds 테이블(JSON)로 주입받는다.
 *
 * 규칙 (국토교통부·기후에너지환경부 「공동주택 층간소음의 범위와 기준에 관한 규칙」 별표, 2023-01-02 시행)
 *  - 사건 시작 시각이 야간(기본 22~06시)이면 야간 기준, 아니면 주간 기준
 *  - 직접충격음(발걸음, 가구, 망치): 1분 등가소음도 39/34dB, 최고소음도 57/52dB
 *  - 공기전달음(반려동물, 악기, 말소리): 5분 등가소음도 45/40dB
 *  - 비고 2: 2005-06-30 이전 사업승인·건축허가 공동주택은 직접충격음에 legacy_bonus_db(2dB) 가산
 *  - 비고 5: 최고소음도는 1시간에 min_count_per_hour(3)회 이상 넘을 때 초과
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./constants'));
  } else {
    root.NeighborSoundThresholdRules = factory(root.NeighborSoundConstants);
  }
})(typeof self !== 'undefined' ? self : this, function (constants) {
  const METRIC_LABELS = {
    avg1min: '1분 등가소음도',
    max: '최고소음도',
    avg5min: '5분 등가소음도',
  };

  /**
   * 시각(시)이 야간 구간인지 판정한다. 야간 구간이 자정을 넘는 경우(22~06)를 처리한다.
   */
  function isNightHour(hour, nightStart, nightEnd) {
    if (typeof hour !== 'number' || Number.isNaN(hour) || hour < 0 || hour > 23) {
      throw new RangeError('hour must be 0-23');
    }
    if (nightStart === nightEnd) return false;
    if (nightStart < nightEnd) {
      return hour >= nightStart && hour < nightEnd;
    }
    return hour >= nightStart || hour < nightEnd;
  }

  /**
   * 소음원 그룹에 해당하는 기준 유형을 돌려준다. 기타는 null(판정 제외).
   */
  function getSourceType(sourceGroup) {
    const group = constants.getSourceGroup(sourceGroup);
    if (!group) throw new RangeError('unknown source group: ' + sourceGroup);
    return group.type;
  }

  /** 기준 행의 적용값: 주간/야간 + 오래된 단지 가산 */
  function limitOf(row, isNight, settings) {
    if (!row) throw new TypeError('threshold row is required');
    const base = isNight ? row.night_db : row.day_db;
    const bonus = settings && settings.legacy_building && row.legacy_bonus_db ? row.legacy_bonus_db : 0;
    return base + bonus;
  }

  /**
   * 사건 하나를 기준과 비교한다.
   * @param {{source_group:string, avg_db:number, max_db:number, hour:number, max_exceed_count_hour?:number}} event
   *   max_exceed_count_hour: 이 사건을 포함해 직전 1시간 동안 최고소음도 기준을 넘은 사건 수 (없으면 1로 본다)
   * @param {Array<{source_type:string, metric:string, day_db:number, night_db:number, legacy_bonus_db?:number, min_count_per_hour?:number}>} thresholds
   * @param {{night_start:number, night_end:number, legacy_building?:boolean}} settings
   * @returns {{is_night:boolean, exceeded:boolean, exceeded_rule:string|null, rules:Array, max_over:boolean}}
   *   max_over: 최고소음도 값 자체는 넘었는지 (1시간 횟수 집계용)
   */
  function evaluate(event, thresholds, settings) {
    if (!event || typeof event !== 'object') throw new TypeError('event is required');
    if (!Array.isArray(thresholds) || thresholds.length === 0) throw new TypeError('thresholds table is required');
    if (!settings) throw new TypeError('settings is required');

    const isNight = isNightHour(event.hour, settings.night_start, settings.night_end);
    const sourceType = getSourceType(event.source_group);
    const rules = [];
    let maxOver = false;
    const countInHour = typeof event.max_exceed_count_hour === 'number' ? event.max_exceed_count_hour : 1;

    if (sourceType) {
      thresholds
        .filter((t) => t.source_type === sourceType)
        .forEach((t) => {
          const limit = limitOf(t, isNight, settings);
          const measured = t.metric === 'max' ? event.max_db : event.avg_db;
          if (typeof measured !== 'number' || Number.isNaN(measured)) return;
          if (measured <= limit) return;
          const label = (isNight ? '야간 ' : '주간 ') + (METRIC_LABELS[t.metric] || t.metric) + ' ' + limit + 'dB 초과';
          if (t.metric === 'max') {
            maxOver = true;
            const need = t.min_count_per_hour || 1;
            if (countInHour < need) return;
            rules.push({ metric: t.metric, limit, measured, count: countInHour, label: label + '(1시간 ' + countInHour + '회)' });
            return;
          }
          rules.push({ metric: t.metric, limit, measured, label });
        });
    }

    return {
      is_night: isNight,
      exceeded: rules.length > 0,
      exceeded_rule: rules.length ? rules.map((r) => r.label).join(', ') : null,
      rules,
      max_over: maxOver,
    };
  }

  /** 최고소음도 기준값 (주간/야간·가산 반영). 기준이 없는 유형이면 null */
  function getMaxLimit(sourceGroup, hour, thresholds, settings) {
    const type = getSourceType(sourceGroup);
    if (!type) return null;
    const row = thresholds.find((t) => t.source_type === type && t.metric === 'max');
    if (!row) return null;
    return limitOf(row, isNightHour(hour, settings.night_start, settings.night_end), settings);
  }

  /**
   * 감지 화면에서 "지금 이 순간" 기준선으로 쓸 1분(또는 5분) 평균 기준값.
   */
  function getCurrentLimit(sourceGroup, hour, thresholds, settings) {
    const isNight = isNightHour(hour, settings.night_start, settings.night_end);
    const sourceType = constants.getSourceGroup(sourceGroup) ? getSourceType(sourceGroup) : null;
    const type = sourceType || 'impact';
    const metric = type === 'impact' ? 'avg1min' : 'avg5min';
    const row = thresholds.find((t) => t.source_type === type && t.metric === metric);
    if (!row) throw new RangeError('threshold row not found: ' + type + '/' + metric);
    return { is_night: isNight, limit: limitOf(row, isNight, settings), metric, source_type: type };
  }

  return { isNightHour, getSourceType, evaluate, getCurrentLimit, getMaxLimit, limitOf, METRIC_LABELS };
});
