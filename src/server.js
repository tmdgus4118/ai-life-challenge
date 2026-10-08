const { createApp } = require('./app');
const { appConfig } = require('./config/env');

const app = createApp({ config: appConfig });

app.listen(appConfig.port, () => {
  const { llmInfo } = app.locals.services;
  // eslint-disable-next-line no-console
  console.log(`이웃소리 서버 시작: http://localhost:${appConfig.port} (LLM: ${llmInfo.provider}, DB: ${appConfig.dbDir})`);
  if (llmInfo.fallbackReason) {
    // eslint-disable-next-line no-console
    console.warn(`[경고] ${llmInfo.fallbackReason}`);
  }
});
