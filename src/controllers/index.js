const { EventController } = require('./EventController');
const { ReportController } = require('./ReportController');
const { MessageController } = require('./MessageController');
const { SettingsController } = require('./SettingsController');
const { DataController } = require('./DataController');
const { PageController } = require('./PageController');
const { LabController } = require('./LabController');
const { ShareController } = require('./ShareController');

const createControllers = (services, config) => ({
  eventController: new EventController(services),
  reportController: new ReportController(services),
  messageController: new MessageController(services),
  settingsController: new SettingsController(services),
  dataController: new DataController(services),
  labController: new LabController(services),
  shareController: new ShareController(services),
  pageController: new PageController({ ...services, config }),
});

module.exports = { createControllers };
