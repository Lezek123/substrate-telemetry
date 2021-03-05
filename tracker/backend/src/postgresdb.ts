import {
  Sequelize,
  Model,
  DataTypes,
  HasOneSetAssociationMixin,
} from "sequelize";

const PG_USER = process.env.PG_USER || 'telemetry';
const PG_PASS = process.env.PG_PASS || 'telemetry';
const PG_DB = process.env.PG_DB || 'telemetry';
const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = process.env.PG_PORT || 5432;

const db = new Sequelize(
  `postgres://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}`,
  {
    logging: false,
  }
);

type LocationInterface = {
  lat: number | string;
  lng: number | string;
  city: string;
  nodeId?: number;
};

class Location extends Model<LocationInterface> implements LocationInterface {
  public lat: number | string;
  public lng: number | string;
  public city: string;
  public nodeId: number;
}

Location.init(
  {
    lat: DataTypes.DECIMAL,
    lng: DataTypes.DECIMAL,
    city: DataTypes.STRING,
  },
  { sequelize: db, modelName: "location" }
);

type NodeInfo = {
  nodeName: string;
  nodeImplementation: string;
  nodeVersion: string;
  address: string | null;
  networkID: string | null;
  lastStartupTime: number | string | null;
};

class Node extends Model<NodeInfo> implements NodeInfo {
  public id: number;
  public nodeName: string;
  public nodeImplementation: string;
  public nodeVersion: string;
  public address: string | null;
  public networkID: string | null;
  public lastStartupTime: number | string | null;
  public setLocation: HasOneSetAssociationMixin<Location, "number">;
}

Node.init(
  {
    nodeName: DataTypes.STRING,
    nodeImplementation: DataTypes.STRING,
    nodeVersion: DataTypes.STRING,
    address: { type: DataTypes.STRING, allowNull: true },
    networkID: { type: DataTypes.STRING, allowNull: true },
    lastStartupTime: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: true,
      get() {
        const val = this.getDataValue("lastStartupTime");
        return val === null ? null : parseInt(val as string);
      },
    },
  },
  {
    sequelize: db,
    modelName: "node",
    indexes: [{ unique: false, fields: ["nodeName"] }],
  }
);

type NodeHistoryEntryInterface = {
  nodeId?: number;
  timestamp: number | string;
  avgPropagationTime: number | null;
  avgBlockTime: number | null;
  peerCount: number;
  uptime: number | string | null;
  transactionsInQueue: number;
  blocksProcessed: number;
  bestBlockNumber: number;
  bestBlockHash: string;
};

class NodeHistoryEntry
  extends Model<NodeHistoryEntryInterface>
  implements NodeHistoryEntryInterface {
  public nodeId: number;
  public timestamp: number | string;
  public avgPropagationTime: number | null;
  public avgBlockTime: number | null;
  public peerCount: number;
  public uptime: number | string | null;
  public transactionsInQueue: number;
  public blocksProcessed: number;
  public bestBlockNumber: number;
  public bestBlockHash: string;
}

NodeHistoryEntry.init(
  {
    timestamp: {
      type: DataTypes.BIGINT({ unsigned: true }),
      get() {
        return parseInt(this.getDataValue("timestamp") as string);
      },
    },
    avgPropagationTime: { type: DataTypes.INTEGER, allowNull: true },
    avgBlockTime: { type: DataTypes.INTEGER, allowNull: true },
    peerCount: DataTypes.INTEGER,
    uptime: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: true,
      get() {
        const val = this.getDataValue("uptime");
        return val === null ? null : parseInt(val as string);
      },
    },
    transactionsInQueue: DataTypes.INTEGER,
    blocksProcessed: DataTypes.INTEGER,
    bestBlockNumber: DataTypes.INTEGER,
    bestBlockHash: DataTypes.STRING,
  },
  { sequelize: db, modelName: "nodeHistoryEntry" }
);

const NodeLocationRef = Node.hasOne(Location);
Location.belongsTo(Node);
Node.hasMany(NodeHistoryEntry);
NodeHistoryEntry.belongsTo(Node);

export { db, Node, Location, NodeLocationRef, NodeHistoryEntry };
