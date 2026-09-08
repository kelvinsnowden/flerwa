/**
 * Shown in place of a page's normal content when a Supabase query genuinely
 * failed — never silently rendered as an empty/zero-result state, which
 * would tell the user "there's nothing here" when the real answer is
 * "we don't know, the server failed." See QA_REPORT.md, High Issues,
 * "silent error swallowing."
 */
export function ErrorNotice({
  message = "We couldn't load this page right now. Please refresh, or try again in a moment.",
}: {
  message?: string;
}) {
  return (
    <div className="notice-error" role="alert">
      {message}
    </div>
  );
}
