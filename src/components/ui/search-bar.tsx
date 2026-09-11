import { Icon } from "./icon";

/**
 * A plain GET form — no client JS required. Submits to "/" with a real
 * `q` param that the home page uses to filter services server-side
 * (see src/app/page.tsx), rather than a decorative input that goes nowhere.
 */
export function SearchBar({
  defaultValue,
  action = "/",
  placeholder = "What do you need done?",
}: {
  defaultValue?: string;
  action?: string;
  placeholder?: string;
}) {
  return (
    <form action={action} className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none">
        <Icon name="search" size={18} />
      </span>
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="pl-10"
        aria-label="Search services"
      />
    </form>
  );
}
