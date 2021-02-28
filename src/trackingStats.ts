import { dbPromise } from "./db";
import BN from "bn.js";
import Debug from "debug";
import { BlockDetails, NodeLocation, NodeStats } from "./common/types";
import { Variants } from "./common/feed";

type AvgDataStats = { sum: BN; count: number };

type NodeTrackingStats = {
  dbId: number;
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
  // nodeDbIdByNodeId = new Map<number, number>();
  nextDbId = 0;

  private calcAvgFromStats = (input: AvgDataStats) =>
    input.count ? input.sum.divn(input.count).toNumber() : null;

  public async init() {
    this.nextDbId = ((await dbPromise).get('nodes').last().value()?.id || 0) + 1
  }

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

    const debug = Debug("db:new-node");
    const dbId = this.nextDbId++;
    const nodeDataStr = JSON.stringify({ wsId: id, nodeName, dbId })

    debug(`Adding new node to db (${nodeDataStr})...`);
    void await db.get("nodes")
      .push({
        id: dbId,
        nodeName,
        nodeImplementation,
        nodeVersion,
        address: optAddress || undefined,
        networkID: optNetworkId || undefined,
        location: location
          ? { lat: location[0], lng: location[1], city: location[2] }
          : undefined,
        lastStartupTime: startupTime ? startupTime : undefined,
        history: [],
      })
      .write();

    debug(`New node added! (${nodeDataStr})`)
    this.statsByNodeId.set(id, {
      dbId,
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

  public async handleUpdatedLocation(nodeId: number, location: NodeLocation, postopned = false) {
    const debug = Debug("db:update-location");
    const [lat, lng, city] = location;
    const db = await dbPromise;

    const nodeDbId = this.statsByNodeId.get(nodeId)?.dbId

    if (nodeDbId) {
      db.get("nodes")
        .find((n) => n.id === nodeDbId)
        .assign({
          location: { lat, lng, city },
        })
        .write()
        .then(() => { debug(`Updated node location! ${nodeId}/${nodeDbId} - ${city}`); });
    } else if (!postopned) {
      debug('Node not yet found in db... Postponing 10 sec...')
      setTimeout(() => this.handleUpdatedLocation(nodeId, location, true), 10000)
    } else {
      debug('Postponed location update failed! Node still not in db...')
    }
  }

  public handleRemovedNode(nodeId: number) {
    this.statsByNodeId.delete(nodeId)
  }

  public async saveSnaphot() {
    const db = await dbPromise;
    const debug = Debug("db:tracing-update");
    const timestamp = Date.now();
    const statsEntries = Array.from(this.statsByNodeId.entries());

    debug("Updating nodes tracing stats...");

    for (const [nodeId, stats] of statsEntries) {
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
      const nodeToUpdate = db.get('nodes').find(n => n.id === stats.dbId).value()
      nodeToUpdate.history.push({
        timestamp,
        avgBlockTime,
        avgPropagationTime,
        peerCount,
        transactionsInQueue,
        bestBlockNumber,
        bestBlockHash,
        blocksProcessed,
        uptime: nodeToUpdate.lastStartupTime ? timestamp - nodeToUpdate.lastStartupTime : null,
      })
      // Reset avg.-related stats
      this.statsByNodeId.set(nodeId, {
        ...stats,
        blockTimesStats: { sum: new BN(0), count: 0 },
        propagationTimesStats: { sum: new BN(0), count: 0 },
      });
    }

    await db.write()

    debug("Nodes stats updated");
  }
}

const tracker = new NodeStatsTracker();

export { tracker, NodeStatsTracker };
