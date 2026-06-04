'use strict';
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

/**
 * Seed script: crea el usuario admin por defecto.
 * Ejecutar: npm run seed
 */
async function seed() {
  console.log('[SEED] Creando usuario administrador por defecto...');

  const email     = 'admin@prismo.local';
  const password  = 'admin123';
  const firstName = 'Admin';
  const lastName  = 'Sistema';
  const role      = 'admin';

  // Verificar si ya existe
  const [existing] = await query('SELECT id FROM users WHERE email = ?', [email]);

  if (existing.length > 0) {
    console.log('[SEED] ⚠ El usuario admin ya existe. No se creó duplicado.');
    process.exit(0);
  }

  // Hash de contraseña
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  await query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES (?, ?, ?, ?, ?)`,
    [email, hash, firstName, lastName, role]
  );

  console.log('[SEED] ✓ Usuario admin creado:');
  console.log(`       Email:    ${email}`);
  console.log(`       Password: ${password}`);
  console.log(`       Rol:      ${role}`);
  console.log('[SEED] ⚠ Cambia la contraseña después del primer login.');

  process.exit(0);
}

seed().catch(err => {
  console.error('[SEED] ✗ Error:', err.message);
  process.exit(1);
});
