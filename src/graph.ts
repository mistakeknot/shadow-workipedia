import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import type { Simulation, SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { GraphData, GraphNode, GraphEdge, EdgeType } from './types';

export interface SimNode extends GraphNode, SimulationNodeDatum {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode;
  target: SimNode;
  strength: number;
  type: EdgeType;
}

export class GraphSimulation {
  private simulation: Simulation<SimNode, SimLink>;
  private nodes: SimNode[];
  private links: SimLink[];

  constructor(data: GraphData, width: number, height: number) {
    // Create mutable copies with positions
    this.nodes = data.nodes.map(n => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 100,
      y: height / 2 + (Math.random() - 0.5) * 100,
    }));

    // Create links with node references
    this.links = this.createLinks(data.edges);

    // Initialize simulation
    this.simulation = forceSimulation<SimNode, SimLink>(this.nodes)
      .force('link', forceLink<SimNode, SimLink>(this.links)
        .id(d => d.id)
        .distance(d => 50 + (1 - d.strength) * 100)
      )
      .force('charge', forceManyBody<SimNode>().strength(-300))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<SimNode>(d => d.size + 4))
      .alphaDecay(0.02);
  }

  private createLinks(edges: GraphEdge[]): SimLink[] {
    const nodeMap = new Map(this.nodes.map(n => [n.id, n]));

    return edges
      .map(e => {
        const source = nodeMap.get(e.source);
        const target = nodeMap.get(e.target);
        if (!source || !target) return null;

        return {
          source,
          target,
          strength: e.strength,
          type: e.type,
        };
      })
      .filter((l): l is SimLink => l !== null);
  }

  getNodes(): SimNode[] {
    return this.nodes;
  }

  getLinks(): SimLink[] {
    return this.links;
  }

  onTick(callback: () => void): void {
    this.simulation.on('tick', callback);
  }

  restart(): void {
    this.simulation.alpha(0.3).restart();
  }

  stop(): void {
    this.simulation.stop();
  }

  updateSize(width: number, height: number): void {
    this.simulation.force('center', forceCenter(width / 2, height / 2));
    this.restart();
  }
}
