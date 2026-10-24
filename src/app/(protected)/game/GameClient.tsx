'use client';

import { useEffect, useRef } from 'react';
import './games-page.css';

export default function GameClient(props: {
  initialMagic: number;
  initialPity5: number;
  initialPity4: number;
  initialTotal: number;
  initialHistory: unknown[];
  initialRainbowIds: unknown[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
      root.querySelector('#' + id) as T;

    /* ============ 图标 ============ */
    const ICON_MAGIC =
      '<path d="M12 1.8 20.4 9.6 12 22.2 3.6 9.6z" fill="currentColor"/>' +
      '<path d="M12 1.8 12 22.2 3.6 9.6z" fill="#fff" opacity=".28"/>';

    let rainbowGradId = 0;
    function rainbowIconSvg() {
      const id = 'rg' + ++rainbowGradId;
      return `<svg viewBox="0 0 24 24">
        <defs>
          <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ff5e7e"/>
            <stop offset="25%" stop-color="#ffb84d"/>
            <stop offset="50%" stop-color="#5ee88a"/>
            <stop offset="75%" stop-color="#5ea8ff"/>
            <stop offset="100%" stop-color="#b86eff"/>
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="9" fill="url(#${id})"/>
        <circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="1" opacity=".75"/>
        <circle cx="12" cy="12" r="4.6" fill="#fff" opacity=".55"/>
      </svg>`;
    }

    /* ============ 奖励池 ============ */
    type PoolItem =
      | { name: string; type: 'magic'; min: number; max: number; w: number }
      | { name: string; type: 'rainbow'; dayMin: number; dayMax: number; w: number };

    const POOL: Record<number, PoolItem[]> = {
      5: [
        { name: '彩虹ID', type: 'rainbow', dayMin: 30, dayMax: 365, w: 1.0 },
        { name: '魔力',   type: 'magic',   min: 800,  max: 2000,  w: 1.8 },
      ],
      4: [
        { name: '彩虹ID', type: 'rainbow', dayMin: 7, dayMax: 90, w: 1.0 },
        { name: '魔力',   type: 'magic',   min: 200, max: 600,   w: 1.8 },
      ],
      3: [{ name: '魔力', type: 'magic', min: 20, max: 100, w: 1.0 }],
    };

    function randInt(min: number, max: number) {
      return Math.floor(min + Math.random() * (max - min + 1));
    }

    /* ============ 抽卡核心 ============ */
    const gacha = {
      pity5: props.initialPity5,
      pity4: props.initialPity4,
      total: props.initialTotal,
      history: (Array.isArray(props.initialHistory) ? props.initialHistory : []) as any[],

      pick(rarity: number): PoolItem {
        const pool = POOL[rarity];
        let sum = 0;
        for (const it of pool) sum += it.w;
        let r = Math.random() * sum;
        for (const it of pool) {
          r -= it.w;
          if (r <= 0) return it;
        }
        return pool[pool.length - 1];
      },

      pull() {
        this.total++;
        let rarity: number;

        const n5 = this.pity5 + 1;
        let rate5 = 0.006;
        if (n5 > 73) rate5 = 0.006 + 0.06 * (n5 - 73);
        if (n5 >= 90) rate5 = 1;

        if (Math.random() < rate5) {
          rarity = 5;
          this.pity5 = 0;
          this.pity4++;
        } else {
          const n4 = this.pity4 + 1;
          let rate4 = 0.051;
          if (n4 === 9) rate4 = 0.561;
          if (n4 >= 10) rate4 = 1;

          if (Math.random() < rate4) {
            rarity = 4;
            this.pity4 = 0;
            this.pity5++;
          } else {
            rarity = 3;
            this.pity4++;
            this.pity5++;
          }
        }

        const base = this.pick(rarity);
        const item: any = { type: base.type, name: base.name, rarity, index: this.total };
        if (base.type === 'magic') item.value = randInt(base.min, base.max);
        else if (base.type === 'rainbow') item.days = randInt(base.dayMin, base.dayMax);

        this.history.unshift(item);
        if (this.history.length > 400) this.history.length = 400;
        return item;
      },
    };

    /* ============ 货币 & 背包 ============ */
    const magicCountEl = $('magicCount');
    const WISH_COST = 160;
    let magic = props.initialMagic;
    const inventory = { rainbowIds: (Array.isArray(props.initialRainbowIds) ? props.initialRainbowIds : []) as { days: number; ts: number }[] };

    function refreshUI() {
      if (magicCountEl) magicCountEl.textContent = String(magic);
    }

    /* ============ 星空生成 ============ */
    (function buildStarfield() {
      const sf = $('starfield');
      if (!sf) return;
      const n = 140;
      const colors = ['#ffffff', '#cfe8ff', '#a8d4ff', '#e0f4ff'];
      let html = '';
      for (let i = 0; i < n; i++) {
        const size = (Math.random() * 1.9 + 0.6).toFixed(2);
        const x = (Math.random() * 100).toFixed(2);
        const y = (Math.random() * 100).toFixed(2);
        const d = (Math.random() * 4).toFixed(2);
        const o = (Math.random() * 0.55 + 0.15).toFixed(2);
        const c = colors[(Math.random() * colors.length) | 0];
        const glow = Number(size) > 1.8 ? `box-shadow:0 0 8px ${c};` : '';
        html += `<div class="star" style="width:${size}px;height:${size}px;left:${x}%;top:${y}%;background:${c};${glow}animation-delay:-${d}s;opacity:${o}"></div>`;
      }
      sf.innerHTML = html;
    })();

    /* ============ 音效 ============ */
    let AC: AudioContext | null = null;
    function audio() {
      if (!AC) {
        try {
          AC = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch {
          AC = null;
        }
      }
      if (AC && AC.state === 'suspended') AC.resume();
      return AC;
    }

    function sfxChime(rarity: number) {
      const ctx = audio();
      if (!ctx) return;
      const t = ctx.currentTime;
      const freq = rarity === 5 ? 1046 : rarity === 4 ? 784 : 587;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(rarity === 5 ? 0.13 : 0.07, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.8);

      if (rarity === 5) {
        [1568, 2093].forEach((f, i) => {
          const o2 = ctx.createOscillator();
          o2.type = 'triangle';
          o2.frequency.value = f;
          const g2 = ctx.createGain();
          const st = t + 0.05 + i * 0.06;
          g2.gain.setValueAtTime(0.0001, st);
          g2.gain.exponentialRampToValueAtTime(0.05, st + 0.02);
          g2.gain.exponentialRampToValueAtTime(0.0001, st + 0.9);
          o2.connect(g2).connect(ctx.destination);
          o2.start(st); o2.stop(st + 1.0);
        });
      }
    }

    /* ============ 特效画布（用容器尺寸） ============ */
    const canvas = $('fx') as HTMLCanvasElement;
    const ctx2d = canvas.getContext('2d')!;
    let W = 0, H = 0;

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = root.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();

    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(root);
    window.addEventListener('resize', resizeCanvas);

    let rafId = 0;
    (function emptyLoop() {
      rafId = requestAnimationFrame(function tick() {
        ctx2d.clearRect(0, 0, W, H);
        rafId = requestAnimationFrame(tick);
      });
    })();

    /* ============ 动画时序 ============ */
    const blackout = $('blackout');
    const skipHint = $('skipHint');
    const cardsEl = $('cards');
    const resultView = $('resultView');
    const closeBtn = $('closeBtn') as HTMLButtonElement;

    let skipResolve: (() => void) | null = null;
    let animating = false;
    let disposed = false;

    function wait(ms: number) {
      return new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          skipResolve = null;
          resolve();
        };
        skipResolve = finish;
        setTimeout(finish, ms);
      });
    }
    function requestSkip() { if (skipResolve) skipResolve(); }

    const onPointerDown = (e: PointerEvent) => {
      if (animating) {
        if (resultView.contains(e.target as Node)) return;
        requestSkip();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);

    async function playAnimation() {
      // 确保黑幕先盖牢主界面
      blackout.style.transition = 'none';
      blackout.style.opacity = '1';
      // 强制 reflow 让 transition 生效
      void blackout.offsetWidth;
      blackout.style.transition = '';

      skipHint.classList.add('show');
      await wait(280);

      // resultView 在黑幕之下先激活（z-index 100 > 40），但里面卡片都是 opacity:0
      resultView.classList.add('active');
      skipHint.classList.remove('show');

      // 黑幕淡出（在 resultView 下方，用户看不到淡出过程）
      blackout.style.transition = 'opacity .2s ease';
      blackout.style.opacity = '0';

      // 等一帧让 resultView 的 opacity:0 卡片被浏览器渲染，这样后续加 .show 时 transition 能触发
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    }

    /* ============ 结果展示 ============ */
    function createCard(item: any) {
      const el = document.createElement('div');
      el.className = 'card r' + item.rarity;

      let iconHtml: string, iconColor: string, nameText: string, subText: string;
      if (item.type === 'magic') {
        iconHtml = `<svg viewBox="0 0 24 24">${ICON_MAGIC}</svg>`;
        iconColor = '#a8e0ff';
        nameText = '魔力';
        subText = '+' + item.value;
      } else if (item.type === 'rainbow') {
        iconHtml = rainbowIconSvg();
        iconColor = '#fff';
        nameText = '彩虹ID';
        subText = item.days + ' 天';
      } else {
        iconHtml = `<svg viewBox="0 0 24 24">${ICON_MAGIC}</svg>`;
        iconColor = '#a8e0ff';
        nameText = item.name || '奖励';
        subText = '';
      }

      el.innerHTML = `
        <div class="cardInner">
          <div class="cardFace cardBack"></div>
          <div class="cardFace cardFront">
            <div class="cardIcon" style="color:${iconColor}">${iconHtml}</div>
            <div class="cardBottom">
              <div class="cardName">${nameText}</div>
              <div class="cardStars">${'★'.repeat(item.rarity)}</div>
              <div class="cardSub">${subText}</div>
            </div>
          </div>
        </div>`;
      return el;
    }

    // 提前准备好 DOM（在黑幕覆盖期间），避免 resultView 激活后才清空 + 填充导致闪烁
    function prepareCards(results: any[]) {
      cardsEl.innerHTML = '';
      cardsEl.className = 'cards ' + (results.length > 1 ? 'grid' : 'single');
      closeBtn.classList.remove('show');
      results.forEach((item) => cardsEl.appendChild(createCard(item)));
    }

    async function showResults(results: any[]) {
      // playAnimation 已经让 resultView 可见 + 卡片已准备好（opacity:0，等待 .show）
      const els = cardsEl.querySelectorAll('.card');
      const interval = results.length > 1 ? 145 : 320;

      for (let i = 0; i < els.length; i++) {
        els[i].classList.add('show');
        sfxChime(results[i].rarity);
        await wait(interval);
      }

      await wait(420);
      closeBtn.classList.add('show');

      return new Promise<void>((resolve) => {
        const done = () => {
          closeBtn.removeEventListener('click', done);
          resultView.classList.remove('active');
          setTimeout(resolve, 180);
        };
        closeBtn.addEventListener('click', done);
      });
    }

    /* ============ 弹窗 ============ */
    const modal = $('modal');
    const modalBox = $('modalBox');

    function showModal(html: string) {
      modalBox.innerHTML = html + '<button class="modalClose">关 闭</button>';
      modal.classList.add('active');
      modalBox.querySelector('.modalClose')!.addEventListener('click', () => {
        modal.classList.remove('active');
      });
      return modalBox;
    }

    const onModalClick = (e: MouseEvent) => {
      if (e.target === modal) modal.classList.remove('active');
    };
    modal.addEventListener('click', onModalClick);

    /* ============ 主流程 ============ */
    let busy = false;

    async function doWish(count: number) {
      if (busy || disposed) return;

      const cost = count * WISH_COST;
      if (magic < cost) {
        showModal(`<h3>魔 力 不 足</h3>
          <p style="text-align:center;color:#93a8c4;font-size:13px;margin:10px 0">
            需要 <b style="color:#ffd98a">${cost}</b> 魔力，当前持有 <b style="color:#8fd4ff">${magic}</b>
          </p>`);
        return;
      }

      busy = true;
      animating = true;
      audio();

      magic -= cost;

      const results: any[] = [];
      for (let i = 0; i < count; i++) {
        const r = gacha.pull();
        results.push(r);
        if (r.type === 'magic') magic += r.value;
        else if (r.type === 'rainbow') inventory.rainbowIds.push({ days: r.days, ts: Date.now() });
      }

      refreshUI();
      prepareCards(results);  // 黑幕覆盖期间提前把卡片 DOM 准备好（opacity:0）
      await playAnimation();
      await showResults(results);

      animating = false;
      busy = false;
      refreshUI();
      saveSave();
    }

    const wishBtns = root.querySelectorAll<HTMLButtonElement>('.wishBtn');
    const onWishClick = (e: Event) => {
      const btn = e.currentTarget as HTMLButtonElement;
      doWish(parseInt(btn.dataset.count!, 10));
    };
    wishBtns.forEach((btn) => btn.addEventListener('click', onWishClick));

    /* ============ 详情 / 历史 ============ */
    $('btnDetail').addEventListener('click', () => {
      showModal(`
        <h3>祈 愿 详 情</h3>
        <p><span class="hl">★★★★★</span> 基础概率 <b>0.600%</b>，综合概率（含保底）<b>1.600%</b>。最多 <b>90</b> 次祈愿必定获得五星奖励。</p>
        <p><span class="hl2">★★★★</span> 基础概率 <b>5.100%</b>，综合概率（含保底）<b>13.000%</b>。最多 <b>10</b> 次祈愿必定获得四星及以上奖励。</p>
        <p><span style="color:#8fb8e0">★★★</span> 三星奖励的概率为 <b>94.300%</b>。</p>
        <p style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(140,190,255,.2);font-size:12.5px;color:#93a8c4">
          每次祈愿消耗 <span class="hl2">160魔力</span>。
        </p>
        <p style="font-size:12.5px;color:#93a8c4">
          <b style="color:#ffd98a">奖励一览：</b><br>
          ★★★★★　彩虹ID（30~365 天） · 魔力 800~2000<br>
          ★★★★　彩虹ID（7~90 天） · 魔力 200~600<br>
          ★★★　魔力 20~100
        </p>`);
    });

    $('btnHistory').addEventListener('click', () => {
      const p5Left = Math.max(0, 90 - gacha.pity5);
      const p4Left = Math.max(0, 10 - gacha.pity4);
      showModal(`<h3>祈 愿 记 录</h3>
        <div style="display:flex;gap:10px;margin-top:4px">
          <div style="flex:1;text-align:center;padding:12px 6px;background:rgba(255,205,120,.1);border-radius:12px;border:1px solid rgba(255,205,120,.3)">
            <div style="font-size:11px;color:#93a8c4;margin-bottom:2px">距5星保底</div>
            <div style="font-size:22px;font-weight:700;color:#ffd98a;letter-spacing:1px">${p5Left}<span style="font-size:12px;font-weight:400;color:#93a8c4"> 抽</span></div>
          </div>
          <div style="flex:1;text-align:center;padding:12px 6px;background:rgba(120,180,255,.1);border-radius:12px;border:1px solid rgba(120,180,255,.3)">
            <div style="font-size:11px;color:#93a8c4;margin-bottom:2px">距4星保底</div>
            <div style="font-size:22px;font-weight:700;color:#9fd4ff;letter-spacing:1px">${p4Left}<span style="font-size:12px;font-weight:400;color:#93a8c4"> 抽</span></div>
          </div>
          <div style="flex:1;text-align:center;padding:12px 6px;background:rgba(180,120,255,.1);border-radius:12px;border:1px solid rgba(180,120,255,.3)">
            <div style="font-size:11px;color:#93a8c4;margin-bottom:2px">累计祈愿</div>
            <div style="font-size:22px;font-weight:700;color:#d8b4fe;letter-spacing:1px">${gacha.total}<span style="font-size:12px;font-weight:400;color:#93a8c4"> 次</span></div>
          </div>
        </div>`);
    });

    /* ============ 存档 ============ */
    const API_BASE = '';

    async function loadSave() {
      try {
        const res = await fetch(API_BASE + '/api/game/wish', { credentials: 'same-origin' });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data.ok || !data.save) return false;
        const s = data.save;
        magic = s.magic ?? 16000;
        gacha.pity5 = s.pity5 ?? 0;
        gacha.pity4 = s.pity4 ?? 0;
        gacha.total = s.total ?? 0;
        gacha.history = Array.isArray(s.history) ? s.history : [];
        inventory.rainbowIds = Array.isArray(s.rainbowIds) ? s.rainbowIds : [];
        return true;
      } catch (e) {
        console.warn('[wish] load save failed:', e);
        return false;
      }
    }

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    function saveSave() {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        try {
          await fetch(API_BASE + '/api/game/wish', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              magic,
              pity5: gacha.pity5,
              pity4: gacha.pity4,
              total: gacha.total,
              history: gacha.history,
              rainbowIds: inventory.rainbowIds,
            }),
          });
        } catch (e) {
          console.warn('[wish] save failed:', e);
        }
      }, 1000);
    }

    /* ============ 初始化 ============ */
    // props 已经是 SSR 查到的最新值，立即刷新 UI（零延迟、零闪烁）
    refreshUI();
    // 异步拉一次 API 兜底（比如另一个标签页刚做了祈愿）
    (async () => {
      await loadSave();
      if (disposed) return;
      refreshUI();
    })();

    /* ============ 防止移动端双击缩放 ============ */
    let lastTouch = 0;
    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouch < 300) e.preventDefault();
      lastTouch = now;
    };
    document.addEventListener('touchend', onTouchEnd, { passive: false });

    /* ============ 清理 ============ */
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', resizeCanvas);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('touchend', onTouchEnd);
      modal.removeEventListener('click', onModalClick);
      wishBtns.forEach((btn) => btn.removeEventListener('click', onWishClick));
      if (saveTimer) clearTimeout(saveTimer);
      if (AC) { try { AC.close(); } catch {} }
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center px-4 py-4 sm:px-6">
      <div
        ref={rootRef}
        className="games-page-root overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]"
        style={{ height: 'min(calc(100vh - 7rem), 720px)' }}
      >
        {/* ============ 主界面 ============ */}
        <div id="wishView">
          <div id="starfield" />
          <div className="halo" />
          <div className="halo halo2" />

          <div className="topBar">
            <div className="pageTitle">祈 愿</div>
            <div className="wallet">
              <div className="currency magic">
                <div className="magicIcon">
                  <svg viewBox="0 0 24 24">
                    <defs>
                      <linearGradient id="mg" x1="0" y1="0" x2="0.4" y2="1">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="45%" stopColor="#a8e0ff" />
                        <stop offset="100%" stopColor="#4a90d9" />
                      </linearGradient>
                    </defs>
                    <path d="M12 1.8 20.4 9.6 12 22.2 3.6 9.6z" fill="url(#mg)" />
                    <path d="M12 1.8 12 22.2 3.6 9.6z" fill="#fff" opacity=".28" />
                    <path d="M3.6 9.6h16.8" stroke="#fff" strokeWidth=".9" opacity=".45" />
                  </svg>
                </div>
                <b id="magicCount">16000</b>
              </div>
            </div>
          </div>

          <div className="bannerInfo">
            <div className="bannerName">奔行世间</div>
            <div className="bannerTime">永久开放</div>
          </div>

          <div className="bottomBar">
            <div className="sideLinks">
              <button className="sideLink" id="btnDetail">详情</button>
              <button className="sideLink" id="btnHistory">历史</button>
            </div>
            <div className="wishButtons">
              <button className="wishBtn" data-count="1">
                <span className="bLabel">祈愿 1 次</span>
                <span className="bCost">
                  <span className="magicIcon">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 1.8 20.4 9.6 12 22.2 3.6 9.6z" fill="#a8e0ff" />
                      <path d="M12 1.8 12 22.2 3.6 9.6z" fill="#fff" opacity=".28" />
                    </svg>
                  </span>
                  160
                </span>
              </button>
              <button className="wishBtn primary" data-count="10">
                <span className="bLabel">祈愿 10 次</span>
                <span className="bCost">
                  <span className="magicIcon">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 1.8 20.4 9.6 12 22.2 3.6 9.6z" fill="#a8e0ff" />
                      <path d="M12 1.8 12 22.2 3.6 9.6z" fill="#fff" opacity=".28" />
                    </svg>
                  </span>
                  1600
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ============ 特效层 ============ */}
        <div id="blackout" />
        <canvas id="fx" />
        <div id="skipHint">点击任意处跳过</div>

        {/* ============ 结果页 ============ */}
        <div id="resultView">
          <div className="cards" id="cards" />
          <button id="closeBtn">点 击 继 续</button>
        </div>

        {/* ============ 弹窗 ============ */}
        <div id="modal">
          <div className="modalBox" id="modalBox" />
        </div>
      </div>
    </div>
  );
}
