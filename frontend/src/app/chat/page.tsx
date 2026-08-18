"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AskStudio from "@/components/qiewen/AskStudio";

function ChatInner() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  return <AskStudio initialQuestion={q} />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="px-5 py-10 font-serif text-muted">展开对读…</div>}>
      <ChatInner />
    </Suspense>
  );
}
