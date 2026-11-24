import { redirect } from "next/navigation";
import { buildBillingPath } from "@/features/billing/utils/plans";

export default async function CheckoutAliasPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  redirect(buildBillingPath(params?.plan));
}
