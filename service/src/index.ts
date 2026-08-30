import express from "express";
import { requireAuth } from "./middleware/auth.js";
import { requireBudget } from "./middleware/budget.js";
import { embedPageHandler } from "./routes/embedPage.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/embed-page", requireAuth, requireBudget("voyage"), embedPageHandler);

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`musing-ai-service listening on :${port}`);
});
