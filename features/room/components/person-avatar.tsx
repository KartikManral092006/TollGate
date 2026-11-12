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
        // Dark enough for white initials to pass WCAG AA at every hue.
        style={{ backgroundColor: `oklch(0.5 0.12 ${hue})` }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
