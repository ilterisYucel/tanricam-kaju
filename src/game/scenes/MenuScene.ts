import Phaser from 'phaser';
import { LEVELS } from '../data/levels';
import { getSave, isUnlocked, resetProgress, rescuedCount, setSoundEnabled } from '../save';
import { sfx } from '../audio';
import { addParallax, makeBackgroundTexture } from '../ui/background';
import { makeButton, makePanel } from '../ui/widgets';

export class MenuScene extends Phaser.Scene {
  private overlay?: Phaser.GameObjects.Container;

  constructor() {
    super('Menu');
  }

  create(): void {
    const save = getSave();
    sfx.setEnabled(save.sound);
    this.cameras.main.fadeIn(350, 7, 12, 14);

    this.add.image(0, 0, makeBackgroundTexture(this, 'dusk')).setOrigin(0).setDepth(-30);
    addParallax(this, 'dusk');

    this.add
      .tileSprite(0, 500, 1280, 302, 'floor-strip')
      .setOrigin(0)
      .setTint(0xf0e1d2)
      .setDepth(2);

    const glow = this.add.circle(330, 500, 245, 0xf2b880, 0.08).setDepth(1);
    this.tweens.add({
      targets: glow,
      alpha: 0.03,
      scale: 1.1,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Hero and Kaju.
    const hero = this.add
      .sprite(330, 654, 'hero-idle', 0)
      .setOrigin(0.5, 1)
      .setScale(2.15)
      .setDepth(5);
    hero.play('hero-idle');
    const kaju = this.add
      .sprite(505, 654, 'kaju-run', 0)
      .setOrigin(0.5, 1)
      .setScale(1.5)
      .setDepth(6);
    kaju.play('kaju-run');

    this.tweens.add({
      targets: kaju,
      x: 520,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Floating pickups and hearts.
    const sushi = ['sushi-2', 'sushi-3', 'sushi-4', 'sushi-5'];
    sushi.forEach((key, index) => {
      const x = 180 + index * 160;
      const y = 320 + (index % 2) * 80;
      const image = this.add.image(x, y, key).setScale(0.46).setAlpha(0.88).setDepth(4);
      this.tweens.add({
        targets: image,
        y: y - 16,
        angle: index % 2 === 0 ? 8 : -8,
        duration: 1500 + index * 170,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    for (let i = 0; i < 7; i++) {
      const heart = this.add
        .text(90 + i * 135, 240 + ((i * 61) % 200), '♥', {
          fontFamily: '"Trebuchet MS", Verdana, sans-serif',
          fontSize: `${14 + (i % 3) * 6}px`,
          color: i % 2 === 0 ? '#ffb2c3' : '#ffd6a0',
        })
        .setAlpha(0.55)
        .setDepth(4);
      this.tweens.add({
        targets: heart,
        y: heart.y - 40,
        alpha: 0.08,
        duration: 2200 + i * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Title block with the same logo used by the native splash.
    this.add.image(890, 58, 'logo').setScale(0.6).setDepth(8);
    const titleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Trebuchet MS", Verdana, sans-serif',
      fontStyle: 'bold',
      color: '#eff7f2',
      shadow: { offsetX: 0, offsetY: 4, color: '#061012', blur: 8, fill: true },
    };
    this.add.text(890, 144, 'TANRIÇAM', { ...titleStyle, fontSize: '60px' }).setOrigin(0.5).setDepth(8);
    this.add
      .text(890, 196, '& KAJU', {
        ...titleStyle,
        fontSize: '34px',
        color: '#f2b880',
      })
      .setOrigin(0.5)
      .setDepth(8);
    this.add
      .text(890, 232, 'HASTANE NÖBETİ', {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '17px',
        color: '#8fd8c1',
        letterSpacing: 5,
      })
      .setOrigin(0.5)
      .setDepth(8);

    // Right-side menu panel.
    makePanel(this, 890, 444, 540, 372).setDepth(7);

    const saveNow = getSave();
    const nextLevel = LEVELS.find((level) => !saveNow.completed.includes(level.id))?.id ?? 1;
    const playLabel = saveNow.completed.length === 0 ? 'BAŞLA' : 'DEVAM';

    makeButton(this, 890, 330, 370, 66, playLabel, () => this.startLevel(nextLevel - 1), {
      fontSize: 24,
      fill: 0x1b5a4a,
      fillHover: 0x257a63,
      stroke: 0x8df0cd,
    }).setDepth(9);

    makeButton(this, 890, 406, 370, 56, 'BÖLÜM SEÇ', () => this.openLevelSelect(), {
      fontSize: 19,
    }).setDepth(9);

    const soundButton = makeButton(
      this,
      890,
      474,
      370,
      54,
      `SES: ${saveNow.sound ? 'AÇIK' : 'KAPALI'}`,
      () => {
        const save = getSave();
        save.sound = !save.sound;
        setSoundEnabled(save.sound);
        sfx.setEnabled(save.sound);
        sfx.click();
        const label = soundButton.getAt(1) as Phaser.GameObjects.Text;
        label.setText(`SES: ${save.sound ? 'AÇIK' : 'KAPALI'}`);
      },
      { fontSize: 17 },
    );
    soundButton.setDepth(9);

    makeButton(this, 890, 540, 220, 46, 'SIFIRLA', () => this.confirmReset(), {
      fontSize: 15,
      fill: 0x2a1e22,
      fillHover: 0x452c32,
      stroke: 0xbb7183,
    }).setDepth(9);

    this.add
      .text(890, 596, `Kurtarılan dost: ${rescuedCount()} / ${LEVELS.length}`, {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '16px',
        color: '#b9d7cd',
      })
      .setOrigin(0.5)
      .setDepth(9);

    this.add
      .text(890, 620, 'Senin için ♥', {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '12px',
        color: '#ffb2c3',
      })
      .setOrigin(0.5)
      .setDepth(9)
      .setAlpha(0.85);

    this.input.on('pointerdown', () => sfx.unlock());
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (!this.overlay) this.startLevel(nextLevel - 1);
    });
    this.input.keyboard?.on('keydown-ESC', () => this.closeOverlay());
  }

  private startLevel(index: number): void {
    sfx.unlock();
    sfx.click();
    this.scene.start('Game', { levelIndex: index });
  }

  private openLevelSelect(): void {
    this.closeOverlay();
    const root = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(640, 360, 1280, 720, 0x061012, 0.78).setInteractive();
    root.add(dim);
    root.add(makePanel(this, 640, 360, 1120, 570));
    root.add(
      this.add
        .text(640, 112, 'BÖLÜM SEÇ', {
          fontFamily: '"Trebuchet MS", Verdana, sans-serif',
          fontSize: '34px',
          fontStyle: 'bold',
          color: '#eff7f2',
        })
        .setOrigin(0.5),
    );

    LEVELS.forEach((level, index) => {
      const col = index % 8;
      const row = Math.floor(index / 8);
      const x = 185 + col * 130;
      const y = 175 + row * 76;
      const unlocked = isUnlocked(level.id);
      const completed = getSave().completed.includes(level.id);
      const tile = this.add.container(x, y).setSize(122, 62);
      const g = this.add.graphics();
      g.fillStyle(unlocked ? (completed ? 0x173a35 : 0x102726) : 0x101a1d, 0.95);
      g.fillRoundedRect(-61, -31, 122, 62, 12);
      g.lineStyle(2, unlocked ? (completed ? 0x7fd6c1 : 0x3b6a61) : 0x2b383c, 0.9);
      g.strokeRoundedRect(-61, -31, 122, 62, 12);
      tile.add(g);

      if (unlocked) {
        tile.add(
          this.add
            .text(-54, -26, `BÖLÜM ${level.id}`, {
              fontFamily: '"Trebuchet MS", Verdana, sans-serif',
              fontSize: '10px',
              fontStyle: 'bold',
              color: completed ? '#aaffd0' : '#8fd8c1',
            })
            .setOrigin(0, 0),
        );
        tile.add(
          this.add
            .text(-54, 1, level.name, {
              fontFamily: '"Trebuchet MS", Verdana, sans-serif',
              fontSize: '12px',
              fontStyle: 'bold',
              color: '#eff7f2',
              wordWrap: { width: 92 },
            })
            .setOrigin(0, 0.5),
        );
        const animalKey = `animal-${String(level.animal).padStart(2, '0')}`;
        if (completed && this.textures.exists(animalKey)) {
          tile.add(this.add.image(45, 4, animalKey).setScale(0.22));
        } else {
          tile.add(
            this.add
              .text(45, 4, '♥', {
                fontFamily: '"Trebuchet MS", Verdana, sans-serif',
                fontSize: '18px',
                color: '#4fc3a1',
              })
              .setOrigin(0.5)
              .setAlpha(0.7),
          );
        }
        tile.setInteractive({ useHandCursor: true });
        tile.on('pointerover', () => {
          g.clear();
          g.fillStyle(0x21584b, 0.98);
          g.fillRoundedRect(-61, -31, 122, 62, 12);
          g.lineStyle(2, 0x8df0cd, 1);
          g.strokeRoundedRect(-61, -31, 122, 62, 12);
        });
        tile.on('pointerout', () => {
          g.clear();
          g.fillStyle(completed ? 0x173a35 : 0x102726, 0.95);
          g.fillRoundedRect(-61, -31, 122, 62, 12);
          g.lineStyle(2, completed ? 0x7fd6c1 : 0x3b6a61, 0.9);
          g.strokeRoundedRect(-61, -31, 122, 62, 12);
        });
        tile.on('pointerdown', () => this.startLevel(index));
      } else {
        tile.add(
          this.add
            .text(0, 0, 'KİLİTLİ', {
              fontFamily: '"Trebuchet MS", Verdana, sans-serif',
              fontSize: '12px',
              fontStyle: 'bold',
              color: '#5b7772',
            })
            .setOrigin(0.5),
        );
      }
      root.add(tile);
    });

    root.add(makeButton(this, 640, 598, 240, 48, 'KAPAT', () => this.closeOverlay(), { fontSize: 16 }));
    this.overlay = root;
  }

  private confirmReset(): void {
    this.closeOverlay();
    const root = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(640, 360, 1280, 720, 0x061012, 0.8).setInteractive();
    root.add(dim);
    root.add(makePanel(this, 640, 360, 500, 320));
    root.add(
      this.add
        .text(640, 274, 'EMİN MİSİN?', {
          fontFamily: '"Trebuchet MS", Verdana, sans-serif',
          fontSize: '30px',
          fontStyle: 'bold',
          color: '#ffb3c1',
        })
        .setOrigin(0.5),
    );
    root.add(
      this.add
        .text(640, 322, 'Tüm bölüm ve dost ilerlemesi silinecek.', {
          fontFamily: '"Trebuchet MS", Verdana, sans-serif',
          fontSize: '15px',
          color: '#b9d7cd',
        })
        .setOrigin(0.5),
    );
    root.add(makeButton(this, 520, 408, 200, 52, 'VAZGEÇ', () => this.closeOverlay(), { fontSize: 16 }));
    root.add(
      makeButton(
        this,
        760,
        408,
        200,
        52,
        'SIFIRLA',
        () => {
          resetProgress();
          sfx.setEnabled(true);
          this.scene.restart();
        },
        { fontSize: 16, fill: 0x3a1f26, fillHover: 0x59303a, stroke: 0xbb7183 },
      ),
    );
    this.overlay = root;
  }

  private closeOverlay(): void {
    if (!this.overlay) return;
    this.overlay.destroy(true);
    this.overlay = undefined;
  }
}
