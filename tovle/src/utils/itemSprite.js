export function getItemClasses(itemName, baseItem) {
  const monumentaClass = `monumenta-${itemName
    .replaceAll('-', '')
    .replaceAll('.', '')
    .replaceAll("'", '')
    .replace(/\(.*\)/g, '')
    .trim()
    .replaceAll(' ', '-')
    .replaceAll('_', '-')
    .toLowerCase()
    .replace(/(?:^|\-)(\w)/g, (_, c) => `-${c.toUpperCase()}`)
    .replace(/^-/, '')}`

  const minecraftClass = `minecraft-${baseItem
    .replaceAll(' ', '-')
    .replaceAll('_', '-')
    .toLowerCase()}`

  return { monumentaClass, minecraftClass }
}