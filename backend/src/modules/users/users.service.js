const bcrypt   = require("bcrypt");
const supabase = require("../../config/supabase");
const { broadcast } = require("../events/events.service");

const getAllUsers = async () => {
  const { data, error } = await supabase
    .from("users")
    .select("id, username, email, role, created_at")
    .order("id");
  if (error) throw error;
  return data;
};

const getUserById = async (id) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, username, email, role, created_at")
    .eq("id", id)
    .single();
  if (error) throw { status: 404, message: "Usuario no encontrado" };
  return data;
};

const createUser = async ({ username, email, password, role }) => {
  const validRoles = ["administrador", "docente", "alumno"];
  const userRole   = validRoles.includes(role) ? role : "alumno";
  const password_hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("users")
    .insert([{ username, email, password_hash, role: userRole }])
    .select("id, username, email, role, created_at");

  if (error) {
    if (error.code === "23505") throw { status: 409, message: "El email o usuario ya existe" };
    throw error;
  }

  broadcast("users", "INSERT", data[0]);
  return data[0];
};

const updateUser = async (id, { username, email, password, role }) => {
  const validRoles = ["administrador", "docente", "alumno"];
  const userRole   = validRoles.includes(role) ? role : "alumno";
  const updateData = { username, email, role: userRole };

  if (password && password.trim() !== "") {
    updateData.password_hash = await bcrypt.hash(password, 10);
  }

  const { data, error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", id)
    .select("id, username, email, role, created_at");

  if (error) throw error;
  if (!data || data.length === 0) throw { status: 404, message: "Usuario no encontrado" };

  broadcast("users", "UPDATE", data[0]);
  return data[0];
};

const deleteUser = async (id) => {
  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", id);

  if (error) throw error;
  broadcast("users", "DELETE", { id });
};

module.exports = { getAllUsers, getUserById, createUser, updateUser, deleteUser };