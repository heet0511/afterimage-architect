import Phaser from "phaser";
import "./style.css";
import { GAME_HEIGHT, GAME_WIDTH } from "./game/constants";
import { GameScene } from "./game/scenes/GameScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#05070d",
  pixelArt: false,
  roundPixels: true,
  scene: [GameScene],
};

new Phaser.Game(config);