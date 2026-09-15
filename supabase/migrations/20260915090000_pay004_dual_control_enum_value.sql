-- PAY-004: extend the existing dual-control approval mechanism
-- (20260914120200_dual_control_approvals.sql) to cover manual payment
-- confirmation. That migration retrofitted refund/suspend/category_pause
-- but deliberately left rpc_confirm_manual_payment for "its own careful
-- pass" (20260914120000's own comment). This is that pass.
--
-- New enum value must be committed in its own transaction before any
-- statement in a later migration can reference it (Postgres restriction
-- on ALTER TYPE ... ADD VALUE).
alter type approval_action_type add value 'confirm_manual_payment';
