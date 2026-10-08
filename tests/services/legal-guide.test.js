const { LegalGuideService } = require('../../src/services/LegalGuideService');

const valid = () => ({
  checked_at: '2026-10-02',
  disclaimer: '법률 자문이 아닙니다.',
  emergency: { title: '위협·폭력은 즉시 112', description: '...', phone: '112' },
  safety_rules: [{ title: '직접 찾아가지 않기', detail: '...' }],
  stages: [
    { step: 1, title: '대화', when: '처음', actions: ['메시지 전달'] },
    { step: 2, title: '관리사무소', when: '2주 후', actions: ['민원'] },
  ],
  laws: [{ title: '공동주택관리법', article: '제20조', summary: '...', source_url: 'https://www.law.go.kr/x' }],
  risky_acts: [{ title: '보복 소음', law: '스토킹처벌법', example: '...', penalty: '...', source_url: 'https://www.law.go.kr/y' }],
  agencies: [{ title: '이웃사이센터', phone: '1661-2642', role: '...', source_url: 'https://www.noiseinfo.or.kr' }],
});

describe('LegalGuideService.validate', () => {
  test('성공: 유효한 데이터는 문제 없음', () => {
    expect(LegalGuideService.validate(valid())).toEqual([]);
  });
  test('실패: 출처 없는 법령·처벌 항목, http 출처', () => {
    const g = valid();
    delete g.laws[0].source_url;
    g.risky_acts[0].source_url = 'http://insecure';
    const problems = LegalGuideService.validate(g);
    expect(problems.some((p) => p.includes('laws[0]'))).toBe(true);
    expect(problems.some((p) => p.includes('risky_acts[0]'))).toBe(true);
  });
  test('실패: 기준일 형식, 긴급 연락처, 빈 배열, 단계 번호 순서', () => {
    const g = valid();
    g.checked_at = '2026/10/02';
    g.emergency = {};
    g.safety_rules = [];
    g.stages[1].step = 3;
    const problems = LegalGuideService.validate(g);
    expect(problems.join()).toMatch(/checked_at/);
    expect(problems.join()).toMatch(/emergency\.phone/);
    expect(problems.join()).toMatch(/safety_rules/);
    expect(problems.join()).toMatch(/stages\[1\]\.step/);
  });
  test('실패: 객체가 아님', () => {
    expect(LegalGuideService.validate(null)).toHaveLength(1);
  });
});

describe('LegalGuideService.getGuide / getStage', () => {
  test('성공: 로드·캐시, 단계 조회', () => {
    const loader = jest.fn(valid);
    const svc = new LegalGuideService({ loader });
    expect(svc.getGuide().checked_at).toBe('2026-10-02');
    svc.getGuide();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(svc.getStage(2).title).toBe('관리사무소');
    svc.clearCache();
    svc.getGuide();
    expect(loader).toHaveBeenCalledTimes(2);
  });
  test('실패: 검증 오류는 예외, 없는 단계·잘못된 번호', () => {
    const svc = new LegalGuideService({ loader: () => ({ ...valid(), laws: [] }) });
    expect(() => svc.getGuide()).toThrow('법·대응 안내 데이터 오류');
    const ok = new LegalGuideService({ loader: valid });
    expect(() => ok.getStage(9)).toThrow(RangeError);
    expect(() => ok.getStage(0)).toThrow(RangeError);
  });
});

describe('실제 legal-guide.json', () => {
  const guide = new LegalGuideService().getGuide();
  test('검증 통과, 6단계, 모든 법령·처벌·기관 항목에 https 출처', () => {
    expect(LegalGuideService.validate(guide)).toEqual([]);
    expect(guide.stages.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  test('조사에서 쓰면 안 된다고 확인된 표현이 없다', () => {
    const text = JSON.stringify(guide);
    // 옛 기관명은 '이름이 바뀌었습니다' 설명 문맥에서만 등장한다
    expect(text.split('환경분쟁조정위원회에서 이름이 바뀌었습니다').join('')).not.toMatch(/환경분쟁조정위원회(?!.*피해구제)/);
    expect(text).not.toContain('500세대 이상 층간소음관리위원회');
    expect(text).not.toMatch(/(?<!기후에너지)환경부/);
    expect(text).not.toContain('2016가단207946');
    expect(text).not.toContain('www.noiseinfo.or.kr');
    expect(text).toContain('700세대');
    expect(text).toContain('환경분쟁조정피해구제위원회');
  });
  test('대화 → 관리사무소 → 위원회 → 센터 → 분쟁조정 → 소송 순서', () => {
    expect(guide.stages.map((s) => s.title)).toEqual([
      '기록하고 정중하게 대화하기', '관리사무소(관리주체)에 알리기', '층간소음관리위원회 조정 신청',
      '층간소음 이웃사이센터 상담·측정', '분쟁조정위원회에 조정 신청', '민사 소송 (손해배상·소음 중지 청구)',
    ]);
  });
});
