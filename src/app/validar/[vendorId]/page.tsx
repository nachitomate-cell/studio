"use client";

import { useParams } from "next/navigation";
import ValidarPanel from "@/components/ValidarPanel";

export default function ValidarPage() {
  const { vendorId } = useParams<{ vendorId: string }>();

  if (!vendorId) return null;

  return <ValidarPanel vendorId={vendorId} />;
}
