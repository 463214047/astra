"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 彩虹动态昵称。
 * 用 Web Animations API 平移渐变背景，不新增任何全局样式。
 *
 * 渐变按一个完整色环写成一个周期（0% ~ 50%），再重复铺满 200% 的背景；
 * 动画只移动一个周期，因此 0% 和 100% 的画面完全一致，循环处没有跳变。
 */
function RainbowName({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const anim = el.animate(
      [{ backgroundPosition: "0% 50%" }, { backgroundPosition: "100% 50%" }],
      { duration: 8000, iterations: Infinity, easing: "linear" },
    );

    return () => anim.cancel();
  }, []);

  return (
    <span
      ref={ref}
      className={`bg-[repeating-linear-gradient(90deg,hsl(340_85%_70%)_0%,hsl(10_85%_68%)_4.1667%,hsl(40_85%_65%)_8.3333%,hsl(70_80%_62%)_12.5%,hsl(100_70%_60%)_16.6667%,hsl(130_70%_58%)_20.8333%,hsl(160_75%_60%)_25%,hsl(190_80%_65%)_29.1667%,hsl(220_85%_70%)_33.3333%,hsl(250_85%_72%)_37.5%,hsl(280_85%_72%)_41.6667%,hsl(310_85%_72%)_45.8333%,hsl(340_85%_70%)_50%)] bg-[length:200%_100%] bg-no-repeat bg-clip-text text-transparent [will-change:background-position] ${className}`}
    >
      {children}
    </span>
  );
}

/** 昵称渲染：rainbow 为 true 时套用彩虹渐变，否则原样输出 */
export function UserName({
  name,
  rainbow,
  className = "",
}: {
  name: string;
  rainbow: boolean;
  className?: string;
}) {
  if (!rainbow) return <>{name}</>;
  return <RainbowName className={className}>{name}</RainbowName>;
}
