import { clampFacePose, type FacePose } from "../core/face-pose.ts";
import { createExpressionForEntityState } from "../core/expression.ts";
import type { EntityState } from "../core/entity-state";
import type { FaceGeometry, GeometryPoint } from "./geometry";

export function createPoseForEntityState(state: EntityState): FacePose {
  return createExpressionForEntityState(state);
}

function deformMouth(point: GeometryPoint, pose: FacePose): GeometryPoint {
  const horizontalScale = 1 + pose.lipSpread * 0.3 - pose.lipRound * 0.38;
  let y = point.y;
  if (point.id === "mouth-upper") y -= pose.lipPressure * 0.025;
  if (point.id === "mouth-lower") y += pose.jawOpen * 0.14;
  if (point.id === "mouth-center") y += pose.jawOpen * 0.07;
  return { ...point, x: point.x * horizontalScale, y };
}

function deformJaw(point: GeometryPoint, pose: FacePose): GeometryPoint {
  const weight = point.id === "jaw-chin" ? 0.16 : 0.08;
  return { ...point, y: point.y + pose.jawOpen * weight };
}

function deformBrow(point: GeometryPoint, amount: number): GeometryPoint {
  return { ...point, y: point.y - amount * 0.1 };
}

function deformEye(point: GeometryPoint, closure: number): GeometryPoint {
  if (point.id.endsWith("upper")) return { ...point, y: point.y + closure * 0.08 };
  if (point.id.endsWith("lower")) return { ...point, y: point.y - closure * 0.045 };
  return { ...point };
}

export function deformFaceGeometry(geometry: FaceGeometry, inputPose: FacePose): FaceGeometry {
  const pose = clampFacePose(inputPose);
  return {
    landmarks: {
      outline: geometry.landmarks.outline.map((point) => ({ ...point })),
      leftEye: geometry.landmarks.leftEye.map((point) => deformEye(point, pose.eyelidLeft)),
      rightEye: geometry.landmarks.rightEye.map((point) => deformEye(point, pose.eyelidRight)),
      leftBrow: geometry.landmarks.leftBrow.map((point) => deformBrow(point, pose.browLeft)),
      rightBrow: geometry.landmarks.rightBrow.map((point) => deformBrow(point, pose.browRight)),
      nose: geometry.landmarks.nose.map((point) => ({ ...point })),
      mouth: geometry.landmarks.mouth.map((point) => deformMouth(point, pose)),
      jaw: geometry.landmarks.jaw.map((point) => deformJaw(point, pose)),
    },
    neuralPoints: geometry.neuralPoints.map((point) => {
      const jawWeight = Math.max(0, (point.y - 0.35) / 0.65);
      return {
        ...point,
        x: point.x * (1 + pose.cheekLeft * (point.side === "left" ? 0.04 : 0) + pose.cheekRight * (point.side === "right" ? 0.04 : 0)),
        y: point.y + pose.jawOpen * jawWeight * 0.08,
      };
    }),
  };
}
