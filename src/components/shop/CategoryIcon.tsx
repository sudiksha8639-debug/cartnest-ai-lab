import { Briefcase, Headphones, Lamp, Shirt, Sparkles, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Electronics: Headphones,
  Fashion: Shirt,
  "Home & Living": Lamp,
  Beauty: Sparkles,
  Accessories: Briefcase,
};

export function CategoryIcon({
  category,
  className = "size-4",
}: {
  category: string;
  className?: string;
}) {
  const Icon = ICONS[category] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" />;
}
