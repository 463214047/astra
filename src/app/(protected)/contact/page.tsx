import ContactForm from "./ContactForm";

export const metadata = { title: "联系管理" };

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">联系管理</h1>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 [[data-background=tohru]_&]:bg-transparent">
        <ContactForm />
      </div>
    </div>
  );
}
