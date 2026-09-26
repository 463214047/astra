// src/app/search/page.tsx
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  // TODO: 用 q 查询数据
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-lg font-semibold">搜索结果：{q ?? "（空）"}</h1>
    </div>
  );
}