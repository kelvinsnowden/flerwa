import { Icon } from "@/components/ui/icon";

export default function AdminMessagesEmptyPage() {
  return (
    <div className="flex-1 flex items-center justify-center text-center p-8">
      <div>
        <Icon name="message-circle" size={28} className="text-[var(--muted-2)] mx-auto mb-2" />
        <p className="text-sm text-[var(--muted)]">Select a conversation to view it.</p>
      </div>
    </div>
  );
}
