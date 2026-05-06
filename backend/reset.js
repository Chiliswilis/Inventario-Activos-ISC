require("dotenv").config();
const bcrypt   = require("bcrypt");
const supabase = require("./src/supabase");

async function resetPasswords() {
  const users = [
    { email: "adminOmar@gmail.com",                  password: "Admin123"   },
    { email: "adminWilly@gmail.com",                 password: "Admin123"   },
    { email: "juan.rodriguez@lahuerta.tecmm.edu.mx", password: "Docente123" },
    { email: "omar.perez@lahuerta.tecmm.edu.mx",     password: "Docente123" },
    { email: "hu230111608@lahuerta.tecmm.edu.mx",    password: "Alumno123"  },
    { email: "hu230111657@lahuerta.tecmm.edu.mx",    password: "123456"  },
    { email: "hu230110712@lahuerta.tecmm.edu.mx",    password: "123456"  },
  ];

  for (const u of users) {
    const password_hash = await bcrypt.hash(u.password, 10);
    const { data, error } = await supabase
      .from("users")
      .update({ password_hash })
      .eq("email", u.email)
      .select("id, username, email, role");

    if (error) console.error(`Error con ${u.email}:`, error);
    else console.log(`${u.email} actualizado:`, data);
  }
}

resetPasswords();