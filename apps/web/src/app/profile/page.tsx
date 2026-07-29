"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/UserAvatar";
import { authClient } from "@/lib/auth-client";
import { getStaffRole } from "@/lib/roles";

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, isPending, refetch } = authClient.useSession();
  const user = session?.user;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      router.replace("/login?next=/profile");
      return;
    }
    setName(user.name ?? "");
    setPhone((user as { phone?: string | null }).phone ?? "");
    setImage(user.image ?? "");
  }, [isPending, user, router]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileBusy(true);
    setProfileMsg(null);
    setProfileError(null);
    try {
      const trimmedPhone = phone.trim();
      if (!trimmedPhone) throw new Error("Phone number is required");
      const res = await authClient.updateUser({
        name: name.trim() || "Analyst",
        phone: trimmedPhone,
        image: image.trim() || null,
      });
      if (res.error) throw new Error(res.error.message);
      await refetch();
      router.refresh();
      setProfileMsg("Profile updated.");
    } catch (err) {
      setProfileError((err as Error).message);
    } finally {
      setProfileBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordBusy(true);
    setPasswordMsg(null);
    setPasswordError(null);
    try {
      if (newPassword.length < 8) throw new Error("New password must be at least 8 characters");
      if (newPassword !== confirmPassword) throw new Error("New passwords do not match");
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (res.error) throw new Error(res.error.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg("Password updated.");
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setPasswordBusy(false);
    }
  }

  if (isPending || !user) {
    return (
      <div className="auth-page">
        <main className="panel auth-card">Loading…</main>
      </div>
    );
  }

  const role = getStaffRole(session);
  const subscription =
    String((user as { subscriptionStatus?: string | null }).subscriptionStatus ?? "free");

  return (
    <main className="profile-page">
      <div className="hero-eyebrow">Account</div>
      <h1 className="section-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
        Profile
      </h1>
      <p className="section-sub" style={{ marginBottom: 22, maxWidth: "36rem" }}>
        Update your details. Email stays on this account; contact support if you need to change it.
      </p>

      <div className="profile-grid">
        <section className="panel profile-card">
          <div className="profile-card-head">
            <UserAvatar name={name || user.name} email={user.email} image={image || user.image} size={48} />
            <div>
              <strong>{name || user.name}</strong>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{user.email}</div>
            </div>
          </div>
          <div className="profile-meta">
            <span>
              Role <em>{role}</em>
            </span>
            <span>
              Plan <em>{subscription}</em>
            </span>
          </div>

          <form className="auth-form" onSubmit={saveProfile}>
            <label className="profile-field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="profile-field">
              Phone
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
              />
            </label>
            <label className="profile-field">
              Avatar image URL
              <input
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://…"
              />
            </label>
            <label className="profile-field">
              Email
              <input type="email" value={user.email} disabled />
            </label>
            {profileError ? <div style={{ color: "var(--down)" }}>{profileError}</div> : null}
            {profileMsg ? <div style={{ color: "var(--up)" }}>{profileMsg}</div> : null}
            <button className="btn btn-primary" disabled={profileBusy}>
              {profileBusy ? "…" : "Save profile"}
            </button>
          </form>
        </section>

        <section className="panel profile-card">
          <h2 className="section-title" style={{ fontSize: "1.15rem" }}>
            Change password
          </h2>
          <p className="section-sub" style={{ marginBottom: 14 }}>
            Other sessions will be signed out after a successful change.
          </p>
          <form className="auth-form" onSubmit={savePassword}>
            <label className="profile-field">
              Current password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label className="profile-field">
              New password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label className="profile-field">
              Confirm new password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            {passwordError ? <div style={{ color: "var(--down)" }}>{passwordError}</div> : null}
            {passwordMsg ? <div style={{ color: "var(--up)" }}>{passwordMsg}</div> : null}
            <button className="btn btn-primary" disabled={passwordBusy}>
              {passwordBusy ? "…" : "Update password"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
