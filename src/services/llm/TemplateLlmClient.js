const { LlmClient } = require('./LlmClient');
const { RECIPIENTS, TONES } = require('../../shared/constants');

/**
 * 오프라인 규칙 기반 작성기. 외부 API 없이도 시연이 돌아가게 하고,
 * 생성형 모델 출력이 안전장치에 걸렸을 때 최종 대체문으로도 쓴다.
 * 집계 JSON의 숫자만 쓰므로 숫자 검사에 항상 통과한다.
 */
class TemplateLlmClient extends LlmClient {
  constructor({ chunkDelayMs = 22, thinkMs = 900 } = {}) {
    super('template');
    if (typeof chunkDelayMs !== 'number' || chunkDelayMs < 0) throw new TypeError('chunkDelayMs must be >= 0');
    if (typeof thinkMs !== 'number' || thinkMs < 0) throw new TypeError('thinkMs must be >= 0');
    this.chunkDelayMs = chunkDelayMs;
    this.thinkMs = thinkMs;
  }

  /** 완성문을 2~4글자씩 나눠 순서대로 전달한다 */
  async stream(task, onDelta, { signal = null } = {}) {
    if (typeof onDelta !== 'function') throw new TypeError('onDelta must be a function');
    const text = await this.generate(task);
    if (this.thinkMs > 0) await new Promise((r) => setTimeout(r, this.thinkMs));
    const chunks = TemplateLlmClient.splitChunks(text);
    for (const chunk of chunks) {
      if (signal && signal.aborted) throw new Error('aborted');
      onDelta(chunk);
      if (this.chunkDelayMs > 0) await new Promise((r) => setTimeout(r, this.chunkDelayMs));
    }
    return text;
  }

  /** 글을 2~4글자 조각으로 나눈다 (공백·문장부호에서 끊기도록) */
  static splitChunks(text, size = 3) {
    if (typeof text !== 'string') throw new TypeError('text must be a string');
    if (!Number.isInteger(size) || size < 1) throw new TypeError('size must be a positive integer');
    const chunks = [];
    let buf = '';
    for (const ch of Array.from(text)) {
      buf += ch;
      if (buf.length >= size || /[\s.,!?]/.test(ch)) {
        chunks.push(buf);
        buf = '';
      }
    }
    if (buf) chunks.push(buf);
    return chunks;
  }

  async generate(task) {
    this.validateTask(task);
    if (task.type === 'report') return this.writeReport(task.summary);
    if (task.type === 'answer') return this.writeAnswer(task.summary, task.questionKey);
    const role = (task.settings && task.settings.role) || 'listener';
    return role === 'maker' ? this.writeMakerMessage(task.summary, task.recipient, task.tone) : this.writeMessage(task.summary, task.recipient, task.tone);
  }

  /** 받침 유무에 따라 조사를 고른다 (예: 발걸음이 / 말소리·TV가) */
  static josa(word, withBatchim, withoutBatchim) {
    if (typeof word !== 'string' || !word) throw new TypeError('word is required');
    const last = word.charCodeAt(word.length - 1);
    if (last >= 0xac00 && last <= 0xd7a3) {
      return word + ((last - 0xac00) % 28 > 0 ? withBatchim : withoutBatchim);
    }
    // 영문·숫자로 끝나면 읽는 소리를 알 수 없어 받침 없는 쪽을 쓴다 (TV가)
    return word + withoutBatchim;
  }

  /** 추천 질문에 대한 규칙 기반 답 (자유 질문은 핵심 패턴으로 안내) */
  writeAnswer(c, key) {
    if (!c || typeof c !== 'object') throw new TypeError('context is required');
    if (!c.total_events) return `선택한 ${c.period.days}일 동안 기록된 사건이 없어 답할 내용이 없습니다. 감지를 시작하면 기록이 쌓입니다.`;
    const josa = TemplateLlmClient.josa;
    const pattern = c.top_hour && c.top_source
      ? `기록된 소음은 ${c.top_hour.label}에 ${c.top_hour.count}건으로 가장 많았고, 주된 소음원은 ${josa(c.top_source.label, '이었', '였')}습니다. 전체 ${c.total_events}건 중 ${c.exceeded_events}건이 기준을 넘었습니다.`
      : `전체 ${c.total_events}건 중 ${c.exceeded_events}건이 기준을 넘었습니다.`;
    const d = c.derived || {};
    switch (key) {
      case 'pattern':
        return pattern;
      case 'weekday_weekend':
        return `평일(월~금)에 ${d.weekday_total}건, 주말(토·일)에 ${d.weekend_total}건이 기록되었습니다.${d.busiest_weekday ? ` 요일별로는 ${d.busiest_weekday.label}요일이 ${d.busiest_weekday.count}건으로 가장 많았습니다.` : ''}`;
      case 'night':
        return `야간 기록은 ${c.night_events}건으로 전체의 ${d.night_share}%이고, 그중 ${c.night_exceeded_events}건이 기준을 넘었습니다. 평일 밤 22시 이후 기록은 ${c.weekday_night_events}건입니다.`;
      case 'trend': {
        const cmp = c.comparison;
        if (!cmp || !cmp.has_previous) return `직전 ${c.period.days}일에는 기록한 날이 적어 비교하기 어렵습니다. 기록을 더 이어 가면 지난 기간과 비교할 수 있습니다.`;
        const word = (n) => (n > 0 ? '늘었' : n < 0 ? '줄었' : '같았');
        const t = cmp.total.delta; const e = cmp.exceeded.delta;
        return `직전 ${c.period.days}일과 비교하면 전체 사건은 ${t === 0 ? '같은 수준이었' : `${Math.abs(t)}건 ${word(t)}`}고, 기준 초과는 ${e === 0 ? '같은 수준이었' : `${Math.abs(e)}건 ${word(e)}`}습니다.`;
      }
      case 'source': {
        const list = (c.by_source || []).filter((g) => g.count > 0);
        if (!list.length) return pattern;
        const [first, second] = list;
        return `${first.label} 소리가 ${first.count}건으로 전체의 ${first.share}%를 차지하고, 그중 ${first.exceeded}건이 기준을 넘었습니다.${second ? ` 다음은 ${second.label} ${second.count}건입니다.` : ''}`;
      }
      default:
        return `이 질문은 기록 숫자만으로 정확히 답하기 어렵습니다. 대신 지금 기록을 요약하면, ${pattern}`;
    }
  }

  writeReport(s) {
    const closing = '이 기록은 스마트폰 측정값으로 공인 측정이 아니며 대화를 위한 참고 자료입니다.';
    if (!s.total_events) {
      return `${s.period.from_label}부터 ${s.period.to_label}까지 ${s.period.days}일 동안 기록된 소음 사건은 없습니다. ${closing}`;
    }
    const sentences = [];
    if (s.top_hour && s.top_source) {
      sentences.push(`기록된 소음은 ${s.top_hour.label}에 ${s.top_hour.count}건으로 가장 많았고, 소음원은 ${TemplateLlmClient.josa(s.top_source.label, '이', '가')} ${s.top_source.count}건으로 가장 많이 기록되었습니다.`);
    }
    sentences.push(`${s.period.from_label}부터 ${s.period.to_label}까지 ${s.period.days}일 동안 총 ${s.total_events}건이 기록되었고 그중 ${s.exceeded_events}건이 공동주택 층간소음 기준을 넘었습니다.`);
    const others = s.by_source.filter((x) => x.count > 0).slice(0, 3).map((x) => `${x.label} ${x.count}건`);
    const v = s.vibration;
    const vib = v && v.measured_events && v.with_vibration ? `바닥 진동을 함께 잰 ${v.measured_events}건 중 ${v.with_vibration}건은 진동을 동반했습니다` : '';
    if (others.length > 1) sentences.push(`소음원별로는 ${others.join(', ')} 순${vib ? `이고, ${vib}` : '입니다'}.`);
    else if (vib) sentences.push(`${vib}.`);
    if (s.max_db) {
      sentences.push(`야간 기록은 ${s.night_events}건이며, 가장 높은 소음은 ${s.max_db.at_label}의 ${s.max_db.source_label} ${s.max_db.value}dB였습니다.`);
    }
    sentences.push(closing);
    return sentences.slice(0, 5).join(' ');
  }

  /** 소음을 내는 쪽: 우리 집 기록을 근거로 먼저 양해를 구하고 조심하겠다는 안내 */
  writeMakerMessage(s, recipient, tone) {
    if (!['neighbor', 'management'].includes(recipient)) throw new RangeError('maker role supports neighbor and management only');
    if (!TONES.some((x) => x.key === tone)) throw new RangeError('unknown tone: ' + tone);
    const period = `${s.period.from_label}부터 ${s.period.to_label}까지`;
    const when = s.top_hour ? `${s.top_hour.label}` : '저녁 시간대';
    const what = s.top_source ? `${s.top_source.label} 소리` : '생활 소음';
    const count = s.top_source ? `${s.top_source.count}건` : `${s.total_events}건`;
    const text = {
      neighbor: {
        soft: `안녕하세요, 같은 건물에 사는 이웃입니다. 저희 집 생활 소음을 ${period} 스스로 기록해 보니 ${when}에 ${what}가 ${count} 기록되었습니다. 그동안 불편을 드렸을까 봐 조심스럽게 먼저 연락드립니다. 앞으로 그 시간대에는 매트를 깔고 더 조심하겠습니다. 혹시 불편하신 점이 있으면 편하게 말씀해 주세요.`,
        basic: `안녕하세요, 같은 건물에 사는 이웃입니다. ${period} 저희 집 소음을 기록한 결과 ${when}에 ${what}가 ${count} 기록되었습니다. 불편을 드렸다면 죄송합니다. 그 시간대에 소음을 줄이도록 조심하겠습니다. 불편한 점이 있으면 알려 주세요.`,
        firm: `안녕하세요, 같은 건물에 사는 이웃입니다. ${period} 저희 집 소음을 기록해 보니 ${when}에 ${what}가 ${count} 기록되었습니다. 이 시간대에는 소음 방지 매트를 깔고 활동을 줄이겠습니다. 기록은 계속 확인하며 개선 결과를 다시 말씀드리겠습니다.`,
      },
      management: {
        soft: `관리사무소 담당자님께. 저희 세대 생활 소음을 ${period} 스스로 기록해 보았습니다. ${when}에 ${what}가 ${count} 기록되어, 이웃 세대에 불편이 없도록 조심하려 합니다. 혹시 관련 민원이 있었다면 알려 주시면 감사하겠습니다.`,
        basic: `관리사무소 담당자님께. 저희 세대에서 ${period} 생활 소음을 자가 점검한 결과 ${when}에 ${what}가 ${count} 기록되었습니다. 소음 방지 조치를 하겠으며, 관련 민원이 있으면 알려 주시기 바랍니다.`,
        firm: `관리사무소 담당자님께. 저희 세대는 ${period} 생활 소음을 자가 점검했고 ${when}에 ${what}가 ${count} 기록되었습니다. 해당 시간대 소음 방지 조치를 하겠습니다. 이웃 세대와 대화가 필요하면 중재를 부탁드립니다.`,
      },
    };
    return text[recipient][tone];
  }

  writeMessage(s, recipient, tone) {
    const r = RECIPIENTS.find((x) => x.key === recipient);
    const t = TONES.find((x) => x.key === tone);
    if (!r) throw new RangeError('unknown recipient: ' + recipient);
    if (!t) throw new RangeError('unknown tone: ' + tone);

    const period = `${s.period.from_label}부터 ${s.period.to_label}까지`;
    // 시간대 건수와 소음원 건수는 서로 다른 숫자이므로 따로 적는다
    const pattern = s.top_hour && s.top_source
      ? `${s.top_hour.label}에 가장 많은 ${s.top_hour.count}건이 기록되었고, 소음원은 ${TemplateLlmClient.josa(s.top_source.label, '이', '가')} ${s.top_source.count}건으로 가장 많았습니다`
      : `소음이 ${s.total_events}건 기록되었습니다`;
    const exceeded = `그중 ${s.exceeded_events}건이 공동주택 층간소음 기준을 넘었습니다`;
    const maxDb = s.max_db ? ` 최대 ${s.max_db.value}dB였습니다.` : '';

    const text = {
      neighbor: {
        soft: `안녕하세요, 같은 건물에 사는 이웃입니다. 조심스럽게 말씀드립니다. ${period} ${pattern}. 그 시간대에 가족이 잠을 설치는 일이 잦았습니다. 모르고 계셨을 수도 있을 것 같아 부탁드립니다. 밤 시간대에 조금만 신경 써 주시면 정말 감사하겠습니다. 읽어 주셔서 고맙습니다.`,
        basic: `안녕하세요, 같은 건물에 사는 이웃입니다. ${period} ${pattern}. ${exceeded}. 그 시간대에 가족이 잠을 설치고 있어 말씀드립니다. 모르고 계셨을 수 있다고 생각합니다. 밤 시간대에 조금 신경 써 주시면 감사하겠습니다.`,
        firm: `안녕하세요, 같은 건물에 사는 이웃입니다. ${period} ${pattern}. ${exceeded}. 그 시간대에 가족이 잠을 자지 못하고 있습니다. 밤 시간대에는 소음을 줄여 주시기를 정중히 요청드립니다. 기록은 필요하시면 보여 드리겠습니다.`,
      },
      management: {
        soft: `관리사무소 담당자님께. 거주 세대에서 ${period} 생활소음을 기록했습니다. ${pattern}. ${exceeded}. 번거로우시겠지만 야간 시간대 주의 안내 방송을 부탁드려도 될까요. 필요하시면 시간대별 기록을 보내 드리겠습니다. 감사합니다.`,
        basic: `관리사무소 담당자님께. 거주 세대에서 ${period} 생활소음을 기록한 결과 총 ${s.total_events}건 중 ${s.exceeded_events}건이 공동주택 층간소음 기준을 넘었습니다. ${pattern}. 야간 시간대 주의 안내 방송 또는 중재를 요청드립니다. 시간대별 기록을 첨부할 수 있습니다.`,
        firm: `관리사무소 담당자님께 민원을 접수합니다. 거주 세대에서 ${period} 기록한 생활소음은 총 ${s.total_events}건이며 그중 ${s.exceeded_events}건이 기준을 넘었습니다. ${pattern}. 야간 시간대 안내 방송과 중재를 요청드리며, 시간대별 기록을 첨부합니다. 처리 결과를 회신해 주시기 바랍니다.`,
      },
      center: {
        soft: `층간소음 이웃사이센터 전화 상담을 신청하고 싶습니다. ${period} 생활소음을 기록했고, ${pattern}. ${exceeded}.${maxDb} 이웃 연락과 관리사무소 안내를 거쳤지만 같은 패턴이 이어지고 있습니다. 가능하시다면 상담과 현장 측정을 부탁드립니다.`,
        basic: `층간소음 이웃사이센터 전화 상담을 신청합니다. ${period} 기록한 생활소음은 총 ${s.total_events}건이며 그중 ${s.exceeded_events}건이 기준을 넘었습니다. ${pattern}.${maxDb} 이웃 연락과 관리사무소 안내 요청을 거쳤으나 같은 패턴이 이어져 현장 측정 상담을 요청드립니다.`,
        firm: `층간소음 이웃사이센터 전화 상담을 신청합니다. ${period} 기록한 생활소음은 총 ${s.total_events}건, 기준 초과 ${s.exceeded_events}건입니다. ${pattern}.${maxDb} 이웃 연락과 관리사무소 민원 단계를 모두 거쳤으나 개선되지 않아 공식 현장 측정과 조정 절차를 요청드립니다. 시간대별 기록을 제출하겠습니다.`,
      },
    };
    return text[recipient][tone];
  }
}

module.exports = { TemplateLlmClient };
