import Phaser from 'phaser';

export interface ButtonOptions {
  fill?: number;
  fillHover?: number;
  stroke?: number;
  textColor?: string;
  fontSize?: number;
  bold?: boolean;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const fill = options.fill ?? 0x15332f;
  const hover = options.fillHover ?? 0x1d4a43;
  const stroke = options.stroke ?? 0x4fc3a1;
  const color = options.textColor ?? '#eff7f2';
  const g = scene.add.graphics();
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: '"Trebuchet MS", Verdana, sans-serif',
      fontSize: `${options.fontSize ?? 22}px`,
      fontStyle: options.bold === false ? 'normal' : 'bold',
      color,
    })
    .setOrigin(0.5);

  const draw = (isHover: boolean): void => {
    g.clear();
    g.fillStyle(isHover ? hover : fill, 1);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, 15);
    g.lineStyle(2, stroke, isHover ? 1 : 0.65);
    g.strokeRoundedRect(-width / 2, -height / 2, width, height, 15);
  };
  draw(false);

  const container = scene.add
    .container(x, y, [g, text])
    .setSize(width, height)
    .setInteractive({ useHandCursor: true });

  container.on('pointerover', () => draw(true));
  container.on('pointerout', () => {
    draw(false);
    scene.tweens.killTweensOf(container);
    container.setScale(1);
  });
  container.on('pointerdown', () => {
    scene.tweens.add({ targets: container, scale: 0.96, duration: 70, yoyo: true });
    onClick();
  });

  return container;
}

export function drawHeart(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  color: number,
  alpha = 1,
): void {
  graphics.fillStyle(color, alpha);
  graphics.fillCircle(x - size * 0.22, y - size * 0.08, size * 0.28);
  graphics.fillCircle(x + size * 0.22, y - size * 0.08, size * 0.28);
  graphics.fillTriangle(
    x - size * 0.5,
    y,
    x + size * 0.5,
    y,
    x,
    y + size * 0.66,
  );
}

function cssColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/**
 * Large UI panels are CanvasTextures rather than Graphics rounded rectangles.
 * This avoids the vertical fill cracks that some Android WebView GPU drivers
 * show on very wide rounded-rect paths.
 */
export function makePanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fill?: number; stroke?: number; alpha?: number } = {},
): Phaser.GameObjects.Container {
  const fill = options.fill ?? 0x0b1c1f;
  const stroke = options.stroke ?? 0x4fc3a1;
  const alpha = options.alpha ?? 1;
  const pad = 8;
  const key = `panel-${width}x${height}-${fill}-${stroke}-${alpha}-${pad}`;

  if (!scene.textures.exists(key)) {
    const canvas = scene.textures.createCanvas(key, width + pad * 2, height + pad * 2);
    if (canvas) {
      const ctx = canvas.getContext();
      ctx.clearRect(0, 0, width + pad * 2, height + pad * 2);
      roundedPath(ctx, pad, pad, width, height, 24);
      const color = cssColor(fill);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = cssColor(stroke);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      canvas.refresh();
    }
  }

  const image = scene.add.image(0, 0, key).setOrigin(0.5);
  return scene.add.container(x, y, [image]);
}
