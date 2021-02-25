import { dbPromise } from "./db";
import BN from "bn.js";
import Debug from "debug";
import { BlockDetails, NodeLocation, NodeStats } from "./common/types";
import { Variants } from "./common/feed";

type AvgDataStats = { sum: BN; count: number };

type NodeTrackingStats = {
  blockTimesStats: AvgDataStats;
  propagationTimesStats: AvgDataStats;
  peerCount: number;
  transactionsInQueue: number;
  bestBlockNumber: number;
  bestBlockHash: string;
};

class NodeStatsTracker {
  // Current memory-persisted stats snapshot
  statsByNodeId = new Map<number, NodeTrackingStats>();

  private calcAvgFromStats = (input: AvgDataStats) =>
    input.count ? input.sum.divn(input.count).toNumber() : null;

  public async handleNewNode(payload: Variants.AddedNodeMessage["payload"]) {
    const db = await dbPromise;
    const [
      id,
      nodeDetails,
      nodeStats,
      nodeIO,
      nodeHardware,
      blockDetails,
      location,
      startupTime,
    ] = payload;
    // TODO: Save address and network id?
    const [
      nodeName,
      nodeImplementation,
      nodeVersion,
      optAddress,
      optNetworkId,
    ] = nodeDetails;
    const [peerCount, transactionsInQueue] = nodeStats;
    const [
      blockNumber,
      blockHash,
      miliseconds,
      timestamp,
      optPropagationTime,
    ] = blockDetails;

    // TODO: NodeIO?
    // TODO: NodeHardware?

    if (
      !db
        .get("nodes")
        .find((n) => n.id === id)
        .value()
    ) {
      const debug = Debug("db:new-node");
      debug("Adding new node to db...");
      db.get("nodes")
        .push({
          id,
          nodeName,
          nodeImplementation,
          nodeVersion,
          location: location
            ? { lat: location[0], lng: location[1], city: location[2] }
            : undefined,
          lastStartupTime: startupTime ? startupTime : undefined,
          history: [],
        })
        .write()
        .then(() => debug(`New node added! (${id}:${nodeName})`));
    } else {
      // If already exists - just update name, lastStartupTime and location
      db.get("nodes")
        .find((n) => n.id === id)
        .assign({
          nodeName,
          lastStartupTime: startupTime ? startupTime : undefined,
          location: location
            ? { lat: location[0], lng: location[1], city: location[2] }
            : undefined,
        })
        .write();
    }

    this.statsByNodeId.set(id, {
      blockTimesStats: {
        sum: new BN(miliseconds),
        count: 1,
      },
      propagationTimesStats: {
        sum: optPropagationTime ? new BN(optPropagationTime) : new BN(0),
        count: optPropagationTime ? 1 : 0,
      },
      peerCount,
      transactionsInQueue,
      bestBlockNumber: blockNumber,
      bestBlockHash: blockHash,
    });
  }

  public handleNewBlock(nodeId: number, blockDetails: BlockDetails) {
    const [
      blockNumber,
      blockHash,
      miliseconds,
      timestamp,
      optPropagationTime,
    ] = blockDetails;

    const statsRef = this.statsByNodeId.get(nodeId);
    if (statsRef) {
      statsRef.bestBlockNumber = blockNumber;
      statsRef.bestBlockHash = blockHash;
      statsRef.blockTimesStats.count += 1;
      statsRef.blockTimesStats.sum = statsRef.blockTimesStats.sum.addn(
        miliseconds
      );
      if (typeof optPropagationTime === "number") {
        statsRef.propagationTimesStats.count += 1;
        statsRef.propagationTimesStats.sum = statsRef.propagationTimesStats.sum.addn(
          optPropagationTime
        );
      }
    }
  }

  public handleUpdatedNodeStats(nodeId: number, nodeStats: NodeStats) {
    const [peerCount, transactionsInQueue] = nodeStats;

    const statsRef = this.statsByNodeId.get(nodeId);
    if (statsRef) {
      statsRef.transactionsInQueue = transactionsInQueue;
      statsRef.peerCount = peerCount;
    }
  }

  public async handleUpdatedLocation(nodeId: number, location: NodeLocation) {
    const debug = Debug("db:update-location");
    const [lat, lng, city] = location;
    const db = await dbPromise;

    db.get("nodes")
      .find((n) => n.id === nodeId)
      .assign({
        location: { lat, lng, city },
      })
      .write();

    debug(`Updated node location! ${nodeId} - ${city}`);
  }

  public async saveSnaphot() {
    const db = await dbPromise;
    const debug = Debug("db:tracing-update");
    const timestamp = Date.now();

    debug("Updating nodes tracing stats...");

    await db
      .get("nodes")
      .each((n) => {
        const stats = this.statsByNodeId.get(n.id);
        if (stats) {
          // Reset avg.-related stats
          this.statsByNodeId.set(n.id, {
            ...stats,
            blockTimesStats: { sum: new BN(0), count: 0 },
            propagationTimesStats: { sum: new BN(0), count: 0 },
          });
          // Update database
          const {
            peerCount,
            transactionsInQueue,
            blockTimesStats,
            propagationTimesStats,
            bestBlockNumber,
            bestBlockHash,
          } = stats;
          const avgBlockTime = this.calcAvgFromStats(blockTimesStats);
          const avgPropagationTime = this.calcAvgFromStats(
            propagationTimesStats
          );
          const blocksProcessed = blockTimesStats.count;
          n.history.push({
            timestamp,
            avgBlockTime,
            avgPropagationTime,
            peerCount,
            transactionsInQueue,
            bestBlockNumber,
            bestBlockHash,
            blocksProcessed,
            uptime: n.lastStartupTime ? Date.now() - n.lastStartupTime : null,
          });
        }
      })
      .write();

    debug("Nodes stats updated");
  }
}

const tracker = new NodeStatsTracker();

export { tracker, NodeStatsTracker };
