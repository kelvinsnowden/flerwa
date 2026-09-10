import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TaskForm } from "./task-form";

export default async function PostTaskPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/tasks/new");

  const [{ data: categories }, { data: locations }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("locations").select("id, ward, town").order("ward"),
  ]);

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-4">
      <h1 className="text-2xl font-bold">Post a task</h1>
      <p className="text-sm text-[var(--muted)] mt-1">
        Tell us what you need done and we&apos;ll help you find the right professional.
      </p>
      <div className="mt-6 card p-5">
        <TaskForm categories={categories ?? []} locations={locations ?? []} />
      </div>
      <p className="mt-4 text-xs text-[var(--muted)]">
        Your task is visible to professionals in the matching category so they can reach out with a
        quote. You&apos;re never charged until you accept one.
      </p>
    </div>
  );
}
