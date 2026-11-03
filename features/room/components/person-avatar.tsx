import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarHue, initials } from "@/features/room/shared/format";

export function PersonAvatar({
  id,
  name,
  size = "default",
  className,
}: {
  id: string;
  name: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const hue = avatarHue(id);
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback
        title={name}
        className="font-medium text-white"
        style={{ backgroundColor: `oklch(0.55 0.13 ${hue})` }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
