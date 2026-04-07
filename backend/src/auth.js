const express  = require("express");
const router   = express.Router();
const bcrypt   = require("bcrypt");
const supabase = require("./config/supabase");

/* ── LOGIN ── */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Faltan credenciales" });

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user)
      return res.status(404).json({ error: "Usuario no encontrado" });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword)
      return res.status(401).json({ error: "Contraseña incorrecta" });

    res.json({
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      session: true
    });

  } catch (err) {
    console.error("Error login:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

/* ── REGISTRO ── */
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: "Nombre, correo y contraseña son obligatorios" });

    if (password.length < 6)
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });

    const validRoles  = ["administrador", "docente", "alumno"];
    const userRole    = validRoles.includes(role) ? role : "alumno";
    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("users")
      .insert([{ username, email, password_hash, role: userRole }])
      .select("id, username, email, role");

    if (error) {
      if (error.code === "23505")
        return res.status(409).json({ error: "El correo o nombre de usuario ya está registrado" });
      return res.status(500).json({ error: "Error al registrar usuario" });
    }

    res.json({ message: "Usuario registrado correctamente", user: data[0] });

  } catch (err) {
    console.error("Error registro:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

/* ── RECUPERAR CONTRASEÑA ── */
router.post("/recover", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ error: "El correo es obligatorio" });

    // Verificar si el usuario existe
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, email")
      .eq("email", email)
      .single();

    if (error || !user)
      return res.status(404).json({ error: "No existe una cuenta con ese correo" });

    // Generar contraseña temporal
    const chars   = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let tempPass  = "Temp_";
    for (let i = 0; i < 6; i++) {
      tempPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const password_hash = await bcrypt.hash(tempPass, 10);

    await supabase
      .from("users")
      .update({ password_hash })
      .eq("id", user.id);

    res.json({
      message: "Contraseña temporal generada",
      tempPassword: tempPass,
      username: user.username
    });

  } catch (err) {
    console.error("Error recuperación:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

module.exports = router;