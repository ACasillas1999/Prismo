const { query } = require('./src/config/db');

(async () => {
  try {
    const [rows] = await query('SHOW CREATE TABLE evaluation_scores');
    console.log(rows[0]['Create Table']);
  } catch (e) {
    console.error(e);
  }
  process.exit();
})();
