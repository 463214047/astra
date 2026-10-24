import ContactForm from "./ContactForm";

export const metadata = { title: "联系管理" };

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">联系管理</h1>
      <p className="mt-1 text-sm text-slate-500">
        反馈问题、建议功能或合作咨询均可。举报违规请使用内容旁的举报按钮，我们会在收到后尽快处理。
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <ContactForm />
      </div>
    </div>
  );
}
