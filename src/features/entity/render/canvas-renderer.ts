import type { FacePose } from "../core/face-pose";
import type { EntityState } from "../core/entity-state";
import { deformFaceGeometry } from "./deformation.ts";
import { createEyePair } from "./eyes.ts";
import type { FaceGeometry, GeometryPoint } from "./geometry";
import type { FaceTopologyLink } from "./topology";

type CanvasSurface = {
  width?: number;
  height?: number;
  style?: Pick<CSSStyleDeclaration, "width" | "height">;
  getContext: (contextId: "2d") => CanvasRenderingContext2D | null;
};

type CanvasRendererOptions = {
  canvas: CanvasSurface;
  geometry: FaceGeometry;
  topology: FaceTopologyLink[];
};

export type CanvasRenderFrame = {
  width: number;
  height: number;
  dpr: number;
  pose: FacePose;
  state: EntityState;
  time: number;
};

export type CanvasFallbackRenderer = {
  mode: "fallback";
  reason: "canvas-context-unavailable";
};

export type CanvasActiveRenderer = {
  mode: "canvas";
  render: (frame: CanvasRenderFrame) => void;
};

export type CanvasRenderer = CanvasFallbackRenderer | CanvasActiveRenderer;

type ScreenPoint = GeometryPoint & { screenX: number; screenY: number };

function trace(
  context: CanvasRenderingContext2D,
  points: ScreenPoint[],
  close = false,
) {
  if (points.length === 0) return;
  context.beginPath();
  context.moveTo(points[0].screenX, points[0].screenY);
  for (const point of points.slice(1)) context.lineTo(point.screenX, point.screenY);
  if (close) context.closePath();
  context.stroke();
}

export function createCanvasRenderer(options: CanvasRendererOptions): CanvasRenderer {
  const context = options.canvas.getContext("2d");
  if (!context) {
    return {
      mode: "fallback",
      reason: "canvas-context-unavailable",
    };
  }

  return {
    mode: "canvas",
    render(frame) {
      const dpr = Math.min(Math.max(frame.dpr, 1), 2);
      const pixelWidth = Math.round(frame.width * dpr);
      const pixelHeight = Math.round(frame.height * dpr);
      if (options.canvas.width !== pixelWidth) options.canvas.width = pixelWidth;
      if (options.canvas.height !== pixelHeight) options.canvas.height = pixelHeight;
      if (options.canvas.style) {
        options.canvas.style.width = `${frame.width}px`;
        options.canvas.style.height = `${frame.height}px`;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, frame.width, frame.height);

      const centerX = frame.width * 0.5;
      const centerY = frame.height * 0.43;
      const scale = Math.min(frame.width * 0.3, frame.height * 0.37);
      const geometry = deformFaceGeometry(options.geometry, frame.pose);
      const project = (point: GeometryPoint): ScreenPoint => ({
        ...point,
        screenX: centerX + point.x * scale,
        screenY: centerY + point.y * scale,
      });
      const projectedLandmarks = Object.fromEntries(
        Object.entries(geometry.landmarks).map(([key, points]) => [key, points.map(project)]),
      ) as Record<keyof FaceGeometry["landmarks"], ScreenPoint[]>;
      const projectedNeural = geometry.neuralPoints.map(project);
      const pointsById = new Map<string, ScreenPoint>();
      for (const points of Object.values(projectedLandmarks)) {
        for (const point of points) pointsById.set(point.id, point);
      }
      for (const point of projectedNeural) pointsById.set(point.id, point);

      const isError = frame.state === "error";
      const cyan = isError ? "rgba(255,90,99,.72)" : "rgba(66,233,255,.72)";
      const gold = "rgba(255,211,106,.68)";

      const aura = context.createRadialGradient(centerX, centerY, scale * 0.08, centerX, centerY, scale * 1.42);
      aura.addColorStop(0, isError ? "rgba(255,77,69,.16)" : "rgba(0,212,255,.14)");
      aura.addColorStop(0.58, "rgba(0,212,255,.035)");
      aura.addColorStop(1, "rgba(0,0,0,0)");
      context.beginPath();
      context.arc(centerX, centerY, scale * 1.42, 0, Math.PI * 2);
      context.fillStyle = aura;
      context.fill();

      context.lineWidth = 0.7;
      for (const link of options.topology) {
        const from = pointsById.get(link.from);
        const to = pointsById.get(link.to);
        if (!from || !to) continue;
        context.beginPath();
        context.moveTo(from.screenX, from.screenY);
        context.lineTo(to.screenX, to.screenY);
        context.strokeStyle = from.x < 0 ? "rgba(255,211,106,.16)" : "rgba(66,233,255,.17)";
        context.stroke();
      }

      context.lineWidth = 1.35;
      context.strokeStyle = cyan;
      trace(context, projectedLandmarks.outline, true);
      trace(context, projectedLandmarks.rightBrow);
      trace(context, projectedLandmarks.nose);
      context.strokeStyle = gold;
      trace(context, projectedLandmarks.leftBrow);
      trace(context, projectedLandmarks.jaw);
      context.strokeStyle = isError ? "rgba(255,100,110,.82)" : "rgba(225,248,255,.62)";
      trace(context, projectedLandmarks.mouth, true);

      const eyes = createEyePair(geometry, frame.pose);
      for (const [side, eye] of Object.entries(eyes)) {
        const center = project(eye.center);
        const iris = project(eye.iris);
        context.beginPath();
        context.ellipse(
          center.screenX,
          center.screenY,
          eye.radiusX * scale,
          eye.radiusY * scale * eye.openness,
          0,
          0,
          Math.PI * 2,
        );
        context.fillStyle = "rgba(3,12,18,.82)";
        context.strokeStyle = side === "left" ? gold : cyan;
        context.fill();
        context.stroke();
        context.beginPath();
        context.arc(iris.screenX, iris.screenY, eye.pupilRadius * scale * 1.8, 0, Math.PI * 2);
        context.fillStyle = side === "left" ? "rgba(255,211,106,.8)" : "rgba(66,233,255,.84)";
        context.fill();
        context.beginPath();
        context.arc(iris.screenX, iris.screenY, eye.pupilRadius * scale * 0.68, 0, Math.PI * 2);
        context.fillStyle = "rgba(2,6,10,.94)";
        context.fill();
      }

      for (const [index, point] of projectedNeural.entries()) {
        context.beginPath();
        context.arc(point.screenX, point.screenY, index % 11 === 0 ? 2.1 : 1.05, 0, Math.PI * 2);
        context.fillStyle = point.x < 0 ? gold : cyan;
        context.fill();
      }
    },
  };
}