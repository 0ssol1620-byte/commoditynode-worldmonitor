import {
  COMMODITY_UNIVERSE_EDGES,
  COMMODITY_UNIVERSE_NODES,
  getCommodityUniverseNode,
  type CommodityUniverseGroup,
} from '@/config/commoditynode-universe';

type FocusedGroup = CommodityUniverseGroup | 'all';

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 620;
const FLOATS_PER_VERTEX = 7;

const GROUP_COLOR: Record<CommodityUniverseGroup, readonly [number, number, number]> = {
  energy: [0.9, 0.66, 0.29],
  'industrial-metals': [0.22, 0.71, 0.68],
  'precious-metals': [0.78, 0.71, 0.42],
  agriculture: [0.51, 0.68, 0.44],
};

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec4 a_color;
in float a_size;
out vec4 v_color;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  gl_PointSize = a_size;
  v_color = a_color;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec4 v_color;
uniform bool u_round_points;
out vec4 out_color;
void main() {
  if (u_round_points) {
    float distance_from_center = distance(gl_PointCoord, vec2(0.5));
    if (distance_from_center > 0.5) discard;
    float edge = 1.0 - smoothstep(0.42, 0.5, distance_from_center);
    out_color = vec4(v_color.rgb, v_color.a * edge);
    return;
  }
  out_color = v_color;
}`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to allocate WebGL shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader error.';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to allocate WebGL program.');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown program link error.';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

export class CommodityUniverseWebGLRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly buffer: WebGLBuffer;
  private readonly resizeObserver: ResizeObserver;
  private selectedId = 'copper';
  private focusedGroup: FocusedGroup = 'all';
  private destroyed = false;
  private frame: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      depth: false,
      powerPreference: 'low-power',
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error('WebGL 2 is unavailable.');
    this.gl = gl;
    this.program = createProgram(gl);
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Unable to allocate WebGL buffer.');
    this.buffer = buffer;
    this.configureAttributes();
    this.resizeObserver = new ResizeObserver(() => this.scheduleRender());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.scheduleRender();
  }

  public update(selectedId: string, focusedGroup: FocusedGroup): void {
    this.selectedId = selectedId;
    this.focusedGroup = focusedGroup;
    this.scheduleRender();
  }

  public destroy(): void {
    this.destroyed = true;
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteProgram(this.program);
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.canvas.hidden = true;
    this.canvas.closest('.cn-universe-graph-stage')?.classList.remove('is-webgl');
  };

  private configureAttributes(): void {
    const { gl, program } = this;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const stride = FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT;
    const position = gl.getAttribLocation(program, 'a_position');
    const color = gl.getAttribLocation(program, 'a_color');
    const size = gl.getAttribLocation(program, 'a_size');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(color);
    gl.vertexAttribPointer(
      color,
      4,
      gl.FLOAT,
      false,
      stride,
      2 * Float32Array.BYTES_PER_ELEMENT,
    );
    gl.enableVertexAttribArray(size);
    gl.vertexAttribPointer(
      size,
      1,
      gl.FLOAT,
      false,
      stride,
      6 * Float32Array.BYTES_PER_ELEMENT,
    );
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private scheduleRender(): void {
    if (this.destroyed || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.render();
    });
  }

  private render(): void {
    if (this.destroyed || this.canvas.hidden) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const { gl } = this;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const project = (x: number, y: number): readonly [number, number] => {
      const scale = Math.min(width / VIEWBOX_WIDTH, height / VIEWBOX_HEIGHT);
      const offsetX = (width - VIEWBOX_WIDTH * scale) / 2;
      const offsetY = (height - VIEWBOX_HEIGHT * scale) / 2;
      return [
        ((offsetX + x * scale) / width) * 2 - 1,
        1 - ((offsetY + y * scale) / height) * 2,
      ];
    };

    this.drawLines(this.buildBackdropVertices(project));
    this.drawLines(this.buildEdgeVertices(project));
    this.drawPoints(this.buildStarVertices(project));
    this.drawPoints(this.buildNodeVertices(project, dpr));
  }

  private vertex(
    position: readonly [number, number],
    color: readonly [number, number, number],
    alpha: number,
    size = 1,
  ): number[] {
    return [position[0], position[1], color[0], color[1], color[2], alpha, size];
  }

  private buildBackdropVertices(
    project: (x: number, y: number) => readonly [number, number],
  ): number[] {
    const vertices: number[] = [];
    for (const radius of [150, 250, 350, 445]) {
      for (let segment = 0; segment < 64; segment += 1) {
        const a = (segment / 64) * Math.PI * 2;
        const b = ((segment + 1) / 64) * Math.PI * 2;
        vertices.push(
          ...this.vertex(project(500 + Math.cos(a) * radius, 310 + Math.sin(a) * radius * 0.58), [0.2, 0.34, 0.38], 0.17),
          ...this.vertex(project(500 + Math.cos(b) * radius, 310 + Math.sin(b) * radius * 0.58), [0.2, 0.34, 0.38], 0.17),
        );
      }
    }
    return vertices;
  }

  private buildEdgeVertices(
    project: (x: number, y: number) => readonly [number, number],
  ): number[] {
    const vertices: number[] = [];
    for (const edge of COMMODITY_UNIVERSE_EDGES) {
      const source = getCommodityUniverseNode(edge.source);
      const target = getCommodityUniverseNode(edge.target);
      if (!source || !target) continue;
      const selected = source.id === this.selectedId || target.id === this.selectedId;
      const inFocus =
        this.focusedGroup === 'all'
        || (source.group === this.focusedGroup && target.group === this.focusedGroup);
      const alpha = inFocus ? (selected ? 0.9 : 0.24) : 0.05;
      const color: readonly [number, number, number] = selected
        ? [0.47, 0.91, 0.88]
        : [0.35, 0.49, 0.53];
      vertices.push(
        ...this.vertex(project(source.x, source.y), color, alpha),
        ...this.vertex(project(target.x, target.y), color, alpha),
      );
    }
    return vertices;
  }

  private buildStarVertices(
    project: (x: number, y: number) => readonly [number, number],
  ): number[] {
    const stars = [
      [60, 75], [185, 300], [315, 55], [430, 265], [470, 90], [535, 330],
      [660, 300], [815, 365], [925, 80], [955, 345], [455, 565], [45, 545],
    ];
    return stars.flatMap(([x, y]) =>
      this.vertex(project(x ?? 0, y ?? 0), [0.53, 0.68, 0.72], 0.56, 2.5),
    );
  }

  private buildNodeVertices(
    project: (x: number, y: number) => readonly [number, number],
    dpr: number,
  ): number[] {
    const vertices: number[] = [];
    for (const node of COMMODITY_UNIVERSE_NODES) {
      const selected = node.id === this.selectedId;
      const inFocus = this.focusedGroup === 'all' || node.group === this.focusedGroup;
      const color = GROUP_COLOR[node.group];
      if (selected) {
        vertices.push(...this.vertex(project(node.x, node.y), color, 0.18, 58 * dpr));
      }
      vertices.push(
        ...this.vertex(
          project(node.x, node.y),
          color,
          inFocus ? (selected ? 1 : 0.76) : 0.15,
          (selected ? 34 : 27) * dpr,
        ),
      );
    }
    return vertices;
  }

  private drawLines(vertices: number[]): void {
    this.draw(vertices, this.gl.LINES, false);
  }

  private drawPoints(vertices: number[]): void {
    this.draw(vertices, this.gl.POINTS, true);
  }

  private draw(vertices: number[], primitive: number, roundPoints: boolean): void {
    if (vertices.length === 0) return;
    const { gl, program } = this;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    gl.uniform1i(gl.getUniformLocation(program, 'u_round_points'), roundPoints ? 1 : 0);
    gl.drawArrays(primitive, 0, vertices.length / FLOATS_PER_VERTEX);
  }
}

