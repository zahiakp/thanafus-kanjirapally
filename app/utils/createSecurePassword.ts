export function createSecurePassword(length = 16) {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*_-+",
  ];
  const randomIndex = (size: number) => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % size;
  };
  const password = groups.map((group) => group[randomIndex(group.length)]);
  const all = groups.join("");
  while (password.length < length) password.push(all[randomIndex(all.length)]);
  return password
    .map((character) => ({ character, order: randomIndex(1_000_000) }))
    .sort((a, b) => a.order - b.order)
    .map(({ character }) => character)
    .join("");
}
