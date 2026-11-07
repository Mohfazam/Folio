
"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";

interface AuthRedirectButtonProps {
    children: ReactNode;
    className?: string;
}

export function AuthRedirectButton({
    children,
    className,
}: AuthRedirectButtonProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        if (loading) return;

        setLoading(true);

        try {
            const user = await getCurrentUser();
            router.push(user ? "/dashboard" : "/sign-up");
        } catch (error) {
            console.error("Unexpected authentication error:", error);
            router.push("/sign-up");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className={className}
        >
            {loading ? "Please wait..." : children}
        </button>
    );
}
