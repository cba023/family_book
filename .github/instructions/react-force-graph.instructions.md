### React Force Graph VR Initialization and Rendering

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/curved-links/index.html

This snippet shows the complete setup for rendering a force-directed graph using React and the react-force-graph-vr library. It includes importing dependencies, defining graph data, and mounting the component to the DOM.

```javascript
import ForceGraphVR from 'https://esm.sh/react-force-graph-vr?external=react';
import React from 'react';
import { createRoot } from 'react-dom';

const gData = {
  nodes: [...Array(14).keys()].map(i => ({ id: i })),
  links: [
    { source: 0, target: 1, curvature: 0, rotation: 0 },
    { source: 0, target: 1, curvature: 0.8, rotation: 0 },
    { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 1 / 6 },
    { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 2 / 6 },
    { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 3 / 6 },
    { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 4 / 6 },
    { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 5 / 6 },
    { source: 0, target: 1, curvature: 0.8, rotation: Math.PI },
    { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 7 / 6 },
    { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 8 / 6 },
    { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 9 / 6 },
    { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 10 / 6 },
    { source: 0, target: 1, curvature: 0.8, rotation: Math.PI * 11 / 6 },
    { source: 2, target: 3, curvature: 0.4, rotation: 0 },
    { source: 3, target: 2, curvature: 0.4, rotation: Math.PI / 2 },
    { source: 2, target: 3, curvature: 0.4, rotation: Math.PI },
    { source: 3, target: 2, curvature: 0.4, rotation: -Math.PI / 2 },
    { source: 4, target: 4, curvature: 0.3, rotation: 0 },
    { source: 4, target: 4, curvature: 0.3, rotation: Math.PI * 2 / 3 },
    { source: 4, target: 4, curvature: 0.3, rotation: Math.PI * 4 / 3 },
    { source: 5, target: 6, curvature: 0, rotation: 0 },
    { source: 5, target: 5, curvature: 0.5, rotation: 0 },
    { source: 6, target: 6, curvature: -0.5, rotation: 0 },
    { source: 7, target: 8, curvature: 0.2, rotation: 0 },
    { source: 8, target: 9, curvature: 0.5, rotation: 0 },
    { source: 9, target: 10, curvature: 0.7, rotation: 0 },
    { source: 10, target: 11, curvature: 1, rotation: 0 },
    { source: 11, target: 12, curvature: 2, rotation: 0 },
    { source: 12, target: 7, curvature: 4, rotation: 0 },
    { source: 13, target: 13, curvature: 0.1, rotation: 0 },
    { source: 13, target: 13, curvature: 0.2, rotation: 0 },
    { source: 13, target: 13, curvature: 0.5, rotation: 0 },
    { source: 13, target: 13, curvature: 0.7, rotation: 0 },
    { source: 13, target: 13, curvature: 1, rotation: 0 }
  ]
};

createRoot(document.getElementById('graph')).render(
  <ForceGraphVR 
    graphData={gData}
    linkCurvature="curvature"
    linkCurveRotation="rotation"
    linkDirectionalParticles={2}
  />
);

```

--------------------------------

### React Force Graph 2D Initialization and Rendering

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/fit-to-canvas/index.html

Initializes and renders a 2D force-directed graph using the react-force-graph-2d library. It utilizes React hooks for managing the graph instance and includes an example of an event handler that zooms to fit the graph when the simulation stops.

```javascript
import ForceGraph2D from 'https://esm.sh/react-force-graph-2d?external=react';
import React, { useRef } from 'react';
import { createRoot } from 'react-dom';
import { genRandomTree } from '../datasets/random-data.js';

const data = genRandomTree();

const Graph = () => {
  const fgRef = useRef();

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={data}
      cooldownTicks={100}
      onEngineStop={() => fgRef.current.zoomToFit(400)}
    />
  );
};

createRoot(document.getElementById('graph'))
  .render(<Graph />);
```

--------------------------------

### React Force Graph VR Setup and Rendering

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/custom-node-shape/index-three.html

This snippet shows how to set up a React application to render a force-directed graph using react-force-graph-vr. It imports necessary libraries like React, ReactDOM, and ForceGraphVR, and uses createRoot to render the graph component. The graph is populated with random tree data and features custom node objects defined with Three.js geometries and materials.

```javascript
import ForceGraphVR from 'https://esm.sh/react-force-graph-vr?external=react';
import React from 'react';
import { createRoot } from 'react-dom';
import * as THREE from 'https://esm.sh/three';
import { genRandomTree } from '../datasets/random-data.js';

createRoot(document.getElementById('graph')).render(
  <ForceGraphVR graphData={genRandomTree(100)}
    nodeThreeObject={({ id }) => new THREE.Mesh(
      [
        new THREE.BoxGeometry(Math.random() * 20, Math.random() * 20, Math.random() * 20),
        new THREE.ConeGeometry(Math.random() * 10, Math.random() * 20),
        new THREE.CylinderGeometry(Math.random() * 10, Math.random() * 10, Math.random() * 20),
        new THREE.DodecahedronGeometry(Math.random() * 10),
        new THREE.SphereGeometry(Math.random() * 10),
        new THREE.TorusGeometry(Math.random() * 10, Math.random() * 2),
        new THREE.TorusKnotGeometry(Math.random() * 10, Math.random() * 2)
      ][id % 7],
      new THREE.MeshLambertMaterial({
        color: Math.round(Math.random() * Math.pow(2, 24)),
        transparent: true,
        opacity: 0.75
      })
    )}
  />
);
```

--------------------------------

### React Force Graph 3D Initialization and Rendering

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/auto-colored/index.html

Initializes and renders a 3D force-directed graph using react-force-graph. It imports necessary modules, generates random tree data, and configures node/link auto-coloring. Ensure React and react-dom are available.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-force-graph-3d?external=react';
import React from 'react';
import { createRoot } from 'react-dom';
import { genRandomTree } from '../datasets/random-data.js';

const GROUPS = 12;
const gData = genRandomTree();

createRoot(document.getElementById('graph')).render(
  <ForceGraph3D
    graphData={gData}
    nodeAutoColorBy={d => d.id%GROUPS}
    linkAutoColorBy={d => gData.nodes[d.source].id%GROUPS}
    linkWidth={2}
  />
);
```

--------------------------------

### Render Force Graph Component (JSX)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

A basic example of how to render a Force Graph component in JSX, passing graph data as a prop.

```jsx
<ForceGraph3D
  graphData={myData}
/>
```

--------------------------------

### Graph Rendering Initialization (React DOM)

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/expandable-nodes/index.html

Initializes the React application by rendering the ExpandableGraph component into a DOM element. It uses `createRoot` from `react-dom` and generates random tree data using `genRandomTree`.

```javascript
import { createRoot } from 'react-dom';
import { genRandomTree } from '../datasets/random-data.js';
import ExpandableGraph from './ExpandableGraph'; // Assuming ExpandableGraph is in a separate file

createRoot(document.getElementById('graph')).render(
  <ExpandableGraph graphData={genRandomTree(600, true)}/>
);

```

--------------------------------

### React Force Graph 2D with Hover Highlighting

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/highlight/index.html

Implements a force-directed graph using react-force-graph-2d. It highlights nodes and their neighbors, as well as links connected to hovered elements. Includes custom node painting for visual feedback.

```javascript
import ForceGraph2D from 'https://esm.sh/react-force-graph-2d?external=react';
import React, { useMemo, useState, useCallback } from 'react';
import { createRoot } from 'react-dom';
import { genRandomTree } from '../datasets/random-data.js';

const NODE_R = 8;

const HighlightGraph = () => {
  const data = useMemo(() => {
    const gData = genRandomTree(80);
    // cross-link node objects
    gData.links.forEach(link => {
      const a = gData.nodes[link.source];
      const b = gData.nodes[link.target];
      !a.neighbors && (a.neighbors = []);
      !b.neighbors && (b.neighbors = []);
      a.neighbors.push(b);
      b.neighbors.push(a);
      !a.links && (a.links = []);
      !b.links && (b.links = []);
      a.links.push(link);
      b.links.push(link);
    });
    return gData;
  }, []);

  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState(null);

  const updateHighlight = () => {
    setHighlightNodes(highlightNodes);
    setHighlightLinks(highlightLinks);
  };

  const handleNodeHover = node => {
    highlightNodes.clear();
    highlightLinks.clear();

    if (node) {
      highlightNodes.add(node);
      node.neighbors.forEach(neighbor => highlightNodes.add(neighbor));
      node.links.forEach(link => highlightLinks.add(link));
    }

    setHoverNode(node || null);
    updateHighlight();
  };

  const handleLinkHover = link => {
    highlightNodes.clear();
    highlightLinks.clear();

    if (link) {
      highlightLinks.add(link);
      highlightNodes.add(link.source);
      highlightNodes.add(link.target);
    }

    updateHighlight();
  };

  const paintRing = useCallback((node, ctx) => {
    // add ring just for highlighted nodes
    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_R * 1.4, 0, 2 * Math.PI, false);
    ctx.fillStyle = node === hoverNode ? 'red' : 'orange';
    ctx.fill();
  }, [hoverNode]);

  return (
    <ForceGraph2D
      graphData={data}
      nodeRelSize={NODE_R}
      autoPauseRedraw={false}
      linkWidth={link => highlightLinks.has(link) ? 5 : 1}
      linkDirectionalParticles={4}
      linkDirectionalParticleWidth={link => highlightLinks.has(link) ? 4 : 0}
      nodeCanvasObjectMode={node => highlightNodes.has(node) ? 'before' : undefined}
      nodeCanvasObject={paintRing}
      onNodeHover={handleNodeHover}
      onLinkHover={handleLinkHover}
    />
  );
};

createRoot(document.getElementById('graph')).render(<HighlightGraph />);

```

--------------------------------

### Initialize and Render 3D Force Graph in React

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/text-nodes/index-3d.html

This snippet sets up the React environment, fetches graph data from a JSON file, and renders a 3D force-directed graph. It customizes nodes to display text labels using SpriteText, adjusting their position and color.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React from 'react';
import { createRoot } from 'react-dom';
import SpriteText from "https://esm.sh/three-spritetext";

fetch('../datasets/miserables.json').then(res => res.json()).then(data => {
  createRoot(document.getElementById('graph')).render(
    <ForceGraph3D graphData={data}
                  nodeAutoColorBy="group"
                  nodeThreeObjectExtend={true}
                  nodeThreeObject={node => {
                    const sprite = new SpriteText(node.id);
                    sprite.color = node.color;
                    sprite.textHeight = 8;
                    sprite.center.y = -0.6; // shift above node
                    return sprite;
                  }}
    />
  );
});
```

--------------------------------

### Initialize and Render 3D Force Graph in React

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/forcegraph-dependencies/index.html

This snippet shows the core logic for initializing the 3D force graph. It fetches data from a JSON file, sets up the graph's rendering environment using ReactDOM, and configures various graph properties like node styling, link direction, and click events.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React from 'react';
import { createRoot } from 'react-dom';
import SpriteText from "https://esm.sh/three-spritetext";

fetch('../datasets/forcegraph-dependencies.json').then(res => res.json()).then(depData => {
  const elem = document.getElementById('graph');
  createRoot(elem).render(
    <ForceGraph3D 
      graphData={depData}
      dagMode="lr"
      dagLevelDistance={60}
      nodeId="package"
      nodeAutoColorBy="user"
      linkDirectionalParticles={2}
      linkDirectionalParticleWidth={0.5}
      onNodeClick={node => window.open(`https://github.com/${node.user}/${node.package}`, '_blank')}
      nodeRelSize={2}
      nodeThreeObjectExtend={true}
      nodeThreeObject={node => {
        const sprite = new SpriteText(node.package);
        sprite.color = node.color;
        sprite.textHeight = 5;
        sprite.center.y = -0.4; // shift above node
        return sprite;
      }}
    />
  );
});
```

--------------------------------

### Render 3D Force Graph with React

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/directional-links-arrows/index.html

This snippet shows the core React component setup for displaying a 3D force-directed graph. It imports necessary libraries, generates random tree data, and renders the ForceGraph3D component with specified properties like arrow length and curvature. Requires React and react-dom.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React from 'react';
import { createRoot } from 'react-dom';
import { genRandomTree } from '../datasets/random-data.js';

createRoot(document.getElementById('graph')).render(
  <ForceGraph3D
    graphData={genRandomTree(40)}
    linkDirectionalArrowLength={3.5}
    linkDirectionalArrowRelPos={1}
    linkCurvature={0.25}
  />
);
```

--------------------------------

### Rendering Force Graph Components (React)

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/all-modes/index.html

This snippet shows how to import and render ForceGraph2D, ForceGraph3D, and ForceGraphVR components from the 'react-force-graph' library. It utilizes React's createRoot API to mount the graph to the DOM and dynamically assigns width based on the window size. The graphData is populated using a utility function 'genRandomTree'.

```jsx
import { ForceGraph2D, ForceGraph3D, ForceGraphVR } from 'https://esm.sh/react-force-graph?external=react';
import React from 'react';
import { createRoot } from 'react-dom';
import { genRandomTree } from '../datasets/random-data.js';

const comps = [ForceGraph2D, ForceGraph3D, ForceGraphVR];
const compWidth = window.innerWidth / comps.length;

createRoot(document.getElementById('graph')).render(
  <div style={{ display: 'flex' }}>
    {comps.map(Comp => <Comp width={compWidth} graphData={genRandomTree()} />)}
  </div>
);
```

--------------------------------

### Initialize React Force Graph 3D with JSON Data

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/large-graph/index.html

This JavaScript snippet initializes a 3D force-directed graph using React Force Graph. It fetches data from a JSON file, sets up node labels with user information and descriptions, and configures node coloring and particle effects.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React from 'react';
import { createRoot } from 'react-dom';

fetch('../datasets/blocks.json').then(res => res.json()).then(data => {
  createRoot(document.getElementById('graph')).render(
    <ForceGraph3D graphData={data}
                  nodeLabel={node => <div><b>{node.user}</b>: {node.description}</div>}
                  nodeAutoColorBy="user"
                  linkDirectionalParticles={1} />
  );
});
```

--------------------------------

### Initialize 3D Force Graph with Custom Link Labels

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/text-links/index-3d.html

This snippet initializes a 3D force-directed graph using react-force-graph-3d. It fetches data from a JSON file and renders the graph, including custom text labels on the links indicating source and target nodes. It also customizes link label appearance and position.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React from 'react';
import { createRoot } from 'react-dom';
import SpriteText from "https://esm.sh/three-spritetext";

fetch('../datasets/miserables.json').then(res => res.json()).then(data => {
  createRoot(document.getElementById('graph')).render(
    <ForceGraph3D
      graphData={data}
      nodeLabel="id"
      nodeAutoColorBy="group"
      linkThreeObjectExtend={true}
      linkThreeObject={link => {
        // extend link with text sprite
        const sprite = new SpriteText(`${link.source} > ${link.target}`);
        sprite.color = 'lightgrey';
        sprite.textHeight = 1.5;
        return sprite;
      }}
      linkPositionUpdate={(sprite, { start, end }) => {
        const middlePos = Object.assign(
          ...['x', 'y', 'z'].map(c => ({ [c]: start[c] + (end[c] - start[c]) / 2 }) // calc middle point
        );
        // Position sprite
        Object.assign(sprite.position, middlePos);
      }}
    />
  );
});
```

--------------------------------

### React Force Graph 3D with Node Focus

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/click-to-focus/index.html

This snippet shows a React component that renders a 3D force-directed graph using react-force-graph-3d. It utilizes `useRef` for accessing the graph instance and `useCallback` to define a click handler that smoothly moves the camera to focus on the clicked node.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React, { useRef, useCallback } from 'react';
import { createRoot } from 'react-dom';

fetch('../datasets/miserables.json').then(res => res.json()).then(data => {
  const FocusGraph = () => {
    const fgRef = useRef();

    const handleClick = useCallback(node => {
      // Aim at node from outside it
      const distance = 40;
      const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
        node, // lookAt ({ x, y, z })
        3000 // ms transition duration
      );
    }, [fgRef]);

    return <ForceGraph3D ref={fgRef} 
                   graphData={data}
                   nodeLabel="id"
                   nodeAutoColorBy="group"
                   onNodeClick={handleClick} />;
  };

  createRoot(document.getElementById('graph')).render(<FocusGraph />);
});
```

--------------------------------

### Render Force Graph AR Component in React

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/ar-graph/index.html

This snippet initializes the React application and renders the ForceGraphAR component with specific configurations. It fetches data from a local JSON file and applies various styling and behavioral properties to the graph, such as node size, link width, and opacity.

```javascript
import ForceGraphAR from 'https://esm.sh/react-force-graph-ar?external=react';
import React from 'react';
import { createRoot } from 'react-dom';

fetch('../datasets/miserables.json').then(res => res.json()).then(data => {
  createRoot(document.getElementById('graph')).render(
    <ForceGraphAR
      glScale={160}
      yOffset={1.8}
      graphData={data}
      nodeAutoColorBy="group"
      nodeRelSize={5}
      linkWidth={1.5}
      nodeOpacity={0.9}
      linkOpacity={0.3}
      linkColor={() => 'darkgrey'}
    />
  );
});
```

--------------------------------

### React Force Graph 2D with DAG Controls

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/tree/index.html

A React component that renders a 2D force-directed graph using react-force-graph-2d. It includes controls for DAG orientation and applies a collision force to nodes. Dependencies include React, react-dom, d3-dsv, d3-force-3d, and dat.gui.

```javascript
import ForceGraph2D from 'https://esm.sh/react-force-graph-2d?external=react';
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom';
import { csvParse } from 'https://esm.sh/d3-dsv';
import { forceCollide } from 'https://esm.sh/d3-force-3d';
import { GUI } from 'https://esm.sh/dat.gui';

const useForceUpdate = () => {
  const setToggle = useState(false)[1];
  return () => setToggle(b => !b);
};

const ForceTree = ({ data }) => {
  const fgRef = useRef();
  const [controls] = useState({ 'DAG Orientation': 'td' });
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    // add controls GUI
    const gui = new GUI();
    gui.add(controls, 'DAG Orientation', ['td', 'bu', 'lr', 'rl', 'radialout', 'radialin', null])
      .onChange(forceUpdate);
  }, []);

  useEffect(() => {
    // add collision force
    fgRef.current.d3Force('collision', forceCollide(node => Math.sqrt(100 / (node.level + 1))));
  }, []);

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={data}
      dagMode={controls['DAG Orientation']}
      dagLevelDistance={300}
      backgroundColor="#101020"
      linkColor={() => 'rgba(255,255,255,0.2)'}
      nodeRelSize={1}
      nodeId="path"
      nodeVal={node => 100 / (node.level + 1)}
      nodeLabel="path"
      nodeAutoColorBy="module"
      linkDirectionalParticles={2}
      linkDirectionalParticleWidth={2}
      d3VelocityDecay={0.3}
    />
  );
};

fetch('../datasets/d3-dependencies.csv')
  .then(r => r.text())
  .then(csvParse)
  .then(data => {
    const nodes = [], links = [];
    data.forEach(({ size, path }) => {
      const levels = path.split('/'),
        level = levels.length - 1,
        module = level > 0 ? levels[1] : null,
        leaf = levels.pop(),
        parent = levels.join('/');

      const node = { path, leaf, module, size: +size || 20, level };
      nodes.push(node);

      if (parent) {
        links.push({ source: parent, target: path, targetNode: node });
      }
    });

    createRoot(document.getElementById('graph')).render(
      <ForceTree data={{ nodes, links }} />
    );
  });

```

--------------------------------

### React Force Graph with Collision Detection (JavaScript/JSX)

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/collision-detection/index.html

This snippet initializes a 2D force graph using react-force-graph-2d and incorporates collision detection and bounding box forces from d3-force. It sets up initial node velocities and renders the graph within a React component.

```jsx
import ForceGraph2D from 'https://esm.sh/react-force-graph-2d?external=react';
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom';
import { forceCollide } from 'https://esm.sh/d3-force-3d';

const CollisionDetectionFG = () => {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  useEffect(() => {
    const fg = fgRef.current;

    // Deactivate existing forces
    fg.d3Force('center', null);
    fg.d3Force('charge', null);

    // Add collision and bounding box forces
    fg.d3Force('collide', forceCollide(4));
    fg.d3Force('box', () => {
      const SQUARE_HALF_SIDE = N * 2;
      nodes.forEach(node => {
        const x = node.x || 0,
          y = node.y || 0;
        // bounce on box walls
        if (Math.abs(x) > SQUARE_HALF_SIDE) {
          node.vx *= -1;
        }
        if (Math.abs(y) > SQUARE_HALF_SIDE) {
          node.vy *= -1;
        }
      });
    });

    // Generate nodes
    const N = 80;
    const nodes = [...Array(N).keys()].map(() => ({
      // Initial velocity in random direction
      vx: (Math.random() * 2) - 1,
      vy: (Math.random() * 2) - 1
    }));

    setGraphData({ nodes, links: [] });
  }, []);

  return <ForceGraph2D ref={fgRef} graphData={graphData} cooldownTime={Infinity} d3AlphaDecay={0} d3VelocityDecay={0} />;
};

createRoot(document.getElementById('graph')).render(<CollisionDetectionFG />);
```

--------------------------------

### Initialize React Force Graph 3D with CSS2DRenderer

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/html-nodes/index.html

This JavaScript code snippet initializes a 3D force-directed graph using the react-force-graph-3d library. It includes necessary imports for React, ReactDOM, and Three.js CSS2DRenderer. The graph is configured with custom node rendering logic that uses CSS2DObjects to display node IDs as HTML elements with specific styling. The data is fetched from a JSON file.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React from 'react';
import { createRoot } from 'react-dom';
import { CSS2DRenderer, CSS2DObject } from 'https://esm.sh/three/examples/jsm/renderers/CSS2DRenderer.js';

const extraRenderers = [
  new CSS2DRenderer()
];

fetch('../datasets/miserables.json')
  .then(res => res.json())
  .then(data => {
    createRoot(document.getElementById('graph')).render(
      <ForceGraph3D
        extraRenderers={extraRenderers}
        graphData={data}
        nodeAutoColorBy="group"
        nodeThreeObject={node => {
          const nodeEl = document.createElement('div');
          nodeEl.textContent = node.id;
          nodeEl.style.color = node.color;
          nodeEl.className = 'node-label';
          return new CSS2DObject(nodeEl);
        }}
        nodeThreeObjectExtend={true}
      />
    );
  });
```

--------------------------------

### React Force Graph 2D with Custom Node Painting

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/custom-node-shape/index-canvas.html

Renders a 2D force graph using react-force-graph-2d. Features custom node rendering logic and uses a randomly generated tree dataset.

```javascript
import ForceGraph2D from 'https://esm.sh/react-force-graph-2d?external=react';
import React from 'react';
import { createRoot } from 'react-dom';
import { genRandomTree } from '../datasets/random-data.js';

function nodePaint({ id, x, y }, color, ctx) {
  ctx.fillStyle = color;
  // Selects a shape based on node ID modulo 4
  switch(id % 4) {
    case 0: // rectangle
      ctx.fillRect(x - 6, y - 4, 12, 8);
      break;
    case 1: // triangle
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x - 5, y + 5);
      ctx.lineTo(x + 5, y + 5);
      ctx.fill();
      break;
    case 2: // circle
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI, false);
      ctx.fill();
      break;
    case 3: // text
      ctx.font = '10px Sans-Serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Text', x, y);
      break;
  }
}

// Generates a persistent color based on node ID
const getColor = n => '#' + ((n * 1234567) % Math.pow(2, 24)).toString(16).padStart(6, '0');

// Renders the graph component into the DOM
createRoot(document.getElementById('graph')).render(
  <ForceGraph2D
    graphData={genRandomTree(20)}
    nodeLabel="id"
    nodeCanvasObject={(node, ctx) => nodePaint(node, getColor(node.id), ctx)}
    nodePointerAreaPaint={nodePaint} // Custom painting for pointer interaction
  />
);
```

--------------------------------

### Initialize 3D Force Graph with Bloom Effect (React)

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/bloom-effect/index.html

This snippet initializes a 3D force-directed graph using react-force-graph-3d and applies a bloom post-processing effect using UnrealBloomPass. It fetches graph data from a JSON file and renders it within a React component.

```jsx
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React, { useRef, useEffect } from 'react';
import { createRoot } from 'react-dom';
import { UnrealBloomPass } from 'https://esm.sh/three/examples/jsm/postprocessing/UnrealBloomPass.js';

fetch('../datasets/miserables.json').then(res => res.json()).then(data => {
  const FocusGraph = () => {
    const fgRef = useRef();

    useEffect(() => {
      const bloomPass = new UnrealBloomPass();
      bloomPass.strength = 4;
      bloomPass.radius = 1;
      bloomPass.threshold = 0;
      fgRef.current.postProcessingComposer().addPass(bloomPass);
    }, []);

    return <ForceGraph3D ref={fgRef} backgroundColor="#000003" graphData={data} nodeLabel="id" nodeAutoColorBy="group" />;
  };

  createRoot(document.getElementById('graph'))
    .render(<FocusGraph/>);
});
```

--------------------------------

### Expandable Force Graph Component (React)

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/expandable-nodes/index.html

A React component that renders an expandable force-directed graph. It processes graph data to enable tree collapsing and expansion, with custom node styling and click handlers. Dependencies include 'react' and 'react-force-graph-3d'.

```jsx
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React, { useState, useMemo, useCallback } from 'react';

const ExpandableGraph = ({ graphData }) => {
  const rootId = 0;

  const nodesById = useMemo(() => {
    const nodesById = Object.fromEntries(graphData.nodes.map(node => [node.id, node]));

    // link parent/children
    graphData.nodes.forEach(node => {
      node.collapsed = node.id !== rootId;
      node.childLinks = [];
    });

    graphData.links.forEach(link =>
      nodesById[link.source].childLinks.push(link)
    );

    return nodesById;
  }, [graphData]);

  const getPrunedTree = useCallback(() => {
    const visibleNodes = [];
    const visibleLinks = [];

    (function traverseTree(node = nodesById[rootId]) {
      visibleNodes.push(node);
      if (node.collapsed) return;

      visibleLinks.push(...node.childLinks);
      node.childLinks
        .map(link => ((typeof link.target) === 'object') ? link.target : nodesById[link.target]) // get child node
        .forEach(traverseTree);
    })();

    return { nodes: visibleNodes, links: visibleLinks };
  }, [nodesById]);

  const [prunedTree, setPrunedTree] = useState(getPrunedTree());

  const handleNodeClick = useCallback(node => {
    node.collapsed = !node.collapsed; // toggle collapse state
    setPrunedTree(getPrunedTree())
  }, []);

  return <ForceGraph3D
    graphData={prunedTree}
    linkDirectionalParticles={2}
    nodeColor={node => !node.childLinks.length ? 'green' : node.collapsed ? 'red' : 'yellow'}
    onNodeClick={handleNodeClick}
  />;
};

export default ExpandableGraph;

```

--------------------------------

### 3D Force Graph with Camera Orbit (JavaScript/React)

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/camera-auto-orbit/index.html

Renders a 3D force-directed graph and implements a camera orbit effect. It requires the 'react-force-graph-3d' library and 'react-dom'. The camera's position is updated at regular intervals to create a circular motion around the graph.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom';
import { genRandomTree } from '../datasets/random-data.js';

const data = genRandomTree();
const distance = 1400;

const CameraOrbit = () => {
  const fgRef = useRef();

  useEffect(() => {
    fgRef.current.cameraPosition({ z: distance }); // camera orbit
    let angle = 0;
    setInterval(() => {
      fgRef.current.cameraPosition({
        x: distance * Math.sin(angle),
        z: distance * Math.cos(angle)
      });
      angle += Math.PI / 300;
    }, 10);
  }, []);

  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={data}
      enableNodeDrag={false}
      enableNavigationControls={false}
      showNavInfo={false}
    />
  );
};

createRoot(document.getElementById('graph')).render(<CameraOrbit />);
```

--------------------------------

### Initialize and Render 2D Force Graph in React

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/directional-links-particles/index.html

This snippet shows how to import the ForceGraph2D component, fetch data from a JSON file, and render the graph within a React application. It utilizes React DOM for mounting the component and configures graph properties like node labels, auto-coloring, and link particle effects.

```javascript
import ForceGraph2D from 'https://esm.sh/react-force-graph-2d?external=react';
import React from 'react';
import { createRoot } from 'react-dom';

fetch('../datasets/miserables.json')
  .then(res => res.json())
  .then(data => {
    createRoot(document.getElementById('graph')).render(
      <ForceGraph2D 
        graphData={data}
        nodeLabel="id"
        nodeAutoColorBy="group"
        linkDirectionalParticles="value"
        linkDirectionalParticleSpeed={d => d.value * 0.001}
      />
    );
  });

```

--------------------------------

### React Force Graph 2D Visualization with Custom Nodes

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/text-nodes/index-2d.html

Renders a Force Graph 2D using React, fetching data from a JSON file. It includes custom rendering for nodes, adding labels with background rectangles, and implementing hover effects for interactivity. The component relies on 'react' and 'react-dom'.

```javascript
import ForceGraph2D from 'https://esm.sh/react-force-graph-2d?external=react';
import React from 'react';
import { createRoot } from 'react-dom';

fetch('../datasets/miserables.json')
  .then(res => res.json())
  .then(data => {
    createRoot(document.getElementById('graph')).render(
      <ForceGraph2D
        graphData={data}
        nodeAutoColorBy="group"
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.id;
          const fontSize = 12/globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = node.color;
          ctx.fillText(label, node.x, node.y);
          node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          ctx.fillStyle = color;
          const bckgDimensions = node.__bckgDimensions;
          bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
        }}
      />
    );
  });

```

--------------------------------

### React Force Graph 3D with Image Nodes

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/img-nodes/index.html

This JavaScript code demonstrates a React component that renders a 3D force-directed graph. It uses the 'react-force-graph-3d' library and customizes node appearance to display images. The component expects a container element with the ID 'graph' to render into. It defines a graph data structure with nodes and links, and customizes node rendering using Three.js sprites with image textures.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React from 'react';
import { createRoot } from 'react-dom';
import * as THREE from 'https://esm.sh/three';

const imgs = [
  'cat.jpg',
  'dog.jpg',
  'eagle.jpg',
  'elephant.jpg',
  'grasshopper.jpg',
  'octopus.jpg',
  'owl.jpg',
  'panda.jpg',
  'squirrel.jpg',
  'tiger.jpg',
  'whale.jpg'
];

// Random connected graph
const gData = {
  nodes: imgs.map((img, id) => ({ id, img })),
  links: [...Array(imgs.length).keys()]
    .filter(id => id)
    .map(id => ({ source: id, target: Math.round(Math.random() * (id - 1)) }))
};

createRoot(document.getElementById('graph')).render(
  <ForceGraph3D
    graphData={gData}
    nodeThreeObject={({ img }) => {
      const imgTexture = new THREE.TextureLoader().load(`./imgs/${img}`);
      imgTexture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.SpriteMaterial({ map: imgTexture });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(12, 12);
      return sprite;
    }}
  />
);
```

--------------------------------

### Emit Particles on Link Click (React)

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/emit-particles/index.html

This JavaScript snippet configures a 3D force graph to emit a particle along a link when the link is clicked. It utilizes React, react-force-graph-3d, and a utility function for generating random tree data. The `emitParticle` method is called on the graph instance via a ref.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React, { useRef } from 'react';
import { createRoot } from 'react-dom';
import { genRandomTree } from '../datasets/random-data.js';

const data = genRandomTree();

const EmitParticles = () => {
  const fgRef = useRef();

  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={data}
      linkDirectionalParticleColor={() => 'red'}
      linkDirectionalParticleWidth={6}
      linkHoverPrecision={10}
      onLinkClick={link => fgRef.current.emitParticle(link)}
    />
  );
};

createRoot(document.getElementById('graph'))
  .render(<EmitParticles />);
```

--------------------------------

### React Force Graph 3D with Multi-Selection and Drag

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/multi-selection/index.html

Implements a React Force Graph 3D component that allows users to select multiple nodes by holding modifier keys and drag them collectively. It uses `useState` for managing selected nodes and `useCallback` for event handlers to optimize performance. The graph is initialized with random tree data.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React, { useMemo, useState, useCallback } from 'react';
import { createRoot } from 'react-dom';
import { genRandomTree } from '../datasets/random-data.js';

const MultiSelectionGraph = () => {
  const data = useMemo(() => genRandomTree(40), []);
  const [selectedNodes, setSelectedNodes] = useState(new Set());

  return (
    <ForceGraph3D
      graphData={data}
      nodeRelSize={9}
      nodeColor={useCallback(
        node => (selectedNodes.has(node) ? 'yellow' : 'grey'),
        [selectedNodes]
      )}
      onNodeClick={useCallback(
        (node, event) => {
          if (event.ctrlKey || event.shiftKey || event.altKey) {
            // multi-selection
            selectedNodes.has(node) ? selectedNodes.delete(node) : selectedNodes.add(node);
            setSelectedNodes(new Set(selectedNodes));
          } else {
            // single-selection
            const untoggle = selectedNodes.has(node) && selectedNodes.size === 1;
            selectedNodes.clear();
            !untoggle && selectedNodes.add(node);
          }
          setSelectedNodes(new Set(selectedNodes)); // update selected nodes state
        },
        [selectedNodes]
      )}
      onNodeDrag={useCallback(
        (node, translate) => {
          if (selectedNodes.has(node)) {
            // moving a selected node
            [...selectedNodes]
              .filter(selNode => selNode !== node) // don't touch node being dragged
              .forEach(node => ['x', 'y', 'z'].forEach(coord => (node[`f${coord}`] = node[coord] + translate[coord])));
          }
        },
        [selectedNodes]
      )}
      onNodeDragEnd={useCallback(
        node => {
          if (selectedNodes.has(node)) {
            // finished moving a selected node
            [...selectedNodes]
              .filter(selNode => selNode !== node) // don't touch node being dragged
              .forEach(node => ['x', 'y', 'z'].forEach(coord => (node[`f${coord}`] = undefined))); // unfix controlled nodes
          }
        },
        [selectedNodes]
      )}
    />
  );
};

createRoot(document.getElementById('graph')).render(<MultiSelectionGraph />);

```

--------------------------------

### Get Graph Bounding Box

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Retrieves the bounding box of nodes in the graph, formatted as an object with x, y, and z arrays. Returns null if no nodes are present. An optional nodeFilterFn can be provided to calculate the bounding box for a subset of nodes.

```javascript
const bbox = getGraphBbox(); // Or getGraphBbox(node => node.id === 'specificNode')
```

--------------------------------

### Apply Link Line Dash Style in React Force Graph

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Enable or disable dashed lines for links. This property accepts an array of numbers (e.g., `[5, 15]`) to define the dash pattern, a string, or a function for dynamic styling. Refer to the [HTML canvas setLineDash API](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash) for pattern examples.

```javascript
const Graph = ForceGraph()(document.getElementById('graph-container'))
  .graphData({ nodes: [...], links: [...] })
  .linkLineDash([5, 15]); // Or: .linkLineDash('5 15') or .linkLineDash(link => link.dashPattern)
```

--------------------------------

### Import Force Graph Components (JavaScript)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Demonstrates how to import the different Force Graph components for use in a React project.

```javascript
import ForceGraph2D from 'react-force-graph-2d';
import ForceGraph3D from 'react-force-graph-3d';
import ForceGraphVR from 'react-force-graph-vr';
import ForceGraphAR from 'react-force-graph-ar';
```

--------------------------------

### Force Engine Configuration

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Configuration properties for the force engine, including simulation dimensions, engine selection, DAG layout options, and simulation parameters.

```APIDOC
## Force Engine Configuration

### Description
Configuration properties for the force engine, including simulation dimensions, engine selection, DAG layout options, and simulation parameters.

### Parameters
#### Request Body
- **numDimensions** (1, 2 or 3) - Optional - Number of dimensions to run the force simulation on. Not applicable to 2D mode.
- **forceEngine** (string) - Optional - Which force-simulation engine to use ('d3' or 'ngraph'). Defaults to 'd3'.
- **dagMode** (string) - Optional - Apply layout constraints based on the graph directionality. Only works correctly for DAG graph structures. Choice between `td`, `bu`, `lr`, `rl`, `zout`, `zin`, `radialout` or `radialin`. Defaults to '-'.
- **dagLevelDistance** (number) - Optional - If `dagMode` is engaged, this specifies the distance between the different graph depths. Defaults to auto-derived from the number of nodes.
- **dagNodeFilter** (func) - Optional - Node accessor function to specify nodes to ignore during the DAG layout processing. Defaults to `node => true`.
- **onDagError** (func) - Optional - Callback to invoke if a cycle is encountered while processing the data structure for a DAG layout. Defaults to throwing an exception.
- **d3AlphaMin** (number) - Optional - Sets the simulation alpha min parameter. Only applicable if using the d3 simulation engine. Defaults to 0.
- **d3AlphaDecay** (number) - Optional - Sets the simulation intensity decay parameter. Only applicable if using the d3 simulation engine. Defaults to 0.0228.
- **d3VelocityDecay** (number) - Optional - Nodes' velocity decay that simulates the medium resistance. Only applicable if using the d3 simulation engine. Defaults to 0.4.
- **ngraphPhysics** (object) - Optional - Specify custom physics configuration for ngraph, according to its configuration object syntax. Only applicable if using the ngraph simulation engine.
- **warmupTicks** (number) - Optional - Number of layout engine cycles to dry-run at ignition before starting to render. Defaults to 0.
- **cooldownTicks** (number) - Optional - How many build-in frames to render before stopping and freezing the layout engine. Defaults to Infinity.
- **cooldownTime** (number) - Optional - How long (ms) to render for before stopping and freezing the layout engine. Defaults to 15000.
- **onEngineTick** (func) - Optional - Callback function invoked at every tick of the simulation engine.
- **onEngineStop** (func) - Optional - Callback function invoked when the simulation engine stops and the layout is frozen.

### Request Example
```json
{
  "numDimensions": 3,
  "forceEngine": "d3",
  "dagMode": "lr",
  "dagLevelDistance": 100,
  "d3AlphaMin": 0.001,
  "d3VelocityDecay": 0.5
}
```

### Response
#### Success Response (200)
- **status** (string) - Indicates the success of the operation.

#### Response Example
```json
{
  "status": "Configuration applied successfully"
}
```
```

--------------------------------

### Include Force Graph Components via Script Tag (HTML)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Shows how to include the Force Graph components in an HTML file using script tags, typically for use with a CDN.

```html
<script src="//cdn.jsdelivr.net/npm/react-force-graph-2d"></script>
<script src="//cdn.jsdelivr.net/npm/react-force-graph-3d"></script>
<script src="//cdn.jsdelivr.net/npm/react-force-graph-vr"></script>
<script src="//cdn.jsdelivr.net/npm/react-force-graph-ar"></script>
```

--------------------------------

### Initialize and Update React Force Graph 3D

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/dynamic/index.html

Sets up the React component for a 3D force graph, dynamically adding nodes and handling node clicks for removal. It uses state management to update graph data.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom';

const DynamicGraph = () => {
  const [data, setData] = useState({ nodes: [{ id: 0 }], links: [] });

  useEffect(() => {
    setInterval(() => {
      // Add a new connected node every second
      setData(({ nodes, links }) => {
        const id = nodes.length;
        return {
          nodes: [...nodes, { id }],
          links: [...links, { source: id, target: Math.round(Math.random() * (id - 1)) }]
        };
      });
    }, 1000);
  }, []);

  const handleClick = useCallback(node => {
    const { nodes, links } = data;
    // Remove node on click
    const newLinks = links.filter(l => l.source !== node && l.target !== node);
    // Remove links attached to node
    const newNodes = nodes.slice();
    newNodes.splice(node.id, 1);
    // Remove node
    newNodes.forEach((n, idx) => {
      n.id = idx;
    });
    // Reset node ids to array index
    setData({ nodes: newNodes, links: newLinks });
  }, [data, setData]);

  return <ForceGraph3D enableNodeDrag={false} onNodeClick={handleClick} graphData={data} />;
};

createRoot(document.getElementById('graph')).render(<DynamicGraph />);
```

--------------------------------

### Configure ngraph physics

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Provide custom physics configurations for the ngraph force engine. This allows fine-tuning of spring constants, repulsion, and other physics properties.

```javascript
const graph = ForceGraph3D()({
  // ... other props
  forceEngine: 'ngraph',
  ngraphPhysics: {
    springLength: 100,
    springCoefficient: 0.0001,
    dragCoefficient: 0.1,
    gravity: -5
  }
});
```

--------------------------------

### Input JSON Syntax for react-force-graph

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Defines the structure for nodes and links in the input JSON data. Nodes require an 'id', 'name', and 'val', while links need 'source' and 'target' properties referencing node IDs.

```json
{
    "nodes": [
        {
          "id": "id1",
          "name": "name1",
          "val": 1
        },
        {
          "id": "id2",
          "name": "name2",
          "val": 10
        },
        ...
    ],
    "links": [
        {
            "source": "id1",
            "target": "id2"
        },
        ...
    ]
}
```

--------------------------------

### Handle Background and Zoom Events (JavaScript)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Set up event listeners for clicks on the graph background and for zoom/pan actions. These callbacks allow customization of background interactions and response to camera transformations.

```javascript
import ForceGraph from 'react-force-graph';

<ForceGraph
  graphData={myData}
  onBackgroundClick={(event) => {
    console.log('Background clicked:', event);
  }}
  onZoom={({ k, x, y }) => {
    console.log('Zoomed:', { k, x, y });
  }}
  onZoomEnd={({ k, x, y }) => {
    console.log('Zoom ended:', { k, x, y });
  }}
/>
```

--------------------------------

### Initialize and Render Force Graph 3D in React

Source: https://github.com/vasturiano/react-force-graph/blob/master/example/fix-dragged-nodes/index.html

This code snippet initializes a React application and renders a 3D force-directed graph. It imports necessary libraries, fetches data, and sets up the graph component with specific configurations for node labels and colors. It also includes functionality to update node positions when dragging ends.

```javascript
import ForceGraph3D from 'https://esm.sh/react-force-graph-3d?external=react';
import React from 'react';
import { createRoot } from 'react-dom';

fetch('../datasets/miserables.json').then(res => res.json()).then(data => {
  createRoot(document.getElementById('graph')).render(
    <ForceGraph3D 
      graphData={data} 
      nodeLabel="id" 
      nodeAutoColorBy="group" 
      onNodeDragEnd={node => {
        node.fx = node.x;
        node.fy = node.y;
        node.fz = node.z;
      }}
    />
  );
});
```

--------------------------------

### Graph Control Methods

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Methods available for controlling the graph's animation, view, and camera.

```APIDOC
## Graph Control Methods

### `pauseAnimation`

*   **Description:** Pauses the rendering cycle of the component, effectively freezing the current view and cancelling all user interaction. This method can be used to save performance in circumstances when a static image is sufficient.
*   **Applies to:** 2D, 3D

### `resumeAnimation`

*   **Description:** Resumes the rendering cycle of the component, and re-enables the user interaction. This method can be used together with `pauseAnimation` for performance optimization purposes.
*   **Applies to:** 2D, 3D

### `centerAt`

*   **Arguments:** `([x], [y], [ms])`
*   **Description:** Set the coordinates of the center of the viewport. This method can be used to perform panning on the 2D canvas programmatically. Each of the `x, y` coordinates is optional, allowing for motion in just one dimension. An optional 3rd argument defines the duration of the transition (in ms) to animate the canvas motion.
*   **Applies to:** 2D

### `zoom`

*   **Arguments:** `([number], [ms])`
*   **Description:** Set the 2D canvas zoom amount. The zoom is defined in terms of the scale transform of each px. A value of `1` indicates unity, larger values zoom in and smaller values zoom out. An optional 2nd argument defines the duration of the transition (in ms) to animate the canvas motion. By default the zoom is set to a value inversely proportional to the amount of nodes in the system.
*   **Applies to:** 2D

### `zoomToFit`

*   **Arguments:** `([ms], [px], [nodeFilterFn])`
*   **Description:** Automatically zooms/pans the canvas so that all of the nodes fit inside it. If no nodes are found no action is taken. It accepts two optional arguments: the first defines the duration of the transition (in ms) to animate the canvas motion (default: 0ms). The second argument is the amount of padding (in px) between the edge of the canvas and the outermost node (default: 10px). The third argument specifies a custom node filter: `node => <boolean>`, which should return a truthy value if the node is to be included. This can be useful for focusing on a portion of the graph.
*   **Applies to:** 2D, 3D

### `cameraPosition`

*   **Arguments:** `([{x,y,z}], [lookAt], [ms])`
*   **Description:** Re-position the camera, in terms of `x`, `y`, `z` coordinates. Each of the coordinates is optional, allowing for motion in just some dimensions. The optional second argument can be used to define the direction that the camera should aim at, in terms of an `{x,y,z}` point in the 3D space. The 3rd optional argument defines the duration of the transition (in ms) to animate the camera motion. A value of 0 (default) moves the camera immediately to the final position. By default the camera will face the center of the graph at a `z` distance proportional to the amount of nodes in the system.
*   **Applies to:** 3D
```

--------------------------------

### Control 3D Rendering with WebGLRenderer Configuration

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Configure the Three.js WebGLRenderer for 3D graph visualizations. This prop accepts an object with parameters for the constructor, affecting rendering behavior on component mount. It's primarily used for 3D rendering.

```javascript
const Graph = ForceGraph3D({ extraRenderers: [new CSS3DRenderer()] });

<Graph
  // ... other props
  rendererConfig={{
    antialias: true,
    alpha: true
  }}
/>
```

--------------------------------

### Utility Methods

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

These utility methods provide essential functionalities for graph manipulation and coordinate translation.

```APIDOC
## Utility Methods

### getGraphBbox

#### Description
Returns the current bounding box of the nodes in the graph, formatted as `{ x: [<num>, <num>], y: [<num>, <num>], z: [<num>, <num>] }`. If no nodes are found, returns `null`. Accepts an optional argument to define a custom node filter: `node => <boolean>`, which should return a truthy value if the node is to be included. This can be useful to calculate the bounding box of a portion of the graph.

### screen2GraphCoords

#### Description
Utility method to translate viewport coordinates to the graph domain. Given a pair of `x`,`y` screen coordinates, and optionally distance from camera for 3D mode, returns the current equivalent `{x, y (, z)}` in the domain of graph node coordinates.

### graph2ScreenCoords

#### Description
Utility method to translate node coordinates to the viewport domain. Given a set of `x`,`y`(,`z`) graph coordinates, returns the current equivalent `{x, y}` in viewport coordinates.
```

--------------------------------

### Node Styling Properties

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

This section details the properties used to customize the appearance and behavior of nodes within the force-directed graph.

```APIDOC
## Node Styling Properties

This section details the properties used to customize the appearance and behavior of nodes within the force-directed graph.

### `nodeRelSize`
- **Type**: `number`
- **Default**: `4`
- **Description**: Ratio of node circle area (square px) [2D] or sphere volume (cubic px) [3D] per value unit.
- **Supported**: 2D, 3D, VR, AR

### `nodeVal`
- **Type**: `number`, `string` or `func`
- **Default**: `val`
- **Description**: Node object accessor function, attribute or a numeric constant for the node numeric value (affects node size).
- **Supported**: 2D, 3D, VR, AR

### `nodeLabel`
- **Type**: `string` or `func`
- **Default**: `name`
- **Description**: Node object accessor function or attribute for name (shown in label). Supports plain text or HTML content (except in VR).
- **Supported**: 2D, 3D, VR

### `nodeDesc`
- **Type**: `string` or `func`
- **Default**: `desc`
- **Description**: For VR only. Node object accessor function or attribute for description (shown under label).
- **Supported**: VR

### `nodeVisibility`
- **Type**: `bool`, `string` or `func`
- **Default**: `true`
- **Description**: Node object accessor function, attribute or a boolean constant for whether to display the node.
- **Supported**: 2D, 3D, VR, AR

### `nodeColor`
- **Type**: `string` or `func`
- **Default**: `color`
- **Description**: Node object accessor function or attribute for node color.
- **Supported**: 2D, 3D, VR, AR

### `nodeAutoColorBy`
- **Type**: `string` or `func`
- **Default**: `''`
- **Description**: Node object accessor function or attribute to automatically group colors by. Only affects nodes without a color attribute.
- **Supported**: 2D, 3D, VR, AR

### `nodeOpacity`
- **Type**: `number`
- **Default**: `0.75`
- **Description**: Nodes sphere opacity, between [0,1].
- **Supported**: 3D, VR, AR

### `nodeResolution`
- **Type**: `number`
- **Default**: `8`
- **Description**: Geometric resolution of each node's sphere, expressed in how many slice segments to divide the circumference. Higher values yield smoother spheres. Only applicable to 3D modes.
- **Supported**: 3D, VR, AR

### `nodeCanvasObject`
- **Type**: `func`
- **Default**: *default 2D node object is a circle, sized according to `val` and styled according to `color`.*
- **Description**: Callback function for painting a custom 2D canvas object to represent graph nodes. Should use the provided canvas context attribute to perform drawing operations for each node. The callback function will be called for each node at every frame, and has the signature: `nodeCanvasObject(<node>, <canvas context>, <current global scale>)`.
- **Supported**: 2D

### `nodeCanvasObjectMode`
- **Type**: `string` or `func`
- **Default**: `() => 'replace'`
- **Description**: Node object accessor function or attribute for the custom drawing mode. Use in combination with `nodeCanvasObject` to specify how to customize nodes painting. Possible values are: `replace`, `before`, `after`. Any other value will be ignored and the default drawing will be applied.
- **Supported**: 2D

### `nodeThreeObject`
- **Type**: `Object3d`, `string` or `func`
- **Default**: *default 3D node object is a sphere, sized according to `val` and styled according to `color`.*
- **Description**: Node object accessor function or attribute for generating a custom 3d object to render as graph nodes. Should return an instance of [ThreeJS Object3d](https://threejs.org/docs/index.html#api/core/Object3D). If a falsy value is returned, the default 3d object type will be used instead for that node.
- **Supported**: 3D, VR, AR

### `nodeThreeObjectExtend`
- **Type**: `bool`, `string` or `func`
- **Default**: `false`
- **Description**: Node object accessor function, attribute or a boolean value for whether to replace the default node when using a custom `nodeThreeObject` (`false`) or to extend it (`true`).
- **Supported**: 3D, VR, AR

### `nodePositionUpdate`
- **Type**: `func(nodeObject, coords, node)`
- **Default**: *null*
- **Description**: Custom function to call for updating the position of nodes at every render iteration. It receives the respective node `ThreeJS Object3d`, the coordinates of the node (`{x,y,z}` each), and the node's `data`. If the function returns a truthy value, the regular position update function will not run for that node.
- **Supported**: 3D
```

--------------------------------

### Data Input Properties

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Properties related to how graph data is structured and accessed.

```APIDOC
## Data Input

### `graphData`

- **Type**: `object`
- **Default**: `{ nodes: [], links: [] }`
- **Description**: Graph data structure. Can also be used to apply incremental updates.
- **Supported**: 2D, 3D, VR, AR

### `nodeId`

- **Type**: `string`
- **Default**: `id`
- **Description**: Node object accessor attribute for unique node id (used in link objects source/target).
- **Supported**: 2D, 3D, VR, AR

### `linkSource`

- **Type**: `string`
- **Default**: `source`
- **Description**: Link object accessor attribute referring to id of source node.
- **Supported**: 2D, 3D, VR, AR

### `linkTarget`

- **Type**: `string`
- **Default**: `target`
- **Description**: Link object accessor attribute referring to id of target node.
- **Supported**: 2D, 3D, VR, AR
```

--------------------------------

### Execute Actions Before and After Frame Rendering

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Utilize callback functions for custom rendering logic on the 2D canvas. `onRenderFramePre` is called before rendering nodes/links, providing canvas context and scale. `onRenderFramePost` is called after rendering.

```javascript
const Graph = ForceGraph2D;

<Graph
  // ... other props
  onRenderFramePre={(context, globalScale) => {
    context.fillStyle = 'rgba(0, 0, 0, 0.1)';
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  }}
  onRenderFramePost={(context, globalScale) => {
    context.fillStyle = 'red';
    context.font = '12px Arial';
    context.fillText(`Scale: ${globalScale.toFixed(2)}`, 10, 20);
  }}
/>
```

--------------------------------

### Configure Pointer Cursor and Control Type (JavaScript)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Customize the pointer cursor behavior and select the interaction control type for 3D visualizations. This allows for tailored user experience and control over camera navigation.

```javascript
import ForceGraph from 'react-force-graph';

<ForceGraph
  graphData={myData}
  showPointerCursor={node => !!node} // Show pointer only on nodes
  controlType="orbit" // Use orbit controls for 3D
/>
```

--------------------------------

### Link Styling Properties

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

This section covers the properties that control the visual aspects of the links, including labels, visibility, color, width, and curvature.

```APIDOC
## Link Styling Properties

This section details the available props for customizing the appearance and behavior of links in the React Force Graph.

### linkLabel

- **Type**: `string` or `func`
- **Default**: `name`
- **Description**: Link object accessor function or attribute for name (shown in label). Supports plain text or HTML content (except in VR).
- **Supported**: 2D, 3D, VR

### linkDesc

- **Type**: `string` or `func`
- **Default**: `desc`
- **Description**: For VR only. Link object accessor function or attribute for description (shown under label).
- **Supported**: VR

### linkVisibility

- **Type**: `bool`, `string` or `func`
- **Default**: `true`
- **Description**: Link object accessor function, attribute or a boolean constant for whether to display the link line.
- **Supported**: 2D, 3D, VR, AR

### linkColor

- **Type**: `string` or `func`
- **Default**: `color`
- **Description**: Link object accessor function or attribute for line color.
- **Supported**: 2D, 3D, VR, AR

### linkAutoColorBy

- **Type**: `string` or `func`
- **Default**: N/A
- **Description**: Link object accessor function or attribute to automatically group colors by. Only affects links without a color attribute.
- **Supported**: 2D, 3D, VR, AR

### linkOpacity

- **Type**: `number`
- **Default**: 0.2
- **Description**: Line opacity of links, between [0,1].
- **Supported**: 3D, VR, AR

### linkLineDash

- **Type**: `number[]`, `string` or `func`
- **Default**: N/A
- **Description**: Link object accessor function, attribute or number array (e.g. `[5, 15]`) to determine if a line dash should be applied to this rendered link. Refer to the [HTML canvas setLineDash API](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash) for example values. Either a falsy value or an empty array will disable dashing.
- **Supported**: 2D

### linkWidth

- **Type**: `number`, `string` or `func`
- **Default**: 1
- **Description**: Link object accessor function, attribute or a numeric constant for the link line width.
- **Supported**: 2D, 3D, VR, AR

### linkResolution

- **Type**: `number`
- **Default**: 6
- **Description**: Geometric resolution of each link 3D line, expressed in how many radial segments to divide the cylinder. Higher values yield smoother cylinders. Applicable only to links with positive width.
- **Supported**: 3D, VR, AR

### linkCurvature

- **Type**: `number`, `string` or `func`
- **Default**: 0
- **Description**: Link object accessor function, attribute or a numeric constant for the curvature radius of the link line. A value of `0` renders a straight line. `1` indicates a radius equal to half of the line length, causing the curve to approximate a semi-circle. For self-referencing links (`source` equal to `target`) the curve is represented as a loop around the node, with length proportional to the curvature value.
- **Supported**: 2D, 3D, VR, AR

### linkCurveRotation

- **Type**: `number`, `string` or `func`
- **Default**: 0
- **Description**: Link object accessor function, attribute or a numeric constant for the rotation along the line axis to apply to the curve. Has no effect on straight lines. At `0` rotation, the curve is oriented in the direction of the intersection with the `XY` plane. The rotation angle (in radians) will rotate the curved line clockwise around the "start-to-end" axis from this reference orientation.
- **Supported**: 3D, VR, AR

### linkMaterial

- **Type**: `Material`, `string` or `func`
- **Default**: *default link material is [MeshLambertMaterial](https://threejs.org/docs/#api/materials/MeshLambertMaterial) styled according to `color` and `opacity`.*
- **Description**: Link object accessor function or attribute for specifying a custom material to style the graph links with. Should return an instance of [ThreeJS Material](https://threejs.org/docs/#api/materials/Material). If a *falsy* value is returned, the default material will be used instead for that link.
- **Supported**: 3D, VR, AR

### linkCanvasObject

- **Type**: `func`
- **Default**: *default 2D link object is a line, styled according to `width` and `color`.*
- **Description**: Callback function for painting a custom canvas object to represent graph links. Should use the provided canvas context attribute to perform drawing operations for each link. The callback function will be called for each link at every frame, and has the signature: `linkCanvasObject(<link>, <canvas context>, <current global scale>)`.
- **Supported**: 2D
```

--------------------------------

### Link Interaction Events

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Callbacks for various link interaction events like clicks, right-clicks, and hovers.

```APIDOC
## Link Interaction Events

This section details the props for handling user interactions with links in the graph.

### `onLinkClick`

- **Description**: Callback function for link (left-button) clicks.
- **Arguments**: `onLinkClick(link, event)`
- **Supported**: 2D, 3D, VR, AR

### `onLinkRightClick`

- **Description**: Callback function for link right-clicks.
- **Arguments**: `onLinkRightClick(link, event)`
- **Supported**: 2D, 3D

### `onLinkHover`

- **Description**: Callback function for link mouse over events.
- **Arguments**: `onLinkHover(link, prevLink)`
- **Supported**: 2D, 3D, VR, AR
```

--------------------------------

### Zoom and Control Props

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Props related to zoom behavior, interaction precision, and cursor display.

```APIDOC
## Zoom and Control Props

This section details props related to zoom functionality, link hover precision, and cursor behavior.

### `onZoom`

- **Description**: Callback function for zoom/pan events. Triggered by user interaction or programmatic changes.
- **Arguments**: `onZoom({ k, x, y })` where `k` is the zoom factor and `x`, `y` are the pan offsets.
- **Supported**: 2D

### `onZoomEnd`

- **Description**: Callback function for the end of zoom/pan events. Triggered by user interaction or programmatic changes.
- **Arguments**: `onZoomEnd({ k, x, y })` where `k` is the zoom factor and `x`, `y` are the pan offsets.
- **Supported**: 2D

### `linkHoverPrecision`

- **Description**: Determines the proximity required to trigger link hover events. Lower values require closer proximity.
- **Type**: `number`
- **Default**: `4`
- **Supported**: 2D, 3D

### `showPointerCursor`

- **Description**: Controls whether a pointer cursor is displayed when hovering over clickable elements.
- **Type**: `boolean` or `func`
- **Default**: `true`
- **Callback Arguments**: Receives the object under the cursor and should return a boolean.
- **Supported**: 2D, 3D

### `controlType`

- **Description**: Specifies the type of camera control to use in 3D mode.
- **Type**: `string`
- **Default**: `trackball`
- **Options**: `trackball`, `orbit`, `fly`
- **Supported**: 3D

### `enableZoomInteraction`

- **Description**: Enables or disables user-initiated zoom interactions on the 2D canvas.
- **Type**: `boolean`
- **Default**: `true`
- **Supported**: 2D
```

--------------------------------

### Handle Node Clicks and Hovers (JavaScript)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Implement callback functions to respond to user interactions like clicking or hovering over nodes. These functions receive node data and event objects, allowing for dynamic updates or information display.

```javascript
import ForceGraph from 'react-force-graph';

<ForceGraph
  graphData={myData}
  onNodeClick={(node, event) => {
    console.log('Node clicked:', node);
  }}
  onNodeHover={(node, prevNode) => {
    console.log('Node hovered:', node);
  }}
/>
```

--------------------------------

### Background Interaction Events

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Callbacks for interaction events on the empty space of the graph canvas.

```APIDOC
## Background Interaction Events

This section details the props for handling user interactions with the background of the graph canvas.

### `onBackgroundClick`

- **Description**: Callback function for click events on the empty space between nodes and links.
- **Arguments**: `onBackgroundClick(event)`
- **Supported**: 2D, 3D

### `onBackgroundRightClick`

- **Description**: Callback function for right-click events on the empty space between nodes and links.
- **Arguments**: `onBackgroundRightClick(event)`
- **Supported**: 2D, 3D
```

--------------------------------

### Control simulation warmup and cooldown

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Set the number of warmup ticks before rendering and the duration for the layout engine to freeze. This controls the simulation's active state.

```javascript
const graph = ForceGraph3D()({
  // ... other props
  warmupTicks: 100,
  cooldownTicks: 500
});
```

--------------------------------

### Handle Link Clicks and Hovers (JavaScript)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Define callback functions to manage interactions with links in the force graph. These handlers provide access to link data and event details, enabling specific actions upon link clicks or hovers.

```javascript
import ForceGraph from 'react-force-graph';

<ForceGraph
  graphData={myData}
  onLinkClick={(link, event) => {
    console.log('Link clicked:', link);
  }}
  onLinkHover={(link, prevLink) => {
    console.log('Link hovered:', link);
  }}
/>
```

--------------------------------

### Access d3 Force Simulation Internals (React Force Graph)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Allows access to the internal forces of the d3 simulation engine, including 'link', 'charge', and 'center'. These forces can be reconfigured or new ones added. This functionality is only available when using the d3 simulation engine.

```javascript
graph.d3Force('forceName', forceFunction);
```

--------------------------------

### Node Interaction Events

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Callbacks for various node interaction events like clicks, right-clicks, hovers, and drags.

```APIDOC
## Node Interaction Events

This section details the props for handling user interactions with nodes in the graph.

### `onNodeClick`

- **Description**: Callback function for node (left-button) clicks.
- **Arguments**: `onNodeClick(node, event)`
- **Supported**: 2D, 3D, VR, AR

### `onNodeRightClick`

- **Description**: Callback function for node right-clicks.
- **Arguments**: `onNodeRightClick(node, event)`
- **Supported**: 2D, 3D

### `onNodeHover`

- **Description**: Callback function for node mouse over events.
- **Arguments**: `onNodeHover(node, prevNode)`
- **Supported**: 2D, 3D, VR, AR

### `onNodeDrag`

- **Description**: Callback function for node drag interactions, invoked repeatedly during drag.
- **Arguments**: `onNodeDrag(node, translate)` where `translate` is `{x, y, z}`
- **Supported**: 2D, 3D

### `onNodeDragEnd`

- **Description**: Callback function for the end of node drag interactions, invoked when the node is released.
- **Arguments**: `onNodeDragEnd(node, translate)` where `translate` is the change in coordinates from the initial position
- **Supported**: 2D, 3D
```

--------------------------------

### Apply DAG layout constraints

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Configure the DAG layout mode and distance between levels for directed acyclic graphs. This helps organize nodes hierarchically.

```javascript
const graph = ForceGraph3D()({
  // ... other props
  dagMode: 'lr', // Left-to-right layout
  dagLevelDistance: 200
});
```

--------------------------------

### Render Control Properties

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Properties that control the rendering behavior and appearance of the graph.

```APIDOC
## Render Control Properties

### `rendererConfig`

*   **Type:** `object`
*   **Default:** `{ antialias: true, alpha: true }`
*   **Description:** Configuration parameters to pass to the ThreeJS WebGLRenderer constructor. This prop only has an effect on component mount.
*   **Applies to:** 3D

### `extraRenderers`

*   **Type:** `array`
*   **Default:** `[]`
*   **Description:** If you wish to include custom objects that require a dedicated renderer besides WebGL, such as CSS3DRenderer, include in this array those extra renderer instances.
*   **Applies to:** 3D

### `autoPauseRedraw`

*   **Type:** `bool`
*   **Default:** `true`
*   **Description:** Enable performance optimization to automatically pause redrawing the 2D canvas at every frame whenever the simulation engine is halted. If you have custom dynamic objects that rely on a constant redraw of the canvas, it's recommended to switch this option off.
*   **Applies to:** 2D

### `minZoom`

*   **Type:** `number`
*   **Default:** `0.01`
*   **Description:** Lowest zoom out level permitted on the 2D canvas.
*   **Applies to:** 2D

### `maxZoom`

*   **Type:** `number`
*   **Default:** `1000`
*   **Description:** Highest zoom in level permitted on the 2D canvas.
*   **Applies to:** 2D

### `onRenderFramePre`

*   **Type:** `func`
*   **Default:** `*-*`
*   **Description:** Callback function to invoke at every frame, immediately before any node/link is rendered to the canvas. This can be used to draw additional external items on the canvas. The canvas context and the current global scale are included as parameters: `.onRenderFramePre(<canvas context>, <global scale>)`.
*   **Applies to:** 2D

### `onRenderFramePost`

*   **Type:** `func`
*   **Default:** `*-*`
*   **Description:** Callback function to invoke at every frame, immediately after the last node/link is rendered to the canvas. This can be used to draw additional external items on the canvas. The canvas context and the current global scale are included as parameters: `.onRenderFramePost(<canvas context>, <global scale>)`.
*   **Applies to:** 2D
```

--------------------------------

### Container Layout Properties

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Properties that control the visual dimensions and appearance of the graph container.

```APIDOC
## Container Layout

### `width`

- **Type**: `number`
- **Default**: `<window width>`
- **Description**: Canvas width, in px.
- **Supported**: 2D, 3D, VR, AR

### `height`

- **Type**: `number`
- **Default**: `<window height>`
- **Description**: Canvas height, in px.
- **Supported**: 2D, 3D, VR, AR

### `backgroundColor`

- **Type**: `string`
- **Default**: (2D - `light` / 3D - `dark`)
- **Description**: Chart background color.
- **Supported**: 2D, 3D, VR

### `showNavInfo`

- **Type**: `bool`
- **Default**: `true`
- **Description**: Whether to show the navigation controls footer info.
- **Supported**: 3D, VR

### `yOffset`

- **Type**: `number`
- **Default**: `1.5`
- **Description**: In AR mode, defines the offset distance above the marker where to place the center coordinates `<0,0,0>` of the force directed graph. Measured in terms of marker width units.
- **Supported**: AR

### `glScale`

- **Type**: `number`
- **Default**: `200`
- **Description**: In AR mode, defines the translation scale between real world distances and WebGL units, determining the overall size of the graph. Defined in terms of how many GL units fit in a full marker width.
- **Supported**: AR

### `markerAttrs`

- **Type**: `object`
- **Default**: `{ preset: 'hiro' }`
- **Description**: Set of attributes that define the marker where the AR force directed graph is mounted, according to the [a-marker specification](https://ar-js-org.github.io/AR.js-Docs/marker-based/). This prop only has an effect on component mount.
- **Supported**: AR
```

--------------------------------

### Access D3 Force Simulation

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Allows access to the internal forces controlling the D3 simulation engine. You can reconfigure existing forces like 'link', 'charge', and 'center', or add new ones. This is only applicable when using the D3 simulation engine.

```APIDOC
## GET /api/force-graph/d3Force

### Description
Access the internal forces of the D3 simulation engine.

### Method
GET

### Endpoint
/api/force-graph/d3Force

### Parameters
#### Query Parameters
- **forceType** (string) - Optional - Specify the type of force to access (e.g., 'link', 'charge', 'center').

### Response
#### Success Response (200)
- **forceConfig** (object) - The configuration of the specified D3 force.

#### Response Example
```json
{
  "forceConfig": {
    "type": "link",
    "distance": 30,
    "strength": 0.1
  }
}
```
```

--------------------------------

### Control 3D Camera Position and Focus

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Manipulate the camera in 3D visualizations. `cameraPosition` allows setting the camera's {x,y,z} coordinates, optionally defining a look-at point and transition duration for smooth camera movements.

```javascript
const graphRef = useRef();

// Set camera position immediately to (0, 50, 100)
graphRef.current.cameraPosition({ x: 0, y: 50, z: 100 });

// Move camera to (100, 100, 100) looking at (0,0,0) over 1000ms
graphRef.current.cameraPosition(
  { x: 100, y: 100, z: 100 },
  { x: 0, y: 0, z: 0 },
  1000
);
```

--------------------------------

### Receive simulation tick and stop events

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Implement callbacks for when the simulation engine ticks or stops. These functions are useful for real-time updates or final state handling.

```javascript
const graph = ForceGraph3D()({
  // ... other props
  onEngineTick: (engine) => {
    console.log(`Simulation tick: ${engine.alpha()}`);
  },
  onEngineStop: (engine) => {
    console.log('Simulation stopped.');
  }
});
```

--------------------------------

### Link Pointer Area Paint Callback

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

A callback function for custom painting of the canvas area used for link pointer interactions. The function receives the link, a unique color identifier, the canvas context, and the current global scale. The painted area is invisible but used for interaction detection.

```javascript
linkPointerAreaPaint: (link, color, ctx, scale) => {
  // Custom painting logic here
}
```

--------------------------------

### Custom 2D Link Rendering in React Force Graph

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Implement custom 2D rendering for links using a callback function. This function receives the link object, canvas context, and global scale, allowing for complex drawing operations.

```javascript
const Graph = ForceGraph()(document.getElementById('graph-container'))
  .graphData({ nodes: [...], links: [...] })
  .linkCanvasObject((link, ctx, globalScale) => {
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.strokeStyle = 'rgba(255,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
```

--------------------------------

### Graph to Screen Coordinates

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Translates graph domain coordinates (x, y, and optionally z) to viewport coordinates. Returns an object with {x, y}.

```javascript
const screenCoords = graph2ScreenCoords(graphX, graphY, graphZ);
```

--------------------------------

### Interaction Properties

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

These properties control user interaction capabilities within the graph visualization.

```APIDOC
## Configuration Properties

### enablePanInteraction

#### Description
Whether to enable panning user interactions on a 2D canvas.

### enableNavigationControls

#### Description
Whether to enable the trackball navigation controls used to move the camera using mouse interactions (rotate/zoom/pan).

### enablePointerInteraction

#### Description
Whether to enable the mouse tracking events. This activates an internal tracker of the canvas mouse position and enables the functionality of object hover/click and tooltip labels, at the cost of performance. If you're looking for maximum gain in your graph performance it's recommended to switch off this property.

### enableNodeDrag

#### Description
Whether to enable the user interaction to drag nodes by click-dragging. If enabled, every time a node is dragged the simulation is re-heated so the other nodes react to the changes. Only applicable if enablePointerInteraction is `true`.

### nodePointerAreaPaint

#### Description
Callback function for painting a canvas area used to detect node pointer interactions. The provided paint color uniquely identifies the node and should be used to perform drawing operations on the provided canvas context. This painted area will not be visible, but instead be used to detect pointer interactions with the node. The callback function has the signature: `nodePointerAreaPaint(<node>, <color>, <canvas context>, <current global scale>)`.

### linkPointerAreaPaint

#### Description
Callback function for painting a canvas area used to detect link pointer interactions. The provided paint color uniquely identifies the link and should be used to perform drawing operations on the provided canvas context. This painted area will not be visible, but instead be used to detect pointer interactions with the link. The callback function has the signature: `linkPointerAreaPaint(<link>, <color>, <canvas context>, <current global scale>)`.
```

--------------------------------

### Screen to Graph Coordinates

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Translates viewport coordinates (x, y) to graph domain coordinates. For 3D mode, an optional distance from the camera can be provided. Returns an object with {x, y (, z)}.

```javascript
const graphCoords = screen2GraphCoords(mouseX, mouseY, cameraDistance);
```

--------------------------------

### Node Pointer Area Paint Callback

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

A callback function for custom painting of the canvas area used for node pointer interactions. The function receives the node, a unique color identifier, the canvas context, and the current global scale. The painted area is invisible but used for interaction detection.

```javascript
nodePointerAreaPaint: (node, color, ctx, scale) => {
  // Custom painting logic here
}
```

--------------------------------

### Configure d3 simulation parameters

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Adjust simulation intensity decay and velocity decay for the d3 force engine. These parameters influence how nodes settle into their final positions.

```javascript
const graph = ForceGraph3D()({
  // ... other props
  d3AlphaDecay: 0.02,
  d3VelocityDecay: 0.5
});
```

--------------------------------

### Custom 2D Node Rendering with nodeCanvasObject

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Allows for custom drawing of 2D nodes using a callback function. The callback receives the canvas context and current scale, enabling detailed control over node appearance. Can replace or augment default rendering.

```javascript
nodeCanvasObject: (node, ctx, globalScale) => {
  // Custom drawing logic here
  const size = node.val || 1;
  ctx.beginPath();
  ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
  ctx.fillStyle = node.color || 'blue';
  ctx.fill();
}
```

--------------------------------

### Emit Particle Method

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Method for emitting a single, non-cyclical particle along a specified link.

```APIDOC
## Emit Particle Method

### `emitParticle`

- **Description**: Emits a single, non-cyclical particle along a specified link. The particle inherits the styling (speed, shape, color) of the regular particle properties.

- **Arguments**:
  - `link` (object) - Required. A valid link object present in the `graphData`.

- **Usage**:
  This method can be used in 2D, 3D, VR, and AR contexts.
```

--------------------------------

### Fit Graph Nodes to Canvas with Zoom and Padding

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Automatically adjust the zoom and pan to fit all nodes within the canvas. `zoomToFit` can take an optional duration for animation, padding around the nodes, and a filter function to include specific nodes in the fitting process.

```javascript
const graphRef = useRef();

// Fit all nodes with default settings
graphRef.current.zoomToFit();

// Fit nodes with 500ms animation and 20px padding
graphRef.current.zoomToFit(500, 20);

// Fit only nodes with ID > 10
graphRef.current.zoomToFit(null, null, node => node.id > 10);
```

--------------------------------

### Control Link Visibility in React Force Graph

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Manage the visibility of links using a boolean, string accessor, or a function. This allows dynamic control over which links are displayed in the graph.

```javascript
const Graph = ForceGraph()(document.getElementById('graph-container'))
  .graphData({ nodes: [...], links: [...] })
  .linkVisibility(true); // Or: .linkVisibility('isVisible') or .linkVisibility(link => link.visible)
```

--------------------------------

### Customize Link Canvas Rendering Mode (React Force Graph)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Allows customization of how links are painted on the canvas. You can replace the default rendering with a custom function, render before or after the default, or use default rendering. This is useful for advanced visual effects on links.

```javascript
linkCanvasObjectMode: 'replace' // or 'before', 'after'
```

--------------------------------

### Handle DAG layout errors

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Define a callback function to handle cycle detection during DAG layout processing. This allows custom error management instead of throwing an exception.

```javascript
const graph = ForceGraph3D()({
  // ... other props
  onDagError: (cycle) => {
    console.warn('DAG cycle detected:', cycle);
    // Continue processing despite the cycle
  }
});
```

--------------------------------

### Generate Custom 3D Link Objects (React Force Graph)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Enables the creation of custom 3D objects for graph links using Three.js. If a falsy value is returned, the default 3D link (line or cylinder) will be used. This is for advanced 3D graph visualizations.

```javascript
linkThreeObject: (link, ctx, globalScale) => {
  // Return a ThreeJS Object3d instance
  // Example: return new THREE.Mesh(...) 
}
```

--------------------------------

### Provide Custom Link Material in React Force Graph (3D)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Assign a custom Three.js material to style graph links. This allows for advanced visual effects. If a falsy value is returned by the accessor function or attribute, the default material will be used.

```javascript
const THREE = window.THREE;
const Graph = ForceGraph()(document.getElementById('graph-container'))
  .graphData({ nodes: [...], links: [...] })
  .linkMaterial(new THREE.MeshBasicMaterial({ color: 'red', opacity: 0.7, transparent: true }));
// Or using a function: .linkMaterial(link => link.customMaterial)
```

--------------------------------

### Link Directional Particle Properties

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Configuration options for customizing the appearance and behavior of directional particles on graph links.

```APIDOC
## Link Directional Particle Properties

This section details the properties used to customize directional particles along graph links.

### `linkDirectionalParticleWidth`

- **Type**: `number`, `string` or `func`
- **Default**: `0.5`
- **Description**: Controls the width of the directional particles. Can be a numeric constant, an accessor function, or an attribute of the link object. Values are rounded for indexing.

### `linkDirectionalParticleColor`

- **Type**: `string` or `func`
- **Default**: `color`
- **Description**: Sets the color of the directional particles. Accepts a color string or an accessor function/attribute from the link object.

### `linkDirectionalParticleResolution`

- **Type**: `number`
- **Default**: `4`
- **Description**: Determines the geometric resolution of the directional particles, affecting their smoothness. Higher values create smoother particles.

### `linkDirectionalParticleCanvasObject`

- **Type**: `func`
- **Description**: A callback function for custom rendering of link particles on a 2D canvas. The function receives `(x, y, link, canvas context, current global scale)` and should use the provided canvas context for drawing.

### `linkDirectionalParticleThreeObject`

- **Type**: `Object3d`, `string` or `func`
- **Description**: Allows specifying a custom 3D object for directional particles using a Three.js `Object3d` instance, a string identifier, or an accessor function. This overrides particle width, color, and resolution settings.
```

--------------------------------

### Custom 3D Node Rendering with nodeThreeObject

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Enables the use of custom Three.js objects for rendering 3D nodes. The function should return a Three.js Object3d instance. Returning a falsy value defaults to a sphere. Can extend or replace the default object.

```javascript
nodeThreeObject: (node) => {
  // Create and return a custom Three.js object
  const geometry = new THREE.SphereGeometry(node.val || 1, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color: node.color || 'blue' });
  return new THREE.Mesh(geometry, material);
}
```

--------------------------------

### Enable Pointer Interaction

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Enables mouse tracking events for object hover/click and tooltip functionality. Turning this off can improve performance. Requires at least one interaction to be enabled.

```javascript
enablePointerInteraction: true
```

--------------------------------

### Extend Default 3D Link Objects (React Force Graph)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Determines whether to extend or replace the default 3D link object when a custom `linkThreeObject` is provided. Setting to `true` adds custom properties to the default object, while `false` replaces it entirely.

```javascript
linkThreeObjectExtend: true // or false
```

--------------------------------

### Enable Node Drag

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Allows users to drag nodes by clicking and dragging. When enabled, dragging a node re-heats the simulation. This property is only applicable if enablePointerInteraction is true.

```javascript
enableNodeDrag: true
```

--------------------------------

### Programmatically Center and Zoom the 2D Canvas

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Adjust the viewport of the 2D graph. `centerAt` sets the center coordinates, optionally with animation. `zoom` adjusts the zoom level, also with optional animation. These methods are for programmatic control of the 2D view.

```javascript
const graphRef = useRef();

// Center the canvas at coordinates (100, 150) over 500ms
graphRef.current.centerAt(100, 150, 500);

// Zoom the canvas to a scale of 2 over 300ms
graphRef.current.zoom(2, 300);
```

--------------------------------

### Configure Link Resolution in React Force Graph (3D)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Determine the geometric resolution of 3D link lines by setting the number of radial segments. Higher values result in smoother cylinder representations for links with positive width.

```javascript
const Graph = ForceGraph()(document.getElementById('graph-container'))
  .graphData({ nodes: [...], links: [...] })
  .linkResolution(10);
```

--------------------------------

### Reheat D3 Simulation

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Reheats the force simulation engine by resetting the `alpha` value to 1. This is useful for re-initializing or boosting the simulation. Only applicable if using the D3 simulation engine.

```APIDOC
## POST /api/force-graph/d3ReheatSimulation

### Description
Reheats the force simulation engine by setting the alpha value to 1.

### Method
POST

### Endpoint
/api/force-graph/d3ReheatSimulation

### Parameters
No parameters required.

### Response
#### Success Response (200)
- **message** (string) - Confirmation that the simulation has been reheated.

#### Response Example
```json
{
  "message": "Simulation reheated successfully."
}
```
```

--------------------------------

### Pause and Resume Graph Rendering

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Control the animation cycle of the graph component. `pauseAnimation` freezes the current view and disables user interaction for performance optimization. `resumeAnimation` re-enables interaction and the rendering cycle.

```javascript
const graphRef = useRef();

// To pause
graphRef.current.pauseAnimation();

// To resume
graphRef.current.resumeAnimation();
```

--------------------------------

### Update Link Position in 3D (React Force Graph)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Provides a custom function to update the position of 3D link objects on each render iteration. It receives the link's ThreeJS object, start/end coordinates, and link data. Returning true bypasses the default position update.

```javascript
linkPositionUpdate: (linkObject, { start, end }, link) => {
  // Custom position update logic
  // Example: linkObject.position.set(start.x, start.y, start.z);
  // return true; // to skip default update
}
```

--------------------------------

### Adjust Link Opacity in React Force Graph (3D)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Control the opacity of link lines in 3D visualizations. The opacity value should be between 0 (fully transparent) and 1 (fully opaque).

```javascript
const Graph = ForceGraph()(document.getElementById('graph-container'))
  .graphData({ nodes: [...], links: [...] })
  .linkOpacity(0.5);
```

--------------------------------

### Enable Navigation Controls

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Enables trackball navigation controls for camera manipulation (rotate/zoom/pan) using mouse interactions. This is a boolean property.

```javascript
enableNavigationControls: true
```

--------------------------------

### Configure Link Label in React Force Graph

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Set the link label to display custom text or HTML content. This property accepts a string or a function that accesses link data. Note that HTML content is not supported in VR environments.

```javascript
const Graph = ForceGraph()(document.getElementById('graph-container'))
  .graphData({ nodes: [...], links: [...] })
  .linkLabel('name'); // Or a function: .linkLabel(link => link.customName)
```

--------------------------------

### Emit Single Particle for react-force-graph

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Provides a method to emit a single, non-cyclical particle along a specified link in react-force-graph. This particle inherits the styling of regular particles. Requires a valid link object present in the graph data.

```javascript
graphRef.current.emitParticle(link);
```

--------------------------------

### Link Directional Particle Properties for react-force-graph

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Defines properties for customizing directional particles on links within a react-force-graph. Supports numeric constants, accessor functions, or strings for width and color, and geometric resolution for shape. It also includes callbacks for custom canvas or Three.js object rendering.

```javascript
linkDirectionalParticleWidth: 0.5, // or (link) => link.width
linkDirectionalParticleColor: 'red', // or (link) => link.color
linkDirectionalParticleResolution: 4,
linkDirectionalParticleCanvasObject: (x, y, link, ctx, scale) => {
  // Custom drawing logic here
},
linkDirectionalParticleThreeObject: (link) => {
  // Return a Three.js Object3d instance
}
```

--------------------------------

### Optimize 2D Rendering with Auto Pause

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Enable performance optimization for the 2D canvas by automatically pausing redrawing when the simulation is halted. Set `autoPauseRedraw` to `false` if custom dynamic objects require constant redrawing.

```javascript
const Graph = ForceGraph2D;

<Graph
  // ... other props
  autoPauseRedraw={true} // or false
/>
```

--------------------------------

### Enable Pan Interaction

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Controls whether panning user interactions are enabled on a 2D canvas. This is a boolean property.

```javascript
enablePanInteraction: true
```

--------------------------------

### Set Link Width in React Force Graph

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Specify the width of the link lines. This can be a constant number, a string attribute name, or a function that accesses link data to determine the width.

```javascript
const Graph = ForceGraph()(document.getElementById('graph-container'))
  .graphData({ nodes: [...], links: [...] })
  .linkWidth(2); // Or: .linkWidth('weight') or .linkWidth(link => link.value)
```

--------------------------------

### Manage 2D Canvas Zoom Limits

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Define the minimum and maximum zoom levels for the 2D canvas. `minZoom` sets the lowest permitted zoom-out level, while `maxZoom` sets the highest zoom-in level.

```javascript
const Graph = ForceGraph2D;

<Graph
  // ... other props
  minZoom={0.5}
  maxZoom={5}
/>
```

--------------------------------

### Reheat d3 Force Simulation (React Force Graph)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Resets the d3 force simulation engine by setting the 'alpha' value to 1. This is useful for re-animating the graph after a pause or change. Applicable only when the d3 simulation engine is in use.

```javascript
graph.d3ReheatSimulation();
```

--------------------------------

### Set Link Color in React Force Graph

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Define the color of the link lines. Accepts a string color value or a function to dynamically determine the color based on link data. The `linkAutoColorBy` prop can be used for automatic coloring based on a data attribute.

```javascript
const Graph = ForceGraph()(document.getElementById('graph-container'))
  .graphData({ nodes: [...], links: [...] })
  .linkColor('blue'); // Or: .linkColor(link => link.color) or .linkAutoColorBy('group')
```

--------------------------------

### Adjust Link Curvature in React Force Graph

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Control the curvature of link lines. A value of 0 renders straight lines, while higher values create curved links. For self-referencing links, the curvature determines the size of the loop around the node.

```javascript
const Graph = ForceGraph()(document.getElementById('graph-container'))
  .graphData({ nodes: [...], links: [...] })
  .linkCurvature(0.2); // Or: .linkCurvature('radius') or .linkCurvature(link => link.curve)
```

--------------------------------

### Set Number of Directional Particles (React Force Graph)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Specifies the number of small spheres (particles) to display along the link line, indicating direction. Particles move from source to target. Accepts a number or a function for dynamic counts.

```javascript
linkDirectionalParticles: 3 // or a function
```

--------------------------------

### Set Directional Particle Speed (React Force Graph)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Configures the speed of the directional particles traveling along the link. It's expressed as a ratio of the link length traveled per frame. Values above 0.5 are not recommended. Supports numbers or functions.

```javascript
linkDirectionalParticleSpeed: 0.02 // or a function
```

--------------------------------

### Set Directional Arrow Color (React Force Graph)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Sets the color of the directional arrow head on links. Accepts color strings or a function for dynamic color assignment based on link data.

```javascript
linkDirectionalArrowColor: 'red' // or a function
```

--------------------------------

### Set Directional Particle Offset (React Force Graph)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Adjusts the initial position offset of the directional particles along the link line. The offset is a value between 0 and 1, representing a full cycle of particle positions. Supports numbers or functions.

```javascript
linkDirectionalParticleOffset: 0 // or a function
```

--------------------------------

### Set Directional Arrow Length (React Force Graph)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Configures the length of the arrow head indicating link direction. A value of 0 hides the arrow. This property can be a number, string, or a function for dynamic sizing.

```javascript
linkDirectionalArrowLength: 5 // or a function
```

--------------------------------

### Set Link Curve Rotation in React Force Graph (3D)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Apply rotation along the axis of curved links in 3D. This property adjusts the orientation of the curve relative to the XY plane. The angle is specified in radians.

```javascript
const Graph = ForceGraph()(document.getElementById('graph-container'))
  .graphData({ nodes: [...], links: [...] })
  .linkCurveRotation(Math.PI / 4); // Or: .linkCurveRotation('rotation') or .linkCurveRotation(link => link.angle)
```

--------------------------------

### Set Directional Arrow Relative Position (React Force Graph)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Defines the longitudinal position of the arrow head along the link line as a ratio (0 to 1). 0 is near the source, 1 is near the target, and 0.5 is in the middle. Supports numeric values or functions.

```javascript
linkDirectionalArrowRelPos: 0.5 // or a function
```

--------------------------------

### Set Directional Arrow Resolution (React Force Graph)

Source: https://github.com/vasturiano/react-force-graph/blob/master/README.md

Controls the geometric resolution of the arrow head, specifically the number of segments in the cone base circumference. Higher values result in smoother arrows. This is a numeric property.

```javascript
linkDirectionalArrowResolution: 16
```

=== COMPLETE CONTENT === This response contains all available snippets from this library. No additional content exists. Do not make further requests.