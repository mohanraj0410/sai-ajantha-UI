import type { ReactNode } from "react";
import "./storefront.css";

export function StorefrontSurface({ children, family = "content" }: { children: ReactNode; family?: string }) {
  return <div className="sa-interior" data-family={family}>{children}</div>;
}
