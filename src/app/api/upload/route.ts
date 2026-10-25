/**
 * 文件上传 API — 图片（封面 / 截图 / 头像）
 *
 * POST /api/upload?kind=cover|screenshot|media|avatar
 * FormData: file
 * 返回: { ok: true, url: "/uploads/covers/xxx.jpg" }
 *
 * 文件直接写到 public/uploads/{kind}/ 下，返回可公开访问的 URL。
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
    }

    const url = new URL(req.url);
    const requestedKind = url.searchParams.get("kind") ?? "cover";
    const kind =
      requestedKind === "screenshot" || requestedKind === "media" || requestedKind === "avatar"
        ? requestedKind
        : "cover";
    const subDir =
      kind === "screenshot"
        ? "screenshots"
        : kind === "media"
          ? "media"
          : kind === "avatar"
            ? "avatars"
            : "covers";

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, message: "未收到文件" }, { status: 400 });
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { ok: false, message: "仅支持 JPG / PNG / WebP 格式" },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, message: "文件超过 5 MB 限制" }, { status: 413 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = extFromMime(file.type);
    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

    // 写 public/uploads/{kind}/ 目录
    const uploadDir = path.join(process.cwd(), "public", "uploads", subDir);
    await mkdir(uploadDir, { recursive: true });
    const dest = path.join(uploadDir, filename);
    await writeFile(dest, bytes);

    const publicUrl = `/uploads/${subDir}/${filename}`;

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      filename,
      size: file.size,
      mime: file.type,
    });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json({ ok: false, message: "上传失败" }, { status: 500 });
  }
}
