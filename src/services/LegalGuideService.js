const fs = require('fs');
const path = require('path');

const DEFAULT_PATH = path.join(__dirname, '..', 'config', 'legal-guide.json');

/**
 * 법·대응 안내 콘텐츠. 법령 내용은 코드가 아니라 JSON 설정(src/config/legal-guide.json)에 두고,
 * 모든 법령·처벌 항목은 출처 URL을 갖도록 검증한다. 법이 바뀌면 JSON만 고친다.
 */
class LegalGuideService {
  constructor({ filePath = DEFAULT_PATH, loader = null } = {}) {
    this.filePath = filePath;
    this.loader = loader || (() => JSON.parse(fs.readFileSync(this.filePath, 'utf8')));
    this.cache = null;
  }

  /** 필수 필드와 출처를 검사한다. 문제 목록을 돌려준다 (빈 배열이면 통과) */
  static validate(guide) {
    const problems = [];
    if (!guide || typeof guide !== 'object') return ['가이드 데이터가 객체가 아닙니다.'];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(guide.checked_at || '')) problems.push('checked_at(확인 기준일)이 YYYY-MM-DD 형식이 아닙니다.');
    if (!guide.disclaimer) problems.push('disclaimer가 없습니다.');
    if (!guide.emergency || !guide.emergency.phone) problems.push('emergency.phone이 없습니다.');
    ['stages', 'safety_rules', 'laws', 'risky_acts', 'agencies'].forEach((key) => {
      if (!Array.isArray(guide[key]) || guide[key].length === 0) problems.push(`${key} 배열이 비어 있습니다.`);
    });
    const needSource = (list, key) => (Array.isArray(list) ? list : []).forEach((item, i) => {
      if (!item.title) problems.push(`${key}[${i}].title이 없습니다.`);
      if (!item.source_url || !/^https:\/\//.test(item.source_url)) problems.push(`${key}[${i}](${item.title || '?'})에 https 출처가 없습니다.`);
    });
    needSource(guide.laws, 'laws');
    needSource(guide.risky_acts, 'risky_acts');
    needSource(guide.agencies, 'agencies');
    (Array.isArray(guide.stages) ? guide.stages : []).forEach((st, i) => {
      if (!Number.isInteger(st.step) || st.step !== i + 1) problems.push(`stages[${i}].step은 ${i + 1}이어야 합니다.`);
      if (!st.title || !Array.isArray(st.actions) || st.actions.length === 0) problems.push(`stages[${i}]에 title/actions가 없습니다.`);
    });
    return problems;
  }

  /** 가이드 전체 (검증 실패 시 예외) */
  getGuide() {
    if (this.cache) return this.cache;
    const guide = this.loader();
    const problems = LegalGuideService.validate(guide);
    if (problems.length) {
      throw new Error(`법·대응 안내 데이터 오류: ${problems.join(' / ')}`);
    }
    this.cache = guide;
    return guide;
  }

  /** 특정 단계 안내 */
  getStage(step) {
    if (!Number.isInteger(step) || step < 1) throw new RangeError('step must be a positive integer');
    const stage = this.getGuide().stages.find((s) => s.step === step);
    if (!stage) throw new RangeError(`stage not found: ${step}`);
    return stage;
  }

  clearCache() {
    this.cache = null;
  }
}

module.exports = { LegalGuideService };
