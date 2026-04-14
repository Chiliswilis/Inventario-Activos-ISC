require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY. Revisa tu archivo .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;