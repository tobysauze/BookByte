
export default function Loading() {
    return (
        <div className="space-y-8 animate-pulse">
            <header className="space-y-4">
                <div className="space-y-3">
                    <div className="h-4 w-32 bg-[rgb(var(--muted))] rounded" />
                    <div className="h-8 w-48 bg-[rgb(var(--muted))] rounded" />
                    <div className="h-4 w-full max-w-lg bg-[rgb(var(--muted))] rounded" />
                </div>
                <div className="pt-2 flex flex-col sm:flex-row gap-4">
                    <div className="h-10 w-full sm:w-64 bg-[rgb(var(--muted))] rounded" />
                    <div className="h-10 w-32 bg-[rgb(var(--muted))] rounded" />
                </div>
            </header>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-xl bg-[rgb(var(--muted))]" />
                ))}
            </div>
        </div>
    );
}
