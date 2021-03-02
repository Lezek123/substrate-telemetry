import {
  db,
  Node,
  Location,
  NodeLocationRef,
  NodeHistoryEntry,
} from "./postgresdb";
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

  private calcAvgFromStats = (input: AvgDataStats) =>
    input.count ? input.sum.divn(input.count).toNumber() : null;

  public async init() {
    await db.sync();
  }

  public async handleNewNode(payload: Variants.AddedNodeMessage["payload"]) {
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

    debug(`Adding new node to db (wsId: ${id}, name: ${nodeName})...`);

    const node = Node.build(
      {
        nodeName,
        nodeImplementation,
        nodeVersion,
        address: optAddress || null,
        networkID: optNetworkId || null,
        lastStartupTime: startupTime ? startupTime : null,
      },
      { include: { association: NodeLocationRef } }
    );

    await node.save();

    if (location) {
      await Location.create({
        lat: location[0],
        lng: location[1],
        city: location[2],
        nodeId: node.id,
      });
    }

    debug(
      `New node succesfully added! (wsId: ${id}, name: ${nodeName}, dbId: ${node.id})`
    );

    this.statsByNodeId.set(id, {
      dbId: node.id,
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

  public async handleUpdatedLocation(
    nodeId: number,
    location: NodeLocation,
    postopnedCount = 0
  ) {
    const debug = Debug("db:update-location");
    const [lat, lng, city] = location;

    const nodeDbId = this.statsByNodeId.get(nodeId)?.dbId;

    if (nodeDbId) {
      const location = await Location.findOne({ where: { nodeId: nodeDbId } });
      if (location) {
        location.lat = lat;
        location.lng = lng;
        location.city = city;
        await location.save();
        debug(`Updated node location! ${nodeId}/${nodeDbId} - ${city}`);
      } else {
        await Location.create({ lat, lng, city, nodeId: nodeDbId });
        debug(`Set node location! ${nodeId}/${nodeDbId} - ${city}`);
      }
    } else if (postopnedCount < 10) {
      debug("Node not yet found in db... Postponing 1 sec...");
      setTimeout(
        () => this.handleUpdatedLocation(nodeId, location, ++postopnedCount),
        1000
      );
    } else {
      debug(
        `Postponed location update failed 10 times in a row for nodeId ${nodeId}... Failed to establish node dbId.`
      );
    }
  }

  public handleRemovedNode(nodeId: number) {
    this.statsByNodeId.delete(nodeId);
  }

  public async saveSnaphot() {
    const debug = Debug("db:tracing-update");
    const timestamp = Date.now();
    const statsEntries = Array.from(this.statsByNodeId.entries());
    // Can now safely reset blockTimeStats and propagationTimeStats in the map
    // (preparing for the next snapshot)
    this.statsByNodeId.forEach((stats, nodeId, thisMap) => {
      thisMap.set(nodeId, {
        ...stats,
        blockTimesStats: { sum: new BN(0), count: 0 },
        propagationTimesStats: { sum: new BN(0), count: 0 },
      });
    });

    debug("Updating nodes tracing stats...");

    for (const [nodeId, stats] of statsEntries) {
      const {
        dbId,
        peerCount,
        transactionsInQueue,
        blockTimesStats,
        propagationTimesStats,
        bestBlockNumber,
        bestBlockHash,
      } = stats;
      const avgBlockTime = this.calcAvgFromStats(blockTimesStats);
      const avgPropagationTime = this.calcAvgFromStats(propagationTimesStats);
      const blocksProcessed = blockTimesStats.count;
      const node = await Node.findByPk(dbId);
      await NodeHistoryEntry.create({
        nodeId: stats.dbId,
        timestamp,
        avgBlockTime,
        avgPropagationTime,
        peerCount,
        transactionsInQueue,
        bestBlockNumber,
        bestBlockHash,
        blocksProcessed,
        uptime: node?.lastStartupTime
          ? timestamp - Number(node.lastStartupTime)
          : null,
      });
    }

    debug("Nodes stats updated");
  }
}

const tracker = new NodeStatsTracker();

export { tracker, NodeStatsTracker };
