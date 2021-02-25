import express from "express";
import { dbPromise } from "./db";

const app = express();
const port = process.env.API_PORT || 5000;

app.get("/nodes", async (req, res) => {
  const db = await dbPromise;
  // Reload db
  await db.read();

  res.send(db.get("nodes").map(({ id, nodeName }) => ({ id, nodeName })));
});

app.get("/node/:nodeId", async (req, res) => {
  const { nodeId } = req.params;
  const db = await dbPromise;
  // Reload db
  await db.read();

  if (parseInt(nodeId).toString() !== nodeId) {
    res.status(400).send("Invalid node id");
    return;
  }

  const nodeData = db
    .get("nodes")
    .find((n) => n.id === parseInt(nodeId))
    .value();

  if (!nodeData) {
    res.status(404).send("Not found");
    return;
  }

  res.send(nodeData);
});

app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
