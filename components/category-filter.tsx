"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/categories";

export function CategoryFilter() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [value, setValue] = useState(searchParams.get("category") || "");
    const [isPending, startTransition] = useTransition();

    const handleValueChange = (newValue: string) => {
        setValue(newValue);

        startTransition(() => {
            const params = new URLSearchParams(window.location.search);
            if (newValue && newValue !== "all") {
                params.set("category", newValue);
            } else {
                params.delete("category");
            }
            router.push(`${window.location.pathname}?${params.toString()}`);
        });
    };

    const clearFilter = () => {
        setValue("");
        startTransition(() => {
            const params = new URLSearchParams(window.location.search);
            params.delete("category");
            router.push(`${window.location.pathname}?${params.toString()}`);
        });
    };

    useEffect(() => {
        // Sync with URL changes
        const category = searchParams.get("category");
        if (category) {
            setValue(category);
        } else {
            setValue("");
        }
    }, [searchParams]);

    return (
        <div className="flex items-center gap-2">
            <Select
                value={value}
                onValueChange={handleValueChange}
            >
                <SelectTrigger className="w-[180px] h-10 bg-white">
                    <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                            {cat}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {value && value !== "all" && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearFilter}
                    className="h-9 w-9 text-gray-500 hover:text-gray-900"
                    title="Clear filter"
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}
