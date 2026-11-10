"use client";

import { useEffect, useRef } from "react";
import "./games-page.css";

export default function GameClient(props: {
  initialMagic: number;
  initialPity5: number;
  initialPity4: number;
  initialTotal: number;
  initialTohru: number;
  initialHistory: unknown[];
  initialRainbowIds: unknown[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
      root.querySelector("#" + id) as T;

    /* ============ 图标 ============ */
    const ICON_MAGIC =
      '<path d="M12 1.8 20.4 9.6 12 22.2 3.6 9.6z" fill="currentColor"/>' +
      '<path d="M12 1.8 12 22.2 3.6 9.6z" fill="#fff" opacity=".28"/>';

    let rainbowGradId = 0;
    function rainbowIconSvg() {
      const id = "rg" + ++rainbowGradId;
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
      | { name: string; type: "magic"; min: number; max: number; w: number }
      | { name: string; type: "rainbow"; dayMin: number; dayMax: number; w: number }
      | { name: string; type: "tohru"; w: number };

    const POOL: Record<number, PoolItem[]> = {
      5: [
        { name: "彩虹ID", type: "rainbow", dayMin: 30, dayMax: 365, w: 0 },
        { name: "魔力", type: "magic", min: 800, max: 2000, w: 0 },
        { name: "托尔", type: "tohru", w: 1.0 },
      ],
      4: [
        { name: "彩虹ID", type: "rainbow", dayMin: 7, dayMax: 90, w: 1.0 },
        { name: "魔力", type: "magic", min: 200, max: 600, w: 1.8 },
      ],
      3: [{ name: "魔力", type: "magic", min: 20, max: 100, w: 1.0 }],
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

        // TEMP 调试：五星必中，便于查看托尔奖品卡
        rate5 = 1;

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
        if (base.type === "magic") item.value = randInt(base.min, base.max);
        else if (base.type === "rainbow") item.days = randInt(base.dayMin, base.dayMax);

        this.history.unshift(item);
        if (this.history.length > 400) this.history.length = 400;
        return item;
      },
    };

    /* ============ 货币 & 背包 ============ */
    const magicCountEl = $("magicCount");
    const WISH_COST = 160;
    let magic = props.initialMagic;
    const inventory = {
      tohru: Number(props.initialTohru) || 0,
      rainbowIds: (Array.isArray(props.initialRainbowIds) ? props.initialRainbowIds : []) as {
        days: number;
        ts: number;
      }[],
    };

    function refreshUI() {
      if (magicCountEl) magicCountEl.textContent = String(magic);
    }

    /* ============ 星空生成 ============ */
    (function buildStarfield() {
      const sf = $("starfield");
      if (!sf) return;
      const n = 140;
      const colors = ["#ffffff", "#cfe8ff", "#a8d4ff", "#e0f4ff"];
      let html = "";
      for (let i = 0; i < n; i++) {
        const size = (Math.random() * 1.9 + 0.6).toFixed(2);
        const x = (Math.random() * 100).toFixed(2);
        const y = (Math.random() * 100).toFixed(2);
        const d = (Math.random() * 4).toFixed(2);
        const o = (Math.random() * 0.55 + 0.15).toFixed(2);
        const c = colors[(Math.random() * colors.length) | 0];
        const glow = Number(size) > 1.8 ? `box-shadow:0 0 8px ${c};` : "";
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
      if (AC && AC.state === "suspended") AC.resume();
      return AC;
    }

    function sfxChime(rarity: number) {
      const ctx = audio();
      if (!ctx) return;
      const t = ctx.currentTime;
      const freq = rarity === 5 ? 1046 : rarity === 4 ? 784 : 587;
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(rarity === 5 ? 0.13 : 0.07, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.8);

      if (rarity === 5) {
        [1568, 2093].forEach((f, i) => {
          const o2 = ctx.createOscillator();
          o2.type = "triangle";
          o2.frequency.value = f;
          const g2 = ctx.createGain();
          const st = t + 0.05 + i * 0.06;
          g2.gain.setValueAtTime(0.0001, st);
          g2.gain.exponentialRampToValueAtTime(0.05, st + 0.02);
          g2.gain.exponentialRampToValueAtTime(0.0001, st + 0.9);
          o2.connect(g2).connect(ctx.destination);
          o2.start(st);
          o2.stop(st + 1.0);
        });
      }
    }

    /* ============ 特效画布（用容器尺寸） ============ */
    const canvas = $("fx") as HTMLCanvasElement;
    const ctx2d = canvas.getContext("2d")!;
    let W = 0,
      H = 0;

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = root.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();

    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(root);
    window.addEventListener("resize", resizeCanvas);

    let rafId = 0;
    (function emptyLoop() {
      rafId = requestAnimationFrame(function tick() {
        ctx2d.clearRect(0, 0, W, H);
        rafId = requestAnimationFrame(tick);
      });
    })();

    /* ============ 动画时序 ============ */
    const blackout = $("blackout");
    const resultView = $("resultView");
    const cardsEl = $("cards");
    const closeBtn = $<HTMLButtonElement>("closeBtn");

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
    function requestSkip() {
      if (skipResolve) skipResolve();
    }

    // 揭示动画期间点击可加速
    const onPointerDown = () => {
      if (!animating) return;
      requestSkip();
    };
    document.addEventListener("pointerdown", onPointerDown, true);

    async function playAnimation() {
      // 确保黑幕先盖牢主界面
      blackout.style.transition = "none";
      blackout.style.opacity = "1";
      // 强制 reflow 让 transition 生效
      void blackout.offsetWidth;
      blackout.style.transition = "";

      await wait(280);

      // resultView 在黑幕之下先激活（z-index 100 > 40），但里面卡片都是 opacity:0
      resultView.classList.add("active");

      // 黑幕淡出（在 resultView 下方，用户看不到淡出过程）
      blackout.style.transition = "opacity .2s ease";
      blackout.style.opacity = "0";

      // 等一帧让 resultView 的 opacity:0 卡片被浏览器渲染，这样后续加 .show 时 transition 能触发
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    }

    /* ============ 结果展示 ============ */

    function createCard(item: any) {
      const el = document.createElement("div");
      el.className = "card r" + item.rarity;

      let iconHtml: string, iconColor: string, nameText: string, subText: string;
      if (item.type === "magic") {
        iconHtml = `<svg viewBox="0 0 24 24">${ICON_MAGIC}</svg>`;
        iconColor = "#a8e0ff";
        nameText = "魔力";
        subText = String(item.value);
      } else if (item.type === "rainbow") {
        iconHtml = rainbowIconSvg();
        iconColor = "#fff";
        nameText = "彩虹ID";
        subText = item.days + " 天";
      } else {
        iconHtml = `<svg viewBox="0 0 24 24">${ICON_MAGIC}</svg>`;
        iconColor = "#a8e0ff";
        nameText = item.name || "奖励";
        subText = "";
      }

      // 托尔：独立五星奖品，整张卡面铺满立绘
      if (item.type === "tohru") {
        el.className = "card r5 full";
        el.innerHTML = `
          <div class="cardInner">
            <div class="cardFace cardBack"></div>
            <div class="cardFace cardFront fullArt">
              <img class="cardArt" src="/wallpaper/tohru-avatar.jpg?v=3" alt="托尔" />
              <div class="cardBottom">
                <div class="cardName">托尔</div>
              </div>
            </div>
          </div>`;
        return el;
      }

      el.innerHTML = `
        <div class="cardInner">
          <div class="cardFace cardBack"></div>
          <div class="cardFace cardFront">
            <div class="cardIcon" style="color:${iconColor}">${iconHtml}</div>
            <div class="cardBottom">
              <div class="cardName">${nameText}</div>
              <div class="cardSub">${subText}</div>
            </div>
          </div>
        </div>`;
      return el;
    }

    // 黑幕覆盖期间提前把卡片 DOM 准备好（opacity:0）
    function prepareCards(results: any[]) {
      cardsEl.innerHTML = "";
      cardsEl.className = "cards " + (results.length > 1 ? "grid" : "single");
      resultView.classList.toggle("single", results.length === 1);
      closeBtn.classList.remove("show");
      results.forEach((item) => cardsEl.appendChild(createCard(item)));
    }

    async function showResults(results: any[]) {
      // 逐张揭示：十连间隔 130ms，单抽 320ms
      const els = Array.from(cardsEl.querySelectorAll<HTMLElement>(".card"));
      const interval = results.length > 1 ? 130 : 320;

      for (let i = 0; i < els.length; i++) {
        els[i].classList.add("show");
        sfxChime(results[i]?.rarity ?? 3);
        await wait(interval);
      }

      await wait(400);
      closeBtn.classList.add("show");

      return new Promise<void>((resolve) => {
        const done = () => {
          closeBtn.removeEventListener("click", done);
          resultView.classList.remove("active");
          setTimeout(resolve, 180);
        };
        closeBtn.addEventListener("click", done);
      });
    }

    /* ============ 弹窗 ============ */
    const modal = $("modal");
    const modalBox = $("modalBox");

    function showModal(html: string) {
      modalBox.innerHTML = html + '<button class="modalClose">关 闭</button>';
      modal.classList.add("active");
      modalBox.querySelector(".modalClose")!.addEventListener("click", () => {
        modal.classList.remove("active");
      });
      return modalBox;
    }

    const onModalClick = (e: MouseEvent) => {
      if (e.target === modal) modal.classList.remove("active");
    };
    modal.addEventListener("click", onModalClick);

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
        if (r.type === "magic") magic += r.value;
        else if (r.type === "rainbow") inventory.rainbowIds.push({ days: r.days, ts: Date.now() });
        else if (r.type === "tohru") inventory.tohru++;
      }

      refreshUI();
      prepareCards(results); // 黑幕覆盖期间提前把卡片 DOM 准备好（opacity:0）
      await playAnimation();
      await showResults(results);

      animating = false;
      busy = false;
      refreshUI();
      saveSave();
    }

    const wishBtns = root.querySelectorAll<HTMLButtonElement>(".wishBtn");
    const onWishClick = (e: Event) => {
      const btn = e.currentTarget as HTMLButtonElement;
      doWish(parseInt(btn.dataset.count!, 10));
    };
    wishBtns.forEach((btn) => btn.addEventListener("click", onWishClick));

    /* ============ 详情 / 历史 ============ */
    $("btnDetail").addEventListener("click", () => {
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
          ★★★★★　贵宾、随机奖品、魔力<br>
          ★★★★　彩虹ID、魔力<br>
          ★★★　魔力
        </p>`);
    });

    $("btnHistory").addEventListener("click", () => {
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
    const API_BASE = "";

    async function loadSave() {
      try {
        const res = await fetch(API_BASE + "/api/game/wish", { credentials: "same-origin" });
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
        inventory.tohru = Number(s.tohru) || 0;
        return true;
      } catch (e) {
        console.warn("[wish] load save failed:", e);
        return false;
      }
    }

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    function saveSave() {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        try {
          await fetch(API_BASE + "/api/game/wish", {
            method: "PUT",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              magic,
              pity5: gacha.pity5,
              pity4: gacha.pity4,
              total: gacha.total,
              history: gacha.history,
              rainbowIds: inventory.rainbowIds,
              tohru: inventory.tohru,
            }),
          });
        } catch (e) {
          console.warn("[wish] save failed:", e);
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

    /* ============ 市场（玩家间交易） ============ */
    const marketView = $("marketView");
    const marketBodyEl = $("marketBody");
    const mToastEl = $("mToast");
    const marketMagicEl = $("marketMagic");
    const mTabBtns = root.querySelectorAll<HTMLButtonElement>("#marketTabs .mTab");
    const mPaneEls = root.querySelectorAll<HTMLElement>(".mPane");
    const btnMarket = $("btnMarket");
    const btnMarketClose = $("marketClose");

    type MineState = {
      magic: number;
      tohru: number;
      rainbowIds: { days: number; ts: number }[];
      rainbowDays: number;
    };
    type PriceInfo = { buy: number; sell: number };
    type SystemPrices = Record<"tohru" | "rainbow", PriceInfo>;
    let marketData: {
      mine: MineState;
      prices: SystemPrices | null;
    } = {
      prices: null,
      mine: {
        magic,
        tohru: inventory.tohru,
        rainbowIds: inventory.rainbowIds,
        rainbowDays: inventory.rainbowIds.reduce((sum, item) => sum + Math.max(0, item.days), 0),
      },
    };
    let marketBusy = false;
    let marketFailed = false;
    let toastTimer: ReturnType<typeof setTimeout> | null = null;

    function toast(text: string) {
      if (!mToastEl) return;
      mToastEl.textContent = text;
      mToastEl.classList.add("show");
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => mToastEl.classList.remove("show"), 2200);
    }

    function renderMarket() {
      const { mine, prices } = marketData;
      if (marketMagicEl) marketMagicEl.textContent = String(mine.magic);

      const browseEl = $("mBrowse");
      const invEl = $("mInventory");

      if (!prices) {
        const placeholder = marketFailed
          ? '<div class="mEmpty">加载失败，请稍后重试</div>'
          : '<div class="mEmpty"><span class="mSpin" aria-hidden="true"></span>加载中</div>';
        browseEl.innerHTML = placeholder;
        invEl.innerHTML = placeholder;
        return;
      }

      /** 系统商店卡：按行情价买入 */
      const shopCard = (
        title: string,
        type: "tohru" | "rainbow",
        unit: string,
        info: PriceInfo,
      ) => `
        <div class="mSell" data-price="${info.buy}" data-unit="${unit}">
          <div class="mSellHead">
            <div class="mSellTitle">${title}</div>
            <div class="mSellBadge">售价 ${info.buy} 魔力/${unit}</div>
          </div>
          <div class="mSellForm">
            <div class="mField">
              <label>数量（${unit}）</label>
              <input class="mQtyInput" type="number" inputmode="numeric" min="1" placeholder="0" aria-label="购买${title}数量" />
            </div>
            <div class="mMeta mMetaEnd">
              <div class="mSum">合计 <b>0</b> 魔力</div>
            </div>
            <button class="mBtn mSellBtn" data-buy-item="${type}" type="button">购买</button>
          </div>
        </div>`;

      /** 背包出售卡：按系统收购价折算实收 */
      const sellCard = (
        title: string,
        type: "tohru" | "rainbow",
        unit: string,
        held: number,
        info: PriceInfo,
      ) => `
        <div class="mSell" data-price="${info.sell}" data-unit="${unit}">
          <div class="mSellHead">
            <div class="mSellTitle">${title}</div>
            <div class="mSellBadge">持有 ${held} ${unit}</div>
          </div>
          <div class="mSellForm">
            <div class="mField">
              <label>数量（${unit}）</label>
              <input class="mQtyInput" type="number" inputmode="numeric" min="1" max="${held}" placeholder="0" aria-label="出售${title}数量" />
            </div>
            <div class="mMeta">
              <div class="mRef">收购 ${info.sell} 魔力/${unit}</div>
              <div class="mSum">实收 <b>0</b> 魔力</div>
            </div>
            <button class="mBtn mSellBtn" data-sell-item="${type}" type="button">出售</button>
          </div>
        </div>`;

      browseEl.innerHTML = `<div class="mSellGrid">
        ${shopCard("托尔", "tohru", "张", prices.tohru)}
        ${shopCard("彩虹ID", "rainbow", "天", prices.rainbow)}
      </div>`;

      const sellCards =
        (mine.tohru > 0 ? sellCard("托尔", "tohru", "张", mine.tohru, prices.tohru) : "") +
        (mine.rainbowDays > 0
          ? sellCard("彩虹ID", "rainbow", "天", mine.rainbowDays, prices.rainbow)
          : "");
      invEl.innerHTML = sellCards
        ? `<div class="mSellGrid">${sellCards}</div>`
        : '<div class="mEmpty">背包暂时没有可出售的奖品</div>';
    }

    function syncMine(mine: MineState) {
      marketData.mine = mine;
      magic = mine.magic;
      inventory.tohru = mine.tohru;
      inventory.rainbowIds = mine.rainbowIds;
      marketData.mine.rainbowDays =
        mine.rainbowDays ?? mine.rainbowIds.reduce((sum, item) => sum + Math.max(0, item.days), 0);
      refreshUI();
      saveSave();
    }

    async function loadMarket() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch("/api/game/market", {
          credentials: "same-origin",
          signal: controller.signal,
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.message || "加载失败");
        marketData = {
          mine: data.mine,
          prices: data.prices ?? null,
        };
        marketFailed = false;
        syncMine(data.mine);
        renderMarket();
      } catch (e) {
        console.warn("[market] load failed:", e);
        marketFailed = true;
        renderMarket();
        toast("市场加载失败，请稍后重试");
      } finally {
        clearTimeout(timer);
      }
    }

    async function marketAction(payload: Record<string, unknown>, okText: string) {
      if (marketBusy) {
        toast("上一个操作还在处理中，请稍候");
        return;
      }
      marketBusy = true;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch("/api/game/market", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!data.ok) {
          toast(data.message || "操作失败");
          // 失败后刷新，避免可购数量/库存停留在过期数据
          void loadMarket();
          return;
        }
        if (data.mine) syncMine(data.mine);
        await loadMarket();
        toast(
          data.cost
            ? `${okText}（花费 ${data.cost} 魔力）`
            : data.gained
              ? `${okText}，+${data.gained} 魔力`
              : okText,
        );
      } catch (e) {
        console.warn("[market] action failed:", e);
        toast(
          e instanceof DOMException && e.name === "AbortError"
            ? "请求超时，请稍后重试"
            : "网络错误，请稍后重试",
        );
        // 恢复按钮状态并同步最新数据
        void loadMarket();
      } finally {
        clearTimeout(timer);
        marketBusy = false;
      }
    }

    /** 操作按钮进入等待态，避免重复点击 */
    function markBtnBusy(target: HTMLElement) {
      if (marketBusy) return;
      const btn = target.closest<HTMLButtonElement>(".mBtn");
      if (!btn) return;
      btn.classList.add("mBtnBusy");
      btn.disabled = true;
    }

    const onMarketClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      const buyType = target.getAttribute("data-buy-item");
      if (buyType === "tohru" || buyType === "rainbow") {
        const panel = target.closest<HTMLElement>(".mSell");
        const qtyInput = panel?.querySelector<HTMLInputElement>(".mQtyInput");
        const qty = parseInt(qtyInput?.value ?? "", 10);
        if (!Number.isFinite(qty) || qty < 1) {
          toast("请填写有效的购买数量");
          qtyInput?.focus();
          return;
        }
        markBtnBusy(target);
        void marketAction(
          { action: "buy", itemType: buyType, units: qty },
          "购买成功，奖品已放入背包",
        );
        return;
      }

      const sellType = target.getAttribute("data-sell-item");
      if (sellType === "tohru" || sellType === "rainbow") {
        const panel = target.closest<HTMLElement>(".mSell");
        const qtyInput = panel?.querySelector<HTMLInputElement>(".mQtyInput");
        const qty = parseInt(qtyInput?.value ?? "", 10);
        const maxQty = sellType === "rainbow" ? marketData.mine.rainbowDays : marketData.mine.tohru;
        const unit = sellType === "rainbow" ? "天" : "张";
        if (!Number.isFinite(qty) || qty < 1 || qty > maxQty) {
          toast(`出售数量需在 1 - ${maxQty} ${unit}之间`);
          qtyInput?.focus();
          return;
        }
        markBtnBusy(target);
        void marketAction({ action: "sell", itemType: sellType, units: qty }, "出售成功");
      }
    };
    marketBodyEl.addEventListener("click", onMarketClick);

    const onMarketInput = (e: Event) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement)) return;

      // 数量 × 单价 = 合计 / 实收
      const panel = input.closest<HTMLElement>(".mSell");
      if (!panel) return;
      const qty = parseInt(panel.querySelector<HTMLInputElement>(".mQtyInput")?.value ?? "", 10);
      const unit = parseFloat(panel.dataset.price ?? "");
      const total = Number.isFinite(qty) && Number.isFinite(unit) ? Math.max(0, qty * unit) : 0;
      const totalEl = panel.querySelector(".mSum b");
      if (totalEl) totalEl.textContent = String(total);
    };
    marketBodyEl.addEventListener("input", onMarketInput);

    const openMarket = () => {
      marketView.classList.add("active");
      marketView.setAttribute("aria-hidden", "false");
      renderMarket();
      void loadMarket();
    };
    const closeMarket = () => {
      marketView.classList.remove("active");
      marketView.setAttribute("aria-hidden", "true");
    };
    btnMarket.addEventListener("click", openMarket);
    btnMarketClose.addEventListener("click", closeMarket);

    const onMarketTab = (e: Event) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const tab = btn.dataset.tab || "browse";
      mTabBtns.forEach((b) => b.classList.toggle("active", b === btn));
      mPaneEls.forEach((pane) => pane.classList.toggle("active", pane.dataset.pane === tab));
    };
    mTabBtns.forEach((btn) => btn.addEventListener("click", onMarketTab));

    /* ============ 防止移动端双击缩放 ============ */
    let lastTouch = 0;
    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouch < 300) e.preventDefault();
      lastTouch = now;
    };
    document.addEventListener("touchend", onTouchEnd, { passive: false });

    /* ============ 清理 ============ */
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", resizeCanvas);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("touchend", onTouchEnd);
      modal.removeEventListener("click", onModalClick);
      wishBtns.forEach((btn) => btn.removeEventListener("click", onWishClick));
      marketBodyEl.removeEventListener("click", onMarketClick);
      marketBodyEl.removeEventListener("input", onMarketInput);
      btnMarket.removeEventListener("click", openMarket);
      btnMarketClose.removeEventListener("click", closeMarket);
      mTabBtns.forEach((btn) => btn.removeEventListener("click", onMarketTab));
      if (toastTimer) clearTimeout(toastTimer);
      if (saveTimer) clearTimeout(saveTimer);
      if (AC) {
        try {
          AC.close();
        } catch {}
      }
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center px-4 py-4 sm:px-6">
      <div
        ref={rootRef}
        className="games-page-root overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] [[data-background=tohru]_&]:bg-transparent"
        style={{ height: "min(calc(100vh - 7rem), 720px)" }}
      >
        {/* ============ 主界面 ============ */}
        <div id="wishView">
          <div id="starfield" />
          <div className="halo" />
          <div className="halo halo2" />

          <div className="topBar">
            <div className="pageTitle">祈 愿</div>
            <div className="wallet">
              <button
                className="currency magic marketEntry"
                id="btnMarket"
                type="button"
                aria-label="打开市场"
                title="市场"
              >
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
              </button>
            </div>
          </div>

          <div className="bannerInfo">
            <div className="bannerName">奔行世间</div>
            <div className="bannerTime">永久开放</div>
          </div>

          <div className="bottomBar">
            <div className="sideLinks">
              <button className="sideLink" id="btnDetail">
                详情
              </button>
              <button className="sideLink" id="btnHistory">
                历史
              </button>
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

        {/* ============ 结果页 ============ */}
        <div id="resultView">
          <div className="cards" id="cards" />
          <button id="closeBtn">点 击 继 续</button>
        </div>

        {/* ============ 市场（玩家间交易） ============ */}
        <div id="marketView" aria-hidden="true">
          <div className="marketShell">
            <div className="marketHead">
              <div className="marketHeadLeft">
                <div className="marketTitle">交 易</div>
                <div className="marketHint">价格随行情浮动</div>
              </div>
              <div className="marketHeadRight">
                <button
                  id="marketClose"
                  className="marketClose"
                  type="button"
                  aria-label="关闭市场"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="marketTabs" id="marketTabs">
              <button className="mTab active" data-tab="browse" type="button">
                市场
              </button>
              <button className="mTab" data-tab="inventory" type="button">
                我的背包
              </button>
            </div>
            <div className="marketBody" id="marketBody">
              <div className="mPane active" data-pane="browse">
                <div className="mGrid" id="mBrowse" />
              </div>
              <div className="mPane" data-pane="inventory">
                <div className="mGrid" id="mInventory" />
              </div>
            </div>
            <div className="mToast" id="mToast" />
          </div>
        </div>

        {/* ============ 弹窗 ============ */}
        <div id="modal">
          <div className="modalBox" id="modalBox" />
        </div>
      </div>
    </div>
  );
}
