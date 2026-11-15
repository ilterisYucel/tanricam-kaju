import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './layout';

export { DESIGN_WIDTH, DESIGN_HEIGHT, GROUND_Y, FOOT_PAD } from './layout';

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    backgroundColor: '#0d1b1e',
    pixelArt: true,
    roundPixels: true,
    banner: false,
    disableContextMenu: true,
    input: {
      activePointers: 4,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 2000 },
        debug: false,
      },
    },
    scene: [BootScene, PreloadScene, MenuScene, GameScene, UIScene],
  };
}
