"use client";

import { User } from "firebase/auth";
import { RewardsView } from "@/components/RewardsView";

interface RewardsTabProps {
  user: User | null;
  userData: any;
  onShowAuth: () => void;
}

export function RewardsTab({ user, userData, onShowAuth }: RewardsTabProps) {
  return <RewardsView user={user} userData={userData} onShowAuth={onShowAuth} />;
}
