import { useEffect, useState } from "react";
import { useSession } from "@/auth/session";

/** True when the dark theme is active (explicit choice, or "system" with a dark OS setting). */
export function useIsDark(): boolean {
  const theme = useSession((s) => s.user?.theme ?? "light");
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return theme === "dark" || (theme === "system" && systemDark);
}
