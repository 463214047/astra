// src/components/editor.tsx
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { useCallback, useEffect, useState } from "react";
import { renderBBCode } from "@/lib/bbcode";
import { useLocale } from "@/components/language-provider";
import ImagePickerDialog from "@/components/image-picker-dialog";
import LinkPickerDialog from "@/components/link-picker-dialog";
import { translateText } from "@/lib/i18n";

/** 正文编辑区样式（默认尺寸，发布页 / 论坛用） */
const CONTENT_CLASS =
  "prose prose-slate max-w-none min-h-[400px] px-5 py-4 outline-none " +
  "prose-headings:font-bold prose-headings:tracking-tight " +
  "prose-blockquote:border-l-4 prose-blockquote:border-brand-300 " +
  "prose-blockquote:bg-brand-50/50 prose-blockquote:py-1 prose-blockquote:not-italic " +
  "prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 " +
  "prose-code:before:content-none prose-code:after:content-none " +
  "prose-img:rounded-xl prose-img:border prose-img:border-slate-200";

/** 正文编辑区样式（紧凑，评论等小场景） */
const CONTENT_CLASS_COMPACT =
  "prose prose-slate max-w-none min-h-[140px] px-4 py-3 text-sm outline-none " +
  "prose-headings:font-bold prose-headings:tracking-tight " +
  "prose-blockquote:border-l-4 prose-blockquote:border-brand-300 " +
  "prose-blockquote:bg-brand-50/50 prose-blockquote:py-1 prose-blockquote:not-italic " +
  "prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 " +
  "prose-code:before:content-none prose-code:after:content-none " +
  "prose-img:rounded-xl prose-img:border prose-img:border-slate-200";

export default function Editor({
  content,
  onChange,
  placeholder = "写点什么…",
  compact = false,
  collapsibleToolbar = false,
}: {
  content: string;
  onChange: (html: string) => void;
  /** 占位文案 */
  placeholder?: string;
  /** 紧凑模式：更矮的编辑区与更小的内边距 */
  compact?: boolean;
  /** 工具栏默认隐藏，点击「格式」按钮展开 */
  collapsibleToolbar?: boolean;
}) {
  // 用于强制 React 重渲染 — tiptap 的 isActive 只在组件重渲染时才重新计算
  const [, forceRender] = useState(0);
  const { locale } = useLocale();
  const localizedPlaceholder = translateText(placeholder, locale) ?? placeholder;

  // 可折叠工具栏：由「格式」按钮控制展开 / 收起
  const [toolbarOpen, setToolbarOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-brand-700 underline underline-offset-2",
        },
      }),
      Placeholder.configure({
        placeholder: localizedPlaceholder,
      }),
      // BBCode 粘贴会带来颜色 / 字号，需要对应的 mark 才能识别
      TextStyle,
      Color,
      FontSize,
      // [spoiler] 折叠块
      Details.configure({
        HTMLAttributes: { class: "my-2 rounded-xl border border-slate-200 px-3 py-2" },
      }),
      DetailsSummary.configure({
        HTMLAttributes: {
          class: "cursor-pointer select-none text-sm font-semibold text-slate-700",
        },
      }),
      DetailsContent.configure({
        HTMLAttributes: { class: "mt-2" },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: compact ? CONTENT_CLASS_COMPACT : CONTENT_CLASS,
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (!text) return false;

        if (!/\[(b|i|u|s|color|size|url|quote|spoiler|code|img|\/[a-z]+)(?:=|\])/i.test(text)) {
          return false;
        }

        event.preventDefault();
        const html = renderBBCode(text);
        editor!.chain().focus().insertContent(html).run();
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    // 关键：光标移动 / mark 切换 / 节点切换时强制 React 重渲染
    // 否则 isActive() 只在 onUpdate（文档变）时才重新计算，工具栏按钮 active 态不更新
    onSelectionUpdate: () => forceRender((n) => n + 1),
    onTransaction: () => forceRender((n) => n + 1),
  });

  useEffect(() => {
    if (!editor) return;
    const placeholderExtension = editor.extensionManager.extensions.find(
      (extension) => extension.name === "placeholder",
    );
    if (!placeholderExtension) return;

    (placeholderExtension.options as { placeholder?: string }).placeholder = localizedPlaceholder;
    editor.view.dispatch(editor.state.tr);
  }, [editor, localizedPlaceholder]);

  // ---------- 链接 / 图片插入弹窗 ----------
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const toggleImage = useCallback(() => {
    setLinkDialogOpen(false);
    setImageDialogOpen((open) => !open);
  }, []);

  const toggleLink = useCallback(() => {
    setImageDialogOpen(false);
    setLinkDialogOpen((open) => !open);
  }, []);

  if (!editor) return null;

  // 工具栏何时可见：非折叠模式一直显示；折叠模式由按钮控制
  const showToolbar = !collapsibleToolbar || toolbarOpen;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white [[data-background=tohru]_&]:bg-transparent">
        {collapsibleToolbar && !showToolbar && (
          <div className="flex justify-end px-2 py-1">
            <button
              type="button"
              onClick={() => setToolbarOpen(true)}
              aria-expanded={false}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <span aria-hidden="true" className="font-serif text-sm leading-none">
                Aa
              </span>
              格式
            </button>
          </div>
        )}

        {showToolbar && (
          <div className="relative">
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/70 px-2 py-2">
              <ToolbarButton
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
                label="加粗"
              >
                <strong>B</strong>
              </ToolbarButton>

              <ToolbarButton
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                label="斜体"
              >
                <em>I</em>
              </ToolbarButton>

              <ToolbarButton
                active={editor.isActive("strike")}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                label="删除线"
              >
                <span className="line-through">S</span>
              </ToolbarButton>

              <Divider />

              <ToolbarButton
                active={editor.isActive("heading", { level: 1 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                label="标题 1"
              >
                H1
              </ToolbarButton>

              <ToolbarButton
                active={editor.isActive("heading", { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                label="标题 2"
              >
                H2
              </ToolbarButton>

              <ToolbarButton
                active={editor.isActive("heading", { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                label="标题 3"
              >
                H3
              </ToolbarButton>

              <Divider />

              <ToolbarButton
                active={editor.isActive("bulletList")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                label="无序列表"
              >
                <IconList />
              </ToolbarButton>

              <ToolbarButton
                active={editor.isActive("orderedList")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                label="有序列表"
              >
                <IconOrderedList />
              </ToolbarButton>

              <ToolbarButton
                active={editor.isActive("blockquote")}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                label="引用"
              >
                <IconQuote />
              </ToolbarButton>

              <Divider />

              <ToolbarButton
                onClick={toggleLink}
                active={linkDialogOpen || editor.isActive("link")}
                label="链接"
              >
                <IconLink />
              </ToolbarButton>

              <ToolbarButton onClick={toggleImage} active={imageDialogOpen} label="插入图片">
                <IconImage />
              </ToolbarButton>

              <div className="ml-auto flex items-center gap-1">
                <ToolbarButton
                  onClick={() => editor.chain().focus().undo().run()}
                  active={false}
                  label="撤销"
                  disabled={!editor.can().undo()}
                >
                  <IconUndo />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor.chain().focus().redo().run()}
                  active={false}
                  label="重做"
                  disabled={!editor.can().redo()}
                >
                  <IconRedo />
                </ToolbarButton>

                {collapsibleToolbar && (
                  <button
                    type="button"
                    onClick={() => setToolbarOpen(false)}
                    aria-expanded={true}
                    aria-label="收起格式工具栏"
                    title="收起格式工具栏"
                    className="ml-1 grid size-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900"
                  >
                    <IconChevronUp />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <EditorContent editor={editor} />
      </div>
      {imageDialogOpen && (
        <ImagePickerDialog
          title="插入图片"
          kind="screenshot"
          onClose={() => setImageDialogOpen(false)}
          onConfirm={(urls) => {
            const insertAt = editor.state.selection.to;
            editor
              .chain()
              .focus()
              .insertContentAt(
                insertAt,
                urls.map((url) => ({
                  type: "image",
                  attrs: { src: url },
                })),
              )
              .run();
          }}
        />
      )}
      {linkDialogOpen && (
        <LinkPickerDialog
          onClose={() => setLinkDialogOpen(false)}
          onConfirm={({ title, href }) => {
            const insertAt = editor.state.selection.to;
            editor
              .chain()
              .focus()
              .insertContentAt(insertAt, {
                type: "text",
                text: title,
                marks: [{ type: "link", attrs: { href } }],
              })
              .run();
          }}
        />
      )}
    </>
  );
}

/* ---------- 工具栏按钮 ---------- */
function ToolbarButton({
  children,
  active,
  disabled,
  onClick,
  label,
}: {
  children: React.ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-8 min-w-8 place-items-center rounded-md px-1.5 text-sm transition ${
        disabled
          ? "cursor-not-allowed text-slate-300"
          : active
            ? "bg-brand-600 text-white"
            : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" />;
}

/* ---------- 图标 ---------- */
function IconChevronUp() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path
        d="M5 12.5 10 7.5l5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconList() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path
        d="M7 5h9M7 10h9M7 15h9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="4" cy="5" r="1" fill="currentColor" />
      <circle cx="4" cy="10" r="1" fill="currentColor" />
      <circle cx="4" cy="15" r="1" fill="currentColor" />
    </svg>
  );
}

function IconOrderedList() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path
        d="M8 5h8M8 10h8M8 15h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <text x="3" y="7" fontSize="6" fill="currentColor">
        1
      </text>
      <text x="3" y="12" fontSize="6" fill="currentColor">
        2
      </text>
      <text x="3" y="17" fontSize="6" fill="currentColor">
        3
      </text>
    </svg>
  );
}

function IconQuote() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path d="M6 8v7M3 8h6M3 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M13 6h4M13 10h4M13 14h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLink() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path
        d="M9 11a3 3 0 0 0 4 0l3-3a3 3 0 0 0-4-4l-1 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M11 9a3 3 0 0 0-4 0l-3 3a3 3 0 0 0 4 4l1-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconImage() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7.5" cy="8.5" r="1" fill="currentColor" />
      <path
        d="M4 14l3.5-3.5a1.5 1.5 0 0 1 2 0L13 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUndo() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path
        d="M7 6L3 10l4 4M3 10h9a4 4 0 0 1 0 8H9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRedo() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path
        d="M13 6l4 4-4 4M17 10H8a4 4 0 0 0 0 8h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
