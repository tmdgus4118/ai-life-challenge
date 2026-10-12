const { createApp } = require('./app');
const { appConfig } = require('./config/env');
const { KeepAlive } = require('./utils/keep-alive');

const app = createApp({ config: appConfig });

// 무료 호스팅이 잠들지 않게 공개 주소(Render가 넣어 주는 RENDER_EXTERNAL_URL, 또는 KEEP_ALIVE_URL)를 10분마다 호출한다
const keepAlive = new KeepAlive({ url: process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || '', intervalMs: 5 * 60 * 1000 });
app.locals.keepAlive = keepAlive;

app.listen(appConfig.port, () => {
  const { llmInfo } = app.locals.services;
  // eslint-disable-next-line no-console
  console.log(`이웃소리 서버 시작: http://localhost:${appConfig.port} (LLM: ${llmInfo.provider}, DB: ${appConfig.dbDir})`);
  if (llmInfo.fallbackReason) {
    // eslint-disable-next-line no-console
    console.warn(`[경고] ${llmInfo.fallbackReason}`);
  }
  if (keepAlive.start()) {
    // eslint-disable-next-line no-console
    console.log(`keep-alive: ${keepAlive.url}/api/health 를 ${keepAlive.intervalMs / 60000}분마다 호출`);
  }
});
