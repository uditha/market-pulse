"use client";

export function CopyValue({ text }: { text: string }) {
  return (
    <button
      className="btn btn-primary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
      }}
    >
      Copy figure
    </button>
  );
}
