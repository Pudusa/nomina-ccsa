const db = require('../database.cjs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nomina_ccsa_secure_secret_key_2026';

function verifyUser(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return null;
  }
  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    return null;
  }
  return {
    id: user.id,
    username: user.username,
    role: user.role
  };
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = {
  verifyUser,
  generateToken,
  verifyToken,
  JWT_SECRET
};
