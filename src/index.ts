import { client as WebSocketClient } from "websocket";
import { FeedMessage } from "./common";
import { ACTIONS } from "./common/feed";
import { tracker } from "./trackingStats";
import Debug from "debug";

const client = new WebSocketClient();
const utf8decoder = new TextDecoder("utf-8");

const WS_URI =
  process.env.WEBSOCKET_URI || "wss://telemetry.joystream.org/feed/";
const CHAIN_NAME = process.env.CHAIN_NAME || "Joystream";
const TRACKING_STATS_INTERVAL_MINUTES = parseInt(process.env.INTERVAL || "5");
const PING_INTERVAL_MS = 30000;

const wsDebug = Debug("websocket");
const pingDebug = wsDebug.extend("ping");
const msgDebug = wsDebug.extend("message");

function main() {
  let currentPingId = 0;
  let currentPingTime = 0;

  client.connect(WS_URI);

  client.on("connectFailed", function (error) {
    wsDebug("Connect Error: " + error.toString());
    process.exit();
  });

  client.on("connect", function (connection) {
    wsDebug("WebSocket Client Connected");

    connection.on("error", function (error) {
      wsDebug("Connection Error: " + error.toString());
      connection.close();
      process.exit();
    });

    connection.on("close", function (code, desc) {
      wsDebug(`Connection Closed! Code: ${code}, Desc: ${desc}`);
      process.exit();
    });

    connection.on("message", function (message) {
      handleMessages(
        FeedMessage.deserialize(
          (utf8decoder.decode(message.binaryData) as any) as FeedMessage.Data
        )
      );
    });

    connection.send(`subscribe:${CHAIN_NAME}`);
    setInterval(() => {
      if (currentPingTime) {
        pingDebug("Expected pong not recieved, exiting...");
        connection.close();
        process.exit();
      }
      connection.send(`ping:${currentPingId}`);
      pingDebug(`Ping ${currentPingId} sent...`);
      currentPingTime = Date.now();
    }, PING_INTERVAL_MS);
  });

  const handleMessages = (messages: FeedMessage.Message[]) => {
    for (const message of messages) {
      switch (message.action) {
        case ACTIONS.FeedVersion: {
          const newVersion = message.payload;
          msgDebug(`FeedVersion message recieved! Version: ${newVersion}`);
          break;
        }

        case ACTIONS.BestBlock: {
          const [best, blockTimestamp, blockAverage] = message.payload;
          msgDebug(
            `New best block: ${best} (ts: ${blockTimestamp}, avg: ${blockAverage})`
          );
          break;
        }

        case ACTIONS.BestFinalized: {
          const [finalized, hash] = message.payload;
          msgDebug(`New best finalized block: ${finalized} (${hash})`);
          break;
        }

        case ACTIONS.AddedNode: {
          tracker.handleNewNode(message.payload);
          break;
        }

        case ACTIONS.RemovedNode: {
          const id = message.payload;
          // Happens when node goes offline
          msgDebug(`Removed node: ${id}`);
          break;
        }

        case ACTIONS.StaleNode: {
          const id = message.payload;
          // Happens when node is online, but stale for some reason
          msgDebug(`Stale node: ${id}`);
          break;
        }

        case ACTIONS.LocatedNode: {
          const [id, ...location] = message.payload;
          msgDebug(`Located node: ${id}`);
          tracker.handleUpdatedLocation(id, location);
          break;
        }

        case ACTIONS.ImportedBlock: {
          const [id, blockDetails] = message.payload;
          // Skip msgDebug here to avoid massive log size

          tracker.handleNewBlock(id, blockDetails);

          break;
        }

        case ACTIONS.FinalizedBlock: {
          const [id, height, hash] = message.payload;

          // Skip msgDebug here to avoid massive log size

          break;
        }

        case ACTIONS.NodeStats: {
          const [id, nodeStats] = message.payload;

          // Skip msgDebug here to avoid massive log size

          tracker.handleUpdatedNodeStats(id, nodeStats);

          break;
        }

        case ACTIONS.NodeHardware: {
          const [id, nodeHardware] = message.payload;

          // Skip msgDebug here to avoid massive log size
          // TODO: Handle?

          break;
        }

        case ACTIONS.NodeIO: {
          const [id, nodeIO] = message.payload;

          // Skip msgDebug here to avoid massive log size
          // TODO: Handle?

          break;
        }

        case ACTIONS.TimeSync: {
          // TODO: Handle?
          break;
        }

        case ACTIONS.AddedChain: {
          // Do nothing
          break;
        }

        case ACTIONS.RemovedChain: {
          // Do nothing
          break;
        }

        case ACTIONS.SubscribedTo: {
          // Do nothing
          break;
        }

        case ACTIONS.UnsubscribedFrom: {
          // Do nothing
          break;
        }

        case ACTIONS.Pong: {
          const pingId = message.payload;

          if (parseInt(pingId) !== currentPingId) {
            pingDebug(`Unexpected pong: ${pingId}, exiting`);
            process.exit();
          }

          pingDebug(
            `...pong recieved, took: ${Date.now() - currentPingTime} ms`
          );
          ++currentPingId;
          currentPingTime = 0;

          break;
        }

        case ACTIONS.AfgFinalized: {
          // Do nothing?
          break;
        }

        case ACTIONS.AfgReceivedPrevote: {
          // Do nothing?
          break;
        }

        case ACTIONS.AfgReceivedPrecommit: {
          // Do nothing?
          break;
        }

        case ACTIONS.AfgAuthoritySet: {
          // Do nothing?
          break;
        }

        default: {
          break;
        }
      }
    }
  };

  setInterval(
    () => tracker.saveSnaphot(),
    TRACKING_STATS_INTERVAL_MINUTES * 60000
  );
}

main();
