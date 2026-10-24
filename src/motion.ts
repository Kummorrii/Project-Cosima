// One shared clock for every shader. It only advances while motion is on, so pausing
// motion freezes the rotation, the twinkling and everything else at once.
export const motionTime = { value: 0 }
