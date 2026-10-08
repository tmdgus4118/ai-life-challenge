/*
 * 마이크 입력과 YAMNet 분류를 묶은 엔진. 감지 화면과 정확도 측정 화면이 함께 쓴다.
 * 오디오는 메모리의 최근 2초만 유지하고 어디에도 저장하거나 보내지 않는다.
 */
(function () {
  const { resample } = window.NeighborSoundDecibel;
  const { SourceMapper } = window.NeighborSoundSourceMapper;

  const YAMNET_RATE = 16000;
  const WINDOW_SAMPLES = 15600; // 0.975초

  class AudioEngine {
    constructor({ modelUrls, classMapUrl = '/models/yamnet_class_map.csv', mappingUrl = '/config/source-mapping.json', confidenceThreshold = 0.3 } = {}) {
      this.modelUrls = (modelUrls || []).filter(Boolean);
      this.classMapUrl = classMapUrl;
      this.mappingUrl = mappingUrl;
      this.confidenceThreshold = confidenceThreshold;
      this.model = null;
      this.mapper = null;
      this.groupOfClass = {};
      this.ready = false;
      this.failed = false;
      this.buffer = new Float32Array(0);
      this.sampleRate = 48000;
      this.ctx = null; this.stream = null; this.source = null; this.processor = null;
    }

    get running() { return Boolean(this.ctx); }

    /** 마이크 시작. 권한 거부 등은 예외로 던진다 */
    async start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('이 브라우저는 마이크를 지원하지 않습니다.');
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.sampleRate = this.ctx.sampleRate;
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
      const maxKeep = this.sampleRate * 2;
      this.processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const merged = new Float32Array(Math.min(maxKeep, this.buffer.length + input.length));
        const keepFromOld = merged.length - input.length;
        if (keepFromOld > 0) merged.set(this.buffer.slice(this.buffer.length - keepFromOld), 0);
        merged.set(input, Math.max(0, keepFromOld));
        this.buffer = merged;
      };
      this.source.connect(this.processor);
      const silent = this.ctx.createGain();
      silent.gain.value = 0;
      this.processor.connect(silent);
      silent.connect(this.ctx.destination);
    }

    stop() {
      if (this.processor) { this.processor.disconnect(); this.processor.onaudioprocess = null; }
      if (this.source) this.source.disconnect();
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      if (this.ctx) this.ctx.close();
      this.processor = null; this.source = null; this.stream = null; this.ctx = null;
      this.buffer = new Float32Array(0);
    }

    /** 최근 n초 샘플 */
    lastSeconds(sec = 1) {
      return this.buffer.slice(Math.max(0, this.buffer.length - Math.round(this.sampleRate * sec)));
    }

    async loadModel() {
      if (!window.tf) throw new Error('TensorFlow.js를 불러오지 못했습니다');
      try { await tf.setBackend('webgl'); } catch (e) { /* 기본 백엔드 사용 */ }
      await tf.ready();
      let lastErr = null;
      for (const url of this.modelUrls) {
        try {
          const fromHub = url.indexOf('tfhub.dev') !== -1 || url.indexOf('kaggle.com') !== -1;
          return await tf.loadGraphModel(url, fromHub ? { fromTFHub: true } : undefined);
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error('모델 주소가 없습니다');
    }

    async loadMapper() {
      const [csv, mapping] = await Promise.all([
        fetch(this.classMapUrl).then((r) => { if (!r.ok) throw new Error('class map'); return r.text(); }),
        fetch(this.mappingUrl).then((r) => { if (!r.ok) throw new Error('mapping'); return r.json(); }),
      ]);
      const names = SourceMapper.parseClassMapCsv(csv);
      this.groupOfClass = {};
      Object.entries(mapping.groups).forEach(([group, list]) => list.forEach((n) => { this.groupOfClass[n] = group; }));
      return new SourceMapper(mapping, names, { confidenceThreshold: this.confidenceThreshold });
    }

    /** 모델·매핑을 한 번 불러오고 워밍업한다. 실패하면 failed=true */
    async load() {
      if (this.ready || this.failed) return this.ready;
      try {
        const [model, mapper] = await Promise.all([this.loadModel(), this.loadMapper()]);
        this.model = model;
        this.mapper = mapper;
        const warm = tf.zeros([WINDOW_SAMPLES]);
        const out = this.model.executeAsync ? await this.model.executeAsync(warm) : this.model.execute(warm);
        (Array.isArray(out) ? out : [out]).forEach((t) => t.dispose());
        warm.dispose();
        this.ready = true;
      } catch (err) {
        this.failed = true;
        this.error = err;
      }
      return this.ready;
    }

    get backendLabel() { return window.tf && tf.getBackend() === 'webgl' ? 'GPU' : 'CPU'; }

    /** 16kHz 0.975초 파형 하나를 분류한다 (마이크·파일 공용) */
    async classifyWave(wave) {
      if (!this.ready) return null;
      let scores;
      try {
        const input = tf.tensor1d(wave);
        const outputs = this.model.executeAsync ? await this.model.executeAsync(input) : this.model.execute(input);
        const list = Array.isArray(outputs) ? outputs : [outputs];
        const scoresTensor = list.find((t) => t.shape.length === 2 && t.shape[1] === this.mapper.classNames.length) || list[0];
        scores = SourceMapper.averageFrames(await scoresTensor.array());
        list.forEach((t) => t.dispose());
        input.dispose();
      } catch (err) {
        console.warn('classify error', err);
        return null;
      }
      const mapped = this.mapper.map(scores);
      const names = this.mapper.classNames;
      const top = Array.from(scores.keys())
        .sort((a, b) => scores[b] - scores[a])
        .filter((i) => names[i] !== 'Silence')
        .slice(0, 3)
        .map((i) => ({ name: names[i], score: scores[i], group: this.groupOfClass[names[i]] || null }));
      return { mapped, top };
    }

    /**
     * 소리 파일을 브라우저 안에서만 해독해 0.975초 창마다 분류한다. 파일은 어디에도 보내지 않는다.
     * @returns {Promise<{duration:number, frames:Array<{at:number, db:number, mapped:object, top:Array}>}>}
     */
    async analyzeFile(file, { maxSeconds = 60, onProgress = null } = {}) {
      if (!file) throw new Error('파일을 골라 주세요.');
      if (file.size > 30 * 1024 * 1024) throw new Error('30MB 이하의 소리 파일만 분석할 수 있습니다.');
      if (!(await this.load())) throw new Error('분류 모델을 불러오지 못했습니다.');
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      let audio;
      try {
        audio = await ctx.decodeAudioData(await file.arrayBuffer());
      } catch (err) {
        throw new Error('이 파일 형식은 해독할 수 없습니다. mp3, wav, m4a 파일을 써 주세요.');
      } finally {
        ctx.close();
      }
      // 여러 채널이면 평균해 모노로
      const length = Math.min(audio.length, Math.floor(audio.sampleRate * maxSeconds));
      const mono = new Float32Array(length);
      for (let c = 0; c < audio.numberOfChannels; c += 1) {
        const data = audio.getChannelData(c);
        for (let i = 0; i < length; i += 1) mono[i] += data[i] / audio.numberOfChannels;
      }
      const wave16 = resample(mono, audio.sampleRate, YAMNET_RATE);
      const frames = [];
      const total = Math.floor(wave16.length / WINDOW_SAMPLES);
      // 파일에는 방의 실제 음압이 없으므로 dB(A) 근사값이 아니라 파일 안의 상대 음량(dBFS)만 남긴다
      const { DecibelMeter } = window.NeighborSoundDecibel;
      for (let k = 0; k < total; k += 1) {
        const win = wave16.slice(k * WINDOW_SAMPLES, (k + 1) * WINDOW_SAMPLES);
        const r = await this.classifyWave(win);
        if (r) frames.push({ at: Math.round(k * 0.975 * 10) / 10, dbfs: Math.round(DecibelMeter.rmsToDbfs(DecibelMeter.rms(win))), mapped: r.mapped, top: r.top });
        if (onProgress) onProgress((k + 1) / total, frames[frames.length - 1]);
      }
      return { duration: Math.round((length / audio.sampleRate) * 10) / 10, truncated: audio.length > length, frames };
    }

    /**
     * 최근 0.975초를 분류한다.
     * @returns {Promise<null|{mapped:{group:string,confidence:number,topClass:string|null}, top:Array<{name:string,score:number,group:string|null}>}>}
     */
    async classify() {
      if (!this.ready || !this.running) return null;
      const need = Math.ceil(WINDOW_SAMPLES * (this.sampleRate / YAMNET_RATE));
      if (this.buffer.length < need) return null;
      const slice = this.buffer.slice(this.buffer.length - need);
      return this.classifyWave(resample(slice, this.sampleRate, YAMNET_RATE).slice(0, WINDOW_SAMPLES));
    }
  }

  window.NSAudioEngine = AudioEngine;
})();
