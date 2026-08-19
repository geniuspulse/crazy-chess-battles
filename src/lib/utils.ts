import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRating(rating: number): string {
  return rating >= 2200 ? `${rating} ★` : `${rating}`;
}

export function getRatingTier(rating: number): { label: string; color: string } {
  if (rating >= 2400) return { label: "Grandmaster", color: "text-purple-400" };
  if (rating >= 2200) return { label: "Master", color: "text-fuchsia-400" };
  if (rating >= 1900) return { label: "Diamond", color: "text-cyan-400" };
  if (rating >= 1600) return { label: "Platinum", color: "text-emerald-400" };
  if (rating >= 1300) return { label: "Gold", color: "text-ccb-accent" };
  if (rating >= 1000) return { label: "Silver", color: "text-ccb-silver" };
  if (rating >= 700) return { label: "Bronze", color: "text-ccb-bronze" };
  return { label: "Rookie", color: "text-ccb-muted" };
}
