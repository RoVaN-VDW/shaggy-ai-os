export type FacePose = {
  jawOpen: number;
  lipRound: number;
  lipSpread: number;
  lipPressure: number;
  cheekLeft: number;
  cheekRight: number;
  browLeft: number;
  browRight: number;
  eyelidLeft: number;
  eyelidRight: number;
  gazeX: number;
  gazeY: number;
  pupil: number;
  energy: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function createNeutralFacePose(): FacePose {
  return {
    jawOpen: 0,
    lipRound: 0,
    lipSpread: 0,
    lipPressure: 0,
    cheekLeft: 0,
    cheekRight: 0,
    browLeft: 0,
    browRight: 0,
    eyelidLeft: 0,
    eyelidRight: 0,
    gazeX: 0,
    gazeY: 0,
    pupil: 0.5,
    energy: 0.2,
  };
}

export function clampFacePose(pose: FacePose): FacePose {
  return {
    jawOpen: clamp(pose.jawOpen, 0, 1),
    lipRound: clamp(pose.lipRound, 0, 1),
    lipSpread: clamp(pose.lipSpread, 0, 1),
    lipPressure: clamp(pose.lipPressure, 0, 1),
    cheekLeft: clamp(pose.cheekLeft, 0, 1),
    cheekRight: clamp(pose.cheekRight, 0, 1),
    browLeft: clamp(pose.browLeft, -1, 1),
    browRight: clamp(pose.browRight, -1, 1),
    eyelidLeft: clamp(pose.eyelidLeft, 0, 1),
    eyelidRight: clamp(pose.eyelidRight, 0, 1),
    gazeX: clamp(pose.gazeX, -1, 1),
    gazeY: clamp(pose.gazeY, -1, 1),
    pupil: clamp(pose.pupil, 0, 1),
    energy: clamp(pose.energy, 0, 1),
  };
}
