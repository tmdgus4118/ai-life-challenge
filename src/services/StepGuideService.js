const { timeUtil } = require('../utils/time');
const { STEP_GUIDE, STEP_WAIT_DAYS, CENTER_INFO } = require('../shared/constants');
const { ValidationError } = require('../utils/errors');

/**
 * 다음 단계 안내: 이웃 연락 → 2주 뒤에도 같으면 관리사무소 → 이웃사이센터 전화 상담.
 * 바로 신고를 권하지 않고 대화부터 시작하도록 안내한다.
 */
class StepGuideService {
  constructor({ messageModel, eventModel, time = timeUtil }) {
    if (!messageModel || !eventModel) throw new TypeError('models are required');
    this.messageModel = messageModel;
    this.eventModel = eventModel;
    this.time = time;
  }

  /** 최근 14일 가장 많은 소음원이 센터 상담 대상 밖이면 안내 문구 */
  getCenterScopeNote(events, now = new Date()) {
    if (!Array.isArray(events)) throw new TypeError('events must be an array');
    const since = now.getTime() - 14 * 86400000;
    const counts = {};
    events.forEach((e) => {
      if (new Date(e.started_at).getTime() >= since) counts[e.source_group] = (counts[e.source_group] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    return StepGuideService.CENTER_SCOPE_NOTES[top[0]] || null;
  }

  async getGuide(userId, now = new Date()) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    const [neighbor, management, center] = await Promise.all(
      ['neighbor', 'management', 'center'].map((r) => this.messageModel.findFirstDeliveredByRecipient(userId, r)),
    );
    const [draftNeighbor] = await Promise.all([this.messageModel.findFirstByRecipient(userId, 'neighbor')]);
    const events = await this.eventModel.findByUser(userId);
    const exceededAfter = (date) => events.filter((e) => e.exceeded && new Date(e.started_at) > new Date(date)).length;

    let current = 1;
    let note = draftNeighbor
      ? '이웃에게 메시지를 전달했다면 중재 화면에서 "전달했음"을 눌러 주세요. 그날부터 2주 동안 기록을 지켜봅니다.'
      : '먼저 기록을 바탕으로 이웃에게 정중하게 연락해 보세요. 상대가 모를 수 있다는 전제로 시작합니다.';
    let daysUntilNext = null;

    if (neighbor) {
      const since = Math.floor((now - new Date(neighbor.delivered_at)) / 86400000);
      const continuing = exceededAfter(neighbor.delivered_at);
      if (since >= STEP_WAIT_DAYS && continuing > 0) {
        current = 2;
        note = `이웃에게 연락한 지 ${since}일이 지났고 이후에도 기준 초과 사건이 ${continuing}건 기록되었습니다. 관리사무소에 기록을 첨부해 민원을 넣을 단계입니다.`;
        if (management) {
          const sinceMgmt = Math.floor((now - new Date(management.delivered_at)) / 86400000);
          const continuingMgmt = exceededAfter(management.delivered_at);
          if (sinceMgmt >= STEP_WAIT_DAYS && continuingMgmt > 0) {
            current = 3;
            note = `관리사무소 민원 후 ${sinceMgmt}일이 지났고 기준 초과 사건이 ${continuingMgmt}건 더 기록되었습니다. 이웃사이센터 전화 상담(${CENTER_INFO.phone})을 신청할 단계입니다.`;
          } else {
            daysUntilNext = Math.max(0, STEP_WAIT_DAYS - sinceMgmt);
            note = `관리사무소에 민원을 넣었습니다. ${daysUntilNext}일 더 기록을 지켜본 뒤에도 같은 패턴이면 이웃사이센터 상담으로 넘어갑니다.`;
          }
        }
      } else if (since < STEP_WAIT_DAYS) {
        daysUntilNext = STEP_WAIT_DAYS - since;
        note = `이웃에게 메시지를 전달한 지 ${since}일 지났습니다. ${daysUntilNext}일 더 기록을 지켜본 뒤에도 같은 패턴이면 관리사무소 단계로 넘어갑니다.`;
      } else {
        note = '이웃에게 연락한 뒤 기준 초과 사건이 더 기록되지 않았습니다. 대화로 해결된 것으로 보이며, 기록은 계속 남겨 두세요.';
      }
    }
    if (center && current === 3) {
      note = `이웃사이센터 상담을 신청한 단계입니다. 센터(${CENTER_INFO.phone})의 현장 측정 안내를 기다리며 기록을 이어 가세요.`;
    }

    return {
      scope_note: this.getCenterScopeNote(events, now),
      current_step: current,
      days_until_next: daysUntilNext,
      note,
      steps: STEP_GUIDE.map((s) => ({
        ...s,
        status: s.step < current ? 'done' : s.step === current ? 'current' : 'upcoming',
        delivered: Boolean({ 1: neighbor, 2: management, 3: center }[s.step]),
        delivered_at: ({ 1: neighbor, 2: management, 3: center }[s.step] || {}).delivered_at || null,
      })),
      center: CENTER_INFO,
      wait_days: STEP_WAIT_DAYS,
    };
  }
}

/** 이웃사이센터 상담 대상이 아닌 소음원 (센터 안내 기준) */
StepGuideService.CENTER_SCOPE_NOTES = {
  pet: '최근 기록에서 가장 많은 소음원은 반려동물입니다. 이웃사이센터는 동물 소음을 상담하지 않으므로, 관리사무소 중재 다음에는 분쟁조정위원회를 이용하세요.',
  voice: '최근 기록에서 가장 많은 소음원은 말소리·TV입니다. 이웃사이센터는 TV·음향기기 소리는 상담하지만 사람 목소리(대화·고성)는 상담하지 않고, 경범죄 처벌법상 인근소란으로 관할 경찰서를 안내합니다.',
  hammer: '최근 기록에서 가장 많은 소음원은 망치·공사입니다. 인테리어 공사 소음은 이웃사이센터 상담 대상이 아닙니다. 관리사무소에 공사 시간과 규정 확인을 요청하세요.',
};
module.exports = { StepGuideService };
