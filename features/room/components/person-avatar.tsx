import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarHue, initials } from "@/features/room/shared/format";
import { cn } from "@/lib/utils";

export function PersonAvatar({
  id,
  name,
  size = "default",
  className,
  textClassName,
}: {
  id: string;
  name: string;
  size?: "sm" | "default" | "lg";
  className?: string;
  textClassName?: string;
}) {
  const hue = avatarHue(id);
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback
        title={name}
        className={cn("font-medium text-white", textClassName)}
        style={{ backgroundColor: `oklch(0.55 0.13 ${hue})` }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
