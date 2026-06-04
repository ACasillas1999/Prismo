'use strict';

/**
 * Middleware factory: verifica que el usuario tenga uno de los roles permitidos.
 * Uso: requireRole('admin', 'department_head')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción',
        required: allowedRoles,
        current: req.user.role,
      });
    }

    next();
  };
}

/**
 * Middleware: solo permite acceso a recursos del propio departamento
 * (para jefes de departamento).
 * Admins pueden ver todo.
 */
function requireOwnDepartment(req, res, next) {
  if (req.user.role === 'admin') {
    return next(); // Admin ve todo
  }

  const requestedDeptId = parseInt(req.params.department_id || req.query.department_id || req.body.department_id);

  if (requestedDeptId && req.user.department_id !== requestedDeptId) {
    return res.status(403).json({
      error: 'Solo puedes acceder a recursos de tu departamento',
    });
  }

  next();
}

module.exports = { requireRole, requireOwnDepartment };
