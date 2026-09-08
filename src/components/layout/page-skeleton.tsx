export function PageSkeleton() {
  return (
    <div className="w-full space-y-4 animate-pulse pt-2">
      {/* Hero card skeleton */}
      <div className="h-28 w-full bg-stone-200 dark:bg-stone-800 rounded-2xl" />

      {/* Action pill row */}
      <div className="flex gap-2">
        <div className="h-9 w-24 bg-stone-200 dark:bg-stone-800 rounded-full" />
        <div className="h-9 w-24 bg-stone-200 dark:bg-stone-800 rounded-full" />
        <div className="h-9 w-24 bg-stone-200 dark:bg-stone-800 rounded-full" />
      </div>

      {/* List items skeleton */}
      <div className="space-y-3 pt-2">
        <div className="h-16 w-full bg-stone-200 dark:bg-stone-800 rounded-xl" />
        <div className="h-16 w-full bg-stone-200 dark:bg-stone-800 rounded-xl" />
        <div className="h-16 w-full bg-stone-200 dark:bg-stone-800 rounded-xl" />
        <div className="h-16 w-full bg-stone-200 dark:bg-stone-800 rounded-xl" />
      </div>
    </div>
  );
}
