import Phaser from 'phaser';
import {
  DESIGN_HEIGHT,
  DECOR_SCALE,
  FOOT_PAD,
  GROUND_Y,
  RAISED_SCALE,
  SUSHI_SCALE,
  type DecorKey,
  type HighFloorKey,
} from '../layout';
import { LEVELS } from '../data/levels';
import manifestJson from '../data/manifest.json';
import type { AssetManifest, HudState, LevelDef, PlatformDef, Weapon } from '../types';
import { Player } from '../entities/Player';
import { Kaju } from '../entities/Kaju';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { addXp, completeLevel, getSave, rescuedCount, xpForNext } from '../save';
import { sfx } from '../audio';
import { addParallax, makeBackgroundTexture } from '../ui/background';

const manifest = manifestJson as unknown as AssetManifest;
const PLAYER_SPEED = 300;

export class GameScene extends Phaser.Scene {
  private levelIndex = 0;
  private level!: LevelDef;
  private player!: Player;
  private kaju!: Kaju;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private boss?: Enemy;
  private animal?: Phaser.GameObjects.Image;
  private animalGlow?: Phaser.GameObjects.Arc;
  private animalMark?: Phaser.GameObjects.Text;
  private animalX = 0;
  private animalY = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cooldowns: Record<Weapon, number> = { domestos: 0, sarma: 0 };
  private attackQueue: Weapon[] = [];
  private virtualLeft = false;
  private virtualRight = false;
  private jumpRequested = false;
  private variableJump = false;
  private jumpBufferedAt = -9999;
  private jumpLockUntil = 0;
  private lastGroundedAt = -9999;
  private lastSafe = { x: 150, y: 0 };
  private lastSafeAt = 0;
  private hudAt = 0;
  private completed = false;
  private failed = false;
  private respawning = false;
  private rescueHintShown = false;
  private nextBossSpawn = 0;
  private bossSpawnCount = 0;

  constructor() {
    super('Game');
  }

  init(data: { levelIndex?: number }): void {
    this.levelIndex = Math.max(0, Math.min(LEVELS.length - 1, data.levelIndex ?? 0));
    this.completed = false;
    this.failed = false;
    this.respawning = false;
    this.rescueHintShown = false;
    this.attackQueue = [];
    this.virtualLeft = false;
    this.virtualRight = false;
    this.jumpRequested = false;
    this.variableJump = false;
    this.jumpBufferedAt = -9999;
    this.jumpLockUntil = 0;
    this.lastGroundedAt = -9999;
    this.cooldowns = { domestos: 0, sarma: 0 };
    this.boss = undefined;
    this.bossSpawnCount = 0;
  }

  create(): void {
    this.level = LEVELS[this.levelIndex];
    this.physics.world.setBounds(0, 0, this.level.width, 1200);
    this.cameras.main.setBounds(0, 0, this.level.width, DESIGN_HEIGHT);
    this.cameras.main.setBackgroundColor(this.level.theme === 'night' ? '#071015' : '#132a2b');

    const bgKey = makeBackgroundTexture(this, this.level.theme);
    this.add.image(0, 0, bgKey).setOrigin(0).setScrollFactor(0).setDepth(-30);
    addParallax(this, this.level.theme);

    this.solids = this.physics.add.staticGroup();
    for (const platform of this.level.platforms) this.buildPlatform(platform);
    this.spawnDecor();

    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group({
      classType: Projectile,
      maxSize: 18,
      runChildUpdate: false,
    });
    this.pickups = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });

    const start = this.level.platforms[0];
    this.player = new Player(this, 260, start.y + FOOT_PAD);
    this.lastSafe = { x: 260, y: start.y + FOOT_PAD };
    this.kaju = new Kaju(this, this.player.x - 90, this.player.y);

    this.physics.add.collider(this.player, this.solids);
    this.spawnEnemies();
    this.physics.add.collider(this.enemies, this.solids);
    this.spawnPickups();
    this.spawnAnimal();

    this.physics.add.overlap(this.player, this.enemies, this.onPlayerEnemy, undefined, this);
    this.physics.add.overlap(this.player, this.pickups, this.onPickup, undefined, this);
    this.physics.add.overlap(this.projectiles, this.enemies, this.onProjectileEnemy, undefined, this);

    this.cameras.main.startFollow(this.player, true, 0.12, 0);
    this.cameras.main.setDeadzone(240, 720);
    this.cameras.main.scrollY = 0;
    this.cameras.main.fadeIn(300, 7, 12, 14);

    this.keys = this.input.keyboard!.addKeys('LEFT,RIGHT,UP,A,D,W,SPACE,J,K,ESC') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.input.on('pointerdown', () => sfx.unlock());
    this.events.on('enemy:dead', this.onEnemyDead, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    this.scene.launch('UI', { levelIndex: this.levelIndex });
    this.time.delayedCall(60, () => this.emitHud());
    this.lastSafeAt = this.time.now;
  }

  update(time: number, delta: number): void {
    if (this.completed || this.failed) {
      this.player.setVelocityX(0);
      return;
    }

    this.cooldowns.domestos = Math.max(0, this.cooldowns.domestos - delta);
    this.cooldowns.sarma = Math.max(0, this.cooldowns.sarma - delta);

    const left = this.keys.LEFT.isDown || this.keys.A.isDown || this.virtualLeft;
    const right = this.keys.RIGHT.isDown || this.keys.D.isDown || this.virtualRight;
    const dir = left === right ? 0 : left ? -1 : 1;

    if (Phaser.Input.Keyboard.JustDown(this.keys.J)) this.requestAttack('domestos');
    if (Phaser.Input.Keyboard.JustDown(this.keys.K)) this.requestAttack('sarma');
    if (
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE) ||
      Phaser.Input.Keyboard.JustDown(this.keys.UP) ||
      Phaser.Input.Keyboard.JustDown(this.keys.W)
    ) {
      this.jumpBufferedAt = time;
      this.variableJump = true;
      this.jumpRequested = false;
    } else if (this.jumpRequested) {
      this.jumpBufferedAt = time;
      this.variableJump = false;
      this.jumpRequested = false;
    }

    if (this.player.isGrounded) this.lastGroundedAt = time;

    const jumpDown = this.keys.SPACE.isDown || this.keys.UP.isDown || this.keys.W.isDown;
    const canJump = this.player.isGrounded || time - this.lastGroundedAt < 110;
    if (
      time - this.jumpBufferedAt < 120 &&
      canJump &&
      time > this.jumpLockUntil &&
      (this.player.body as Phaser.Physics.Arcade.Body).velocity.y >= -10
    ) {
      this.player.setVelocityY(-1000);
      this.jumpBufferedAt = -9999;
      this.jumpLockUntil = time + 260;
      sfx.jump();
    }

    if (this.variableJump && !jumpDown && (this.player.body as Phaser.Physics.Arcade.Body).velocity.y < -320) {
      this.player.setVelocityY(-320);
    }

    if (dir !== 0) {
      this.player.setFacing(dir);
      this.player.setAccelerationX(dir * 2500);
      this.player.setDragX(0);
    } else {
      this.player.setAccelerationX(0);
      this.player.setDragX(2600);
    }

    this.player.updateAnimation(dir !== 0 && this.player.isGrounded);

    while (this.attackQueue.length > 0) {
      const weapon = this.attackQueue.shift()!;
      if (this.cooldowns[weapon] <= 0) this.fire(weapon);
    }

    this.projectiles.getChildren().forEach((child) => {
      const projectile = child as Projectile;
      if (projectile.active) projectile.update(time);
    });

    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Enemy;
      if (enemy.active) enemy.update(time, delta, this.player);
    });

    this.kaju.follow(this.player, delta);

    if (this.player.isGrounded && time - this.lastSafeAt > 250) {
      const platform = this.findPlatformAt(this.player.x, this.player.y - FOOT_PAD);
      if (
        platform &&
        this.player.x > platform.x + 70 &&
        this.player.x < platform.x + platform.width - 70
      ) {
        this.lastSafe = { x: this.player.x, y: this.player.y };
        this.lastSafeAt = time;
      }
    }

    if (this.player.y > 780 && !this.respawning) this.fallOut();

    if (this.boss?.active) {
      if (this.bossSpawnCount < 3 && time > this.nextBossSpawn) {
        this.nextBossSpawn = time + 4600;
        this.spawnBossMinion();
      }
    }

    if (this.animal && !this.completed && Math.abs(this.player.x - this.animalX) < 78) {
      if (this.boss?.active) {
        if (!this.rescueHintShown) {
          this.rescueHintShown = true;
          this.floatText(this.animalX, this.animalY - 170, 'ÖNCE ONU DURDUR!', '#ffd18a');
        }
      } else {
        this.rescueAnimal();
      }
    }

    if (time - this.hudAt > 220) {
      this.hudAt = time;
      this.emitHud();
    }
  }

  private buildPlatform(def: PlatformDef): void {
    const tint = this.level.theme === 'night' ? 0xc5d8ef : this.level.theme === 'dusk' ? 0xf0e1d2 : 0xffffff;

    if (def.kind === 'raised') {
      const row = def.row ?? 'RAISED1';
      const scales = RAISED_SCALE[row];
      let x = def.x;
      for (const key of def.tiles ?? []) {
        const info = manifest.images[key];
        if (!info) continue;
        const scale = scales[key as HighFloorKey] ?? 1;
        this.add
          .image(x, def.y - (info.surfaceOffset ?? 0) * scale, key)
          .setOrigin(0, 0)
          .setScale(scale)
          .setDepth(10)
          .setTint(tint);
        x += Math.round(info.width * scale);
      }
    } else {
      const strip = manifest.floor.strip;
      const count = def.tileCount ?? Math.max(1, Math.round(def.width / strip.width));
      for (let i = 0; i < count; i++) {
        this.add
          .image(def.x + i * strip.width, def.y - strip.surfaceOffset, 'floor-strip')
          .setOrigin(0, 0)
          .setDepth(10)
          .setTint(tint);
      }
    }

    const solid = this.solids.create(def.x + def.width / 2, def.y + 12, 'pixel') as Phaser.Physics.Arcade.Image;
    solid.setDisplaySize(def.width, 24);
    solid.refreshBody();
    solid.setVisible(false);

    // Upper routes are one-way: jump through from below and land on top.
    if (def.kind === 'raised') {
      const body = solid.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
    }
  }

  private spawnDecor(): void {
    const tint = this.level.theme === 'night' ? 0xc5d8ef : this.level.theme === 'dusk' ? 0xf0e1d2 : 0xffffff;
    for (const item of this.level.decor ?? []) {
      const info = manifest.images[item.tile];
      if (!info) continue;
      this.add
        .image(item.x, item.y + FOOT_PAD, item.tile)
        .setOrigin(0, 1)
        .setScale(DECOR_SCALE[item.tile as DecorKey] ?? 1)
        .setDepth(11)
        .setTint(tint);
    }
  }

  private spawnEnemies(): void {
    const tier = Math.floor((this.level.id - 1) / 10);
    const hpScale = 1 + tier * 0.2;
    const speedScale = 1 + tier * 0.1;

    for (const def of this.level.enemies) {
      const platform = this.findPlatformAt(def.x, (def.y ?? GROUND_Y + FOOT_PAD) - FOOT_PAD);
      if (!platform) continue;
      const y = def.y ?? platform.y + FOOT_PAD;
      const patrolMin = Math.max(platform.x + 30, def.x - 220);
      const patrolMax = Math.min(platform.x + platform.width - 30, def.x + 220);
      const enemy = new Enemy(this, {
        kind: def.kind,
        x: def.x,
        y,
        skin: def.skin,
        flying: def.flying,
        elite: def.elite,
        boss: def.boss,
        patrolMin,
        patrolMax,
        hpScale,
        speedScale,
      });
      this.enemies.add(enemy);
      if (def.boss) {
        this.boss = enemy;
        this.nextBossSpawn = this.time.now + 2600;
        sfx.boss();
      }
    }
  }

  private spawnBossMinion(): void {
    if (!this.boss?.active) return;
    this.bossSpawnCount++;
    const x = Phaser.Math.Clamp(this.boss.x - 140, this.boss.x - 220, this.boss.x + 220);
    const platform = this.findPlatformAt(x) ?? this.level.platforms[this.level.platforms.length - 1];
    const tier = Math.floor((this.level.id - 1) / 10);
    const enemy = new Enemy(this, {
      kind: 'microbe',
      x,
      y: platform.y + FOOT_PAD,
      skin: this.bossSpawnCount % 3,
      patrolMin: Math.max(platform.x + 30, x - 160),
      patrolMax: Math.min(platform.x + platform.width - 30, x + 160),
      hpScale: 1 + tier * 0.2,
      speedScale: 1 + tier * 0.1,
    });
    this.enemies.add(enemy);
    this.burst(x, platform.y - 50, 0xb9ff86, 10);
  }

  private spawnPickups(): void {
    for (const def of this.level.sushi) {
      if (!this.textures.exists(`sushi-${def.kind}`)) continue;
      const pickup = this.pickups.create(def.x, def.y, `sushi-${def.kind}`) as Phaser.Physics.Arcade.Image;
      pickup.setScale(SUSHI_SCALE).setDepth(30).setData('kind', def.kind);
      (pickup.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.tweens.add({
        targets: pickup,
        y: def.y - 9,
        duration: 850 + Math.random() * 250,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      const glow = this.add.circle(def.x, def.y, 38, 0xffe8a3, 0.14).setDepth(29);
      pickup.setData('glow', glow);
      this.tweens.add({
        targets: glow,
        alpha: 0.04,
        scale: 0.82,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private spawnAnimal(): void {
    const grounds = this.level.platforms.filter((p) => p.kind === 'ground');
    const last = grounds[grounds.length - 1] ?? this.level.platforms[this.level.platforms.length - 1];
    const key = `animal-${String(this.level.animal).padStart(2, '0')}`;
    if (!this.textures.exists(key)) return;

    this.animalX = this.level.animalX ?? last.x + last.width - 155;
    this.animalY = last.y + FOOT_PAD;
    this.animalGlow = this.add
      .circle(this.animalX, this.animalY - 62, 62, 0xfff0a8, 0.16)
      .setDepth(28);
    this.tweens.add({
      targets: this.animalGlow,
      alpha: 0.05,
      scale: 1.18,
      duration: 950,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.animal = this.add
      .image(this.animalX, this.animalY, key)
      .setOrigin(0.5, 1)
      .setScale(0.9)
      .setDepth(31);
    this.animalMark = this.add
      .text(this.animalX, this.animalY - 150, '!', {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ffe9a1',
        stroke: '#18302c',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(32);
    this.tweens.add({
      targets: [this.animalMark, this.animal],
      y: '-=10',
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private onPlayerEnemy: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, enemyObject) => {
    const enemy = enemyObject as Enemy;
    if (!enemy.active || this.completed) return;
    if (this.player.hurt(enemy.contactDamage, enemy.x)) {
      sfx.hurt();
      this.cameras.main.shake(100, 0.005);
      this.emitHud();
      if (this.player.health <= 0) this.fail();
    }
  };

  private onProjectileEnemy: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (projectileObject, enemyObject) => {
    const projectile = projectileObject as Projectile;
    const enemy = enemyObject as Enemy;
    if (!projectile.active || !enemy.active) return;

    const result = enemy.takeHit(projectile.weapon, projectile.damage);
    if (projectile.weapon === 'domestos') this.showDomestosBurst(projectile.x, projectile.y);
    projectile.kill();

    if (result === 'immune') {
      sfx.immune();
      this.floatText(enemy.x, enemy.y - enemy.displayHeight - 18, 'ETKİSİZ!', '#ffb3a7');
      this.burst(projectile.x, projectile.y, 0x9a9a9a, 5);
      return;
    }

    sfx.hit();
    this.cameras.main.shake(70, 0.003);
    this.burst(projectile.x, projectile.y, projectile.weapon === 'domestos' ? 0xaaffc0 : 0xffcf8a, 8);
    this.floatText(
      enemy.x,
      enemy.y - enemy.displayHeight - 12,
      `-${projectile.damage}`,
      enemy.isBoss ? '#fff2a8' : '#ffffff',
    );
    if (enemy.isBoss || result === 'dead') {
      this.emitHud();
    }
  };

  private onPickup: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, pickupObject) => {
    const pickup = pickupObject as Phaser.Physics.Arcade.Image;
    if (!pickup.active) return;
    const kind = pickup.getData('kind') as number;
    const glow = pickup.getData('glow') as Phaser.GameObjects.Arc | undefined;
    glow?.destroy();
    pickup.disableBody(true, true);
    this.burst(pickup.x, pickup.y, 0xffe6a4, 7);

    if (kind === 0 || kind === 1) {
      if (this.player.heal(1)) {
        sfx.pickup();
        this.floatText(pickup.x, pickup.y - 20, '+1 KALP', '#ffb3c7');
      } else {
        const result = addXp(1);
        if (result.levelUp) {
          sfx.levelUp();
          this.floatText(pickup.x, pickup.y - 20, 'SALDIRI GÜÇLENDİ!', '#aaffd0');
        } else {
          sfx.pickup();
          this.floatText(pickup.x, pickup.y - 20, '+1 XP', '#aaffd0');
        }
      }
    } else if (getSave().attackLevel >= 5) {
      if (this.player.heal(1)) {
        sfx.pickup();
        this.floatText(pickup.x, pickup.y - 20, '+1 KALP', '#ffb3c7');
      } else {
        sfx.pickup();
        this.floatText(pickup.x, pickup.y - 20, 'CAN DOLU', '#ffb3c7');
      }
    } else {
      const result = addXp(kind === 5 ? 2 : 1);
      if (result.levelUp) {
        sfx.levelUp();
        this.floatText(pickup.x, pickup.y - 20, 'SALDIRI GÜÇLENDİ!', '#aaffd0');
      } else {
        sfx.pickup();
        this.floatText(pickup.x, pickup.y - 20, kind === 5 ? '+2 XP' : '+1 XP', '#aaffd0');
      }
    }
    this.emitHud();
  };

  private fire(weapon: Weapon): void {
    const direction = this.player.facing;
    const projectile = this.projectiles.getFirstDead(
      true,
      this.player.x,
      this.player.y - 110,
      'domestos-bottle',
      0,
    ) as Projectile | null;
    if (!projectile) return;

    const save = getSave();
    const x = this.player.x + direction * 44;
    const y = this.player.y - 106;
    const wantedSpecies = weapon === 'domestos' ? 'microbe' : 'human';

    // Gentle auto-aim: a thrown bottle should land on a knee-high slime as
    // well as on a doctor. It only picks enemies in the facing direction.
    let targetX = direction * 300;
    let targetY = 0;
    let bestDistance = Infinity;
    for (const child of this.enemies.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active || enemy.species !== wantedSpecies) continue;
      const dx = enemy.x - x;
      const sideways = Math.abs(dx);
      if (sideways > 540) continue;
      if (dx !== 0 && Math.sign(dx) !== direction) continue;
      const dy = (enemy.body as Phaser.Physics.Arcade.Body).center.y - y;
      if (Math.abs(dy) > 190) continue;
      if (sideways < bestDistance) {
        bestDistance = sideways;
        targetX = dx;
        targetY = dy;
      }
    }

    const length = Math.hypot(targetX, targetY) || 1;
    const speed = weapon === 'domestos' ? 720 : 540;
    projectile.fire(
      x,
      y,
      (targetX / length) * speed,
      (targetY / length) * speed,
      weapon,
      save.attackLevel,
    );
    this.cooldowns[weapon] = 340;
    sfx.throw();
    this.cameras.main.shake(35, 0.0015);
    this.burst(x, y, weapon === 'domestos' ? 0xb9ffd6 : 0xffd497, 4);
    this.tweens.add({
      targets: this.player,
      angle: direction * 4,
      duration: 70,
      yoyo: true,
      onComplete: () => this.player.setAngle(0),
    });
  }

  private rescueAnimal(): void {
    if (this.completed || !this.animal) return;
    const save = getSave();
    completeLevel(this.level.id);
    this.completed = true;
    this.player.setAccelerationX(0);
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.kaju.celebrate();
    sfx.rescue();
    sfx.bark();
    this.emitHud();

    const payload = {
      levelId: this.level.id,
      levelName: this.level.name,
      animalKey: `animal-${String(this.level.animal).padStart(2, '0')}`,
      rescuedCount: rescuedCount(),
      isFinal: rescuedCount() >= LEVELS.length,
    };

    this.tweens.killTweensOf([this.animal, this.animalMark, this.animalGlow]);
    this.tweens.add({
      targets: [this.animal, this.animalMark, this.animalGlow],
      y: '-=90',
      alpha: 0,
      duration: 620,
      ease: 'Back.easeIn',
    });

    for (let i = 0; i < 10; i++) {
      const heart = this.add
        .text(this.animalX + Phaser.Math.Between(-60, 60), this.animalY - 80, '♥', {
          fontFamily: '"Trebuchet MS", Verdana, sans-serif',
          fontSize: `${Phaser.Math.Between(16, 28)}px`,
          color: '#ffb2c3',
        })
        .setOrigin(0.5)
        .setDepth(70);
      this.tweens.add({
        targets: heart,
        y: heart.y - Phaser.Math.Between(50, 130),
        alpha: 0,
        duration: 800 + i * 40,
        ease: 'Quad.easeOut',
        onComplete: () => heart.destroy(),
      });
    }

    this.time.delayedCall(720, () => {
      this.game.events.emit('game:complete', payload);
      this.scene.pause();
    });
  }

  private fail(): void {
    if (this.failed) return;
    this.failed = true;
    this.player.setAccelerationX(0);
    this.player.setVelocityX(0);
    this.player.anims.stop();
    this.player.setTint(0x888888);
    sfx.hurt();
    this.cameras.main.shake(260, 0.008);
    this.time.delayedCall(620, () => {
      this.game.events.emit('game:fail', {
        levelId: this.level.id,
        levelName: this.level.name,
      });
      this.scene.pause();
    });
  }

  private fallOut(): void {
    this.respawning = true;
    const nextHealth = Math.max(0, this.player.health - 1);
    this.player.health = nextHealth;
    this.player.invulnerableUntil = this.time.now + 1300;
    sfx.hurt();
    this.floatText(this.player.x, 640, '-1 KALP', '#ff9e9e');
    this.emitHud();

    if (nextHealth <= 0) {
      this.fail();
      return;
    }

    this.player.setAlpha(0.35);
    this.time.delayedCall(280, () => {
      this.player.setPosition(this.lastSafe.x, this.lastSafe.y);
      this.player.setVelocity(0, 0);
      this.player.setAlpha(1);
      this.respawning = false;
    });
  }

  private onEnemyDead(enemy: Enemy): void {
    const color = enemy.species === 'microbe' ? 0xa8ff86 : 0x9bd5ff;
    this.burst(enemy.x, enemy.y - enemy.displayHeight * 0.5, color, 12);
    this.cameras.main.shake(enemy.isBoss ? 260 : 60, enemy.isBoss ? 0.008 : 0.003);
    if (enemy.isBoss) {
      this.boss = undefined;
      this.floatText(enemy.x, enemy.y - enemy.displayHeight - 20, 'TEMİZLENDİ!', '#aaffd0');
      this.nextBossSpawn = Number.POSITIVE_INFINITY;
    }
    this.emitHud();
  }

  private findPlatformAt(x: number, surfaceY?: number): PlatformDef | undefined {
    const candidates = this.level.platforms.filter(
      (platform) => x >= platform.x && x <= platform.x + platform.width,
    );
    if (candidates.length === 0) return undefined;
    if (surfaceY !== undefined) {
      candidates.sort((a, b) => Math.abs(a.y - surfaceY) - Math.abs(b.y - surfaceY));
      return candidates[0];
    }
    return candidates.reduce((best, platform) => (platform.y < best.y ? platform : best));
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color,
        stroke: '#081214',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(80);
    this.tweens.add({
      targets: label,
      y: y - 54,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private showDomestosBurst(x: number, y: number): void {
    if (!this.textures.exists('domestos-burst')) return;
    const splash = this.add
      .image(x, y, 'domestos-burst')
      .setScale(0.45)
      .setAlpha(0.9)
      .setDepth(65);
    this.tweens.add({
      targets: splash,
      scale: 0.7,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => splash.destroy(),
    });
  }

  private burst(x: number, y: number, tint: number, count: number): void {
    const emitter = this.add.particles(x, y, 'pixel', {
      speed: { min: 50, max: 180 },
      angle: { min: 0, max: 360 },
      lifespan: 380,
      quantity: count,
      scale: { start: 1.2, end: 0 },
      tint,
      emitting: false,
    });
    emitter.setDepth(75);
    emitter.explode(count);
    this.time.delayedCall(500, () => emitter.destroy());
  }

  private emitHud(): void {
    if (!this.player) return;
    const state = this.getHudState();
    this.game.events.emit('hud:update', state);
  }

  getHudState(): HudState {
    const save = getSave();
    const bossNearby =
      this.boss?.active &&
      this.player &&
      Math.abs(this.boss.x - this.player.x) < 950;
    return {
      health: this.player?.health ?? 3,
      maxHealth: 3,
      attackLevel: save.attackLevel,
      xp: save.xp,
      xpNext: xpForNext(save.attackLevel),
      levelId: this.level?.id ?? 1,
      levelName: this.level?.name ?? '',
      bossHp: bossNearby ? this.boss!.hp : 0,
      bossMax: bossNearby ? this.boss!.maxHp : 0,
    };
  }

  requestAttack(weapon: Weapon): void {
    if (this.completed || this.failed) return;
    this.attackQueue.push(weapon);
  }

  requestJump(): void {
    if (this.completed || this.failed) return;
    this.jumpRequested = true;
  }

  setVirtualLeft(value: boolean): void {
    this.virtualLeft = value;
  }

  setVirtualRight(value: boolean): void {
    this.virtualRight = value;
  }

  pauseGame(): void {
    if (this.completed || this.failed || this.scene.isPaused()) return;
    this.scene.pause();
    this.game.events.emit('game:paused');
  }

  resumeGame(): void {
    if (!this.scene.isPaused()) return;
    this.scene.resume();
    this.game.events.emit('game:resumed');
  }

  goToLevel(index: number): void {
    if (this.scene.isPaused()) this.scene.resume();
    this.scene.stop('UI');
    this.scene.restart({ levelIndex: index });
  }

  goToMenu(): void {
    if (this.scene.isPaused()) this.scene.resume();
    this.scene.stop('UI');
    this.scene.start('Menu');
  }

  private onShutdown(): void {
    this.scene.stop('UI');
    this.events.off('enemy:dead', this.onEnemyDead, this);
  }
}
