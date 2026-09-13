export function getFirstLastInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "";
  }

  const firstInitial = words[0][0];
  const lastInitial = words[words.length - 1][0];

  return (firstInitial + lastInitial).toUpperCase();
}
export function getMergedName(name: string): string {
  const words = name.trim().split(" ");
  return words.map((word) => word.trim()).join("+");
}
