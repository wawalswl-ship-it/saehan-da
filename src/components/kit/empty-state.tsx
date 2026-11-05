import { Inbox } from "lucide-react";

export function EmptyState({ text }: { text?: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg bg-muted/50 px-4 py-8 text-center">
      <Inbox className="size-6 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">
        {text ?? "선택한 조건에 해당하는 데이터가 없습니다. 필터를 조정해 보세요."}
      </p>
    </div>
  );
}
