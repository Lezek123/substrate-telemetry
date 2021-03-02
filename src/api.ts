import express from "express";
import { db, Node, NodeHistoryEntry, NodeLocationRef } from "./postgresdb";
import { Op } from "sequelize";
import _ from "lodash";

const app = express();
const port = process.env.API_PORT || 5000;

app.get("/nodes", async (req, res) => {
  const [queryRes] = await db.query(
    'SELECT DISTINCT "nodeName" FROM nodes ORDER BY "nodeName" ASC'
  );
  res.send(queryRes);
});

app.get("/node/:nodeName", async (req, res) => {
  const { nodeName } = req.params;

  const nodeInstances = await Node.findAll({
    where: { nodeName },
    order: [["id", "ASC"]],
    include: NodeLocationRef,
  });

  if (!nodeInstances.length) {
    res.status(404).send("Not found");
    return;
  }

  const historyEntries = await NodeHistoryEntry.findAll({
    where: { nodeId: { [Op.in]: nodeInstances.map((n) => n.id) } },
    order: [
      ["timestamp", "ASC"],
      ["nodeId", "ASC"], // After timestamp - proritize by "earlier" nodeId
    ],
  });

  // Remove duplicate timestamps
  // (if 2 nodes had the same name at the same time, the earlier-id node should be prioritized)
  const history = _.uniqBy(historyEntries, "timestamp");

  // Get most recent node data (with accordance to non-duplicate history entries)
  const mostRecentNodeData = nodeInstances.find(
    (n) => n.id === history.length ? history[history.length - 1].nodeId : nodeInstances[nodeInstances.length - 1].id
  );

  res.send({ ...mostRecentNodeData?.toJSON(), history });
});

app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
