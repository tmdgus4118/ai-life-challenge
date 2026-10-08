require('dotenv').config({ quiet: true });
const path = require('path');

/**
 * 환경 변수를 한 곳에서 읽어 애플리케이션 설정 객체로 만든다.
 */
class AppConfig {
  constructor(env = process.env) {
    this.port = Number(env.PORT) || 3000;
    this.dbDir = path.resolve(process.cwd(), env.DB_DIR || './db');
    this.llmProvider = (env.LLM_PROVIDER || (env.ANTHROPIC_API_KEY ? 'anthropic' : 'template')).toLowerCase();
    this.anthropicApiKey = env.ANTHROPIC_API_KEY || '';
    this.llmModel = env.LLM_MODEL || 'claude-opus-5-5';
    this.yamnetModelUrl = env.YAMNET_MODEL_URL || '';
    this.nodeEnv = env.NODE_ENV || 'development';
    // 규칙 기반 작성기가 글을 조각으로 내보낼 때의 간격(ms). 테스트에서는 0
    const delay = Number(env.STREAM_CHUNK_DELAY_MS);
    this.streamChunkDelayMs = Number.isFinite(delay) && delay >= 0 ? delay : this.nodeEnv === 'test' ? 0 : 22;
    // 규칙 기반 작성기가 글을 쓰기 전 "생각 중" 단계(ms). 테스트에서는 0
    const think = Number(env.STREAM_THINK_MS);
    this.streamThinkMs = Number.isFinite(think) && think >= 0 ? think : this.nodeEnv === 'test' ? 0 : 900;
  }

  get isTest() {
    return this.nodeEnv === 'test';
  }
}

module.exports = { AppConfig, appConfig: new AppConfig() };
