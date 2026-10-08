const { EventModel } = require('./EventModel');
const { ReportModel } = require('./ReportModel');
const { MessageModel } = require('./MessageModel');
const { SettingsModel } = require('./SettingsModel');
const { ThresholdModel } = require('./ThresholdModel');
const { LabRunModel } = require('./LabRunModel');
const { ShareModel } = require('./ShareModel');

/** 모델 묶음 생성 (DB 디렉터리 주입) */
const createModels = (dbDir) => ({
  eventModel: new EventModel(dbDir),
  reportModel: new ReportModel(dbDir),
  messageModel: new MessageModel(dbDir),
  settingsModel: new SettingsModel(dbDir),
  thresholdModel: new ThresholdModel(dbDir),
  labRunModel: new LabRunModel(dbDir),
  shareModel: new ShareModel(dbDir),
});

module.exports = { createModels, EventModel, ReportModel, MessageModel, SettingsModel, ThresholdModel, LabRunModel, ShareModel };
