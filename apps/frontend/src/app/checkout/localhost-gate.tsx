import type { ReactNode } from "react";
import { headers } from "next/headers";
import { isLocalhostRequest } from "@/features/billing/utils/localhost-guard";

export async function getCheckoutLocalhostAvailability(): Promise<boolean> {
  const reqHeaders = await headers();
  return isLocalhostRequest(reqHeaders);
}

export async function CheckoutLocalhostScope({
  children,
}: {
  children: (isLocalDevTestAvailable: boolean) => ReactNode;
}) {
  const available = await getCheckoutLocalhostAvailability();
  return <>{children(available)}</>;
}
