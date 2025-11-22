import { zoom as d3Zoom, zoomIdentity as d3ZoomIdentity } from 'd3-zoom';
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
  private canvas: HTMLCanvasElement;
  private zoomBehavior: ZoomBehavior<HTMLCanvasElement, unknown>;
  private transform: Transform = { x: 0, y: 0, k: 1 };
  private onTransform: (transform: Transform) => void;
  private isDraggingNode = false;

  constructor(canvas: HTMLCanvasElement, onTransform: (t: Transform) => void) {
    this.canvas = canvas;
    this.onTransform = onTransform;

    this.zoomBehavior = d3Zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 5])
      .filter((event) => {
        // Disable zoom/pan during node dragging
        if (this.isDraggingNode) return false;
        // Allow wheel zoom and left-button drag for pan
        return event.type === 'wheel' || event.button === 0;
      })
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

  setDragging(dragging: boolean): void {
    this.isDraggingNode = dragging;
  }

  getTransform(): Transform {
    return this.transform;
  }

  setTransform(transform: Transform): void {
    // Programmatically update d3-zoom's internal transform state
    // This prevents jumps when panning after animated pan-to-center
    select(this.canvas)
      .call(this.zoomBehavior.transform, d3ZoomIdentity.translate(transform.x, transform.y).scale(transform.k));
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

export class DragHandler {
  private canvas: HTMLCanvasElement;
  private nodes: SimNode[];
  private transform: Transform;
  private draggedNode: SimNode | null = null;
  private onDragStart: (() => void) | null = null;
  private onDragEnd: (() => void) | null = null;
  private onRender: () => void;
  private zoomHandler: ZoomPanHandler | null = null;
  private onReheatSimulation: (() => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    nodes: SimNode[],
    onRender: () => void,
    callbacks?: {
      onDragStart?: () => void;
      onDragEnd?: () => void;
      onReheatSimulation?: () => void;
    }
  ) {
    this.canvas = canvas;
    this.nodes = nodes;
    this.transform = { x: 0, y: 0, k: 1 };
    this.onRender = onRender;
    this.onDragStart = callbacks?.onDragStart || null;
    this.onDragEnd = callbacks?.onDragEnd || null;
    this.onReheatSimulation = callbacks?.onReheatSimulation || null;

    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('mouseleave', this.handleMouseUp);
  }

  setZoomHandler(zoomHandler: ZoomPanHandler): void {
    this.zoomHandler = zoomHandler;
  }

  updateTransform(transform: Transform): void {
    this.transform = transform;
  }

  private findNodeAtPosition(x: number, y: number): SimNode | null {
    const tree = quadtree<SimNode>()
      .x(d => d.x!)
      .y(d => d.y!)
      .addAll(this.nodes);

    return tree.find(x, y, 20 / this.transform.k) || null;
  }

  private handleMouseDown = (event: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const graphX = (mouseX - this.transform.x) / this.transform.k;
    const graphY = (mouseY - this.transform.y) / this.transform.k;

    const node = this.findNodeAtPosition(graphX, graphY);

    if (node) {
      this.draggedNode = node;

      // Fix node position (stop simulation forces)
      node.fx = node.x;
      node.fy = node.y;

      this.canvas.style.cursor = 'grabbing';
      if (this.zoomHandler) this.zoomHandler.setDragging(true);
      if (this.onDragStart) this.onDragStart();

      // Reheat simulation so connected nodes react
      if (this.onReheatSimulation) this.onReheatSimulation();

      // Prevent canvas pan during node drag
      event.stopPropagation();
    }
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.draggedNode) return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const graphX = (mouseX - this.transform.x) / this.transform.k;
    const graphY = (mouseY - this.transform.y) / this.transform.k;

    // Update fixed position
    this.draggedNode.fx = graphX;
    this.draggedNode.fy = graphY;

    // Reheat simulation continuously during drag so forces react
    if (this.onReheatSimulation) this.onReheatSimulation();

    this.onRender();
    event.stopPropagation();
  };

  private handleMouseUp = (): void => {
    if (this.draggedNode) {
      // Optionally release node (let simulation take over again)
      // Comment these lines if you want nodes to stay fixed after dragging
      this.draggedNode.fx = null;
      this.draggedNode.fy = null;

      this.draggedNode = null;
      this.canvas.style.cursor = 'grab';
      if (this.zoomHandler) this.zoomHandler.setDragging(false);
      if (this.onDragEnd) this.onDragEnd();
    }
  };

  destroy(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
  }
}
