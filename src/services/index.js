const { SettingsService } = require('./SettingsService');
const { ThresholdService } = require('./ThresholdService');
const { EventService } = require('./EventService');
const { DataService } = require('./DataService');
const { DemoDataService } = require('./DemoDataService');
const { AggregationService } = require('./AggregationService');
const { SafetyChecker } = require('./SafetyChecker');
const { AiWriterService } = require('./AiWriterService');
const { ReportService } = require('./ReportService');
const { MessageService } = require('./MessageService');
const { StepGuideService } = require('./StepGuideService');
const { LegalGuideService } = require('./LegalGuideService');
const { LabService } = require('./LabService');
const { ShareService } = require('./ShareService');
const { LlmClientFactory } = require('./llm/LlmClientFactory');
const { TemplateLlmClient } = require('./llm/TemplateLlmClient');

/** 서비스 컨테이너: 모델과 설정을 주입해 모든 서비스를 조립한다 */
const createServices = (models, config, { llmClient = null } = {}) => {
  const llm = llmClient ? { client: llmClient, fallbackReason: null } : LlmClientFactory.create(config);
  const settingsService = new SettingsService(models.settingsModel);
  const thresholdService = new ThresholdService(models.thresholdModel);
  const eventService = new EventService({ eventModel: models.eventModel, thresholdService, settingsService });
  const aggregationService = new AggregationService();
  const fallbackClient = new TemplateLlmClient({ chunkDelayMs: config.streamChunkDelayMs ?? 22, thinkMs: config.streamThinkMs ?? 900 });
  const aiWriter = new AiWriterService({ llmClient: llm.client, fallbackClient, safetyChecker: new SafetyChecker(), aggregationService });
  const reportService = new ReportService({ eventModel: models.eventModel, reportModel: models.reportModel, aggregationService, aiWriter, settingsService, thresholdService });
  const stepGuideService = new StepGuideService({ messageModel: models.messageModel, eventModel: models.eventModel });
  const messageService = new MessageService({ messageModel: models.messageModel, reportService, aiWriter, stepGuideService, settingsService, thresholdService });
  const dataService = new DataService(models);
  const demoDataService = new DemoDataService({ eventService });
  const legalGuideService = new LegalGuideService();
  const labService = new LabService({ labRunModel: models.labRunModel });
  const shareService = new ShareService({ shareModel: models.shareModel, reportService });
  return {
    settingsService, thresholdService, eventService, aggregationService, aiWriter, reportService,
    stepGuideService, messageService, dataService, demoDataService, legalGuideService, labService, shareService,
    llmInfo: { provider: llm.client.name, model: config.llmModel, fallbackReason: llm.fallbackReason },
  };
};

module.exports = { createServices };
