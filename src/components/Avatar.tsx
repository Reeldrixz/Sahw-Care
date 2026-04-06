"use client";

import Image from "next/image";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
}

const COLORS = [
  ["#e8f5f1", "#2d6a4f"],
  ["#fff3e0", "#b8540b"],
  ["#f3e5f5", "#7b2d8b"],
  ["#e3f2fd", "#1565c0"],
  ["#fce4ec", "#c62828"],
  ["#e8f5e9", "#2e7d32"],
  ["#fff8e1", "#f57f17"],
  ["#ede7f6", "#4527a0"],
];

function avatarColors(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({ src, name, size = 32 }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const fontSize = Math.round(size * 0.38);
  const [bg, fg] = avatarColors(name);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        color: fg,
        fontSize,
        fontWeight: 800,
        fontFamily: "Nunito, sans-serif",
        userSelect: "none",
      }}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          width={size}
          height={size}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
        />
      ) : (
        initials
      )}
    </div>
  );
}
