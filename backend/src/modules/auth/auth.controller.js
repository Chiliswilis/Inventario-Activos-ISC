const authService      = require("./auth.service");
const { logAction }    = require("../audit/audit.service");

/* ── LOGIN ── */
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Faltan credenciales" });

    const result = await authService.login(email, password);

    await logAction({
      userId:      result.user.id,
      userRole:    result.user.role,
      action:      "LOGIN",
      module:      "auth",
      description: `Inició sesión: ${result.user.username} (${result.user.email})`,
      req,
    });

    res.json(result);
  } catch (err) {
    // Log intento fallido (sin userId porque no autenticó)
    await logAction({
      userId:      null,
      userRole:    null,
      action:      "LOGIN",
      module:      "auth",
      description: `Intento de login fallido para: ${req.body?.email || "desconocido"} — ${err.message}`,
      req,
    });
    console.error("Error login:", err);
    res.status(err.status || 500).json({ error: err.message || "Error del servidor" });
  }
}

/* ── LOGOUT ── */
async function logout(req, res) {
  try {
    const user = req.user;
    if (user) {
      await logAction({
        userId:      user.id,
        userRole:    user.role,
        action:      "LOGOUT",
        module:      "auth",
        description: `Cerró sesión: ${user.username} (${user.email})`,
        req,
      });
    }
    res.json({ message: "Sesión cerrada" });
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
}

/* ── REGISTRO ── */
async function register(req, res) {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: "Nombre, correo y contraseña son obligatorios" });

    const result = await authService.register(username, email, password, role);

    await logAction({
      userId:      req.user?.id   || null,   // Si lo registra un admin, tendrá user
      userRole:    req.user?.role || null,
      action:      "CREATE",
      module:      "auth",
      recordId:    result.user?.id,
      description: `Nuevo usuario registrado: ${username} (${email}) — rol: ${result.user?.role}`,
      newValue:    { username, email, role: result.user?.role },
      req,
    });

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

    await logAction({
      userId:      null,
      userRole:    null,
      action:      "UPDATE",
      module:      "auth",
      description: `Contraseña temporal generada para: ${email}`,
      req,
    });

    res.json(result);
  } catch (err) {
    console.error("Error recuperación:", err);
    res.status(err.status || 500).json({ error: err.message || "Error del servidor" });
  }
}

/* ── ME — revalidar sesión activa ── */
async function me(req, res) {
  try {
    res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
}

module.exports = { login, logout, register, recover, me };