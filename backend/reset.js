require("dotenv").config();
const bcrypt   = require("bcrypt");
const supabase = require("./src/supabase");
 
async function resetAdmin() {
  const password      = "Admin123";
  const password_hash = await bcrypt.hash(password, 10);
 
  console.log("Hash generado:", password_hash);
 
  const { data, error } = await supabase
    .from("users")
    .update({ password_hash })
    .eq("id", 1)
    .select("id, username, email, role");
 
  if (error) {
    console.error("Error al actualizar:", error);
  } else {
    console.log("✅ Contraseña actualizada correctamente:", data);
  }
}
 
resetAdmin();
 