import { dbPromise as lowdb } from "./lowdb";
import {
  db as postgresdb,
  Node,
  Location,
  NodeHistoryEntry,
} from "./postgresdb";
// Simple lowDB => PostgreSQL migration script

async function main() {
  await postgresdb.sync({ force: true });
  const nodes = (await lowdb).get("nodes").value();

  for (let node of nodes) {
    const {
      id: lowDbId,
      nodeName,
      nodeImplementation,
      nodeVersion,
      address,
      networkID,
      lastStartupTime,
      location,
    } = node;
    const dbNode = Node.build({
      nodeName,
      nodeImplementation,
      nodeVersion,
      address: address || null,
      networkID: networkID || null,
      lastStartupTime: lastStartupTime || null,
    });

    await dbNode.save();

    if (location) {
      await Location.create({
        lat: location["lat"],
        lng: location["lng"],
        city: location["city"],
        nodeId: dbNode.id,
      });
    }

    await NodeHistoryEntry.bulkCreate(
      node.history.map((entry) => ({ nodeId: dbNode.id, ...entry }))
    );

    const nodeShortData = {
      lowDbId,
      nodeName,
      city: location?.city,
      postDbId: dbNode.id,
      historyEntries: node.history.length,
    };
    console.log("Imported!", nodeShortData);
  }
}

main()
  .then(() => process.exit())
  .catch(console.error);
