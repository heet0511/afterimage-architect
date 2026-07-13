export const LEVEL_KEYS = ["level-001", "level-002", "level-003"] as const;

export type LevelKey = (typeof LEVEL_KEYS)[number];

export const SAVE_KEY = "afterimage-architect-progress";

export type LevelSelectInfo = {
  key: LevelKey;
  name: string;
  description: string;
};

export const LEVEL_SELECT_INFO: LevelSelectInfo[] = [
  {
    key: "level-001",
    name: "First Contact",
    description: "Reach the exit portal.",
  },
  {
    key: "level-002",
    name: "Hold the Line",
    description: "Use a pressure plate to open the door.",
  },
  {
    key: "level-003",
    name: "Borrowed Weight",
    description: "Record an afterimage to hold the plate for you.",
  },
];

type ProgressSave = {
  highestUnlockedLevelIndex: number;
  lastCompletedLevel: LevelKey;
};

export function readHighestUnlockedLevelIndex(): number {
  const rawSave = localStorage.getItem(SAVE_KEY);

  if (!rawSave) {
    return 0;
  }

  try {
    const parsed = JSON.parse(rawSave) as Partial<ProgressSave>;
    const savedIndex = parsed.highestUnlockedLevelIndex ?? 0;

    return Math.max(0, Math.min(savedIndex, LEVEL_KEYS.length - 1));
  } catch {
    return 0;
  }
}