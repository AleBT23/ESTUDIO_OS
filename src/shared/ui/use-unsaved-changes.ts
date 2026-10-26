"use client";
import { useEffect } from "react";
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    const click = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest("a");
      if (
        link &&
        !link.hasAttribute("download") &&
        !window.confirm(
          "Tienes cambios sin guardar. ¿Quieres salir de esta página?",
        )
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
}
