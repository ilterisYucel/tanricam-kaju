import Phaser from 'phaser';
import type { Species, Weapon } from '../types';

export class Projectile extends Phaser.Physics.Arcade.Image {
  weapon: Weapon = 'domestos';
  target: Species = 'microbe';
  damage = 1;
  bornAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(60);
    this.arcadeBody.setAllowGravity(false);
    this.setActive(false);
    this.setVisible(false);
  }

  private get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  fire(
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    weapon: Weapon,
    damage: number,
  ): void {
    this.weapon = weapon;
    this.target = weapon === 'domestos' ? 'microbe' : 'human';
    this.damage = damage;
    this.bornAt = this.scene.time.now;

    this.setTexture(weapon === 'domestos' ? 'domestos-bottle' : 'dolma');
    this.setPosition(x, y);
    const levelBoost = 1 + Math.min(4, Math.max(0, damage - 1)) * 0.055;
    this.setScale((weapon === 'domestos' ? 0.44 : 0.6) * levelBoost);
    this.setActive(true);
    this.setVisible(true);
    this.setAlpha(1);
    this.setAngle(0);
    this.arcadeBody.enable = true;
    this.arcadeBody.setAllowGravity(false);
    this.arcadeBody.setSize(50, 34, true);
    this.setVelocity(velocityX, velocityY);
    this.setAngularVelocity(velocityX < 0 ? -(weapon === 'domestos' ? 520 : 300) : weapon === 'domestos' ? 520 : 300);
    this.setFlipX(velocityX < 0);
  }

  update(time: number): void {
    if (!this.active) return;
    if (time - this.bornAt > 1700 || this.x < -130 || this.x > this.scene.physics.world.bounds.width + 130) {
      this.kill();
    }
  }

  kill(): void {
    this.setActive(false);
    this.setVisible(false);
    this.arcadeBody.enable = false;
    this.setVelocity(0, 0);
    this.setAngularVelocity(0);
  }
}
