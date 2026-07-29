function initialsFrom(name?: string | null, email?: string | null): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function UserAvatar({
  name,
  email,
  image,
  size = 32,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: number;
}) {
  const label = name || email || "Account";
  const initials = initialsFrom(name, email);

  return (
    <span
      className="user-avatar"
      title={email || label}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-label={label}
    >
      {image ? (
        <img src={image} alt="" className="user-avatar-img" />
      ) : (
        <span className="user-avatar-initials">{initials}</span>
      )}
    </span>
  );
}
