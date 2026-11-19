import ProfileAvatar from "@/components/ui/ProfileAvatar";

/**
 * Avatar for a public customer review: the profile image when one is
 * available, otherwise a polished initials-based fallback. `name` is
 * the privacy-safe display name from the public review DTO.
 */
export default function ReviewAvatar({
  name,
  image,
}: {
  name: string;
  image: string | null;
}) {
  return (
    <ProfileAvatar
      image={image}
      name={name}
      className="h-11 w-11 text-[11px] ring-1 ring-inset ring-border-strong"
    />
  );
}
