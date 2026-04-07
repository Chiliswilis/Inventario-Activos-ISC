const supabase = require("../../config/supabase");

const getAllCategories = async () => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, description, type, area")
    .order("type")
    .order("name");
  if (error) throw error;
  return data;
};

const getAssetCategories = async () => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, description, type, area")
    .eq("type", "asset")
    .order("name");
  if (error) throw error;
  return data;
};

const getConsumableCategories = async () => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, description, type, area")
    .eq("type", "consumable")
    .order("name");
  if (error) throw error;
  return data;
};

module.exports = { getAllCategories, getAssetCategories, getConsumableCategories };