import Phaser from "phaser";
import {
  COLORS,
  EXIT_SIZE,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_SIMULATION_STEPS_PER_FRAME,
  PLAYER_SIZE,
  PLAYER_SPEED,
  PLATE_SIZE,
  SIMULATION_STEP_MS,
  TILE_SIZE,
} from "../constants";
import { LEVEL_KEYS, SAVE_KEY, type LevelKey } from "../levels";
import { GeneratedSfx } from "../systems/GeneratedSfx";
import type {
  DoorState,
  GhostState,
  LevelData,
  PlateState,
  PlayerInputFrame,
  WasdKeys,
} from "../types";

export class GameScene extends Phaser.Scene {
  private readonly sfx = new GeneratedSfx();
  private player!: Phaser.GameObjects.Rectangle;
  private playerGlow!: Phaser.GameObjects.Arc;

  private exitCore!: Phaser.GameObjects.Arc;
  private exitRing!: Phaser.GameObjects.Rectangle;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: WasdKeys;

  private restartTimelineKey!: Phaser.Input.Keyboard.Key;
  private fullResetKey!: Phaser.Input.Keyboard.Key;
  private shiftKey!: Phaser.Input.Keyboard.Key;

  private nextLevelKey!: Phaser.Input.Keyboard.Key;
  private levelOneKey!: Phaser.Input.Keyboard.Key;
  private levelTwoKey!: Phaser.Input.Keyboard.Key;
  private levelThreeKey!: Phaser.Input.Keyboard.Key;
  private continueKey!: Phaser.Input.Keyboard.Key;

  private pauseKey!: Phaser.Input.Keyboard.Key;
  private menuKey!: Phaser.Input.Keyboard.Key;

  private timelineText!: Phaser.GameObjects.Text;
  private recordingText!: Phaser.GameObjects.Text;
  private ghostText!: Phaser.GameObjects.Text;

  private currentLevelKey: LevelKey = "level-001";
  private level!: LevelData;

  private wallBounds: Phaser.Geom.Rectangle[] = [];

  private plates: PlateState[] = [];
  private doors: DoorState[] = [];
  private ghosts: GhostState[] = [];

  private levelComplete = false;
  private completionViews: Phaser.GameObjects.GameObject[] = [];

  private fixedStepAccumulator = SIMULATION_STEP_MS;

  private isPaused = false;
  private pauseOverlayViews: Phaser.GameObjects.GameObject[] = [];

  private timelineNumber = 1;
  private currentRecording: PlayerInputFrame[] = [];
  private savedRecordings: PlayerInputFrame[][] = [];

  constructor() {
    super("GameScene");
  }

  init(data?: { levelKey?: LevelKey }): void {
    this.currentLevelKey = data?.levelKey ?? "level-001";

    this.wallBounds = [];
    this.plates = [];
    this.doors = [];
    this.ghosts = [];

    this.levelComplete = false;
    this.completionViews = [];

    this.fixedStepAccumulator = SIMULATION_STEP_MS;

    this.isPaused = false;
    this.pauseOverlayViews = [];

    this.timelineNumber = 1;
    this.currentRecording = [];
    this.savedRecordings = [];
  }

  preload(): void {
    this.load.json("level-001", "/levels/level-001.json");
    this.load.json("level-002", "/levels/level-002.json");
    this.load.json("level-003", "/levels/level-003.json");
    this.load.json("level-004", "/levels/level-004.json");
    this.load.json("level-005", "/levels/level-005.json");
  }

  create(): void {
    this.level = this.cache.json.get(this.currentLevelKey) as LevelData;

    this.cameras.main.setBackgroundColor(COLORS.background);

    this.createInput();
    this.drawFloorGrid();
    this.drawRoomWalls();
    this.createPlates();
    this.createDoors();
    this.createExitPortal();
    this.createPlayer();
    this.createHud();
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
      this.togglePause();
      return;
    }

    const restartPressed = Phaser.Input.Keyboard.JustDown(this.restartTimelineKey);
    const fullResetPressed =
      Phaser.Input.Keyboard.JustDown(this.fullResetKey) ||
      (restartPressed && this.shiftKey.isDown);

    if (fullResetPressed) {
      this.fullResetLevel();
      return;
    }

    if (this.isPaused) {
      if (Phaser.Input.Keyboard.JustDown(this.continueKey)) {
        this.togglePause();
        return;
      }

      if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
        this.scene.start("LevelSelectScene");
        return;
      }

      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      this.scene.start("LevelSelectScene");
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.levelOneKey)) {
      this.switchToLevel("level-001");
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.levelTwoKey)) {
      this.switchToLevel("level-002");
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.levelThreeKey)) {
      this.switchToLevel("level-003");
      return;
    }

    if (
      Phaser.Input.Keyboard.JustDown(this.nextLevelKey) ||
      Phaser.Input.Keyboard.JustDown(this.continueKey)
    ) {
      this.switchToNextLevel();
      return;
    }

    if (this.levelComplete) {
      return;
    }

    if (restartPressed) {
      this.restartTimeline();
      return;
    }

    const safeDelta = Math.min(
      delta,
      SIMULATION_STEP_MS * MAX_SIMULATION_STEPS_PER_FRAME,
    );

    this.fixedStepAccumulator += safeDelta;

    let simulationSteps = 0;

    while (
      this.fixedStepAccumulator >= SIMULATION_STEP_MS &&
      simulationSteps < MAX_SIMULATION_STEPS_PER_FRAME
    ) {
      this.runFixedSimulationStep(SIMULATION_STEP_MS);

      this.fixedStepAccumulator -= SIMULATION_STEP_MS;
      simulationSteps += 1;

      if (this.levelComplete) {
        break;
      }
    }

    if (simulationSteps >= MAX_SIMULATION_STEPS_PER_FRAME) {
      this.fixedStepAccumulator = 0;
    }

    this.updateHud();
  }

  private runFixedSimulationStep(delta: number): void {
    const inputFrame = this.captureInputFrame();
    this.currentRecording.push(inputFrame);

    this.moveGhosts(delta);
    this.movePlayerFromInput(inputFrame, delta);

    this.updatePuzzleState();
    this.checkWinCondition();
  }

  private createInput(): void {
    if (!this.input.keyboard) {
      throw new Error("Keyboard input is not available.");
    }

    this.cursors = this.input.keyboard.createCursorKeys();

    const keys = this.input.keyboard.addKeys(
      "W,A,S,D,R,N,P,ONE,TWO,THREE",
    ) as Record<string, Phaser.Input.Keyboard.Key>;

    this.wasdKeys = {
      W: keys.W,
      A: keys.A,
      S: keys.S,
      D: keys.D,
    };

    this.restartTimelineKey = keys.R;

    this.fullResetKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.BACKSPACE,
    );

    this.shiftKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
    );

    this.nextLevelKey = keys.N;
    this.levelOneKey = keys.ONE;
    this.levelTwoKey = keys.TWO;
    this.levelThreeKey = keys.THREE;

    this.continueKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER,
    );

    this.pauseKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC,
    );

    this.menuKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.M,
    );

    keys.P.on("down", () => {
      this.togglePause();
    });

    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.BACKSPACE,
      Phaser.Input.Keyboard.KeyCodes.ESC,
    ]);
  }

  private captureInputFrame(): PlayerInputFrame {
    return {
      left: this.wasdKeys.A.isDown || this.cursors.left.isDown,
      right: this.wasdKeys.D.isDown || this.cursors.right.isDown,
      up: this.wasdKeys.W.isDown || this.cursors.up.isDown,
      down: this.wasdKeys.S.isDown || this.cursors.down.isDown,
    };
  }

  private switchToLevel(levelKey: LevelKey): void {
    this.sfx.play("select");
    this.scene.restart({ levelKey });
  }

  private switchToNextLevel(): void {
    const currentIndex = LEVEL_KEYS.indexOf(this.currentLevelKey);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= LEVEL_KEYS.length) {
      this.switchToLevel("level-001");
      return;
    }

    const nextLevelKey = LEVEL_KEYS[nextIndex];
    this.switchToLevel(nextLevelKey);
  }

  private isFinalLevel(): boolean {
    return LEVEL_KEYS.indexOf(this.currentLevelKey) === LEVEL_KEYS.length - 1;
  }

  private saveProgress(): void {
    const currentIndex = LEVEL_KEYS.indexOf(this.currentLevelKey);
    const unlockedIndex = Math.min(currentIndex + 1, LEVEL_KEYS.length - 1);

    const saveData = {
      highestUnlockedLevelIndex: unlockedIndex,
      lastCompletedLevel: this.currentLevelKey,
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  }

  private restartTimeline(): void {
    if (this.currentRecording.length > 0) {
      const savedRecording = [...this.currentRecording];

      this.savedRecordings.push(savedRecording);
      this.createGhost(savedRecording);
    }

    this.currentRecording = [];
    this.timelineNumber += 1;
    this.fixedStepAccumulator = SIMULATION_STEP_MS;

    this.resetPlayerToSpawn();
    this.resetGhostsToSpawn();

    this.updatePuzzleState();
    this.updateHud();

    this.sfx.play("timelineRestart");
    this.cameras.main.flash(180, 95, 255, 215);
  }

  private fullResetLevel(): void {
    this.currentRecording = [];
    this.savedRecordings = [];
    this.timelineNumber = 1;
    this.levelComplete = false;
    this.fixedStepAccumulator = SIMULATION_STEP_MS;

    this.isPaused = false;
    this.destroyPauseOverlay();

    this.destroyCompletionViews();
    this.destroyGhosts();

    this.resetPlayerToSpawn();

    this.player.setFillStyle(COLORS.player, 1);
    this.playerGlow.setAlpha(0.18);

    this.updatePuzzleState();
    this.updateHud();

    this.cameras.main.flash(220, 255, 120, 120);
    this.sfx.play("reset");
  }

  private togglePause(): void {
    if (this.levelComplete) {
      return;
    }
  
    this.isPaused = !this.isPaused;
  
    if (this.isPaused) {
      this.createPauseOverlay();
      this.sfx.play("pause");
    } else {
      this.destroyPauseOverlay();
      this.sfx.play("resume");
    }
  }

  private createPauseOverlay(): void {
    this.destroyPauseOverlay();

    const panel = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, 260, 0x02030a, 0.94)
      .setStrokeStyle(1, 0x5fffd7, 0.7);

    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 92, "PAUSED", {
        fontFamily: "monospace",
        fontSize: "30px",
        color: "#d7faff",
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 54, "Afterimage Architect", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#8fdbe8",
      })
      .setOrigin(0.5);

    const controls = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 6,
        [
          "Enter / Esc / P  Resume",
          "R                Create afterimage",
          "Backspace        Reset current level",
          "M                Return to level select",
          "WASD / Arrows    Move",
        ],
        {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#d7faff",
          align: "left",
          lineSpacing: 8,
        },
      )
      .setOrigin(0.5);

    const settingsText = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 100,
        "Settings: sound and visual options coming next",
        {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#6f96a3",
        },
      )
      .setOrigin(0.5);

    this.pauseOverlayViews = [panel, title, subtitle, controls, settingsText];
  }

  private destroyPauseOverlay(): void {
    for (const view of this.pauseOverlayViews) {
      view.destroy();
    }

    this.pauseOverlayViews = [];
  }

  private destroyCompletionViews(): void {
    for (const view of this.completionViews) {
      view.destroy();
    }

    this.completionViews = [];
  }

  private destroyGhosts(): void {
    for (const ghost of this.ghosts) {
      ghost.view.destroy();
      ghost.glow.destroy();
    }

    this.ghosts = [];
  }

  private createGhost(recording: PlayerInputFrame[]): void {
    const spawnX = this.level.spawn.x * TILE_SIZE;
    const spawnY = this.level.spawn.y * TILE_SIZE;

    const glow = this.add.circle(spawnX, spawnY, 28, COLORS.ghostGlow, 0.1);

    const view = this.add.rectangle(
      spawnX,
      spawnY,
      PLAYER_SIZE,
      PLAYER_SIZE,
      COLORS.ghost,
      0.36,
    );

    view.setStrokeStyle(2, COLORS.ghostGlow, 0.45);

    this.tweens.add({
      targets: glow,
      alpha: 0.22,
      scale: 1.15,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.ghosts.push({
      recording,
      frameIndex: 0,
      view,
      glow,
    });
  }

  private resetPlayerToSpawn(): void {
    const spawnX = this.level.spawn.x * TILE_SIZE;
    const spawnY = this.level.spawn.y * TILE_SIZE;

    this.player.x = spawnX;
    this.player.y = spawnY;
    this.playerGlow.x = spawnX;
    this.playerGlow.y = spawnY;
  }

  private resetGhostsToSpawn(): void {
    const spawnX = this.level.spawn.x * TILE_SIZE;
    const spawnY = this.level.spawn.y * TILE_SIZE;

    for (const ghost of this.ghosts) {
      ghost.frameIndex = 0;
      ghost.view.x = spawnX;
      ghost.view.y = spawnY;
      ghost.glow.x = spawnX;
      ghost.glow.y = spawnY;
    }
  }

  private moveGhosts(delta: number): void {
    for (const ghost of this.ghosts) {
      if (ghost.frameIndex >= ghost.recording.length) {
        continue;
      }

      const inputFrame = ghost.recording[ghost.frameIndex];

      this.moveActorFromInput(ghost.view, inputFrame, delta);

      ghost.glow.x = ghost.view.x;
      ghost.glow.y = ghost.view.y;

      ghost.frameIndex += 1;
    }
  }

  private movePlayerFromInput(inputFrame: PlayerInputFrame, delta: number): void {
    this.moveActorFromInput(this.player, inputFrame, delta);

    this.playerGlow.x = this.player.x;
    this.playerGlow.y = this.player.y;
  }

  private moveActorFromInput(
    actor: Phaser.GameObjects.Rectangle,
    inputFrame: PlayerInputFrame,
    delta: number,
  ): void {
    let moveX = 0;
    let moveY = 0;

    if (inputFrame.left) {
      moveX -= 1;
    }

    if (inputFrame.right) {
      moveX += 1;
    }

    if (inputFrame.up) {
      moveY -= 1;
    }

    if (inputFrame.down) {
      moveY += 1;
    }

    if (moveX !== 0 && moveY !== 0) {
      moveX *= Math.SQRT1_2;
      moveY *= Math.SQRT1_2;
    }

    const seconds = delta / 1000;

    const changeX = moveX * PLAYER_SPEED * seconds;
    const changeY = moveY * PLAYER_SPEED * seconds;

    this.tryMoveActor(actor, changeX, changeY);
  }

  private tryMoveActor(
    actor: Phaser.GameObjects.Rectangle,
    changeX: number,
    changeY: number,
  ): void {
    const nextX = actor.x + changeX;

    if (!this.wouldCollideAt(nextX, actor.y)) {
      actor.x = nextX;
    }

    const nextY = actor.y + changeY;

    if (!this.wouldCollideAt(actor.x, nextY)) {
      actor.y = nextY;
    }
  }

  private wouldCollideAt(actorX: number, actorY: number): boolean {
    const actorBounds = this.getActorBoundsAt(actorX, actorY);

    for (const wallBound of this.wallBounds) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(actorBounds, wallBound)) {
        return true;
      }
    }

    for (const door of this.doors) {
      if (door.open) {
        continue;
      }

      const doorBounds = this.getTileBounds(door.data.x, door.data.y);

      if (Phaser.Geom.Intersects.RectangleToRectangle(actorBounds, doorBounds)) {
        return true;
      }
    }

    return false;
  }

  private updatePuzzleState(): void {
    const actorBounds = this.getAllActorBounds();
    const activeDoorIds = new Set<string>();

    for (const plate of this.plates) {
      const plateBounds = this.getPlateBounds(plate.data.x, plate.data.y);

      const isPressed = actorBounds.some((bounds) =>
        Phaser.Geom.Intersects.RectangleToRectangle(bounds, plateBounds),
      );

      plate.pressed = isPressed;

      if (isPressed) {
        plate.view.setFillStyle(COLORS.plateOn, 0.8);
        plate.view.setStrokeStyle(2, 0xffffff, 0.8);

        for (const doorId of plate.data.controls) {
          activeDoorIds.add(doorId);
        }
      } else {
        plate.view.setFillStyle(COLORS.plateOff, 0.45);
        plate.view.setStrokeStyle(2, COLORS.plateOn, 0.45);
      }
    }

    for (const door of this.doors) {
      const shouldOpen = activeDoorIds.has(door.data.id);

      if (shouldOpen === door.open) {
        continue;
      }

      door.open = shouldOpen;

      if (door.open) {
        door.view.setFillStyle(COLORS.doorOpen, 0.16);
        door.view.setStrokeStyle(2, COLORS.doorOpen, 0.45);
        door.view.setAlpha(0.35);
        this.sfx.play("doorOpen");
      } else {
        door.view.setFillStyle(COLORS.doorClosed, 0.85);
        door.view.setStrokeStyle(2, 0xffffff, 0.75);
        door.view.setAlpha(1);
        this.sfx.play("doorClose");
      }
    }
  }

  private getAllActorBounds(): Phaser.Geom.Rectangle[] {
    const bounds = [this.getActorBoundsAt(this.player.x, this.player.y)];

    for (const ghost of this.ghosts) {
      bounds.push(this.getActorBoundsAt(ghost.view.x, ghost.view.y));
    }

    return bounds;
  }

  private checkWinCondition(): void {
    const playerBounds = this.getActorBoundsAt(this.player.x, this.player.y);
    const exitBounds = this.getExitBounds();

    const reachedExit = Phaser.Geom.Intersects.RectangleToRectangle(
      playerBounds,
      exitBounds,
    );

    if (!reachedExit) {
      return;
    }

    this.completeLevel();
  }

  private completeLevel(): void {
    this.levelComplete = true;
    this.saveProgress();
    this.sfx.play("levelComplete");

    this.player.setFillStyle(0xffffff);
    this.playerGlow.setAlpha(0.5);

    const isFinalLevel = this.isFinalLevel();

    const titleText = isFinalLevel ? "DEMO COMPLETE" : "LEVEL COMPLETE";
    const subtitleText = isFinalLevel
      ? "You completed the current prototype levels."
      : "You used timelines to solve the room.";

    const nextTextValue = isFinalLevel
      ? "Press Enter / N to replay from Level 1"
      : "Press Enter / N for next level";

    const panel = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, 170, 0x02030a, 0.9)
      .setStrokeStyle(1, 0x5fffd7, 0.6);

    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 38, titleText, {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#d7faff",
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 2, subtitleText, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#8fdbe8",
      })
      .setOrigin(0.5);

    const nextText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 32, nextTextValue, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#9fffe4",
      })
      .setOrigin(0.5);

    const resetText = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 56,
        "Backspace / Shift+R: reset current level",
        {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#6f96a3",
        },
      )
      .setOrigin(0.5);

    this.completionViews = [panel, title, subtitle, nextText, resetText];
  }

  private getActorBoundsAt(x: number, y: number): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      x - PLAYER_SIZE / 2,
      y - PLAYER_SIZE / 2,
      PLAYER_SIZE,
      PLAYER_SIZE,
    );
  }

  private getExitBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.exitCore.x - EXIT_SIZE / 2,
      this.exitCore.y - EXIT_SIZE / 2,
      EXIT_SIZE,
      EXIT_SIZE,
    );
  }

  private getPlateBounds(tileX: number, tileY: number): Phaser.Geom.Rectangle {
    const worldX = tileX * TILE_SIZE;
    const worldY = tileY * TILE_SIZE;

    return new Phaser.Geom.Rectangle(
      worldX - PLATE_SIZE / 2,
      worldY - PLATE_SIZE / 2,
      PLATE_SIZE,
      PLATE_SIZE,
    );
  }

  private getTileBounds(tileX: number, tileY: number): Phaser.Geom.Rectangle {
    const worldX = tileX * TILE_SIZE;
    const worldY = tileY * TILE_SIZE;

    return new Phaser.Geom.Rectangle(
      worldX - TILE_SIZE / 2,
      worldY - TILE_SIZE / 2,
      TILE_SIZE,
      TILE_SIZE,
    );
  }

  private drawFloorGrid(): void {
    const graphics = this.add.graphics();

    graphics.lineStyle(1, COLORS.floorLine, 0.35);

    for (let x = 0; x <= GAME_WIDTH; x += TILE_SIZE) {
      graphics.lineBetween(x, 0, x, GAME_HEIGHT);
    }

    for (let y = 0; y <= GAME_HEIGHT; y += TILE_SIZE) {
      graphics.lineBetween(0, y, GAME_WIDTH, y);
    }
  }

  private drawRoomWalls(): void {
    this.wallBounds = [];

    for (const tile of this.level.walls) {
      const worldX = tile.x * TILE_SIZE;
      const worldY = tile.y * TILE_SIZE;

      const wall = this.add.rectangle(
        worldX,
        worldY,
        TILE_SIZE,
        TILE_SIZE,
        COLORS.wall,
      );

      wall.setStrokeStyle(1, COLORS.wallStroke, 0.35);

      this.wallBounds.push(this.getTileBounds(tile.x, tile.y));
    }
  }

  private createPlates(): void {
    this.plates = [];

    for (const plateData of this.level.plates) {
      const worldX = plateData.x * TILE_SIZE;
      const worldY = plateData.y * TILE_SIZE;

      const plateView = this.add.rectangle(
        worldX,
        worldY,
        PLATE_SIZE,
        PLATE_SIZE,
        COLORS.plateOff,
        0.45,
      );

      plateView.setStrokeStyle(2, COLORS.plateOn, 0.45);

      this.plates.push({
        data: plateData,
        view: plateView,
        pressed: false,
      });
    }
  }

  private createDoors(): void {
    this.doors = [];

    for (const doorData of this.level.doors) {
      const worldX = doorData.x * TILE_SIZE;
      const worldY = doorData.y * TILE_SIZE;

      const doorView = this.add.rectangle(
        worldX,
        worldY,
        TILE_SIZE,
        TILE_SIZE,
        COLORS.doorClosed,
        0.85,
      );

      doorView.setStrokeStyle(2, 0xffffff, 0.75);

      this.doors.push({
        data: doorData,
        view: doorView,
        open: false,
      });
    }
  }

  private createExitPortal(): void {
    const exitX = this.level.exit.x * TILE_SIZE;
    const exitY = this.level.exit.y * TILE_SIZE;

    this.exitCore = this.add.circle(exitX, exitY, 16, COLORS.exitCore, 0.9);

    this.exitRing = this.add.rectangle(
      exitX,
      exitY,
      42,
      42,
      COLORS.exitRing,
      0.14,
    );

    this.exitRing.setStrokeStyle(2, COLORS.exitRing, 0.8);

    this.tweens.add({
      targets: this.exitCore,
      scale: 1.2,
      alpha: 0.65,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.tweens.add({
      targets: this.exitRing,
      angle: 360,
      duration: 2800,
      repeat: -1,
      ease: "Linear",
    });
  }

  private createPlayer(): void {
    const spawnX = this.level.spawn.x * TILE_SIZE;
    const spawnY = this.level.spawn.y * TILE_SIZE;

    this.playerGlow = this.add.circle(
      spawnX,
      spawnY,
      30,
      COLORS.playerGlow,
      0.18,
    );

    this.player = this.add.rectangle(
      spawnX,
      spawnY,
      PLAYER_SIZE,
      PLAYER_SIZE,
      COLORS.player,
    );

    this.player.setStrokeStyle(2, 0xffffff, 0.65);

    this.tweens.add({
      targets: this.playerGlow,
      alpha: 0.32,
      scale: 1.18,
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private createHud(): void {
    this.add.text(24, 20, "Afterimage Architect", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#d7faff",
    });

    const levelNumber = LEVEL_KEYS.indexOf(this.currentLevelKey) + 1;

    this.add.text(
      24,
      48,
      `Level ${levelNumber}/${LEVEL_KEYS.length}: ${this.level.name}`,
      {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#8fdbe8",
      },
    );

    this.add.text(24, 72, this.level.instruction, {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#d7faff",
      wordWrap: { width: 520 },
    });

    this.add.text(24, 96, this.level.hint, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#6f96a3",
      wordWrap: { width: 520 },
    });

    this.timelineText = this.add.text(24, 128, "", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#d7faff",
    });

    this.recordingText = this.add.text(24, 152, "", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#8fdbe8",
    });

    this.ghostText = this.add.text(24, 176, "", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#9fffe4",
    });

    this.add.text(
      24,
      GAME_HEIGHT - 40,
      "Esc/P: pause | Enter/N: next | R: afterimage | Backspace: reset",
      {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#6f96a3",
      },
    );

    this.updateHud();
  }

  private updateHud(): void {
    this.timelineText.setText(`Timeline: ${this.timelineNumber}`);
    this.recordingText.setText(
      `Current frames: ${this.currentRecording.length} | Saved attempts: ${this.savedRecordings.length}`,
    );
    this.ghostText.setText(`Afterimages: ${this.ghosts.length}`);
  }
}