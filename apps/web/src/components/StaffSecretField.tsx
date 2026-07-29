"use client";

import { useEffect, useState } from "react";
import {
  defaultStaffSecret,
  readStaffSecret,
  writeStaffSecret,
} from "@/lib/staff-secret";

export function useStaffSecret() {
  const [secret, setSecretState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStaffSecret();
    setSecretState(stored || defaultStaffSecret());
    setReady(true);
  }, []);

  function setSecret(next: string) {
    setSecretState(next);
    writeStaffSecret(next);
  }

  return { secret, setSecret, ready };
}

export function StaffSecretField({
  secret,
  onChange,
  label = "Admin secret",
}: {
  secret: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: "0.85rem", color: "var(--muted)" }}>
      {label}
      <input
        type="password"
        autoComplete="off"
        value={secret}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ADMIN_SECRET"
        style={{
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: "10px 12px",
          minWidth: 200,
          background: "var(--panel-solid)",
          color: "var(--ink)",
        }}
      />
    </label>
  );
}
