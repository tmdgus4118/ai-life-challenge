const { ValidationError } = require('../utils/errors');

/** 전체 기록 삭제 (사건·리포트·메시지·설정) */
class DataService {
  constructor({ eventModel, reportModel, messageModel, settingsModel, labRunModel = null, shareModel = null }) {
    if (!eventModel || !reportModel || !messageModel || !settingsModel) throw new TypeError('models are required');
    this.labRunModel = labRunModel;
    this.shareModel = shareModel;
    this.eventModel = eventModel;
    this.reportModel = reportModel;
    this.messageModel = messageModel;
    this.settingsModel = settingsModel;
  }

  async deleteAll(userId) {
    if (!userId) throw new ValidationError('사용자 식별자가 없습니다.');
    const [events, reports, messages, settings, labRuns, shares] = await Promise.all([
      this.eventModel.deleteByUser(userId),
      this.reportModel.deleteByUser(userId),
      this.messageModel.deleteByUser(userId),
      this.settingsModel.deleteByUser(userId),
      this.labRunModel ? this.labRunModel.deleteByUser(userId) : Promise.resolve(0),
      this.shareModel ? this.shareModel.deleteByUser(userId) : Promise.resolve(0),
    ]);
    return { events, reports, messages, settings, lab_runs: labRuns, shares };
  }

  /** 개인정보 안내에 쓰는 저장 항목 설명 */
  getStoredItemsDescription() {
    return [
      { item: '사건 기록', fields: '시작·종료 시각, 소음원 그룹, 평균·최고 dB, 주간·야간 구분, 기준 초과 여부, 메모' },
      { item: 'AI 리포트', fields: '기간 집계 숫자와 생성된 요약문' },
      { item: '중재 메시지', fields: '수신자·말투별 생성된 초안' },
      { item: '설정', fields: '야간 시간, 마이크 보정 오프셋, 민감도' },
      { item: '식별자', fields: '브라우저가 만든 익명 UUID (회원가입·위치·연락처 수집 없음)' },
    ];
  }
}

module.exports = { DataService };
