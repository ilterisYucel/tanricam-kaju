import Phaser from 'phaser';
import { getSave } from '../save';
import { sfx } from '../audio';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Small branding asset, loaded before the loading screen so it can show it.
    this.load.image('logo', 'assets/game/logo.png');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d1b1e');
    sfx.setEnabled(getSave().sound);

    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('pixel', 4, 4);
    g.destroy();

    this.scene.start('Preload');
  }
}
