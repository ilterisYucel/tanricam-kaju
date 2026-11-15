import Phaser from 'phaser';
import manifestJson from '../data/manifest.json';
import type { AssetManifest } from '../types';

const manifest = manifestJson as unknown as AssetManifest;

export class PreloadScene extends Phaser.Scene {
  private barFill!: Phaser.GameObjects.Graphics;
  private percentText!: Phaser.GameObjects.Text;
  private barX = 0;
  private barY = 0;
  private barWidth = 0;

  constructor() {
    super('Preload');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#0d1b1e');
    this.createLoadingUi();

    for (const [key, sheet] of Object.entries(manifest.sheets)) {
      this.load.spritesheet(key, sheet.url, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
    for (const [key, image] of Object.entries(manifest.images)) {
      if (key === 'logo') continue; // loaded by Boot so the loading screen can use it
      this.load.image(key, image.url);
    }
    for (const [key, image] of Object.entries(manifest.animals)) {
      this.load.image(key, image.url);
    }
    this.load.image('floor-strip', manifest.floor.strip.url);

    this.load.on('progress', (value: number) => {
      this.updateProgress(value);
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error('Asset load failed:', file.key, file.src);
    });
  }

  create(): void {
    this.createAnimations();
    this.cameras.main.fadeOut(300, 7, 12, 14);
    this.time.delayedCall(320, () => this.scene.start('Menu'));
  }

  private createLoadingUi(): void {
    const { width, height } = this.scale;
    this.add
      .image(width / 2, height / 2 - 180, 'logo')
      .setDisplaySize(94, 120);
    this.add
      .text(width / 2, height / 2 - 90, 'TANRIÇAM & KAJU', {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#eff7f2',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 - 50, 'HASTANE NÖBETİ', {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '17px',
        color: '#7fd6c1',
        letterSpacing: 6,
      })
      .setOrigin(0.5);

    this.barWidth = 540;
    this.barX = width / 2 - this.barWidth / 2;
    this.barY = height / 2 + 44;
    const bar = this.add.graphics();
    bar.fillStyle(0x102726, 1);
    bar.fillRoundedRect(this.barX - 4, this.barY - 4, this.barWidth + 8, 28, 14);
    bar.lineStyle(2, 0x2c5b52, 1);
    bar.strokeRoundedRect(this.barX - 4, this.barY - 4, this.barWidth + 8, 28, 14);

    this.barFill = this.add.graphics();
    this.percentText = this.add
      .text(width / 2, this.barY + 54, 'Hastane hazırlanıyor... 0%', {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '16px',
        color: '#b9d7cd',
      })
      .setOrigin(0.5);
  }

  private updateProgress(value: number): void {
    const width = Math.max(0, Math.min(1, value)) * this.barWidth;
    this.barFill.clear();
    this.barFill.fillStyle(0x4fc3a1, 1);
    this.barFill.fillRoundedRect(this.barX, this.barY, width, 20, 10);
    this.percentText.setText(`Hastane hazırlanıyor... ${Math.round(value * 100)}%`);
  }

  private createAnimations(): void {
    this.anims.create({
      key: 'hero-walk',
      frames: this.anims.generateFrameNumbers('hero-walk', { start: 0, end: 6 }),
      frameRate: 14,
      repeat: -1,
    });
    this.anims.create({
      key: 'hero-idle',
      frames: this.anims.generateFrameNumbers('hero-idle', { start: 0, end: 4 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: 'hero-run',
      frames: this.anims.generateFrameNumbers('hero-run', { start: 0, end: 1 }),
      frameRate: 12,
      repeat: -1,
    });
    this.anims.create({
      key: 'kaju-run',
      frames: this.anims.generateFrameNumbers('kaju-run', { start: 0, end: 9 }),
      frameRate: 14,
      repeat: -1,
    });
    this.anims.create({
      key: 'doctor-walk',
      frames: this.anims.generateFrameNumbers('doctor-walk', { start: 0, end: 6 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: 'doctor-charge',
      frames: this.anims.generateFrameNumbers('doctor-charge', { start: 0, end: 2 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: 'nurse-walk',
      frames: this.anims.generateFrameNumbers('nurse-walk', { start: 0, end: 6 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: 'nurse-attack',
      frames: this.anims.generateFrameNumbers('nurse-attack', { start: 0, end: 1 }),
      frameRate: 10,
      repeat: 0,
    });
  }
}
