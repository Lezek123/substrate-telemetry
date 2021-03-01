import low from "lowdb";
import FileAsync from "lowdb/adapters/FileAsync";

const DB_FILE = process.env.DB_FILE || "db.json";

type NodeTrackingHistoryEntry = {
  timestamp: number;
  avgPropagationTime: number | null;
  avgBlockTime: number | null;
  peerCount: number;
  uptime: number | null;
  transactionsInQueue: number;
  blocksProcessed: number;
  bestBlockNumber: number;
  bestBlockHash: string;
};

type NodeInfo = {
  id: number;
  nodeName: string;
  nodeImplementation: string;
  nodeVersion: string;
  address?: string;
  networkID?: string;
  location?: { lat: number; lng: number; city: string };
  lastStartupTime?: number;
  history: NodeTrackingHistoryEntry[];
};

type Schema = {
  nodes: NodeInfo[];
};

const adapter = new FileAsync<Schema>(DB_FILE, {
  defaultValue: {
    nodes: [],
  },
});
const dbPromise = low(adapter);

export { dbPromise, NodeInfo, NodeTrackingHistoryEntry };
