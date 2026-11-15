import Phaser from 'phaser';

const FRAME_W = 134;
const FRAME_H = 201;
const BODY_W = 46;
const BODY_H = 160;

export class Player extends Phaser.Physics.Arcade.Sprite {
  health = 3;
  maxHealth = 3;
  facing: 1 | -1 = 1;
  invulnerableUntil = 0;
  lastGroundedAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'hero-idle', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1);
    this.setDepth(50);
    this.setCollideWorldBounds(true);
    this.setDragX(1900);
    this.setMaxVelocity(340, 1100);
    this.arcadeBody.setSize(BODY_W, BODY_H);
    this.arcadeBody.setOffset((FRAME_W - BODY_W) / 2, FRAME_H - BODY_H - 4);
    this.play('hero-idle');
  }

  private get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get isGrounded(): boolean {
    return this.arcadeBody.blocked.down || this.arcadeBody.touching.down;
  }

  get canBeHurt(): boolean {
    return this.scene.time.now >= this.invulnerableUntil;
  }

  setFacing(direction: number): void {
    if (direction === 0) return;
    this.facing = direction < 0 ? -1 : 1;
    this.setFlipX(this.facing < 0);
  }

  playWalk(): void {
    if (this.anims.currentAnim?.key !== 'hero-walk') this.play('hero-walk');
  }

  playIdle(): void {
    if (this.anims.currentAnim?.key !== 'hero-idle') this.play('hero-idle');
  }

  playJump(): void {
    this.anims.stop();
    this.setTexture('hero-idle', 3);
  }

  hurt(amount: number, fromX: number): boolean {
    const now = this.scene.time.now;
    if (now < this.invulnerableUntil || this.health <= 0) return false;

    this.health = Math.max(0, this.health - amount);
    this.invulnerableUntil = now + 1100;
    this.setTint(0xff7b7b);
    this.setVelocityX(this.x < fromX ? -240 : 240);
    this.setVelocityY(-260);
    this.scene.tweens.add({
      targets: this,
      alpha: 0.35,
      duration: 90,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        this.setAlpha(1);
        this.clearTint();
      },
    });
    return true;
  }

  heal(amount: number): boolean {
    if (this.health >= this.maxHealth) return false;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return true;
  }

  resetHealth(): void {
    this.health = this.maxHealth;
    this.invulnerableUntil = 0;
    this.setAlpha(1);
    this.clearTint();
  }

  updateAnimation(moving: boolean): void {
    if (!this.isGrounded) {
      this.playJump();
      return;
    }
    if (moving) this.playWalk();
    else this.playIdle();
  }
}
