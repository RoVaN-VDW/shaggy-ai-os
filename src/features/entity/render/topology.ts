import type { FaceGeometry, GeometryPoint } from "./geometry";

export type FaceTopologyLink = {
  from: string;
  to: string;
  kind: "landmark" | "neural";
};

function distance(left: GeometryPoint, right: GeometryPoint) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

export function createFaceTopology(geometry: FaceGeometry): FaceTopologyLink[] {
  const links = new Map<string, FaceTopologyLink>();
  const addLink = (from: string, to: string, kind: FaceTopologyLink["kind"]) => {
    const [first, second] = from < to ? [from, to] : [to, from];
    const key = `${kind}:${first}:${second}`;
    links.set(key, { from: first, to: second, kind });
  };

  const closedRegions = new Set(["outline", "leftEye", "rightEye", "mouth"]);
  for (const [region, points] of Object.entries(geometry.landmarks)) {
    for (let index = 1; index < points.length; index += 1) {
      addLink(points[index - 1].id, points[index].id, "landmark");
    }
    if (closedRegions.has(region) && points.length > 2) {
      addLink(points.at(-1)!.id, points[0].id, "landmark");
    }
  }

  for (const source of geometry.neuralPoints) {
    const nearest = geometry.neuralPoints
      .filter((candidate) => candidate.id !== source.id && candidate.side === source.side)
      .map((candidate) => ({ candidate, distance: distance(source, candidate) }))
      .sort((left, right) => left.distance - right.distance || left.candidate.id.localeCompare(right.candidate.id))
      .slice(0, 2);
    for (const { candidate } of nearest) {
      addLink(source.id, candidate.id, "neural");
    }
  }

  return [...links.values()].sort((left, right) =>
    left.kind.localeCompare(right.kind)
    || left.from.localeCompare(right.from)
    || left.to.localeCompare(right.to));
}
