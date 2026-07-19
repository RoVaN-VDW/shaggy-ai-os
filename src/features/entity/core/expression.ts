import { clampFacePose, createNeutralFacePose, type FacePose } from "./face-pose.ts";
import type { EntityState } from "./entity-state.ts";

const STATE_EXPRESSIONS: Record<EntityState, Partial<FacePose>> = {
  booting: { eyelidLeft: 0.08, eyelidRight: 0.08, pupil: 0.46, energy: 0.35 },
  idle: {},
  listening: { browLeft: 0.18, browRight: 0.18, pupil: 0.62, energy: 0.68 },
  understanding: { browLeft: 0.1, browRight: 0.1, eyelidLeft: 0.06, eyelidRight: 0.06, pupil: 0.55, energy: 0.72 },
  speaking: { browLeft: 0.08, browRight: 0.08, cheekLeft: 0.06, cheekRight: 0.06, pupil: 0.56, energy: 0.74 },
  success: { browLeft: 0.24, browRight: 0.24, cheekLeft: 0.18, cheekRight: 0.18, pupil: 0.54, energy: 0.58 },
  warning: { browLeft: -0.28, browRight: -0.28, eyelidLeft: 0.1, eyelidRight: 0.1, pupil: 0.42, energy: 0.62 },
  error: {
    jawOpen: 0.08,
    lipSpread: 0,
    browLeft: -0.55,
    browRight: -0.55,
    eyelidLeft: 0.18,
    eyelidRight: 0.18,
    pupil: 0.38,
    energy: 0.78,
  },
  interrupted: { browLeft: 0.12, browRight: 0.12, eyelidLeft: 0.14, eyelidRight: 0.14, pupil: 0.58, energy: 0.5 },
};

export function createExpressionForEntityState(state: EntityState): FacePose {
  return clampFacePose({
    ...createNeutralFacePose(),
    ...STATE_EXPRESSIONS[state],
  });
}
