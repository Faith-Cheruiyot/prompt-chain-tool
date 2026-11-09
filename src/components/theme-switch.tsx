"use client";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <div className="theme-switch" role="group" aria-label="Color theme">
      {[
        { value: "light", Icon: Sun },
        { value: "dark", Icon: Moon },
        { value: "system", Icon: Monitor },
      ].map(({ value, Icon }) => (
        <button
          type="button"
          key={value}
          onClick={() => setTheme(value)}
          aria-label={`${value[0].toUpperCase() + value.slice(1)} theme`}
          aria-pressed={mounted && theme === value}
          title={`${value[0].toUpperCase() + value.slice(1)} theme`}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
