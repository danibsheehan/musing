import express from "express";
import { corsMiddleware } from "./lib/cors.js";
import { requireAuth } from "./middleware/auth.js";
import { requireBudget } from "./middleware/budget.js";
import { embedPageHandler } from "./routes/embedPage.js";
import { searchHandler } from "./routes/search.js";
import { summarizePageHandler } from "./routes/summarizePage.js";
import { relatedPagesHandler } from "./routes/relatedPages.js";
import { usageHandler } from "./routes/usage.js";

const app = express();
app.use(corsMiddleware);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/embed-page", requireAuth, requireBudget("voyage"), embedPageHandler);
app.post("/api/search", requireAuth, requireBudget("voyage"), searchHandler);
app.post("/api/summarize-page", requireAuth, requireBudget("anthropic"), summarizePageHandler);
app.post("/api/related-pages", requireAuth, relatedPagesHandler);
app.get("/api/usage", requireAuth, usageHandler);

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`musing-ai-service listening on :${port}`);
});
