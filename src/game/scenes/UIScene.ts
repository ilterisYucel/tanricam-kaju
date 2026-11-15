import Phaser from 'phaser';
import { LEVELS } from '../data/levels';
import type { CompletePayload, HudState } from '../types';
import { XP_THRESHOLDS } from '../save';
import { sfx } from '../audio';
import { drawHeart, makeButton, makePanel } from '../ui/widgets';
import type { GameScene } from './GameScene';

interface FailPayload {
  levelId: number;
  levelName: string;
}

export class UIScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private levelIndex = 0;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private attackText!: Phaser.GameObjects.Text;
  private xpText!: Phaser.GameObjects.Text;
  private bossLabel!: Phaser.GameObjects.Text;
  private touchRoot?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Container;
  private isTouch = false;
  private gameEnded = false;
  private paused = false;

  constructor() {
    super('UI');
  }

  init(data: { levelIndex?: number }): void {
    this.levelIndex = data.levelIndex ?? 0;
    this.gameEnded = false;
    this.paused = false;
    this.overlay = undefined;
    this.touchRoot = undefined;
  }

  create(): void {
    this.gameScene = this.scene.get('Game') as GameScene;
    this.isTouch = this.detectTouch();

    this.hudGfx = this.add.graphics().setDepth(20);
    this.levelText = this.add
      .text(640, 16, '', {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#eff7f2',
        stroke: '#081214',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(20);
    this.attackText = this.add
      .text(34, 98, 'SALDIRI Sv. 1', {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#bfe9db',
      })
      .setDepth(20);
    this.xpText = this.add
      .text(284, 76, '', {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '12px',
        color: '#9fc9be',
      })
      .setOrigin(1, 0.5)
      .setDepth(20);
    this.bossLabel = this.add
      .text(640, 48, '', {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffc0cb',
        stroke: '#160a10',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(20)
      .setVisible(false);

    makeButton(this, 1231, 42, 62, 42, 'II', () => this.gameScene.pauseGame(), {
      fontSize: 16,
      fill: 0x102726,
      fillHover: 0x1d4a43,
    }).setDepth(20);

    if (this.isTouch) this.createTouchControls();

    this.applyHud(this.gameScene.getHudState());
    this.showIntro();

    this.game.events.on('hud:update', this.onHud, this);
    this.game.events.on('game:paused', this.onPaused, this);
    this.game.events.on('game:resumed', this.onResumed, this);
    this.game.events.on('game:complete', this.onComplete, this);
    this.game.events.on('game:fail', this.onFail, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.input.on('pointerdown', () => sfx.unlock());

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.paused) this.onResumePressed();
      else if (!this.overlay) this.gameScene.pauseGame();
    });
  }

  private detectTouch(): boolean {
    if (typeof window === 'undefined') return false;
    const forced = new URLSearchParams(window.location.search).get('touch') === '1';
    if (forced) return true;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    return coarse || (navigator.maxTouchPoints ?? 0) > 0;
  }

  private createTouchControls(): void {
    this.touchRoot = this.add.container(0, 0).setDepth(10);

    // Movement lives on the right; jump + skills stack on the left.
    const left = makeButton(this, 1080, 646, 82, 82, '◀', () => this.gameScene.setVirtualLeft(true), {
      fill: 0x0e2427,
      fillHover: 0x1d4a43,
      stroke: 0x4fc3a1,
      fontSize: 28,
    });
    const right = makeButton(this, 1180, 646, 82, 82, '▶', () => this.gameScene.setVirtualRight(true), {
      fill: 0x0e2427,
      fillHover: 0x1d4a43,
      stroke: 0x4fc3a1,
      fontSize: 28,
    });
    for (const button of [left, right]) {
      button.on('pointerup', () => this.releaseMove());
      button.on('pointerout', () => this.releaseMove());
      button.on('pointerupoutside', () => this.releaseMove());
      button.setAlpha(0.9);
      this.touchRoot.add(button);
    }

    const jumpIcon = this.add.text(0, 0, '▲', {
      fontFamily: '"Trebuchet MS", Verdana, sans-serif',
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#d7ffe9',
    }).setOrigin(0.5);
    this.makeTouchCard(68, 468, 104, 96, {
      fill: 0x1b3a33,
      fillHover: 0x2a5b4f,
      stroke: 0x7fe0c1,
      title: 'ZIPLA',
      titleSize: 15,
      icon: jumpIcon,
      iconY: -14,
      onClick: () => this.gameScene.requestJump(),
    });

    const domestosIcon = this.add.image(0, 0, 'domestos-bottle-b').setScale(0.46);
    this.makeTouchCard(68, 566, 104, 96, {
      fill: 0x123a2b,
      fillHover: 0x1f5a42,
      stroke: 0x7fe0b0,
      title: 'DOMESTOS',
      subtitle: 'SALDIRISI',
      icon: domestosIcon,
      iconY: -16,
      onClick: () => this.gameScene.requestAttack('domestos'),
    });

    const sarmaIcon = this.add.image(0, 0, 'dolma').setScale(0.58);
    this.makeTouchCard(68, 664, 104, 96, {
      fill: 0x3a2a1e,
      fillHover: 0x5a402b,
      stroke: 0xf2b880,
      title: 'SARMA',
      subtitle: 'SALDIRISI',
      titleColor: '#ffe5c7',
      icon: sarmaIcon,
      iconY: -16,
      onClick: () => this.gameScene.requestAttack('sarma'),
    });
  }

  private makeTouchCard(
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      fill: number;
      fillHover: number;
      stroke: number;
      title: string;
      subtitle?: string;
      titleColor?: string;
      titleSize?: number;
      icon: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
      iconY: number;
      onClick: () => void;
    },
  ): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    const draw = (hover: boolean): void => {
      g.clear();
      g.fillStyle(hover ? options.fillHover : options.fill, 1);
      g.fillRoundedRect(-width / 2, -height / 2, width, height, 18);
      g.lineStyle(2, options.stroke, hover ? 1 : 0.7);
      g.strokeRoundedRect(-width / 2, -height / 2, width, height, 18);
    };
    draw(false);

    options.icon.setPosition(0, options.iconY);
    const title = this.add
      .text(0, height / 2 - 29, options.title, {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: `${options.titleSize ?? 14}px`,
        fontStyle: 'bold',
        color: options.titleColor ?? '#eff7f2',
      })
      .setOrigin(0.5);

    const children: Phaser.GameObjects.GameObject[] = [g, options.icon, title];
    if (options.subtitle) {
      children.push(
        this.add
          .text(0, height / 2 - 14, options.subtitle, {
            fontFamily: '"Trebuchet MS", Verdana, sans-serif',
            fontSize: '10px',
            color: options.titleColor ?? '#b9d7cd',
            letterSpacing: 1,
          })
          .setOrigin(0.5),
      );
    }

    const card = this.add
      .container(x, y, children)
      .setSize(width, height)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.94);
    card.on('pointerover', () => {
      draw(true);
      card.setAlpha(1);
    });
    card.on('pointerout', () => {
      draw(false);
      card.setAlpha(0.94);
      this.tweens.killTweensOf(card);
      card.setScale(1);
    });
    card.on('pointerdown', () => {
      this.tweens.add({ targets: card, scale: 0.95, duration: 60, yoyo: true });
      options.onClick();
    });
    this.touchRoot!.add(card);
    return card;
  }

  private releaseMove(): void {
    this.gameScene.setVirtualLeft(false);
    this.gameScene.setVirtualRight(false);
  }

  private onHud(state: HudState): void {
    this.applyHud(state);
  }

  private applyHud(state: HudState): void {
    const g = this.hudGfx;
    g.clear();

    for (let i = 0; i < 3; i++) {
      drawHeart(g, 46 + i * 34, 42, 25, i < state.health ? 0xff7f9a : 0x5b7470, i < state.health ? 1 : 0.35);
    }

    const barX = 34;
    const barY = 72;
    const barW = 250;
    const barH = 16;
    g.fillStyle(0x0b1b1e, 0.86);
    g.fillRoundedRect(barX - 2, barY - 2, barW + 4, barH + 4, 9);
    g.lineStyle(1, 0x2f5b53, 0.8);
    g.strokeRoundedRect(barX - 2, barY - 2, barW + 4, barH + 4, 9);

    const current = XP_THRESHOLDS[Math.max(0, Math.min(XP_THRESHOLDS.length - 1, state.attackLevel - 1))];
    const next = state.xpNext;
    const ratio = state.attackLevel >= XP_THRESHOLDS.length
      ? 1
      : Phaser.Math.Clamp((state.xp - current) / Math.max(1, next - current), 0, 1);
    if (ratio > 0) {
      g.fillStyle(0x4fc3a1, 1);
      g.fillRoundedRect(barX, barY, barW * ratio, barH, 8);
    }

    this.levelText.setText(`BÖLÜM ${state.levelId}  •  ${state.levelName}`);
    this.attackText.setText(`SALDIRI Sv. ${state.attackLevel}`);
    this.xpText.setText(state.attackLevel >= 5 ? 'MAX' : `${state.xp} / ${state.xpNext} XP`);

    if (state.bossHp > 0 && state.bossMax > 0) {
      const bossW = 420;
      const bossX = 640 - bossW / 2;
      const bossY = 68;
      g.fillStyle(0x1b1017, 0.9);
      g.fillRoundedRect(bossX - 2, bossY - 2, bossW + 4, 18, 9);
      g.lineStyle(1, 0x8a4559, 0.9);
      g.strokeRoundedRect(bossX - 2, bossY - 2, bossW + 4, 18, 9);
      g.fillStyle(0xff6b8a, 1);
      g.fillRoundedRect(bossX, bossY, bossW * (state.bossHp / state.bossMax), 14, 7);
      this.bossLabel.setText('MUTANT MİKROP').setVisible(true);
    } else {
      this.bossLabel.setVisible(false);
    }
  }

  private showIntro(): void {
    const level = LEVELS[this.levelIndex];
    if (!level) return;

    const root = this.add.container(0, 0).setDepth(15);
    const introHeight = level.hint ? 118 : 86;
    root.add(makePanel(this, 640, 116 + introHeight / 2, 780, introHeight));
    root.add(
      this.add
        .text(640, 132, `BÖLÜM ${level.id}`, {
          fontFamily: '"Trebuchet MS", Verdana, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#7fd6c1',
          letterSpacing: 2,
        })
        .setOrigin(0.5, 0),
    );
    root.add(
      this.add
        .text(640, 154, level.name, {
          fontFamily: '"Trebuchet MS", Verdana, sans-serif',
          fontSize: '30px',
          fontStyle: 'bold',
          color: '#eff7f2',
        })
        .setOrigin(0.5, 0),
    );

    if (level.hint) {
      const hint = this.isTouch && level.id === 1
        ? 'Sağdaki oklarla yürü; soldaki kartlarla zıpla ve saldır.'
        : level.hint;
      root.add(
        this.add
          .text(640, 200, hint, {
            fontFamily: '"Trebuchet MS", Verdana, sans-serif',
            fontSize: '15px',
            color: '#b9d7cd',
            align: 'center',
            wordWrap: { width: 700 },
          })
          .setOrigin(0.5, 0),
      );
    }

    this.tweens.add({
      targets: root,
      alpha: 0,
      delay: 5200,
      duration: 650,
      onComplete: () => root.destroy(),
    });
  }

  private showOverlay(build: (root: Phaser.GameObjects.Container) => void): void {
    this.hideOverlay();
    const root = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(640, 360, 1280, 720, 0x061012, 0.72).setInteractive();
    root.add(dim);
    build(root);
    this.overlay = root;
    if (this.touchRoot) this.touchRoot.setVisible(false);
  }

  private hideOverlay(): void {
    if (this.overlay) {
      this.overlay.destroy(true);
      this.overlay = undefined;
    }
    if (this.touchRoot && !this.gameEnded) this.touchRoot.setVisible(true);
  }

  private onPaused(): void {
    this.paused = true;
    this.showOverlay((root) => {
      root.add(makePanel(this, 640, 360, 540, 440));
      root.add(
        this.add
          .text(640, 196, 'MOLA', {
            fontFamily: '"Trebuchet MS", Verdana, sans-serif',
            fontSize: '44px',
            fontStyle: 'bold',
            color: '#eff7f2',
          })
          .setOrigin(0.5),
      );
      root.add(
        this.add
          .text(640, 246, 'Tanrıçam biraz mola veriyor.', {
            fontFamily: '"Trebuchet MS", Verdana, sans-serif',
            fontSize: '17px',
            color: '#b9d7cd',
          })
          .setOrigin(0.5),
      );
      root.add(makeButton(this, 640, 326, 330, 62, 'DEVAM', () => this.onResumePressed(), { fontSize: 20 }));
      root.add(makeButton(this, 640, 402, 330, 58, 'YENİDEN BAŞLAT', () => this.gameScene.goToLevel(this.levelIndex), { fontSize: 18 }));
      root.add(makeButton(this, 640, 474, 330, 58, 'MENÜ', () => this.gameScene.goToMenu(), { fontSize: 18 }));
    });
  }

  private onResumePressed(): void {
    this.paused = false;
    this.gameScene.resumeGame();
    this.hideOverlay();
  }

  private onResumed(): void {
    this.paused = false;
    this.hideOverlay();
  }

  private onComplete(payload: CompletePayload): void {
    this.gameEnded = true;
    this.showOverlay((root) => {
      if (payload.isFinal) {
        this.buildFinalOverlay(root);
        return;
      }

      root.add(makePanel(this, 640, 360, 760, 540));
      root.add(
        this.add
          .text(640, 158, 'BÖLÜM TAMAM!', {
            fontFamily: '"Trebuchet MS", Verdana, sans-serif',
            fontSize: '38px',
            fontStyle: 'bold',
            color: '#eff7f2',
          })
          .setOrigin(0.5),
      );
      if (this.textures.exists(payload.animalKey)) {
        root.add(this.add.image(640, 292, payload.animalKey).setScale(1.35));
      }
      root.add(
        this.add
          .text(640, 386, 'Minik dost kurtarıldı!', {
            fontFamily: '"Trebuchet MS", Verdana, sans-serif',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#aaffd0',
          })
          .setOrigin(0.5),
      );
      root.add(
        this.add
          .text(640, 424, `Kurtarılan dost: ${payload.rescuedCount} / ${LEVELS.length}`, {
            fontFamily: '"Trebuchet MS", Verdana, sans-serif',
            fontSize: '16px',
            color: '#b9d7cd',
          })
          .setOrigin(0.5),
      );

      const hasNext = this.levelIndex + 1 < LEVELS.length;
      if (hasNext) {
        root.add(makeButton(this, 492, 530, 280, 60, 'SONRAKİ BÖLÜM', () => this.gameScene.goToLevel(this.levelIndex + 1), { fontSize: 17 }));
      }
      root.add(makeButton(this, hasNext ? 800 : 640, 530, 280, 60, 'MENÜ', () => this.gameScene.goToMenu(), { fontSize: 18 }));
    });
  }

  private buildFinalOverlay(root: Phaser.GameObjects.Container): void {
    root.add(makePanel(this, 640, 360, 960, 570));
    root.add(
      this.add
        .text(640, 122, 'TÜM DOSTLAR KURTARILDI!', {
          fontFamily: '"Trebuchet MS", Verdana, sans-serif',
          fontSize: '36px',
          fontStyle: 'bold',
          color: '#ffe9a1',
        })
        .setOrigin(0.5),
    );
    root.add(
      this.add
        .text(640, 172, `${LEVELS.length} minik dost artık güvende. Seninle her nöbet güzel.`, {
          fontFamily: '"Trebuchet MS", Verdana, sans-serif',
          fontSize: '17px',
          color: '#b9d7cd',
        })
        .setOrigin(0.5),
    );

    LEVELS.forEach((level, i) => {
      const key = `animal-${String(level.animal).padStart(2, '0')}`;
      if (this.textures.exists(key)) {
        const col = i % 13;
        const row = Math.floor(i / 13);
        root.add(
          this.add
            .image(640 + (col - 6) * 70, 300 + row * 68, key)
            .setScale(0.38),
        );
      }
    });

    root.add(
      this.add
        .text(640, 508, 'Kaju de çok mutlu. ♥', {
          fontFamily: '"Trebuchet MS", Verdana, sans-serif',
          fontSize: '18px',
          color: '#aaffd0',
        })
        .setOrigin(0.5),
    );
    root.add(makeButton(this, 640, 575, 300, 62, 'MENÜ', () => this.gameScene.goToMenu(), { fontSize: 20 }));
  }

  private onFail(_payload: FailPayload): void {
    this.gameEnded = true;
    this.showOverlay((root) => {
      root.add(makePanel(this, 640, 360, 540, 430));
      root.add(
        this.add
          .text(640, 226, 'NÖBET BİTTİ', {
            fontFamily: '"Trebuchet MS", Verdana, sans-serif',
            fontSize: '40px',
            fontStyle: 'bold',
            color: '#ffb3c1',
          })
          .setOrigin(0.5),
      );
      root.add(
        this.add
          .text(640, 282, 'Tekrar dene, tanrıçam. Kaju seni bekliyor.', {
            fontFamily: '"Trebuchet MS", Verdana, sans-serif',
            fontSize: '16px',
            color: '#b9d7cd',
          })
          .setOrigin(0.5),
      );
      root.add(makeButton(this, 640, 366, 300, 60, 'TEKRAR', () => this.gameScene.goToLevel(this.levelIndex), { fontSize: 20 }));
      root.add(makeButton(this, 640, 440, 300, 56, 'MENÜ', () => this.gameScene.goToMenu(), { fontSize: 18 }));
    });
  }

  private onShutdown(): void {
    this.game.events.off('hud:update', this.onHud, this);
    this.game.events.off('game:paused', this.onPaused, this);
    this.game.events.off('game:resumed', this.onResumed, this);
    this.game.events.off('game:complete', this.onComplete, this);
    this.game.events.off('game:fail', this.onFail, this);
  }
}
