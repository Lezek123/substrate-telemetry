import express from "express";
import { dbPromise, NodeTrackingHistoryEntry } from "./db";
import Debug from "debug";
import _ from "lodash";

const app = express();
const dbReloadDebug = Debug("db-reload");
const port = process.env.API_PORT || 5000;
const DB_RELOAD_INTERVAL_MIN = parseInt(process.env.RELOAD_INTERVAL || "5");

app.get("/nodes", async (req, res) => {
  const db = await dbPromise;

  res.send(
    db
      .get("nodes")
      .map(({ nodeName }) => ({ nodeName }))
      .uniqBy("nodeName")
      .value()
  );
});

app.get("/node/:nodeName", async (req, res) => {
  const { nodeName } = req.params;
  const db = await dbPromise;

  const nodeInstances = db
    .get("nodes")
    .filter((n) => n.nodeName === nodeName)
    .sort((a, b) => b.id - a.id) // Sort by id DESC
    .value();

  if (!nodeInstances.length) {
    res.status(404).send("Not found");
    return;
  }

  // Merge data from multiple db instances by name
  const historyMap = new Map<number, NodeTrackingHistoryEntry>();
  nodeInstances.forEach((instanceData) => {
    instanceData.history.forEach((entry) => {
      historyMap.set(entry.timestamp, entry);
    });
  });
  const nodeData = nodeInstances[nodeInstances.length - 1];
  nodeData.history = Array.from(historyMap.values()).sort(
    (a, b) => a.timestamp - b.timestamp
  );

  res.send(nodeData);
});

app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});

// Periodically reload db
setInterval(async () => {
  (await dbPromise).read();
  dbReloadDebug("Database state reloaded");
}, DB_RELOAD_INTERVAL_MIN * 60 * 1000);
