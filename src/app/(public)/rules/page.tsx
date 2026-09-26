import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "规则",
};

export default function RulesPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-xl border border-border/60 bg-card p-8 shadow-lg dark:border-border/40">
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            账号总则
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[15px] leading-7 text-muted-foreground">
            <li>任何主观上伤害网站的操作，均被禁止</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            上传总则
          </h2>
          <ol className="list-decimal space-y-2 pl-6 text-[15px] leading-7 text-muted-foreground">
            <li>上传者必须对上传的文件拥有合法的传播权</li>
            <li>转载他人作品须获得授权，并注明来源与作者</li>
            <li>因上传内容引发的纠纷与责任，由上传者自行承担</li>
            <li>禁止上传含病毒、木马或恶意脚本的文件</li>
          </ol>
        </section>
      </div>
    </main>
  );
}
