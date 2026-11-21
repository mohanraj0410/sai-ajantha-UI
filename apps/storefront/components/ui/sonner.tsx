"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      richColors
      toastOptions={{
        style: {
          borderColor: "#C6CAD5",
          background: "#153C66",
          color: "#FFFFFF",
          fontFamily: "var(--font-poppins), Arial, sans-serif",
          fontSize: "12px",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };

