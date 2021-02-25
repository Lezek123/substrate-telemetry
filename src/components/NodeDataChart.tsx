import React from "react";
import { NodeFullData, AggregationType } from "../common/types";
import { chartableProps } from "../common/consts";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import dateFormat from "dateformat";
import sha256 from "sha256";
import _ from "lodash";

type IsolatedChartData = {
  timestamp: number;
  [nodeName: string]: number;
};

type AggregationData = {
  [timestamp: number]: {
    [nodeName: string]: {
      value: number;
      totalWeight: number;
    };
  };
};

type Props = {
  nodesData: NodeFullData[];
  dataKey: string;
  beginTs?: number;
  endTs?: number;
  aggregation?: number;
  aggregationType?: AggregationType;
};

const NodeDataChart: React.FC<Props> = ({
  nodesData,
  dataKey,
  beginTs,
  endTs,
  aggregation = 1,
  aggregationType,
}) => {
  const getChartData = (): [IsolatedChartData[], number, number] => {
    const isolatedData: IsolatedChartData[] = [];

    if (!dataKey || !nodesData.length) {
      return [[], 0, 0];
    }

    let aggregationData: AggregationData = {};

    nodesData.forEach(({ history, nodeName }) => {
      history.forEach(({ timestamp, [dataKey]: value, blocksProcessed }) => {
        const aggregationPeriodTs =
          Math.round(timestamp / (aggregation * 60 * 1000)) *
          (aggregation * 60 * 1000);
        if (
          (beginTs && aggregationPeriodTs < beginTs) ||
          (endTs && aggregationPeriodTs > endTs)
        ) {
          return;
        }
        // Update aggregationData
        if (!aggregationData[aggregationPeriodTs]) {
          aggregationData[aggregationPeriodTs] = {};
        }
        if (!aggregationData[aggregationPeriodTs][nodeName]) {
          aggregationData[aggregationPeriodTs][nodeName] = {
            totalWeight: aggregationType === "bwavg" ? blocksProcessed : 1,
            value,
          };
        } else {
          const nodeAggregationData =
            aggregationData[aggregationPeriodTs][nodeName];
          if (aggregationType === "avg" || aggregationType === "bwavg") {
            const datapointWeight =
              aggregationType === "bwavg" ? blocksProcessed : 1;
            const currentTotalWeight = nodeAggregationData.totalWeight;
            nodeAggregationData.value =
              (nodeAggregationData.value * currentTotalWeight +
                value * datapointWeight) /
              (currentTotalWeight + datapointWeight);
            nodeAggregationData.totalWeight += datapointWeight;
          }
          if (aggregationType === "min") {
            nodeAggregationData.value =
              value < nodeAggregationData.value
                ? value
                : nodeAggregationData.value;
          }
          if (aggregationType === "max") {
            nodeAggregationData.value =
              value > nodeAggregationData.value
                ? value
                : nodeAggregationData.value;
          }
        }
      });
    });

    // Convert aggregationData to isolated chart data and get dataMin and dataMax
    let dataMin = Number.MAX_SAFE_INTEGER, dataMax = Number.MIN_SAFE_INTEGER;
    for (const [timestamp, data] of Object.entries(aggregationData)) {
      isolatedData.push({
        timestamp: parseInt(timestamp),
        ..._.mapValues(data, ({ value }) => {
          if (value !== null && value < dataMin) {
            dataMin = value;
          }
          if (value > dataMax) {
            dataMax = value;
          }
          return value;
        }),
      });
    }

    // Calculate domain
    const domainMin = Math.floor(
      dataMin - 0.2 * (dataMax - dataMin) < 0
        ? 0
        : dataMin - 0.2 * (dataMax - dataMin)
    );
    const domainMax = Math.ceil(dataMax + 0.2 * (dataMax - dataMin));

    return [isolatedData, domainMin, domainMax];
  };

  const [data, domainMin, domainMax] = getChartData();

  const nodeNameToColor = (nodeName: string) => {
    return `#${sha256(Buffer.from(nodeName)).slice(2, 8)}`;
  };

  return (
    <div style={{ height: "500px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          width={500}
          height={300}
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(timestamp) =>
              dateFormat(timestamp, "HH:MM dd-mm-yy")
            }
          />
          <YAxis domain={[domainMin, domainMax]} />
          <Tooltip
            labelFormatter={(ts) => dateFormat(ts, "HH:MM dd-mm-yy")}
            formatter={chartableProps[dataKey].formatter}
          />
          <Legend />
          {nodesData.map(({ nodeName }) => (
            <Line
              type="linear"
              stroke={nodeNameToColor(nodeName)}
              dataKey={nodeName}
              activeDot={{ r: 8 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export { NodeDataChart };
