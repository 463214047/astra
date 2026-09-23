import type { Metadata } from 'next';
import Image from 'next/image';
import { signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const metadata: Metadata = {
  title: '登录',
};

const GithubIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
      clipRule="evenodd"
    />
  </svg>
);

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-500/20" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-500/20" />

      <Card className="relative w-full max-w-md border-border/60 shadow-2xl dark:border-border/40">
        <CardHeader className="pb-2 pt-8">
          <div className="mx-auto mb-5 h-28 w-28">
            <div className="relative h-full w-full rounded-full p-1 bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-400 shadow-lg shadow-indigo-500/20">
              <Image
                src="/icon.png"
                alt="Ayaka"
                width={112}
                height={112}
                priority
                className="h-full w-full rounded-full border-[3px] border-white object-cover dark:border-slate-900"
              />
            </div>
          </div>

          <div className="text-center space-y-1.5">
            <h1 className="text-3xl font-bold tracking-tight">欢迎来到 Astra</h1>
            <p className="text-sm text-muted-foreground">
              使用 GitHub 账号或邮箱密码登录
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 px-8 pb-8 pt-6">
          {/* 邮箱密码登录 */}
          <form
            className="space-y-4"
            action={async (formData) => {
              'use server';
              const email = formData.get('email') as string;
              const password = formData.get('password') as string;
              await signIn('credentials', { email, password, redirectTo: '/' });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                邮箱地址
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                className="h-11 rounded-xl border-border/70 bg-background/60 px-4 text-sm shadow-sm transition focus-visible:ring-2 focus-visible:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                密码
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="h-11 rounded-xl border-border/70 bg-background/60 px-4 text-sm shadow-sm transition focus-visible:ring-2 focus-visible:ring-indigo-500/20"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-1 h-11 w-full rounded-xl bg-indigo-600 text-sm font-medium shadow-md shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/30"
            >
              登录
            </Button>
          </form>

          {/* 分割线 */}
          <div className="relative flex items-center py-1">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <span className="mx-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              或
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          {/* GitHub 登录 */}
          <form
            action={async () => {
              'use server';
              await signIn('github', { redirectTo: '/' });
            }}
          >
            <Button
              variant="outline"
              type="submit"
              size="lg"
              className="h-11 w-full gap-2 rounded-xl border-border/70 bg-background text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:bg-accent/40"
            >
              <GithubIcon />
              使用 GitHub 登录
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
