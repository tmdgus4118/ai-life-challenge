/**
 * 데모 데이터 시드: 지정한(또는 새) 사용자 UUID로 35일치 모의 사건 약 400건을 넣는다.
 *   npm run seed            → 새 UUID 발급 후 출력 (브라우저 쿠키 nsid에 넣으면 그 데이터가 보임)
 *   npm run seed -- <uuid>  → 해당 사용자에게 시드
 */
const { appConfig } = require('../config/env');
const { createModels } = require('../models');
const { createServices } = require('../services');
const { IdUtil } = require('../utils/id');

const main = async () => {
  const userId = IdUtil.isValid(process.argv[2]) ? process.argv[2] : IdUtil.generate();
  const models = createModels(appConfig.dbDir);
  const services = createServices(models, appConfig);
  const result = await services.demoDataService.seed(userId);
  console.log(`사용자 ${userId} 에게 데모 사건 ${result.inserted}건(기준 초과 ${result.exceeded}건)을 넣었습니다.`);
  console.log(`브라우저 쿠키 nsid=${userId} 로 설정하면 이 데이터가 보입니다. (설정 화면의 "데모 데이터 불러오기"로도 가능)`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
