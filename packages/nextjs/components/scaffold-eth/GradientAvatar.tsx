"use client";

import { AvatarComponent } from "@rainbow-me/rainbowkit";

export const GradientAvatar: AvatarComponent = ({ address, ensImage, size }) => {
  if (ensImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={ensImage} width={size} height={size} style={{ borderRadius: 999 }} alt="Avatar" />;
  }

  // Genera colores únicos basados en el address
  const hash = address ? parseInt(address.slice(2, 14), 16) : 0;
  const hue1 = hash % 360;
  const hue2 = (hash + 60) % 360;

  const gradient = `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 60%))`;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: size * 0.6,
          height: size * 0.6,
          borderRadius: 999,
          backgroundColor: "rgba(255, 255, 255, 0.3)",
          backdropFilter: "blur(10px)",
        }}
      />
    </div>
  );
};
