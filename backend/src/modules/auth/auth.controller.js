const authService = require("./auth.service");

/* ── LOGIN ── */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Faltan credenciales" });

    const result = await authService.login(email, password);
    res.json(result);

  } catch (err) {
    console.error("Error login:", err);
    res.status(err.status || 500).json({ error: err.message || "Error del servidor" });
  }
}

/* ── REGISTRO ── */
async function register(req, res) {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: "Nombre, correo y contraseña son obligatorios" });

    const result = await authService.register(username, email, password, role);
    res.json(result);

  } catch (err) {
    console.error("Error registro:", err);
    res.status(err.status || 500).json({ error: err.message || "Error del servidor" });
  }
}

/* ── RECUPERAR CONTRASEÑA ── */
async function recover(req, res) {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ error: "El correo es obligatorio" });

    const result = await authService.recover(email);
    res.json(result);

  } catch (err) {
    console.error("Error recuperación:", err);
    res.status(err.status || 500).json({ error: err.message || "Error del servidor" });
  }
}

/* ── ME — revalidar sesión activa ── */
// requireAuth ya verificó x-user-id y adjuntó req.user
async function me(req, res) {
  try {
    res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
}

module.exports = { login, register, recover, me };