import Phaser from 'phaser';
import type { Theme } from '../types';

interface Palette {
  top: string;
  bottom: string;
  wall: string;
  panel: string;
  rail: string;
  accent: string;
  window: string;
  windowGlow: string;
  light: string;
  ink: string;
}

const PALETTES: Record<Theme, Palette> = {
  day: {
    top: '#e7f6ef',
    bottom: '#9cc7b8',
    wall: '#cfe8de',
    panel: '#b7dbcf',
    rail: '#8fbcae',
    accent: '#3f9e86',
    window: '#7fb7c9',
    windowGlow: '#d8f2ff',
    light: '#fff2b8',
    ink: '#23443e',
  },
  dusk: {
    top: '#47636d',
    bottom: '#20343b',
    wall: '#3a5860',
    panel: '#2f4c54',
    rail: '#223b42',
    accent: '#f2b880',
    window: '#526f86',
    windowGlow: '#ffd79a',
    light: '#ffd28a',
    ink: '#182a30',
  },
  night: {
    top: '#1a2b36',
    bottom: '#081116',
    wall: '#172a33',
    panel: '#10222a',
    rail: '#0a171d',
    accent: '#7fd6c1',
    window: '#1c3a4b',
    windowGlow: '#ffe9a8',
    light: '#ffe6a1',
    ink: '#071015',
  },
};

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function makeBackgroundTexture(scene: Phaser.Scene, theme: Theme): string {
  const key = `hospital-bg-${theme}`;
  if (scene.textures.exists(key)) return key;

  const width = 1280;
  const height = 720;
  const canvas = scene.textures.createCanvas(key, width, height);
  if (!canvas) return key;
  const ctx = canvas.getContext();
  const p = PALETTES[theme];

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, p.top);
  grad.addColorStop(0.7, p.wall);
  grad.addColorStop(1, p.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Soft wall panels.
  ctx.fillStyle = p.panel;
  ctx.globalAlpha = 0.5;
  for (let x = 40; x < width; x += 160) {
    rounded(ctx, x, 60, 120, 390, 10);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Wainscoting and rail.
  ctx.fillStyle = p.panel;
  ctx.fillRect(0, 470, width, 130);
  ctx.fillStyle = p.rail;
  ctx.fillRect(0, 464, width, 10);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = p.accent;
  ctx.fillRect(0, 494, width, 3);
  ctx.globalAlpha = 1;

  // Windows. At night/dusk they glow.
  const windows = [
    [140, 110, 230, 270],
    [555, 110, 230, 270],
    [970, 110, 230, 270],
  ];
  for (const [x, y, w, h] of windows) {
    ctx.save();
    rounded(ctx, x, y, w, h, 16);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, p.window);
    sky.addColorStop(1, theme === 'day' ? '#bfe1ee' : '#07131b');
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);

    if (theme === 'day') {
      ctx.fillStyle = '#f9fbff';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(x + w * 0.72, y + h * 0.26, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.3, y + h * 0.2, 46, 16, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + w * 0.6, y + h * 0.38, 36, 13, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = p.windowGlow;
      for (let i = 0; i < 14; i++) {
        const sx = x + 16 + ((i * 47) % (w - 32));
        const sy = y + 18 + ((i * 61) % (h - 36));
        ctx.globalAlpha = 0.35 + (i % 3) * 0.2;
        ctx.fillRect(sx, sy, 3, 3);
      }
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(x + w * 0.75, y + h * 0.24, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Window frame.
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 10;
    rounded(ctx, x, y, w, h, 16);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 8);
    ctx.lineTo(x + w / 2, y + h - 8);
    ctx.moveTo(x + 8, y + h * 0.55);
    ctx.lineTo(x + w - 8, y + h * 0.55);
    ctx.stroke();
    ctx.restore();
  }

  // ECG line on the wall.
  ctx.save();
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  ctx.shadowColor = p.accent;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  const baseY = 410;
  ctx.moveTo(70, baseY);
  for (let x = 70; x < width - 70; x += 110) {
    ctx.lineTo(x + 32, baseY);
    ctx.lineTo(x + 44, baseY - 12);
    ctx.lineTo(x + 52, baseY + 22);
    ctx.lineTo(x + 62, baseY - 48);
    ctx.lineTo(x + 72, baseY + 10);
    ctx.lineTo(x + 84, baseY);
    ctx.lineTo(x + 110, baseY);
  }
  ctx.stroke();
  ctx.restore();

  // Clock.
  ctx.save();
  ctx.translate(1150, 150);
  ctx.fillStyle = p.panel;
  ctx.strokeStyle = p.rail;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -25);
  ctx.moveTo(0, 0);
  ctx.lineTo(17, 8);
  ctx.stroke();
  ctx.restore();

  // Vignette.
  const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.25, width / 2, height / 2, height * 0.9);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, theme === 'day' ? 'rgba(31,62,54,0.22)' : 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  canvas.refresh();
  return key;
}

export function addParallax(scene: Phaser.Scene, theme: Theme): void {
  const p = PALETTES[theme];
  const g = scene.add.graphics();
  g.setDepth(-15);
  g.setScrollFactor(0.18, 0);
  g.fillStyle(theme === 'day' ? 0x8fbcae : 0x0c1a20, theme === 'day' ? 0.1 : 0.18);
  for (let i = 0; i < 5; i++) {
    g.fillEllipse(80 + i * 290, 430, 170, 300);
  }
  g.fillStyle(Phaser.Display.Color.HexStringToColor(p.ink).color, theme === 'day' ? 0.08 : 0.16);
  g.fillRect(0, 640, 1500, 80);
}
