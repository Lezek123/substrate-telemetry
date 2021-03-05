```
yarn
yarn start:indexer
yarn start:api
```
By default those are started as pm2 processes with auto-restart enabled.

Logs are outputted to `./indexer.log` and `./api.log`.

LowDB database is kept in `/db.json`

Endpoints exposed by `api`:
- `http://localhost:5000/nodes` - list of known nodes (name + id)
- `http://localhost:5000/node/{id}` - all available information about a node

To stop you can use:

```
yarn stop:indexer
yarn stop:api
```

### Snapshots (`node.history`)
The indexer takes "snapshots" of stats for each node every `x` minutes. This data includes:
- `timestamp` - snapshot timestamp (server `Date.now()`)
- `avgPropagationTime` - average propagation time for current period
- `avgBlockTime` - average block time for current period
- `peerCount` - peer count (at snapshot time)
- `uptime` - `lastStartupTime` - `Date.now()` (at snaphost time)
- `transactionsInQueue` - number of transactions in queue (at snapshot time) 
- `blocksProcessed` - number of blocks processed in current period
- `bestBlockNumber` - best block number (at snapshot time)
- `bestBlockHash` - best block hash (at snapshot time)

### Indexer configuration
Configurable `env` values:
- `WEBSOCKET_URI` - defaults to `wss://telemetry.joystream.org/feed/`
- `CHAIN_NAME` - defaults to `Joystream`
- `INTERVAL` - snapshots interval in minutes. Defaults to `5`

### Api configuration

- `API_PORT` - defaults to `5000`