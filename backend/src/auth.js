const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const supabase = require("./supabase");

router.post("/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Faltan credenciales" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      session: true
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Error del servidor" });
  }

});

module.exports = router;