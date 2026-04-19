/* eslint-disable @typescript-eslint/no-unused-vars */
const APP_URL = 'https://task-inky-ten-50.vercel.app/';
const CRON_SECRET = 'man-cron-secret-12345';

// Main handler called by the time-based trigger.
function triggerNextjsReport() {
  const url = APP_URL.replace(/\/$/, '') + '/api/cron/trigger-report';

  const options = {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + CRON_SECRET,
    },
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log('Trigger report success: ' + response.getContentText());
  } catch (err) {
    Logger.log('Trigger report failed: ' + err);
  }
}

// Run this once to recreate the two daily triggers.
function setupDailyTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  ScriptApp.newTrigger('triggerNextjsReport')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .nearMinute(0)
    .create();

  ScriptApp.newTrigger('triggerNextjsReport')
    .timeBased()
    .atHour(17)
    .everyDays(1)
    .nearMinute(0)
    .create();

  Logger.log('Daily triggers created for 08:00 and 17:00.');
}
