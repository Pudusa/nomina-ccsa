const authService = require('../services/auth.service.cjs');

async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Se requiere usuario y contraseña.' });
    }

    const verified = authService.verifyUser(username, password);
    // Manejar tanto si verifyUser retorna una Promise como si es síncrono
    const user = verified instanceof Promise ? await verified : verified;

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = authService.generateToken(user);

    res.json({
      message: 'Autenticación exitosa (Microservice con AD/LDAP support)',
      token,
      user
    });
  } catch (err) {
    console.error('Error in auth service login:', err);
    res.status(500).json({ error: err.message });
  }
}

function getMe(req, res) {
  try {
    res.json({ user: req.user });
  } catch (err) {
    console.error('Error in auth service getMe:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  login,
  getMe
};
