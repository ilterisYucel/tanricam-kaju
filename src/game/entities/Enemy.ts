import Phaser from 'phaser';
import type { EnemyKind, Species, Weapon } from '../types';
import type { Player } from './Player';

export interface EnemyOptions {
  kind: EnemyKind;
  x: number;
  y: number;
  skin?: number;
  flying?: boolean;
  elite?: boolean;
  boss?: boolean;
  patrolMin: number;
  patrolMax: number;
  hpScale?: number;
  speedScale?: number;
}

interface EnemyStats {
  texture: string;
  frame: number;
  species: Species;
  hp: number;
  speed: number;
  bodyW: number;
  bodyH: number;
  frameW: number;
  frameH: number;
  scale: number;
  gravity: boolean;
  contactDamage: number;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly species: Species;
  readonly kind: EnemyKind;
  readonly isBoss: boolean;
  readonly isElite: boolean;
  hp: number;
  readonly maxHp: number;
  readonly contactDamage: number;
  private speed: number;
  private hpBar?: Phaser.GameObjects.Graphics;
  private dir: 1 | -1 = 1;
  private patrolMin: number;
  private patrolMax: number;
  private flying: boolean;
  private baseY: number;
  private phase = Math.random() * Math.PI * 2;
  private stunUntil = 0;
  private nextHop = 0;
  private nextLunge = 0;
  private dead = false;

  constructor(scene: Phaser.Scene, options: EnemyOptions) {
    const stats = Enemy.statsFor(options);
    super(scene, options.x, options.y, stats.texture, stats.frame);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.kind = options.kind;
    this.species = stats.species;
    this.isBoss = Boolean(options.boss);
    this.isElite = Boolean(options.elite);
    this.hp = Math.max(1, Math.round(stats.hp * (options.hpScale ?? 1)));
    this.maxHp = this.hp;
    this.contactDamage = stats.contactDamage;
    this.speed = stats.speed * (options.speedScale ?? 1);
    this.flying = Boolean(options.flying);
    this.baseY = options.y;
    this.patrolMin = options.patrolMin;
    this.patrolMax = options.patrolMax;

    this.setOrigin(0.5, 1);
    this.setDepth(40);
    this.setScale(stats.scale);
    this.arcadeBody.setSize(stats.bodyW, stats.bodyH);
    this.arcadeBody.setOffset((stats.frameW - stats.bodyW) / 2, stats.frameH - stats.bodyH - 4);
    this.setCollideWorldBounds(false);

    if (this.flying) {
      this.arcadeBody.setAllowGravity(false);
    } else {
      this.arcadeBody.setAllowGravity(true);
      this.setCollideWorldBounds(false);
    }

    if (!this.isBoss && this.maxHp > 1) {
      this.hpBar = scene.add.graphics().setDepth(41).setVisible(false);
    }

    if (this.kind === 'doctor') this.play('doctor-walk');
    else if (this.kind === 'nurse') this.play('nurse-walk');
    else if (this.kind === 'pus') this.setFrame(3);
  }

  private static statsFor(options: EnemyOptions): EnemyStats {
    const elite = Boolean(options.elite);
    const boss = Boolean(options.boss);
    switch (options.kind) {
      case 'pus':
        return {
          texture: 'pus-stages', frame: 3, species: 'microbe', hp: 3, speed: 32,
          bodyW: 58, bodyH: 26, frameW: 77, frameH: 70, scale: 1, gravity: true,
          contactDamage: 1,
        };
      case 'doctor':
        return {
          texture: 'doctor-walk', frame: 0, species: 'human', hp: elite ? 8 : 6,
          speed: elite ? 82 : 64, bodyW: 42, bodyH: 98, frameW: 77, frameH: 115,
          scale: elite ? 1.7 : 1.5, gravity: true, contactDamage: 2,
        };
      case 'nurse':
        return {
          texture: 'nurse-walk', frame: 0, species: 'human', hp: elite ? 7 : 5,
          speed: elite ? 96 : 76, bodyW: 40, bodyH: 98, frameW: 71, frameH: 114,
          scale: elite ? 1.75 : 1.55, gravity: true, contactDamage: 1,
        };
      case 'microbe':
      default:
        return {
          texture: 'microbe-skins', frame: (options.skin ?? 0) % 5, species: 'microbe',
          hp: boss ? 20 : elite ? 6 : 4 + ((options.skin ?? 0) >= 3 ? 1 : 0),
          speed: boss ? 42 : options.flying ? 46 : 58,
          bodyW: 58, bodyH: 68, frameW: 100, frameH: 106,
          scale: boss ? 2.2 : elite ? 1.3 : 1, gravity: !options.flying,
          contactDamage: boss ? 2 : 1,
        };
    }
  }

  private get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  update(time: number, delta: number, player: Player): void {
    if (this.dead || !this.active) return;
    this.updateHealthBar();
    const dt = delta / 1000;

    if (this.flying) {
      this.y = this.baseY + Math.sin(time * 0.003 + this.phase) * 14;
      if (time > this.stunUntil) {
        this.setVelocityX(this.dir * this.speed);
        this.setFlipX(this.dir < 0);
      }
      this.checkPatrol();
      return;
    }

    if (this.kind === 'pus') {
      if (this.arcadeBody.blocked.down && time > this.nextHop) {
        this.nextHop = time + 1250 + Math.random() * 700;
        const toward = player.x < this.x ? -1 : 1;
        this.setVelocityY(-360);
        this.setVelocityX(toward * 60);
      }
      this.setFlipX(player.x < this.x);
      return;
    }

    if (this.isBoss) {
      if (this.arcadeBody.blocked.down && time > this.nextHop) {
        this.nextHop = time + 1900 + Math.random() * 800;
        const toward = player.x < this.x ? -1 : 1;
        this.setVelocityY(-430);
        this.setVelocityX(toward * 80);
        this.setFlipX(toward < 0);
      }
      return;
    }

    if (time < this.stunUntil) return;

    const distance = Math.abs(player.x - this.x);
    const sameFloor = Math.abs(player.y - this.y) < 150;
    const aggressive = distance < 300 && sameFloor;

    if (this.kind === 'nurse' && distance < 160 && sameFloor) {
      if (time > this.nextLunge) {
        this.nextLunge = time + 1800;
        this.play('nurse-attack', true);
        this.setVelocityX((player.x < this.x ? -1 : 1) * this.speed * 1.7);
        this.setFlipX(player.x < this.x);
        return;
      }
      this.setVelocityX(0);
      if (this.anims.currentAnim?.key !== 'nurse-walk') this.play('nurse-walk');
      return;
    }

    if (this.kind === 'doctor' && aggressive) {
      this.setVelocityX((player.x < this.x ? -1 : 1) * this.speed * 1.55);
      this.setFlipX(player.x < this.x);
      if (this.anims.currentAnim?.key !== 'doctor-charge') this.play('doctor-charge');
      this.checkPatrol(false);
      return;
    }

    if (this.kind === 'doctor') {
      if (this.anims.currentAnim?.key !== 'doctor-walk') this.play('doctor-walk');
    } else if (this.kind === 'nurse') {
      if (this.anims.currentAnim?.key !== 'nurse-walk') this.play('nurse-walk');
    }

    this.setVelocityX(this.dir * this.speed);
    this.setFlipX(this.dir < 0);
    this.checkPatrol();
    void dt;
  }

  private checkPatrol(turn = true): void {
    if (this.x <= this.patrolMin) this.dir = 1;
    else if (this.x >= this.patrolMax) this.dir = -1;
    if (!turn) {
      if (this.x < this.patrolMin) this.x = this.patrolMin;
      if (this.x > this.patrolMax) this.x = this.patrolMax;
    }
  }

  takeHit(weapon: Weapon, damage: number): 'hit' | 'immune' | 'dead' {
    if (this.dead) return 'dead';
    const target: Species = weapon === 'domestos' ? 'microbe' : 'human';
    if (target !== this.species) return 'immune';

    this.hp -= damage;
    this.stunUntil = this.scene.time.now + 180;
    this.setTint(0xffffff);
    this.scene.time.delayedCall(90, () => {
      if (this.active) this.clearTint();
    });

    if (this.kind === 'pus') {
      this.setFrame(Phaser.Math.Clamp(this.hp, 0, 3));
    }

    if (this.hp <= 0) {
      this.die();
      return 'dead';
    }
    this.updateHealthBar();
    return 'hit';
  }

  private updateHealthBar(): void {
    if (!this.hpBar) return;
    const visible = this.hp > 0 && this.hp < this.maxHp;
    this.hpBar.setVisible(visible);
    if (!visible) return;
    const width = Math.max(34, Math.min(72, this.displayWidth * 0.8));
    const barX = this.x - width / 2;
    const barY = this.y - this.displayHeight - 12;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x081214, 0.85).fillRect(barX, barY, width, 5);
    this.hpBar
      .fillStyle(0xff7f9a, 1)
      .fillRect(barX + 1, barY + 1, (width - 2) * (this.hp / this.maxHp), 3);
  }

  private die(): void {
    if (this.dead) return;
    this.dead = true;
    this.hpBar?.destroy();
    this.hpBar = undefined;
    this.arcadeBody.enable = false;
    this.anims.stop();
    if (this.kind === 'pus') this.setFrame(4);
    this.scene.events.emit('enemy:dead', this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: this.scaleX * 1.25,
      scaleY: this.scaleY * 0.8,
      duration: this.isBoss ? 900 : 240,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroy(),
    });
  }
}
