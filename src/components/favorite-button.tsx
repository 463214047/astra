"use client";

import { useState, useEffect, useCallback } from "react";

type Props = {
  postId: string;
};

const STORAGE_KEY = "astra_favorites";

function getFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveFavorites(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export default function FavoriteButton({ postId }: Props) {
  const [favorited, setFavorited] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setFavorited(getFavorites().includes(postId));
  }, [postId]);

  const toggle = useCallback(() => {
    const favs = getFavorites();
    const idx = favs.indexOf(postId);
    let next: string[];
    if (idx >= 0) {
      next = favs.filter((id) => id !== postId);
    } else {
      next = [...favs, postId];
    }
    saveFavorites(next);
    setFavorited(idx < 0);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
  }, [postId]);

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
        favorited
          ? "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400 hover:text-amber-800"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900"
      }`}
      title={favorited ? "取消收藏" : "收藏"}
    >
      <svg
        viewBox="0 0 20 20"
        className={`size-3.5 transition-transform ${animating ? "scale-125" : "scale-100"}`}
        fill={favorited ? "currentColor" : "none"}
      >
        <path
          d="M10.5 2.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10.5 15l-4.8 2.4.9-5.4L2.7 8.2l5.4-.8L10.5 2.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {favorited ? "已收藏" : "收藏"}
    </button>
  );
}
