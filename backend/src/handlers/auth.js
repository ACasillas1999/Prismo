'use strict';
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { query } = require('../config/db');

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user }
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    // Buscar usuario por email
    const [rows] = await query(
      `SELECT id, email, password_hash, first_name, last_name, role,
              department_id, position_id, avatar_url, is_active
       FROM users WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' });
    }

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar JWT
    const tokenPayload = {
      id:            user.id,
      email:         user.email,
      role:          user.role,
      department_id: user.department_id,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    });

    // Responder sin password_hash
    const { password_hash, ...safeUser } = user;

    res.json({
      token,
      user: safeUser,
    });
  } catch (err) {
    console.error('[AUTH] Error en login:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * GET /api/auth/me
 * Returns: user profile from JWT
 */
async function me(req, res) {
  try {
    const [rows] = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role,
              u.department_id, u.position_id, u.avatar_url, u.is_active,
              d.name AS department_name,
              p.name AS position_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN positions p   ON u.position_id = p.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    console.error('[AUTH] Error en /me:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { login, me };
