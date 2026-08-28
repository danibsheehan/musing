import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`musing-ai-service listening on :${port}`);
});
