require("dotenv").config();

const express = require("express");
const cors    = require("cors");

const authRoutes        = require("./src/auth");
const assetsRoutes      = require("./src/assets");
const categoriesRoutes  = require("./src/categories");
const usersRoutes       = require("./src/users");
const consumiblesRoutes = require("./src/consumibles");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth",        authRoutes);
app.use("/api/assets",      assetsRoutes);
app.use("/api/categories",  categoriesRoutes);
app.use("/api/users",       usersRoutes);
app.use("/api/consumibles", consumiblesRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});