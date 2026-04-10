---
applyTo: '**'
---
# xyflow/web - Documentation Monorepo

This monorepo contains the team website and comprehensive documentation for React Flow and Svelte Flow libraries. The project serves as a central hub for xyflow.com (team website), reactflow.dev (React Flow documentation), and svelteflow.dev (Svelte Flow documentation). Built with Turborepo, Next.js, and Nextra, it provides extensive example applications, reusable UI components, and shared packages for building node-based interfaces.

The repository demonstrates best practices for building interactive node-graph applications using React Flow and Svelte Flow. It includes over 80 example applications covering edges, nodes, layouts, interactions, and styling patterns. The monorepo architecture ensures code reusability across multiple documentation sites while maintaining independent deployments for each domain. The example applications showcase real-world implementations of custom nodes, edges, layout algorithms, and advanced features like undo/redo, drag-and-drop, and collaborative editing.

## React Flow - Initialize Basic Flow

Create a basic React Flow instance with nodes, edges, and controls.

```jsx
import React from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  { id: '1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
  { id: '2', data: { label: 'Node 2' }, position: { x: 0, y: 100 } },
];

const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = React.useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}

export default Flow;
```

## Custom Edge with Interactive Button

Build custom edges with interactive elements using EdgeLabelRenderer.

```tsx
import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';

export default function ButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { setEdges } = useReactFlow();

  const onEdgeClick = () => {
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          <button
            onClick={onEdgeClick}
            style={{
              width: 20,
              height: 20,
              background: '#eee',
              border: '1px solid #fff',
              cursor: 'pointer',
              borderRadius: '50%',
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
```

## Custom Node with Dynamic Data

Create custom nodes with interactive controls and dynamic styling.

```jsx
import React, { useState, useEffect } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function ColorSelectorNode({ data }) {
  return (
    <div style={{ padding: 10, border: '1px solid #ddd', borderRadius: 3, background: 'white' }}>
      <div>Color Selector</div>
      <input
        type="color"
        onChange={data.onChange}
        value={data.color}
        style={{ marginTop: 5 }}
      />
    </div>
  );
}

const nodeTypes = {
  selectorNode: ColorSelectorNode,
};

function CustomNodeFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [bgColor, setBgColor] = useState('#c9f1dd');

  useEffect(() => {
    const onChange = (event) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === '2') {
            const color = event.target.value;
            setBgColor(color);
            return { ...node, data: { ...node.data, color } };
          }
          return node;
        })
      );
    };

    setNodes([
      {
        id: '1',
        type: 'input',
        data: { label: 'Input Node' },
        position: { x: 0, y: 50 },
      },
      {
        id: '2',
        type: 'selectorNode',
        data: { onChange, color: bgColor },
        position: { x: 300, y: 50 },
      },
      {
        id: '3',
        type: 'output',
        data: { label: 'Output Node' },
        position: { x: 600, y: 50 },
      },
    ]);

    setEdges([
      { id: 'e1-2', source: '1', target: '2', animated: true },
      { id: 'e2-3', source: '2', target: '3', animated: true },
    ]);
  }, []);

  const onConnect = React.useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        style={{ background: bgColor }}
        fitView
      />
    </div>
  );
}

export default CustomNodeFlow;
```

## Save and Restore Flow State

Persist flow state to localStorage and restore it across sessions.

```jsx
import React, { useState, useCallback } from 'react';
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const flowKey = 'example-flow';

const initialNodes = [
  { id: '1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
  { id: '2', data: { label: 'Node 2' }, position: { x: 0, y: 100 } },
];

const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

function SaveRestore() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [rfInstance, setRfInstance] = useState(null);
  const { setViewport } = useReactFlow();

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onSave = useCallback(() => {
    if (rfInstance) {
      const flow = rfInstance.toObject();
      localStorage.setItem(flowKey, JSON.stringify(flow));
      console.log('Flow saved:', flow);
    }
  }, [rfInstance]);

  const onRestore = useCallback(() => {
    const flow = JSON.parse(localStorage.getItem(flowKey));
    if (flow) {
      const { x = 0, y = 0, zoom = 1 } = flow.viewport;
      setNodes(flow.nodes || []);
      setEdges(flow.edges || []);
      setViewport({ x, y, zoom });
      console.log('Flow restored:', flow);
    }
  }, [setNodes, setEdges, setViewport]);

  const onAdd = useCallback(() => {
    const newNode = {
      id: `node_${+new Date()}`,
      data: { label: 'Added node' },
      position: {
        x: Math.random() * 400 - 200,
        y: Math.random() * 400 - 200,
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onInit={setRfInstance}
      fitView
    >
      <Background />
      <Panel position="top-right">
        <button onClick={onSave} style={{ marginRight: 5 }}>Save</button>
        <button onClick={onRestore} style={{ marginRight: 5 }}>Restore</button>
        <button onClick={onAdd}>Add Node</button>
      </Panel>
    </ReactFlow>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <div style={{ width: '100vw', height: '100vh' }}>
        <SaveRestore />
      </div>
    </ReactFlowProvider>
  );
}
```

## Automatic Layout with Dagre

Apply automatic graph layout using the Dagre algorithm.

```tsx
import React, { useCallback } from 'react';
import {
  Background,
  ReactFlow,
  addEdge,
  ConnectionLineType,
  Panel,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

const nodeWidth = 172;
const nodeHeight = 36;

const initialNodes = [
  { id: '1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
  { id: '2', data: { label: 'Node 2' }, position: { x: 0, y: 0 } },
  { id: '3', data: { label: 'Node 3' }, position: { x: 0, y: 0 } },
  { id: '4', data: { label: 'Node 4' }, position: { x: 0, y: 0 } },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e1-3', source: '1', target: '3' },
  { id: 'e2-4', source: '2', target: '4' },
  { id: 'e3-4', source: '3', target: '4' },
];

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
  initialNodes,
  initialEdges
);

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge({ ...params, type: ConnectionLineType.SmoothStep, animated: true }, eds)
      ),
    [setEdges]
  );

  const onLayout = useCallback(
    (direction) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        direction
      );
      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
    },
    [nodes, edges, setNodes, setEdges]
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
      >
        <Panel position="top-right">
          <button onClick={() => onLayout('TB')} style={{ marginRight: 5 }}>
            Vertical Layout
          </button>
          <button onClick={() => onLayout('LR')}>Horizontal Layout</button>
        </Panel>
        <Background />
      </ReactFlow>
    </div>
  );
}

export default Flow;
```

## Svelte Flow - Basic Implementation

Implement a node graph using Svelte Flow with custom nodes and edges.

```svelte
<script lang="ts">
  import {
    SvelteFlow,
    Background,
    ConnectionMode,
    Controls,
    type Node,
    type Edge,
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  import ButtonEdge from './ButtonEdge.svelte';
  import BiDirectionalNode from './BiDirectionalNode.svelte';

  let nodes = $state.raw<Node[]>([
    {
      id: '1',
      type: 'input',
      data: { label: 'Input Node' },
      position: { x: 0, y: 0 },
    },
    {
      id: '2',
      type: 'bidirectional',
      data: { label: 'Custom Node' },
      position: { x: 250, y: 0 },
    },
    {
      id: '3',
      type: 'output',
      data: { label: 'Output Node' },
      position: { x: 500, y: 0 },
    },
  ]);

  let edges = $state.raw<Edge[]>([
    {
      id: 'e1-2',
      source: '1',
      target: '2',
      type: 'buttonedge',
    },
    {
      id: 'e2-3',
      source: '2',
      target: '3',
      animated: true,
    },
  ]);

  const nodeTypes = {
    bidirectional: BiDirectionalNode,
  };

  const edgeTypes = {
    buttonedge: ButtonEdge,
  };
</script>

<div style="width: 100vw; height: 100vh;">
  <SvelteFlow
    bind:nodes
    {nodeTypes}
    bind:edges
    {edgeTypes}
    connectionMode={ConnectionMode.Loose}
    fitView
  >
    <Controls />
    <Background />
  </SvelteFlow>
</div>
```

## Monorepo Development Setup

Run the complete development environment or individual sites.

```bash
# Install all dependencies
pnpm install

# Run all sites and apps
pnpm run dev

# Run documentation sites only
pnpm run dev:docs

# Run specific site
pnpm run dev:reactflow.dev
pnpm run dev:svelteflow.dev
pnpm run dev:xyflow.com

# Build all projects
pnpm run build

# Lint all code
pnpm run lint

# Format all code
pnpm run format

# Clean all build artifacts
pnpm run clean
```

## Turborepo Build Configuration

Configure Turborepo tasks with dependencies and caching.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "globalEnv": [
    "NODE_ENV",
    "NEXT_PUBLIC_*",
    "NOTION_API_SECRET",
    "VERCEL_ENV"
  ],
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [
        ".next/**",
        "!.next/cache/**",
        ".svelte-kit/**",
        "public/**"
      ],
      "inputs": [
        "$TURBO_DEFAULT$",
        ".env.production.local",
        ".env.local",
        ".env"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "inputs": [
        "$TURBO_DEFAULT$",
        ".env.development.local",
        ".env.local",
        ".env"
      ]
    }
  }
}
```

## Summary

The xyflow/web monorepo serves as a comprehensive resource for developers building node-based interfaces with React Flow and Svelte Flow. Primary use cases include referencing example implementations for custom nodes and edges, learning layout algorithms and interaction patterns, understanding state management and persistence strategies, and exploring advanced features like collaborative editing and whiteboard functionality. The monorepo demonstrates production-ready patterns for integrating these libraries into real applications.

The project's integration patterns showcase best practices for monorepo architecture with Turborepo, Next.js site deployment, and shared component libraries. Developers can leverage the example applications as starting points for their own implementations, copy UI components from the components registry, and reference the documentation sites' source code for advanced Next.js and Nextra patterns. The codebase emphasizes type safety with TypeScript, component reusability through workspace packages, and efficient development workflows with hot module replacement across multiple sites.
