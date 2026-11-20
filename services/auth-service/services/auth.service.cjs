const db = require('../database.cjs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function verifyUser(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !user.activo) {
    return null;
  }
  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    return null;
  }
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    activo: user.activo,
    must_change_password: user.must_change_password
  };
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, roles: [user.role] },
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

function createUser(username, password, role) {
  const passwordHash = bcrypt.hashSync(password, 10);
  return db.prepare(
    'INSERT INTO users (username, password_hash, role, activo) VALUES (?, ?, ?, 1)'
  ).run(username, passwordHash, role);
}

module.exports = {
  verifyUser,
  generateToken,
  verifyToken,
  createUser,
  JWT_SECRET
};
