import Phaser from 'phaser';
import type { Player } from './Player';

export class Kaju extends Phaser.GameObjects.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'kaju-run', 0);
    scene.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setDepth(45);
    this.setScale(0.92);
    this.play('kaju-run');
  }

  follow(player: Player, delta: number): void {
    const targetX = player.x - player.facing * 82;
    const targetY = player.y + 2;
    const t = 1 - Math.pow(0.00001, delta / 1000);
    const dx = targetX - this.x;

    if (Math.abs(dx) > 420 || Math.abs(targetY - this.y) > 260) {
      this.setPosition(targetX, targetY);
    } else {
      this.x = Phaser.Math.Linear(this.x, targetX, Math.min(0.16, t));
      this.y = Phaser.Math.Linear(this.y, targetY, Math.min(0.14, t));
    }

    if (Math.abs(dx) > 8) {
      this.setFlipX(dx < 0);
      if (!this.anims.isPlaying) this.play('kaju-run');
    } else {
      this.anims.stop();
      this.setFrame(0);
    }
  }

  celebrate(): void {
    this.scene.tweens.add({
      targets: this,
      y: this.y - 42,
      angle: this.flipX ? -8 : 8,
      duration: 180,
      yoyo: true,
      repeat: 2,
      ease: 'Quad.easeOut',
      onComplete: () => this.setAngle(0),
    });
  }
}
