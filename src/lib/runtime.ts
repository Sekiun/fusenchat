export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (window as Window & { isTauri?: boolean }).isTauri === true;
}

export function isBlobUrl(value: string): boolean {
  return value.startsWith("blob:");
}
