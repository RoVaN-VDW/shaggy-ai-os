import { clampFacePose, type FacePose } from "../core/face-pose.ts";
import type { FaceGeometry, GeometryPoint } from "./geometry";

export type EyeGeometry = {
  center: GeometryPoint;
  iris: GeometryPoint;
  radiusX: number;
  radiusY: number;
  pupilRadius: number;
  openness: number;
};

export type EyePair = {
  left: EyeGeometry;
  right: EyeGeometry;
};

function findCenter(points: GeometryPoint[], id: string) {
  const center = points.find((point) => point.id === id);
  if (!center) throw new Error(`Missing canonical eye center: ${id}`);
  return center;
}

function createEye(center: GeometryPoint, gazeX: number, gazeY: number, pupil: number, closure: number): EyeGeometry {
  return {
    center: { ...center },
    iris: {
      id: `${center.id}-iris`,
      x: center.x + gazeX * 0.07,
      y: center.y + gazeY * 0.044,
    },
    radiusX: 0.21,
    radiusY: 0.105,
    pupilRadius: 0.025 + pupil * 0.03,
    openness: 1 - closure,
  };
}

export function createEyePair(geometry: FaceGeometry, inputPose: FacePose): EyePair {
  const pose = clampFacePose(inputPose);
  return {
    left: createEye(
      findCenter(geometry.landmarks.leftEye, "left-eye-center"),
      pose.gazeX,
      pose.gazeY,
      pose.pupil,
      pose.eyelidLeft,
    ),
    right: createEye(
      findCenter(geometry.landmarks.rightEye, "right-eye-center"),
      pose.gazeX,
      pose.gazeY,
      pose.pupil,
      pose.eyelidRight,
    ),
  };
}
