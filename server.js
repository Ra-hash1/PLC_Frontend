import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "dist");
const indexPath = path.join(distPath, "index.html");

// 🔍 DEBUG (IMPORTANT)
console.log("Dist path:", distPath);
console.log("Index exists:", fs.existsSync(indexPath));

// Serve static files
app.use(express.static(distPath));

// Root route
app.get("/", (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send("index.html not found");
  }
});

// Catch-all
app.get(/.*/, (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send("index.html not found");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Frontend running on port ${PORT}`);
});