const { createApp } = require('../src/app');

/**
 * 테스트용 앱을 127.0.0.1의 임시 포트에 띄운다.
 * supertest에 앱을 그대로 넘기면 IPv6 전체 주소(::)로 듣는데, 같은 포트 번호를 IPv4로 쓰는
 * 다른 프로그램이 있으면 127.0.0.1 요청이 그쪽으로 가서 무작위로 404가 섞인다. 그래서 주소를 명시한다.
 */
const startApp = async (options) => {
  const app = createApp(options);
  app.server = await new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
  return app;
};

const stopApp = (app) => new Promise((resolve) => {
  if (!app || !app.server) return resolve();
  return app.server.close(() => resolve());
});

module.exports = { startApp, stopApp };
