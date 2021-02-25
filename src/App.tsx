import React, { useState } from "react";
import { NodeSelect, NodeDataChart } from "./components";
import { NodeFullData, AggregationType } from "./common/types";
import { chartableProps } from "./common/consts";
import dateFormat from "dateformat";
import { Button, Dropdown, Form, Header, Icon, Table } from "semantic-ui-react";
import DateTime from "react-datetime";
import "semantic-ui-css/semantic.min.css";
import "react-datetime/css/react-datetime.css";

type NodeCollectionElement = {
  key: number;
  data?: NodeFullData;
};

function App() {
  const [nodesCollection, setNodesCollection] = useState<
    NodeCollectionElement[]
  >([{ key: Date.now() }]);
  const [selectedDataKey, setSelectedDataKey] = useState<string>();
  const [beginTs, setBeginTs] = useState<number>();
  const [endTs, setEndTs] = useState<number>();
  const [aggregation, setAggragation] = useState<number>();
  const [aggregationType, setAggregationType] = useState<AggregationType>();

  const updateSelectedNodeData = (key: number, data: NodeFullData) =>
    setNodesCollection((collection) =>
      collection.map((n) => (n.key === key ? { ...n, data } : { ...n }))
    );

  const addNode = () =>
    setNodesCollection((collection) => [...collection, { key: Date.now() }]);
  const removeNode = (key: number) =>
    setNodesCollection((collection) => collection.filter((n) => n.key !== key));

  return (
    <div className="App" style={{ margin: "5vh 5vw" }}>
      <div>
        <Header as="h1">Nodes</Header>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
          {nodesCollection.map(({ key, data }) => (
            <div
              style={{
                padding: "1em",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
              }}
            >
              <NodeSelect
                onData={(data) => updateSelectedNodeData(key, data)}
              />
              {data && (
                <Table definition size="small" compact>
                  <Table.Body>
                    <Table.Row>
                      <Table.Cell>Name</Table.Cell>
                      <Table.Cell>{data.nodeName}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Implementation:</Table.Cell>{" "}
                      <Table.Cell>{data.nodeImplementation}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Version:</Table.Cell>{" "}
                      <Table.Cell>{data.nodeVersion}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Current location:</Table.Cell>
                      <Table.Cell>
                        {data.location
                          ? `${data.location.city} (Lat: ${data.location.lat}, Lon: ${data.location.lng})`
                          : "Unknown"}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Last startup:</Table.Cell>
                      <Table.Cell>
                        {data.lastStartupTime
                          ? dateFormat(data.lastStartupTime)
                          : "Unknown"}
                      </Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table>
              )}
              <div style={{ marginTop: "1em" }}>
                <Button
                  color="red"
                  onClick={() => removeNode(key)}
                  icon="trash"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60px",
        }}
      >
        <Button color="green" size="big" onClick={() => addNode()} icon="plus">
          <Icon name="plus" />
          Add node
        </Button>
      </div>

      <div style={{ marginTop: "1em" }}>
        <Form>
          <Form.Group widths="equal">
            <Form.Field>
              <label>Date from</label>
              <DateTime
                value={beginTs ? new Date(beginTs) : undefined}
                onChange={(value) =>
                  typeof value === "object" && setBeginTs(value.valueOf())
                }
              />
            </Form.Field>
            <Form.Field>
              <label>Date to</label>
              <DateTime
                value={endTs ? new Date(endTs) : undefined}
                onChange={(value) =>
                  typeof value === "object" && setEndTs(value.valueOf())
                }
              />
            </Form.Field>
            <Form.Field>
              <label>Aggregation</label>
              <Dropdown
                defaultValue={10}
                value={aggregation}
                onChange={(e, data) => setAggragation(data.value as number)}
                options={[
                  { text: "1m", value: 1 },
                  { text: "5m", value: 5 },
                  { text: "15m", value: 15 },
                  { text: "30m", value: 30 },
                  { text: "1h", value: 60 },
                  { text: "2h", value: 120 },
                  { text: "4h", value: 240 },
                ]}
                fluid
                selection
              />
            </Form.Field>
            <Form.Field>
              <label>Aggregation type</label>
              <Dropdown
                defaultValue={10}
                value={aggregationType}
                onChange={(e, data) =>
                  setAggregationType(data.value as AggregationType)
                }
                options={[
                  { text: "Block-weighted average", value: "bwavg" },
                  { text: "Average", value: "avg" },
                  { text: "Max", value: "max" },
                  { text: "Min", value: "min" },
                ]}
                fluid
                selection
              />
            </Form.Field>
            <Form.Field>
              <label>Property</label>
              <Dropdown
                value={selectedDataKey}
                onChange={(e, data) => setSelectedDataKey(data.value as string)}
                options={Object.keys(chartableProps).map((key) => ({
                  value: key,
                  text: chartableProps[key as keyof typeof chartableProps].name,
                }))}
                fluid
                selection
              />
            </Form.Field>
          </Form.Group>
        </Form>
        {selectedDataKey && (
          <NodeDataChart
            dataKey={selectedDataKey}
            nodesData={
              nodesCollection
                .map(({ data }) => data)
                .filter((data) => data) as NodeFullData[]
            }
            beginTs={beginTs}
            endTs={endTs}
            aggregation={aggregation}
            aggregationType={aggregationType}
          />
        )}
      </div>
    </div>
  );
}

export default App;
