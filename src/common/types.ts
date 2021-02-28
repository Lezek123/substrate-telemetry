type AggregationType = "max" | "min" | "bwavg" | "avg";

type NodeShortData = {
  nodeName: string;
};

type NodeFullData = {
  id: number;
  nodeName: string;
  nodeImplementation: string;
  nodeVersion: string;
  location?: { lat: number; lng: number; city: string };
  lastStartupTime?: number;
  history: { [key: string]: any }[]; // Simplified representation to avoid too much TS complexity
};

export type { AggregationType, NodeShortData, NodeFullData };
