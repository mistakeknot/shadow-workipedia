import { zoom as d3Zoom } from 'd3-zoom';
import { select } from 'd3-selection';
import type { ZoomBehavior, D3ZoomEvent } from 'd3-zoom';
import { quadtree } from 'd3-quadtree';
import type { SimNode } from './graph';

export interface Transform {
  x: number;
  y: number;
  k: number; // scale
}

export class ZoomPanHandler {
  private zoomBehavior: ZoomBehavior<HTMLCanvasElement, unknown>;
  private transform: Transform = { x: 0, y: 0, k: 1 };
  private onTransform: (transform: Transform) => void;

  constructor(canvas: HTMLCanvasElement, onTransform: (t: Transform) => void) {
    this.onTransform = onTransform;

    this.zoomBehavior = d3Zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        this.transform = {
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        };
        this.onTransform(this.transform);
      });

    select(canvas).call(this.zoomBehavior);
  }

  getTransform(): Transform {
    return this.transform;
  }

  reset(): void {
    this.transform = { x: 0, y: 0, k: 1 };
    this.onTransform(this.transform);
  }
}

export class HoverHandler {
  private canvas: HTMLCanvasElement;
  private nodes: SimNode[];
  private transform: Transform;
  private onHover: (node: SimNode | null) => void;

  constructor(
    canvas: HTMLCanvasElement,
    nodes: SimNode[],
    onHover: (node: SimNode | null) => void
  ) {
    this.canvas = canvas;
    this.nodes = nodes;
    this.transform = { x: 0, y: 0, k: 1 };
    this.onHover = onHover;

    canvas.addEventListener('mousemove', this.handleMouseMove);
  }

  updateTransform(transform: Transform): void {
    this.transform = transform;
  }

  private handleMouseMove = (event: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Transform mouse coordinates to graph space
    const graphX = (mouseX - this.transform.x) / this.transform.k;
    const graphY = (mouseY - this.transform.y) / this.transform.k;

    // Use quadtree for efficient spatial search
    const tree = quadtree<SimNode>()
      .x(d => d.x!)
      .y(d => d.y!)
      .addAll(this.nodes);

    const found = tree.find(graphX, graphY, 20 / this.transform.k);

    this.onHover(found || null);
  };

  destroy(): void {
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
  }
}

export class ClickHandler {
  private canvas: HTMLCanvasElement;
  private nodes: SimNode[];
  private transform: Transform;
  private onClick: (node: SimNode | null) => void;

  constructor(
    canvas: HTMLCanvasElement,
    nodes: SimNode[],
    onClick: (node: SimNode | null) => void
  ) {
    this.canvas = canvas;
    this.nodes = nodes;
    this.transform = { x: 0, y: 0, k: 1 };
    this.onClick = onClick;

    canvas.addEventListener('click', this.handleClick);
  }

  updateTransform(transform: Transform): void {
    this.transform = transform;
  }

  private handleClick = (event: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const graphX = (mouseX - this.transform.x) / this.transform.k;
    const graphY = (mouseY - this.transform.y) / this.transform.k;

    const tree = quadtree<SimNode>()
      .x(d => d.x!)
      .y(d => d.y!)
      .addAll(this.nodes);

    const found = tree.find(graphX, graphY, 20 / this.transform.k);

    this.onClick(found || null);
  };

  destroy(): void {
    this.canvas.removeEventListener('click', this.handleClick);
  }
}
