require("dotenv").config();
const bcrypt   = require("bcrypt");
const supabase = require("./src/supabase");

async function resetPasswords() {
  const users = [
    { email: "docente@sgiac.com", password: "Docente123" },
    { email: "alumno@sgiac.com",  password: "Alumno123"  }
  ];

  for (const u of users) {
    const password_hash = await bcrypt.hash(u.password, 10);
    const { data, error } = await supabase
      .from("users")
      .update({ password_hash })
      .eq("email", u.email)
      .select("id, username, email, role");

    if (error) console.error(`Error con ${u.email}:`, error);
    else console.log(`✅ ${u.email} actualizado:`, data);
  }
}

resetPasswords();