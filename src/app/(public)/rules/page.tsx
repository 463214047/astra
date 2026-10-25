import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "规则",
};

export default function RulesPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">规则</h1>
        <p className="mt-2 text-sm text-slate-500">
          请仔细阅读以下规则。违反者将视情节轻重受到警告、限制或封禁处理。
        </p>
      </header>

      <div className="space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {/* ============ 账号总则 ============ */}
        <section>
          <SectionTitle num="01">总则</SectionTitle>
          <List>
            <li>
              为了网站能够稳定运行，请避免在能够被搜索引擎检索到以及与PT无关的公共场合提及本站。
            </li>
          </List>
        </section>

        <Divider />

        {/* ============ 内容规范 ============ */}
        <section>
          <SectionTitle num="02">发布规范</SectionTitle>
          <List>
            <li>转种请勿重新制种，种子内文件不要包含与资源无关的内容或广告信息。</li>
          </List>
        </section>
      </div>
    </main>
  );
}

// ============ 小组件 ============
function SectionTitle({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-semibold text-slate-900">
      <span className="grid size-7 place-items-center rounded-md bg-slate-900 text-[12px] font-bold text-white">
        {num}
      </span>
      {children}
    </h2>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7 text-slate-700">
      {children}
    </ul>
  );
}

function Divider() {
  return <div className="h-px bg-slate-100" />;
}
