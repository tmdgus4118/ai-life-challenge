const { ReportQueryDto, EventQueryDto } = require('../dtos');
const { BaseDto } = require('../dtos/BaseDto');
const { ValidationError } = require('../utils/errors');
const { SOURCE_GROUPS, RECIPIENT_KEYS, TONE_KEYS, DISCLAIMER, CENTER_INFO, DEFAULT_SETTINGS } = require('../shared/constants');

/** 서버 사이드 렌더링 화면 5개 + 인쇄용 리포트 */
class PageController {
  constructor({ eventService, reportService, messageService, settingsService, thresholdService, dataService, legalGuideService, labService = null, shareService = null, llmInfo, config }) {
    if (!eventService || !reportService || !messageService || !settingsService || !thresholdService || !dataService || !legalGuideService) {
      throw new TypeError('services are required');
    }
    this.eventService = eventService;
    this.reportService = reportService;
    this.messageService = messageService;
    this.settingsService = settingsService;
    this.thresholdService = thresholdService;
    this.dataService = dataService;
    this.legalGuideService = legalGuideService;
    this.labService = labService;
    this.shareService = shareService;
    this.llmInfo = llmInfo || {};
    this.config = config || {};
  }

  /** 메인 페이지: 서비스 소개 */
  home = (req, res, next) => {
    try {
      res.render('pages/welcome', { title: '이웃소리 소개', page: 'welcome', example: PageController.EXAMPLE_WEEK });
    } catch (err) {
      next(err);
    }
  };

  detect = async (req, res, next) => {
    try {
      const [settings, thresholds, recent] = await Promise.all([
        this.settingsService.get(req.userId),
        this.thresholdService.getAll(),
        this.eventService.getRecent(req.userId, 3),
      ]);
      const limit = await this.thresholdService.getCurrentLimit('footstep', settings);
      res.render('pages/detect', {
        title: '감지',
        page: 'detect',
        settings,
        thresholds,
        currentLimit: limit,
        recentEvents: recent.map((e) => this.eventService.decorate(e)),
        sourceGroups: SOURCE_GROUPS,
        yamnetModelUrl: this.config.yamnetModelUrl || '',
      });
    } catch (err) {
      next(err);
    }
  };

  records = async (req, res, next) => {
    try {
      const source = EventQueryDto.from({ source: req.query.source }).source;
      const weekStart = req.query.week ? BaseDto.string(req.query.week, 'week', { maxLength: 10 }) : null;
      if (weekStart && !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new ValidationError('week는 YYYY-MM-DD 형식이어야 합니다.', { field: 'week' });
      const view = await this.eventService.getWeekView(req.userId, { weekStart, source });
      res.render('pages/records', {
        title: '기록',
        page: 'records',
        view: { ...view, events: view.events.map((e) => this.eventService.decorate(e)), by_date: view.by_date.map((d) => ({ ...d, events: d.events.map((e) => this.eventService.decorate(e)) })) },
        sourceGroups: SOURCE_GROUPS,
        settings: await this.settingsService.get(req.userId),
      });
    } catch (err) {
      next(err);
    }
  };

  report = async (req, res, next) => {
    try {
      const dto = ReportQueryDto.from(req.query);
      const view = await this.reportService.buildView(req.userId, dto.days);
      res.render('pages/report', { title: '리포트', page: 'report', view, sourceGroups: SOURCE_GROUPS, llmInfo: this.llmInfo });
    } catch (err) {
      next(err);
    }
  };

  reportPrint = async (req, res, next) => {
    try {
      const dto = ReportQueryDto.from(req.query);
      const view = await this.reportService.buildView(req.userId, dto.days);
      res.render('pages/report-print', { title: '소음 리포트', page: 'report-print', view, sourceGroups: SOURCE_GROUPS, disclaimer: DISCLAIMER, center: CENTER_INFO, layout: false });
    } catch (err) {
      next(err);
    }
  };

  mediate = async (req, res, next) => {
    try {
      const recipient = BaseDto.oneOf(req.query.recipient, 'recipient', RECIPIENT_KEYS, { required: false, fallback: 'neighbor' });
      const tone = BaseDto.oneOf(req.query.tone, 'tone', TONE_KEYS, { required: false, fallback: 'basic' });
      const view = await this.messageService.buildView(req.userId, { recipient, tone });
      res.render('pages/mediate', { title: '중재', page: 'mediate', view, llmInfo: this.llmInfo });
    } catch (err) {
      next(err);
    }
  };

  /** 공유 링크 열람 (읽기 전용, 로그인·사용자 식별과 무관) */
  shared = async (req, res, next) => {
    try {
      const share = await this.shareService.getByToken(req.params.token);
      res.set('X-Robots-Tag', 'noindex, nofollow');
      res.render('pages/shared', { title: '공유된 소음 기록', page: 'shared', share, s: share.summary_json, sourceGroups: SOURCE_GROUPS, disclaimer: DISCLAIMER, center: CENTER_INFO });
    } catch (err) {
      next(err);
    }
  };

  lab = async (req, res, next) => {
    try {
      const summary = await this.labService.summary(req.userId);
      res.render('pages/lab', { title: '분류 정확도 측정', page: 'lab', summary, sourceGroups: SOURCE_GROUPS, yamnetModelUrl: this.config.yamnetModelUrl || '' });
    } catch (err) {
      next(err);
    }
  };

  guide = async (req, res, next) => {
    try {
      const guide = this.legalGuideService.getGuide();
      res.render('pages/guide', { title: '법·대응 안내', page: 'guide', guide });
    } catch (err) {
      next(err);
    }
  };

  settings = async (req, res, next) => {
    try {
      const [settings, thresholds] = await Promise.all([this.settingsService.get(req.userId), this.thresholdService.getAll()]);
      res.render('pages/settings', {
        title: '설정',
        page: 'settings',
        settings,
        defaults: DEFAULT_SETTINGS,
        thresholds,
        storedItems: this.dataService.getStoredItemsDescription(),
        llmInfo: this.llmInfo,
      });
    } catch (err) {
      next(err);
    }
  };
}

/** 첫 방문 화면의 예시 다이얼 (예시임을 화면에 표기) */
PageController.EXAMPLE_WEEK = {
  hourly: [6, 3, 1, 0, 0, 0, 2, 5, 3, 2, 4, 3, 2, 3, 5, 4, 4, 3, 5, 7, 8, 9, 24, 19],
  exceeded: [4, 2, 1, 0, 0, 0, 1, 2, 0, 0, 1, 0, 0, 1, 2, 1, 1, 0, 2, 3, 3, 4, 18, 14],
};

module.exports = { PageController };
