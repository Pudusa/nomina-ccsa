const authService = require('../services/auth.service.cjs');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(403).json({ error: 'Token requerido' });
  }

  const user = authService.verifyToken(token);
  if (!user) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }

  req.user = user;
  next();
}

module.exports = {
  authenticateToken
};
