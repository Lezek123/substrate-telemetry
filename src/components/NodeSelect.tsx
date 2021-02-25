import React, { useState, useEffect } from "react";
import { Dropdown } from "semantic-ui-react";
import axios from "axios";
import { NodeFullData, NodeShortData } from "../common/types";

type Props = {
  onData: (data: NodeFullData) => any;
};

const NodeSelect: React.FC<Props> = ({ onData }) => {
  const handleChange = (nodeId: number) => {
    axios
      .get<NodeFullData>(`/node/${nodeId}`)
      .then(({ data }) => {
        onData(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    console.log("Fetching available nodes...");
    axios
      .get<NodeShortData[]>("/nodes")
      .then(({ data }) => {
        setNodes(data);
      })
      .catch(console.error);
  }, []);

  const [nodes, setNodes] = useState<NodeShortData[]>([]);

  return (
    <Dropdown
      placeholder="Choose a node"
      onChange={(e, data) => {
        handleChange(data.value as number);
      }}
      options={nodes.map(({ id, nodeName }) => ({
        value: id,
        text: `${nodeName} (${id})`,
      }))}
      fluid
      search
      selection
    />
  );
};

export { NodeSelect };
