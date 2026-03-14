const express  = require("express");
const router   = express.Router();
const bcrypt   = require("bcrypt");
const supabase = require("./supabase");
 
/* ── LISTAR USUARIOS ── */
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, username, email, role, created_at")
    .order("id");
 
  if (error) return res.status(500).json(error);
  res.json(data);
});
 
/* ── OBTENER USUARIO POR ID ── */
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, username, email, role, created_at")
    .eq("id", req.params.id)
    .single();
 
  if (error) return res.status(404).json({ message: "Usuario no encontrado" });
  res.json(data);
});
 
/* ── CREAR USUARIO ── */
router.post("/", async (req, res) => {
  const { username, email, password, role } = req.body;
 
  if (!username || !email || !password) {
    return res.status(400).json({ message: "username, email y password son obligatorios" });
  }
 
  const validRoles = ["administrador", "docente", "alumno"];
  const userRole   = validRoles.includes(role) ? role : "alumno";
 
  try {
    const password_hash = await bcrypt.hash(password, 10);
 
    const { data, error } = await supabase
      .from("users")
      .insert([{ username, email, password_hash, role: userRole }])
      .select("id, username, email, role, created_at");
 
    if (error) {
      if (error.code === "23505") return res.status(409).json({ message: "El email o usuario ya existe" });
      return res.status(500).json(error);
    }
 
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ message: "Error al crear usuario" });
  }
});
 
/* ── ACTUALIZAR USUARIO ── */
router.put("/:id", async (req, res) => {
  const { username, email, password, role } = req.body;
 
  if (!username || !email) {
    return res.status(400).json({ message: "username y email son obligatorios" });
  }
 
  const validRoles = ["administrador", "docente", "alumno"];
  const userRole   = validRoles.includes(role) ? role : "alumno";
 
  try {
    const updateData = { username, email, role: userRole };
 
    // Solo actualiza contraseña si se envió una nueva
    if (password && password.trim() !== "") {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }
 
    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", req.params.id)
      .select("id, username, email, role, created_at");
 
    if (error) return res.status(500).json(error);
    if (!data || data.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });
 
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ message: "Error al actualizar usuario" });
  }
});
 
/* ── ELIMINAR USUARIO ── */
router.delete("/:id", async (req, res) => {
  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", req.params.id);
 
  if (error) return res.status(500).json(error);
  res.json({ message: "Usuario eliminado" });
});
 
module.exports = router;
 