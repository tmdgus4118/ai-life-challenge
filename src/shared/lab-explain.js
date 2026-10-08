/**
 * 분류 정확도 측정 결과 설명 (UMD). 1초별 분류 결과를 모아
 * "AI가 무슨 소리로 들었는지"와 판정 이유, 틀렸을 때 확인할 점을 만든다.
 * YAMNet 클래스 이름은 한국어 이름을 붙여 보여 준다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NeighborSoundLabExplain = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const KO_CLASS = {
    'Walk, footsteps': '발걸음', Run: '뛰는 소리', Shuffle: '발 끄는 소리',
    'Thump, thud': '쿵 하는 충격음', Slam: '쾅 닫는 소리', Scrape: '긁는 소리', 'Drawer open or close': '서랍 여닫기',
    Door: '문', Knock: '노크', Tap: '톡톡 두드림', Squeak: '삐걱 소리', Wood: '나무 부딪힘', Chop: '내리찍는 소리',
    Thunk: '둔탁한 소리', Clatter: '달그락 소리',
    Hammer: '망치', Jackhammer: '착암기', Sawing: '톱질', 'Power tool': '전동 공구', Drill: '드릴', Tools: '공구',
    Dog: '개', Bark: '개 짖는 소리', Howl: '울부짖음', 'Bow-wow': '멍멍', Growling: '으르렁', 'Whimper (dog)': '낑낑',
    Cat: '고양이', Purr: '고양이 그르렁', Meow: '야옹', Animal: '동물', 'Domestic animals, pets': '반려동물',
    Music: '음악', 'Musical instrument': '악기', Guitar: '기타', Piano: '피아노', 'Drum kit': '드럼 세트', Drum: '북',
    Singing: '노래', 'Keyboard (musical)': '건반 악기', 'Violin, fiddle': '바이올린', 'Electric guitar': '전기 기타',
    'Bass guitar': '베이스 기타', Percussion: '타악기',
    Speech: '말소리', 'Child speech, kid speaking': '아이 말소리', Conversation: '대화', Shout: '고함', Yell: '외침',
    'Children shouting': '아이들 소리침', Screaming: '비명', Laughter: '웃음소리', Television: 'TV',
    'Crying, sobbing': '울음', 'Baby cry, infant cry': '아기 울음', 'Narration, monologue': '해설·내레이션', Babbling: '옹알이',
    Silence: '조용함', 'Inside, small room': '작은 방 울림', Static: '지직 잡음', 'White noise': '백색 소음',
    Noise: '잡음', Hum: '웅웅 소리', 'Heart sounds, heartbeat': '심장 박동 소리', 'Heart murmur': '심잡음',
    Vehicle: '차량', Engine: '엔진', 'Mechanisms': '기계 작동음', Clicking: '딸깍 소리', Tick: '똑딱',
    Bang: '쾅 소리', Boom: '쿵 울림', Thunder: '천둥', Rain: '빗소리', Water: '물소리', Wind: '바람',
    Writing: '필기', Typing: '타자', 'Computer keyboard': '키보드', Breathing: '숨소리', Snoring: '코골이',
    'Sound effect': '효과음', 'Background music': '배경음악',
    'Busy signal': '통화 중 신호음', 'Dial tone': '발신음', 'Sine wave': '단순 신호음', 'Beep, bleep': '삐 소리',
    Buzz: '윙 소리', Buzzer: '버저', Ding: '딩 소리', Clang: '쨍그랑', 'Ding-dong': '초인종', Doorbell: '초인종',
    Plop: '퐁 소리', Crack: '탁 깨지는 소리', Crackle: '타닥 소리', Rattle: '덜컹 소리', Rumble: '우르릉',
    'Whack, thwack': '탁 치는 소리', 'Smash, crash': '부서지는 소리', Shatter: '산산조각',
    'Glass': '유리', 'Chink, clink': '쨍 소리', 'Dishes, pots, and pans': '그릇·냄비 소리', 'Cutlery, silverware': '수저 소리',
    Clapping: '박수', Applause: '박수 갈채', 'Finger snapping': '손가락 튕김',
    'Hands': '손 소리', 'Cough': '기침', Sneeze: '재채기', Gasp: '헉 소리', Whispering: '속삭임',     Chatter: '웅성거림', 'Hubbub, speech noise, speech babble': '웅성거림', Crowd: '군중',
    'Toilet flush': '변기 물 내림', 'Water tap, faucet': '수도꼭지', 'Sink (filling or washing)': '싱크대 물',     'Vacuum cleaner': '청소기', 'Air conditioning': '에어컨', 'Mechanical fan': '선풍기',
    'Microwave oven': '전자레인지', Blender: '믹서기', 'Hair dryer': '드라이어', 'Electric shaver, electric razor': '전기면도기',
    Car: '자동차', Motorcycle: '오토바이', Siren: '사이렌', 'Car alarm': '자동차 경보', Truck: '트럭', Bus: '버스', Aircraft: '비행기',
    Bird: '새', 'Bird vocalization, bird call, bird song': '새소리', Insect: '곤충', Cricket: '귀뚜라미',
    'Video game music': '게임 음악', 'Pop music': '대중음악', 'Electronic music': '전자 음악', Song: '노래', Bell: '종', 'Alarm clock': '자명종', Alarm: '경보음',
    'Telephone': '전화', 'Telephone bell ringing': '전화벨', Ringtone: '벨소리', 'Radio': '라디오', Echo: '울림', Reverberation: '잔향',
    'Basketball bounce': '농구공 튀기기', 'Bouncing': '튀는 소리', 'Ping': '핑 소리', 'Zipper (clothing)': '지퍼', 'Keys jangling': '열쇠 짤랑',
  };

  /** YAMNet 클래스 이름 → 한국어 이름 (없으면 원래 이름) */
  const koName = (name) => {
    if (typeof name !== 'string' || !name) throw new TypeError('name must be a non-empty string');
    return KO_CLASS[name] || name;
  };

  /** 받침이 있으면 '이', 없으면 '가' (한글이 아니면 '가') */
  const subjectJosa = (word) => {
    const code = String(word).charCodeAt(String(word).length - 1);
    if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 ? '이' : '가';
    return '가';
  };

  const labelOf = (groups, key) => {
    const g = groups.find((x) => x.key === key);
    return g ? g.label : key;
  };

  /** 틀렸을 때 확인할 점 (판정된 소리 기준 → 기대한 소리 기준) */
  const TIPS_BY_PREDICTED = {
    voice: '영상의 해설, 대화, 배경 말소리가 섞이면 말소리·TV로 판정됩니다. 말소리 없이 효과음만 있는 음원을 쓰세요.',
    music: '배경음악이 깔린 영상은 악기·음악으로 판정되기 쉽습니다. 음악 없는 효과음을 쓰세요.',
    other: '확실하게 분류된 1초가 없었습니다. 소리를 더 크게 틀거나 폰을 스피커에 더 가까이 두세요.',
  };
  const TIPS_BY_EXPECTED = {
    footstep: '발걸음은 또각또각 걷는 소리가 있어야 잘 구분됩니다. 천장 너머로 들리는 낮은 쿵쿵 소리는 가구·충격으로 듣는 경우가 많습니다.',
    furniture: '의자 끄는 소리, 문 닫는 소리, 물건 떨어지는 소리처럼 짧고 분명한 충격음일수록 잘 맞습니다.',
    hammer: '망치질이나 드릴 소리가 쉬지 않고 이어지는 구간을 틀어 주세요.',
    pet: '개가 여러 번 짖는 구간을 틀어 주세요. 짖지 않는 구간이 길면 기타로 빠집니다.',
    music: '악기 소리가 분명한 구간을 틀어 주세요.',
    voice: '사람 목소리가 또렷한 구간을 틀어 주세요.',
  };

  /**
   * @param {Array<{group:string, confidence:number, at?:number, top?:Array<{name:string, score:number}>}>} frames
   * @param {{expected:string, predicted:string, groups:Array<{key:string,label:string}>}} ctx
   */
  const explain = (frames, { expected, predicted, groups } = {}) => {
    if (!Array.isArray(frames) || frames.length === 0) throw new TypeError('frames must be a non-empty array');
    if (typeof expected !== 'string' || typeof predicted !== 'string') throw new TypeError('expected and predicted are required');
    if (!Array.isArray(groups)) throw new TypeError('groups must be an array');

    const total = frames.length;
    const counts = {};
    frames.forEach((f) => { counts[f.group] = (counts[f.group] || 0) + 1; });
    const distribution = Object.entries(counts)
      .map(([key, count]) => ({ key, label: labelOf(groups, key), count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count || (a.key === 'other') - (b.key === 'other'));

    const heardMap = {};
    frames.forEach((f) => {
      const first = Array.isArray(f.top) ? f.top[0] : null;
      if (!first || !first.name) return;
      if (!heardMap[first.name]) heardMap[first.name] = { name: first.name, ko: koName(first.name), count: 0 };
      heardMap[first.name].count += 1;
    });
    const heard = Object.values(heardMap).sort((a, b) => b.count - a.count).slice(0, 5);

    const voted = total - (counts.other || 0);
    const hits = counts[expected] || 0;
    const correct = expected === predicted;
    const expectedLabel = labelOf(groups, expected);
    const predictedLabel = labelOf(groups, predicted);

    let reason;
    if (voted === 0) {
      reason = '1초 결과 ' + total + '번이 모두 기타(확실하지 않은 소리)여서 기타로 판정했습니다.';
    } else {
      const winner = distribution.find((d) => d.key === predicted);
      reason = '1초 결과 ' + total + '번 중 기타를 뺀 ' + voted + '번으로 다수결을 했고, ' + predictedLabel + subjectJosa(predictedLabel) + ' ' + (winner ? winner.count : 0) + '번으로 가장 많았습니다.';
    }
    if (heard.length) {
      const h = heard[0];
      reason += ' AI가 가장 많이 들은 소리는 ' + (h.ko !== h.name ? h.ko + '(' + h.name + ')' : h.name) + '입니다.';
    }

    const tips = [];
    if (!correct) {
      if (TIPS_BY_PREDICTED[predicted]) tips.push(TIPS_BY_PREDICTED[predicted]);
      if (TIPS_BY_EXPECTED[expected]) tips.push(TIPS_BY_EXPECTED[expected]);
    }

    return {
      correct,
      expected_label: expectedLabel,
      predicted_label: predictedLabel,
      frame_hits: hits,
      frame_accuracy: Math.round((hits / total) * 100),
      total,
      distribution,
      heard,
      reason,
      tips,
    };
  };

  return { KO_CLASS, koName, subjectJosa, explain };
});
