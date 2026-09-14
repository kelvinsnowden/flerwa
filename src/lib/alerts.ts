/**
 * Minimal outbound alert channel for server-only admin/ops signals (e.g. a
 * ledger imbalance, a reconciliation job that failed to run). Deliberately
 * not a general notification system — NOTIF-001/002 in
 * MARKETPLACE_REMEDIATION_REGISTER.md track that separate, user-facing gap.
 * This exists only so a P0 financial check finding a real problem doesn't
 * sit silently in `console.error`/`scheduler_runs` with nobody looking.
 *
 * Uses Resend's HTTP API directly (no SDK dependency) so this stays inert
 * until configured: without RESEND_API_KEY/ALERT_EMAIL_TO/ALERT_EMAIL_FROM
 * set, sendOpsAlert() logs and returns false rather than throwing — it must
 * never be able to block or fail the check it's reporting on.
 */
export async function sendOpsAlert(params: { subject: string; body: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM;

  if (!apiKey || !to || !from) {
    console.warn(
      JSON.stringify({
        event: "ops_alert_not_sent",
        reason: "RESEND_API_KEY/ALERT_EMAIL_TO/ALERT_EMAIL_FROM not all configured",
        subject: params.subject,
      })
    );
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: params.subject,
        text: params.body,
      }),
    });

    if (!res.ok) {
      console.error(JSON.stringify({ event: "ops_alert_send_failed", status: res.status, subject: params.subject }));
      return false;
    }
    return true;
  } catch (err) {
    console.error(JSON.stringify({ event: "ops_alert_send_failed", error: err instanceof Error ? err.message : String(err), subject: params.subject }));
    return false;
  }
}
