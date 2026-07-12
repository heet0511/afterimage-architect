import Phaser from "phaser";

export type TilePoint = {
  x: number;
  y: number;
};

export type PlateData = TilePoint & {
  id: string;
  controls: string[];
};

export type DoorData = TilePoint & {
  id: string;
};

export type LevelData = {
  id: string;
  name: string;
  spawn: TilePoint;
  exit: TilePoint;
  walls: TilePoint[];
  plates: PlateData[];
  doors: DoorData[];
};

export type WasdKeys = {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
};

export type PlayerInputFrame = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
};

export type PlateState = {
  data: PlateData;
  view: Phaser.GameObjects.Rectangle;
  pressed: boolean;
};

export type DoorState = {
  data: DoorData;
  view: Phaser.GameObjects.Rectangle;
  open: boolean;
};

export type GhostState = {
  recording: PlayerInputFrame[];
  frameIndex: number;
  view: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Arc;
};