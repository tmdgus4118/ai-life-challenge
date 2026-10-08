/**
 * 서버와 브라우저가 함께 쓰는 상수 (UMD).
 * 소음원 7개 그룹, 수신자, 말투, 기본 설정값 등 도메인 상수를 한 곳에 둔다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NeighborSoundConstants = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const SOURCE_GROUPS = [
    { key: 'footstep', label: '발걸음', type: 'impact', icon: 'footstep' },
    { key: 'furniture', label: '가구·충격', type: 'impact', icon: 'furniture' },
    { key: 'hammer', label: '망치·공사', type: 'impact', icon: 'hammer' },
    { key: 'pet', label: '반려동물', type: 'airborne', icon: 'pet' },
    { key: 'music', label: '악기·음악', type: 'airborne', icon: 'music' },
    { key: 'voice', label: '말소리·TV', type: 'airborne', icon: 'voice' },
    { key: 'other', label: '기타', type: null, icon: 'other' },
  ];

  const SOURCE_KEYS = SOURCE_GROUPS.map((g) => g.key);

  const RECIPIENTS = [
    { key: 'neighbor', label: '이웃', form: '부탁 형식' },
    { key: 'management', label: '관리사무소', form: '민원 형식' },
    { key: 'center', label: '이웃사이센터', form: '상담 신청 서술 형식' },
  ];
  const RECIPIENT_KEYS = RECIPIENTS.map((r) => r.key);

  const TONES = [
    { key: 'soft', label: '부드럽게' },
    { key: 'basic', label: '기본' },
    { key: 'firm', label: '단호하게' },
  ];
  const TONE_KEYS = TONES.map((t) => t.key);

  const REPORT_PERIODS = [7, 14, 30];

  const DEFAULT_SETTINGS = {
    night_start: 22,
    night_end: 6,
    db_offset: 90,
    min_duration_sec: 3,
    quiet_end_sec: 10,
    classify_interval_sec: 1,
    confidence_threshold: 0.3,
    legacy_building: false,
    role: 'listener',
    theme: 'auto',
    text_size: 'normal',
    vibration_enabled: true,
    care_alert: true,
  };

  /** 참/거짓 설정 항목 */
  const SETTINGS_BOOLEANS = ['legacy_building', 'vibration_enabled', 'care_alert'];

  /** 선택지 설정 항목 */
  const SETTINGS_ENUMS = {
    role: ['listener', 'maker'],
    theme: ['auto', 'light', 'dark'],
    text_size: ['normal', 'large'],
  };

  /** 리포트 화면 '기록에게 묻기' 추천 질문 */
  const ASK_QUESTIONS = [
    { key: 'pattern', label: '가장 두드러진 패턴은 무엇인가요?' },
    { key: 'weekday_weekend', label: '평일과 주말은 어떻게 다른가요?' },
    { key: 'night', label: '밤 시간대는 어떤가요?' },
    { key: 'trend', label: '지난 기간보다 나아졌나요?' },
    { key: 'source', label: '어떤 소리가 가장 많은가요?' },
  ];
  const ASK_KEYS = ASK_QUESTIONS.map((q) => q.key);
  const ASK_MAX_LENGTH = 120;
  const SHARE_TTL_DAYS = 14;

  /** 화면에 보이는 AI 제공자 이름 (내부 식별자를 그대로 노출하지 않음) */
  // 화면에는 모델·회사 이름을 드러내지 않는다
  const PROVIDER_LABELS = { anthropic: 'AI', template: '규칙 기반 작성기' };
  const providerLabel = (key) => PROVIDER_LABELS[key] || 'AI';

  const ROLES = [
    { key: 'listener', label: '소음을 듣는 쪽', description: '이웃의 소음을 기록하고 대화·상담에 씁니다.' },
    { key: 'maker', label: '소음을 내는 쪽', description: '우리 집이 언제 시끄러운지 스스로 점검하고, 기준에 가까워지면 배려 알림을 받습니다.' },
  ];

  const THEMES = [
    { key: 'auto', label: '야간 자동', description: '야간 시간대에 어두운 화면으로 바뀝니다.' },
    { key: 'light', label: '밝게' },
    { key: 'dark', label: '어둡게' },
  ];

  const SETTINGS_LIMITS = {
    night_start: { min: 0, max: 23 },
    night_end: { min: 0, max: 23 },
    db_offset: { min: 40, max: 140 },
    min_duration_sec: { min: 1, max: 30 },
    quiet_end_sec: { min: 3, max: 60 },
    classify_interval_sec: { min: 1, max: 3 },
    confidence_threshold: { min: 0.1, max: 0.9 },
  };

  const CENTER_INFO = {
    name: '층간소음 이웃사이센터',
    phone: '1661-2642',
    url: 'https://floor.noiseinfo.or.kr/floornoise/',
    operator: '기후에너지환경부 · 한국환경공단',
    hours: '평일 9~18시 (점심 12~13시 제외)',
    cost: '상담·측정 무료',
  };

  const MESSAGE_MAX_LENGTH = 300;
  const REPORT_MAX_SENTENCES = 5;

  const DISCLAIMER = '스마트폰 측정값으로 공인 측정이 아니며, 대화를 위한 참고 기록입니다. 법적 증거로 사용할 수 없습니다.';

  const STEP_GUIDE = [
    { step: 1, key: 'neighbor', title: '이웃에게 직접 연락', description: '정리된 기록을 바탕으로 정중하게 부탁합니다. 상대가 모를 수 있다는 전제로 대화를 시작합니다.' },
    { step: 2, key: 'management', title: '관리사무소 민원', description: '이웃 연락 후 2주가 지나도 같은 패턴이면 관리사무소에 기록을 첨부해 알리고, 상대 세대에 중단을 권고해 달라고 요청합니다(공동주택관리법 제20조제2항). 단지에 층간소음관리위원회가 있으면 조정을 신청할 수 있습니다.' },
    { step: 3, key: 'center', title: '이웃사이센터 상담·측정', description: '관리사무소 중재 후에도 계속되면 이웃사이센터(1661-2642)에 전화 상담을 받고 방문상담·소음측정을 신청합니다. 관리사무소 중재 결과서를 함께 냅니다. 비용은 무료입니다.' },
  ];

  const STEP_WAIT_DAYS = 14;

  const TIMEZONE = 'Asia/Seoul';

  return {
    SOURCE_GROUPS,
    SOURCE_KEYS,
    RECIPIENTS,
    RECIPIENT_KEYS,
    TONES,
    TONE_KEYS,
    REPORT_PERIODS,
    DEFAULT_SETTINGS,
    SETTINGS_LIMITS,
    SETTINGS_BOOLEANS,
    SETTINGS_ENUMS,
    ASK_QUESTIONS,
    ASK_KEYS,
    ASK_MAX_LENGTH,
    SHARE_TTL_DAYS,
    PROVIDER_LABELS,
    providerLabel,
    ROLES,
    THEMES,
    CENTER_INFO,
    MESSAGE_MAX_LENGTH,
    REPORT_MAX_SENTENCES,
    DISCLAIMER,
    STEP_GUIDE,
    STEP_WAIT_DAYS,
    TIMEZONE,
    getSourceGroup(key) {
      return SOURCE_GROUPS.find((g) => g.key === key) || null;
    },
  };
});
