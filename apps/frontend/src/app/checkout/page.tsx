import { Suspense } from "react";
import { redirect } from "next/navigation";
import { buildBillingPath } from "@/features/billing/utils/plans";

async function CheckoutRedirect({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  redirect(buildBillingPath(params?.plan));
}

export default function CheckoutAliasPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <CheckoutRedirect searchParams={searchParams} />
    </Suspense>
  );
}
