import { memo } from "react";

export const FlowStatus = memo(function FlowStatus({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="flex items-center gap-2 rounded-md border bg-blue-50 dark:bg-blue-950/40 border-blue-200 px-3 py-2 text-sm text-blue-800 dark:text-blue-200 shadow-sm">
        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        {message}
      </div>
    </div>
  );
});
