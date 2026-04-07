const bcrypt   = require("bcrypt");
const supabase = require("../../config/supabase");

/* ── LOGIN ── */
async function login(email, password) {
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !user) {
    const err = new Error("Usuario no encontrado");
    err.status = 404;
    throw err;
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    const err = new Error("Contraseña incorrecta");
    err.status = 401;
    throw err;
  }

  return {
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
    session: true,
  };
}

/* ── REGISTRO ── */
async function register(username, email, password, role) {
  if (password.length < 6) {
    const err = new Error("La contraseña debe tener al menos 6 caracteres");
    err.status = 400;
    throw err;
  }

  const validRoles    = ["administrador", "docente", "alumno"];
  const userRole      = validRoles.includes(role) ? role : "alumno";
  const password_hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("users")
    .insert([{ username, email, password_hash, role: userRole }])
    .select("id, username, email, role");

  if (error) {
    if (error.code === "23505") {
      const err = new Error("El correo o nombre de usuario ya está registrado");
      err.status = 409;
      throw err;
    }
    const err = new Error("Error al registrar usuario");
    err.status = 500;
    throw err;
  }

  return { message: "Usuario registrado correctamente", user: data[0] };
}

/* ── RECUPERAR CONTRASEÑA ── */
async function recover(email) {
  const { data: user, error } = await supabase
    .from("users")
    .select("id, username, email")
    .eq("email", email)
    .single();

  if (error || !user) {
    const err = new Error("No existe una cuenta con ese correo");
    err.status = 404;
    throw err;
  }

  const chars  = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let tempPass = "Temp_";
  for (let i = 0; i < 6; i++) {
    tempPass += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const password_hash = await bcrypt.hash(tempPass, 10);

  await supabase
    .from("users")
    .update({ password_hash })
    .eq("id", user.id);

  return {
    message: "Contraseña temporal generada",
    tempPassword: tempPass,
    username: user.username,
  };
}

module.exports = { login, register, recover };