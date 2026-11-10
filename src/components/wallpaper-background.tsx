"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "@/components/theme-provider";

export const WALLPAPER_OPACITY_KEY = "astra-wallpaper-opacity";
export const WALLPAPER_OPACITY_EVENT = "astra:wallpaper-opacity";
export const DEFAULT_WALLPAPER_OPACITY = 1;

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function readWallpaperOpacity(): number {
  if (typeof window === "undefined") return DEFAULT_WALLPAPER_OPACITY;
  const raw = window.localStorage.getItem(WALLPAPER_OPACITY_KEY);
  if (raw === null) return DEFAULT_WALLPAPER_OPACITY;
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_WALLPAPER_OPACITY;
  return clampOpacity(value);
}

export function writeWallpaperOpacity(value: number): number {
  const next = clampOpacity(value);
  if (typeof window === "undefined") return next;
  window.localStorage.setItem(WALLPAPER_OPACITY_KEY, String(next));
  window.dispatchEvent(new CustomEvent<number>(WALLPAPER_OPACITY_EVENT, { detail: next }));
  return next;
}

function subscribeWallpaperOpacity(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === WALLPAPER_OPACITY_KEY) onChange();
  };

  window.addEventListener(WALLPAPER_OPACITY_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(WALLPAPER_OPACITY_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useWallpaperOpacity(): number {
  return useSyncExternalStore(
    subscribeWallpaperOpacity,
    readWallpaperOpacity,
    () => DEFAULT_WALLPAPER_OPACITY,
  );
}

export const WALLPAPER_MOTION_KEY = "astra-wallpaper-motion";
export const WALLPAPER_MOTION_EVENT = "astra:wallpaper-motion";

export function readWallpaperMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(WALLPAPER_MOTION_KEY) !== "0";
}

export function writeWallpaperMotion(enabled: boolean): boolean {
  if (typeof window === "undefined") return enabled;
  window.localStorage.setItem(WALLPAPER_MOTION_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new CustomEvent<boolean>(WALLPAPER_MOTION_EVENT, { detail: enabled }));
  return enabled;
}

function subscribeWallpaperMotion(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === WALLPAPER_MOTION_KEY) onChange();
  };

  window.addEventListener(WALLPAPER_MOTION_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(WALLPAPER_MOTION_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useWallpaperMotion(): boolean {
  return useSyncExternalStore(subscribeWallpaperMotion, readWallpaperMotion, () => true);
}

type Ember = {
  x: number;
  y: number;
  size: number;
  rise: number;
  sway: number;
  phase: number;
  life: number;
  maxLife: number;
  alpha: number;
};

type Spark = {
  x: number;
  y: number;
  size: number;
  rise: number;
  drift: number;
  phase: number;
  twinkle: number;
  alpha: number;
};

type Shaft = {
  x: number;
  width: number;
  length: number;
  rotation: number;
  alpha: number;
  phase: number;
  swing: number;
  speed: number;
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export default function WallpaperBackground() {
  const { background } = useTheme();
  const active = background === "tohru";
  const opacity = useWallpaperOpacity();
  const motion = useWallpaperMotion();

  const hostRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 鼠标视差：壁纸随指针轻微位移，移动端不启用
  useEffect(() => {
    if (!active || !motion) return;
    const layer = parallaxRef.current;
    if (!layer) return;

    layer.style.transform = "translate3d(0, 0, 0) scale(1.06)";

    if (window.matchMedia("(pointer: coarse)").matches) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let frame = 0;

    const onPointerMove = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 26;
      targetY = (event.clientY / window.innerHeight - 0.5) * 20;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      layer.style.transform = `translate3d(${-currentX}px, ${-currentY}px, 0) scale(1.06)`;
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      layer.style.transform = "";
    };
  }, [active, motion]);

  // 粒子层：余烬、金色光点、缓慢漂移的光柱
  useEffect(() => {
    if (!active || !motion) return;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let lastTime = performance.now();
    let shaftImage: HTMLImageElement | null = null;

    const embers: Ember[] = [];
    const sparks: Spark[] = [];
    const shafts: Shaft[] = [];

    const spawnEmber = (ember: Ember, midLife: boolean) => {
      ember.x = randomBetween(0, width);
      ember.y = midLife ? randomBetween(0, height) : height + randomBetween(20, 80);
      ember.size = randomBetween(14, 44);
      ember.rise = randomBetween(14, 34);
      ember.sway = randomBetween(8, 26);
      ember.phase = randomBetween(0, Math.PI * 2);
      ember.maxLife = randomBetween(7, 13);
      ember.life = midLife ? randomBetween(0, ember.maxLife) : 0;
      ember.alpha = randomBetween(0.14, 0.3);
    };

    const seed = () => {
      embers.length = 0;
      sparks.length = 0;
      shafts.length = 0;

      const emberCount = Math.round(Math.min(34, Math.max(12, width / 70)));
      for (let i = 0; i < emberCount; i += 1) {
        const ember = {} as Ember;
        spawnEmber(ember, true);
        embers.push(ember);
      }

      const sparkCount = Math.round(Math.min(240, Math.max(90, (width * height) / 10000)));
      for (let i = 0; i < sparkCount; i += 1) {
        sparks.push({
          x: randomBetween(0, width),
          y: randomBetween(0, height),
          size: randomBetween(0.8, 2.4),
          rise: randomBetween(6, 22),
          drift: randomBetween(-10, 10),
          phase: randomBetween(0, Math.PI * 2),
          twinkle: randomBetween(0.7, 2.3),
          alpha: randomBetween(0.22, 0.6),
        });
      }

      for (let i = 0; i < 15; i += 1) {
        shafts.push({
          x: randomBetween(-width * 0.1, width * 1.1),
          width: randomBetween(80, 220),
          length: height * randomBetween(1.4, 2.1),
          rotation: -0.35 + randomBetween(-0.08, 0.08),
          alpha: randomBetween(0.18, 0.45),
          phase: randomBetween(0, Math.PI * 2),
          swing: randomBetween(20, 70),
          speed: randomBetween(0.1, 0.28),
        });
      }
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = (time: number) => {
      const delta = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      const seconds = time / 1000;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      const halo = ctx.createRadialGradient(
        width * 0.18,
        -height * 0.1,
        0,
        width * 0.18,
        -height * 0.1,
        height * 1.1,
      );
      halo.addColorStop(0, "rgba(255, 216, 168, 0.22)");
      halo.addColorStop(1, "rgba(255, 216, 168, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      if (shaftImage) {
        for (const shaft of shafts) {
          const swing = Math.sin(seconds * shaft.speed + shaft.phase) * shaft.swing;
          const pulse = 0.6 + 0.4 * Math.sin(seconds * shaft.speed * 0.7 + shaft.phase * 1.6);
          ctx.save();
          ctx.translate(shaft.x + swing, -height * 0.12);
          ctx.rotate(shaft.rotation);
          ctx.globalAlpha = shaft.alpha * pulse;
          ctx.drawImage(shaftImage, -shaft.width / 2, 0, shaft.width, shaft.length);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;

      for (const ember of embers) {
        ember.life += delta;
        if (ember.life >= ember.maxLife || ember.y + ember.size < -80) {
          spawnEmber(ember, false);
          continue;
        }
        ember.y -= ember.rise * delta;
        ember.x += Math.sin(seconds * 0.6 + ember.phase) * ember.sway * delta;
        const progress = ember.life / ember.maxLife;
        const fade = Math.sin(progress * Math.PI);
        const glow = ctx.createRadialGradient(ember.x, ember.y, 0, ember.x, ember.y, ember.size);
        glow.addColorStop(0, `rgba(255, 232, 190, ${ember.alpha * fade})`);
        glow.addColorStop(0.4, `rgba(255, 168, 72, ${ember.alpha * fade * 0.55})`);
        glow.addColorStop(1, "rgba(255, 140, 40, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const spark of sparks) {
        spark.y -= spark.rise * delta;
        spark.x += Math.sin(seconds * 0.8 + spark.phase) * spark.drift * delta;
        if (spark.y < -20) {
          spark.y = height + randomBetween(4, 40);
          spark.x = randomBetween(0, width);
        }
        const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(seconds * spark.twinkle + spark.phase));
        ctx.fillStyle = `rgba(255, 226, 175, ${spark.alpha * twinkle})`;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      frame = requestAnimationFrame(draw);
    };

    const start = () => {
      if (frame) return;
      lastTime = performance.now();
      frame = requestAnimationFrame(draw);
    };

    const stop = () => {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    const image = new Image();
    image.src = "/wallpaper/lightshaft.png";
    image.onload = () => {
      shaftImage = image;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    start();

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      image.onload = null;
      shaftImage = null;
    };
  }, [active, motion]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ opacity }}
    >
      <div ref={hostRef} className="absolute inset-0">
        <div ref={parallaxRef} className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wallpaper/tohru-bg.jpg"
            alt=""
            draggable={false}
            className="size-full select-none object-cover"
          />
          {motion && <canvas ref={canvasRef} className="absolute inset-0 size-full" />}
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/5 to-white/25" />
    </div>
  );
}
