const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nomina_ccsa_secure_secret_key_2026';
const INTERNAL_SECRET = process.env.INTERNAL_GATEWAY_SECRET || 'nomina_ccsa_internal_hmac_secret_2026';

function authenticateToken(req, res, next) {
  // 1. Check Zero Trust Gateway Context (HMAC signature verification)
  const gatewaySignature = req.headers['x-gateway-signature'];
  const userId = req.headers['x-user-id'];
  const userRoles = req.headers['x-user-roles'];

  if (gatewaySignature && userId) {
    const signaturePayload = `${userId}:${userRoles || 'user'}`;
    const expectedSignature = crypto
      .createHmac('sha256', INTERNAL_SECRET)
      .update(signaturePayload)
      .digest('hex');

    if (crypto.timingSafeEqual(Buffer.from(gatewaySignature), Buffer.from(expectedSignature))) {
      req.user = {
        id: userId,
        role: userRoles ? userRoles.split(',')[0] : 'user',
        roles: userRoles ? userRoles.split(',') : ['user']
      };
      return next();
    } else {
      return res.status(403).json({ error: 'Security Alert: Invalid Gateway Signature (Header Spoofing detected)' });
    }
  }

  // 2. Fallback to direct Bearer Token verification
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(403).json({ error: 'Token requerido o contexto de Gateway ausente' });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: 'Acceso denegado: usuario no autenticado.' });
    }
    // Superusuario: Admin con ID 1 tiene acceso total
    if (String(req.user.id) === '1') {
      return next();
    }
    const userRoles = req.user.roles || [req.user.role];
    const hasRole = roles.some(r => userRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ error: 'Acceso denegado: permisos insuficientes.' });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
