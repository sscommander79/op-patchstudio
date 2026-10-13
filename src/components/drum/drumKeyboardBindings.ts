export const physicalKeyRows = [
  { name: 'upper', keys: ['W', 'E', 'R', 'Y', 'U'] },
  { name: 'lower', keys: ['A', 'S', 'D', 'F', 'G', 'H', 'J'] },
] as const;
// Z and X choose which twelve-pad bank the computer keys play.
export const bankKeys = { lower: 'Z', upper: 'X' } as const;

// Hints are generated from these bindings so help text cannot drift from what the keys do.
export const drumComputerKeyHint = {
  lowerRow: physicalKeyRows[1].keys,
  upperRow: physicalKeyRows[0].keys,
  bankKeys,
  switchBanks: `Use ${bankKeys.lower} or ${bankKeys.upper} to switch pad banks`,
} as const;

