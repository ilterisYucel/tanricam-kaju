import { IonContent, IonPage } from '@ionic/react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from '../game/config';
import type { GameScene } from '../game/scenes/GameScene';

export default function GamePage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const game = new Phaser.Game(createGameConfig(containerRef.current));
    (window as unknown as { __game?: Phaser.Game }).__game = game;
    const listeners: PluginListenerHandle[] = [];
    const resizeGame = () => {
      if (!game.scale || !game.canvas) return;
      game.scale.refresh();
    };
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => resizeGame())
        : undefined;
    resizeObserver?.observe(containerRef.current);
    window.addEventListener('resize', resizeGame);

    if (Capacitor.isNativePlatform()) {
      ScreenOrientation.lock({ orientation: 'landscape' })
        .then(() => {
          // The WebView can miss the first resize while Android rotates.
          setTimeout(resizeGame, 250);
          setTimeout(resizeGame, 800);
        })
        .catch(() => undefined);
      StatusBar.hide().catch(() => undefined);

      void CapApp.addListener('backButton', () => {
        const gameScene = game.scene.getScene('Game') as GameScene | undefined;
        if (gameScene?.scene.isActive() && !gameScene.scene.isPaused()) {
          gameScene.pauseGame();
        } else {
          void CapApp.exitApp();
        }
      }).then((handle) => listeners.push(handle));

      void CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) return;
        const gameScene = game.scene.getScene('Game') as GameScene | undefined;
        if (gameScene?.scene.isActive() && !gameScene.scene.isPaused()) gameScene.pauseGame();
      }).then((handle) => listeners.push(handle));
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeGame);
      listeners.forEach((listener) => void listener.remove());
      game.destroy(true);
    };
  }, []);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="game-content">
        <div className="game-shell" ref={containerRef} />
        <div className="rotate-hint">
          <div className="rotate-card">
            <span className="rotate-phone">▭</span>
            <strong>Telefonu yan çevir</strong>
            <small>Tanrıçam &amp; Kaju yatay modda oynanır.</small>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
