export type GeometryPoint = {
  id: string;
  x: number;
  y: number;
};

export type NeuralPoint = GeometryPoint & {
  side: "left" | "right";
};

export type FaceLandmarks = {
  outline: GeometryPoint[];
  leftEye: GeometryPoint[];
  rightEye: GeometryPoint[];
  leftBrow: GeometryPoint[];
  rightBrow: GeometryPoint[];
  nose: GeometryPoint[];
  mouth: GeometryPoint[];
  jaw: GeometryPoint[];
};

export type FaceGeometry = {
  landmarks: FaceLandmarks;
  neuralPoints: NeuralPoint[];
};

export type FaceGeometryOptions = {
  seed: number;
  neuralPointCount: number;
};

function point(id: string, x: number, y: number): GeometryPoint {
  return { id, x, y };
}

function createRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function createFaceGeometry(options: FaceGeometryOptions): FaceGeometry {
  const random = createRandom(options.seed);
  const neuralPoints = Array.from({ length: options.neuralPointCount }, (_, index) => {
    const y = (random() * 2 - 1) * 0.9;
    const envelope = Math.sqrt(Math.max(0, 1 - (y / 0.98) ** 2));
    const x = (random() * 2 - 1) * 0.76 * envelope;
    return {
      id: `neural-${index}`,
      x,
      y,
      side: x < 0 ? "left" as const : "right" as const,
    };
  });

  return {
    landmarks: {
      outline: [
        point("outline-0", 0, -1),
        point("outline-1", -0.52, -0.9),
        point("outline-2", -0.78, -0.48),
        point("outline-3", -0.72, 0.18),
        point("outline-4", -0.5, 0.7),
        point("outline-5", 0, 1),
        point("outline-6", 0.5, 0.7),
        point("outline-7", 0.72, 0.18),
        point("outline-8", 0.78, -0.48),
        point("outline-9", 0.52, -0.9),
      ],
      leftEye: [
        point("left-eye-outer", -0.54, -0.18),
        point("left-eye-upper", -0.33, -0.25),
        point("left-eye-inner", -0.12, -0.16),
        point("left-eye-lower", -0.33, -0.08),
        point("left-eye-center", -0.33, -0.16),
      ],
      rightEye: [
        point("right-eye-inner", 0.12, -0.16),
        point("right-eye-upper", 0.33, -0.25),
        point("right-eye-outer", 0.54, -0.18),
        point("right-eye-lower", 0.33, -0.08),
        point("right-eye-center", 0.33, -0.16),
      ],
      leftBrow: [
        point("left-brow-outer", -0.58, -0.39),
        point("left-brow-arch", -0.34, -0.48),
        point("left-brow-inner", -0.12, -0.4),
      ],
      rightBrow: [
        point("right-brow-inner", 0.12, -0.4),
        point("right-brow-arch", 0.34, -0.48),
        point("right-brow-outer", 0.58, -0.39),
      ],
      nose: [
        point("nose-bridge", 0, -0.28),
        point("nose-left", -0.12, 0.22),
        point("nose-tip", 0, 0.29),
        point("nose-right", 0.12, 0.22),
      ],
      mouth: [
        point("mouth-left", -0.3, 0.48),
        point("mouth-upper", 0, 0.42),
        point("mouth-right", 0.3, 0.48),
        point("mouth-lower", 0, 0.57),
        point("mouth-center", 0, 0.49),
      ],
      jaw: [
        point("jaw-left", -0.48, 0.62),
        point("jaw-chin", 0, 0.94),
        point("jaw-right", 0.48, 0.62),
      ],
    },
    neuralPoints,
  };
}
