require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://roqrezpmkafeewfenpia.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvcXJlenBta2FmZWV3ZmVucGlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTUyMzc2NSwiZXhwIjoyMDg3MDk5NzY1fQ.1bC5kc4TFRCcbHLsdGprZSx-t5hw4_kqMnTNg5QL_og";

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;