const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query } = require('../src/config/db.js');

async function migrate() {
  try {
    console.log('Adding requires_evidence to template_criteria...');
    await query(`ALTER TABLE template_criteria ADD COLUMN requires_evidence TINYINT(1) DEFAULT 0;`);
    console.log('Success.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Column requires_evidence already exists.');
    } else {
      console.error(e);
    }
  }

  try {
    console.log('Creating evaluation_evidences table...');
    await query(`
      CREATE TABLE IF NOT EXISTS evaluation_evidences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        score_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (score_id) REFERENCES evaluation_scores(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
    console.log('Success.');
  } catch (e) {
    console.error(e);
  }

  process.exit(0);
}

migrate();
