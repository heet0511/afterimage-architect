import Phaser from "phaser";
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from "../constants";
import {
  LEVEL_SELECT_INFO,
  readHighestUnlockedLevelIndex,
} from "../levels";
import { GeneratedSfx } from "../systems/GeneratedSfx";

export class LevelSelectScene extends Phaser.Scene {
  private readonly sfx = new GeneratedSfx();

  private levelNumberKeys: Phaser.Input.Keyboard.Key[] = [];
  private continueKey!: Phaser.Input.Keyboard.Key;

  private highestUnlockedLevelIndex = 0;
  private messageText!: Phaser.GameObjects.Text;

  constructor() {
    super("LevelSelectScene");
  }

  create(): void {
    this.highestUnlockedLevelIndex = readHighestUnlockedLevelIndex();

    this.cameras.main.setBackgroundColor(COLORS.background);

    this.createInput();
    this.drawBackgroundGrid();
    this.createTitle();
    this.createLevelCards();
    this.createFooter();
  }

  update(): void {
    for (let index = 0; index < this.levelNumberKeys.length; index += 1) {
      if (Phaser.Input.Keyboard.JustDown(this.levelNumberKeys[index])) {
        this.tryStartLevel(index);
        return;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.continueKey)) {
      this.tryStartLevel(this.highestUnlockedLevelIndex);
    }
  }

  private createInput(): void {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      throw new Error("Keyboard input is not available.");
    }

    const numberKeyCodes = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
    ];

    this.levelNumberKeys = numberKeyCodes.map((keyCode) =>
      keyboard.addKey(keyCode),
    );

    this.continueKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }

  private tryStartLevel(levelIndex: number): void {
    const levelInfo = LEVEL_SELECT_INFO[levelIndex];

    if (!levelInfo) {
      return;
    }

    if (levelIndex > this.highestUnlockedLevelIndex) {
      this.sfx.play("locked");
      this.messageText.setText("Complete the previous level to unlock this one.");
      this.cameras.main.shake(120, 0.004);
      return;
    }

    this.sfx.play("select");

    this.scene.start("GameScene", {
      levelKey: levelInfo.key,
    });
  }

  private drawBackgroundGrid(): void {
    const graphics = this.add.graphics();

    graphics.lineStyle(1, COLORS.floorLine, 0.28);

    for (let x = 0; x <= GAME_WIDTH; x += TILE_SIZE) {
      graphics.lineBetween(x, 0, x, GAME_HEIGHT);
    }

    for (let y = 0; y <= GAME_HEIGHT; y += TILE_SIZE) {
      graphics.lineBetween(0, y, GAME_WIDTH, y);
    }
  }

  private createTitle(): void {
    this.add
      .text(GAME_WIDTH / 2, 54, "AFTERIMAGE ARCHITECT", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#d7faff",
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        88,
        "Use recordings of your past attempts to cooperate with yourself.",
        {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#8fdbe8",
        },
      )
      .setOrigin(0.5);
  }

  private createLevelCards(): void {
    const startY = 140;
    const cardWidth = 640;
    const cardHeight = 58;

    for (let index = 0; index < LEVEL_SELECT_INFO.length; index += 1) {
      const levelInfo = LEVEL_SELECT_INFO[index];
      const isUnlocked = index <= this.highestUnlockedLevelIndex;

      const cardX = GAME_WIDTH / 2;
      const cardY = startY + index * 70;

      const fillColor = isUnlocked ? 0x07131c : 0x05070d;
      const borderColor = isUnlocked ? COLORS.playerGlow : 0x32414a;
      const titleColor = isUnlocked ? "#d7faff" : "#60717a";
      const descriptionColor = isUnlocked ? "#8fdbe8" : "#46555d";

      this.add
        .rectangle(cardX, cardY, cardWidth, cardHeight, fillColor, 0.92)
        .setStrokeStyle(1, borderColor, isUnlocked ? 0.7 : 0.4);

      this.add.text(cardX - cardWidth / 2 + 24, cardY - 18, `${index + 1}`, {
        fontFamily: "monospace",
        fontSize: "22px",
        color: titleColor,
      });

      this.add.text(
        cardX - cardWidth / 2 + 70,
        cardY - 18,
        `${levelInfo.name}${isUnlocked ? "" : "  [LOCKED]"}`,
        {
          fontFamily: "monospace",
          fontSize: "17px",
          color: titleColor,
        },
      );

      this.add.text(cardX - cardWidth / 2 + 70, cardY + 8, levelInfo.description, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: descriptionColor,
      });
    }
  }

  private createFooter(): void {
    const continueLevel = LEVEL_SELECT_INFO[this.highestUnlockedLevelIndex];

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 76,
        `Enter: continue from ${continueLevel.name} | 1-${LEVEL_SELECT_INFO.length}: select level`,
        {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#9fffe4",
        },
      )
      .setOrigin(0.5);

    this.messageText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 44, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ff9f1c",
      })
      .setOrigin(0.5);
  }
}