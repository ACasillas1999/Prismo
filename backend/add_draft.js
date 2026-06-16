const { query } = require('./src/config/db');

(async () => {
  try {
    await query('ALTER TABLE evaluation_templates ADD COLUMN is_draft TINYINT(1) DEFAULT 0 AFTER is_active;');
    console.log('Column is_draft added.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('Already exists');
    else console.error(e);
  }
  process.exit();
})();
