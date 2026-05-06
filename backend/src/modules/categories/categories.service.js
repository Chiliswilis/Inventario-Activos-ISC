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

const createCategory = async ({ name, description, type, area }) => {
  const { data, error } = await supabase
    .from("categories")
    .insert([{ name, description: description || null, type, area: area || null }])
    .select("id, name, description, type, area");
  if (error) throw error;
  return data[0];
};

const updateCategory = async (id, { name, description, type, area }) => {
  const { data, error } = await supabase
    .from("categories")
    .update({ name, description: description || null, type, area: area || null })
    .eq("id", id)
    .select("id, name, description, type, area");
  if (error) throw error;
  if (!data?.length) {
    const e = new Error("Categoría no encontrada");
    e.status = 404;
    throw e;
  }
  return data[0];
};

const deleteCategory = async (id) => {
  // Verificar que no haya activos usando esta categoría
  const { data: inUseAssets } = await supabase
    .from("assets")
    .select("id")
    .eq("category_id", id)
    .limit(1);

  // Verificar que no haya consumibles usando esta categoría
  const { data: inUseConsumables } = await supabase
    .from("consumables")
    .select("id")
    .eq("category_id", id)
    .limit(1);

  if (inUseAssets?.length || inUseConsumables?.length) {
    const e = new Error("No se puede eliminar: hay elementos usando esta categoría");
    e.status = 409;
    throw e;
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

module.exports = {
  getAllCategories,
  getAssetCategories,
  getConsumableCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};