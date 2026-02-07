/**
 * Add this to your existing text import script to set up daily automation
 * 
 * Run installTextImportTrigger() once to create the daily trigger
 */

function installTextImportTrigger() {
  // Delete any existing triggers for syncFolder
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncFolder') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new daily trigger (runs every day at 3 AM)
  ScriptApp.newTrigger('syncFolder')
    .timeBased()
    .everyDays(1)
    .atHour(3)  // Adjust time as needed (3 AM to avoid overlap with PDF script at 2 AM)
    .create();
  
  Logger.log('Daily trigger for syncFolder() created successfully!');
  Logger.log('The script will run automatically every day at 3 AM.');
}

function removeTextImportTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncFolder') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Trigger removed');
    }
  });
}
