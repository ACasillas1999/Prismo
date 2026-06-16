const { query } = require('./src/config/db');

(async () => {
  try {
    console.log('Adding is_active to template_categories...');
    await query('ALTER TABLE template_categories ADD COLUMN is_active TINYINT(1) DEFAULT 1;');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') console.error(e);
  }

  try {
    console.log('Adding is_active to template_criteria...');
    await query('ALTER TABLE template_criteria ADD COLUMN is_active TINYINT(1) DEFAULT 1;');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') console.error(e);
  }

  try {
    console.log('Updating foreign key on evaluation_scores...');
    await query('ALTER TABLE evaluation_scores DROP FOREIGN KEY evaluation_scores_ibfk_2;');
    await query('ALTER TABLE evaluation_scores ADD CONSTRAINT evaluation_scores_ibfk_2 FOREIGN KEY (criterion_id) REFERENCES template_criteria(id) ON DELETE CASCADE;');
  } catch (e) {
    console.error(e);
  }

  console.log('Migration complete.');
  process.exit();
})();
