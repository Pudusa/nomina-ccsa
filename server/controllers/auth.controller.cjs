const authService = require('../services/auth.service.cjs');

function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Se requiere usuario y contraseña.' });
    }

    const user = authService.verifyUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = authService.generateToken(user);

    res.json({
      message: 'Autenticación exitosa',
      token,
      user
    });
  } catch (err) {
    console.error('Error in login:', err);
    res.status(500).json({ error: err.message });
  }
}

function getMe(req, res) {
  try {
    res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  login,
  getMe
};
