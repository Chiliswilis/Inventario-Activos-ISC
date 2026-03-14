require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://ktldlqvkjlfznzuqvkoh.supabase.co";
const supabaseKey = "sb_secret_aNS2prljyY_Zp_I-wOVkGA_Q2n-cWs4";

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;