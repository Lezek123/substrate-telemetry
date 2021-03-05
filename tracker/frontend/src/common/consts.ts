import moment from "moment";

const chartableProps: {
  [dataKey: string]: { name: string; formatter?: (val: number) => any };
} = {
  avgPropagationTime: { name: "Avg. propagation time" },
  avgBlockTime: { name: "Avg. block time" },
  peerCount: { name: "Peer count" },
  transactionsInQueue: { name: "Transactions in queue" },
  blocksProcessed: { name: "Blocks processed" },
  bestBlockNumber: { name: "Best block number" },
  uptime: {
    name: "Uptime",
    formatter: (ms: number) => {
      const dur = moment.duration(ms, "milliseconds");
      return (
        `${Math.round(dur.asMinutes())} minutes` +
        (dur.asMinutes() > 60
          ? ` (~${moment.duration(ms, "milliseconds").humanize()})`
          : "")
      );
    },
  },
};

export { chartableProps };
