import islesItems from '../data/islesItems.json'

function getMonumentaClass(itemName) {
  return `monumenta-${itemName
    .replaceAll('-', '')
    .replaceAll('.', '')
    .replaceAll("'", '')
    .replace(/\(.*\)/g, '')
    .trim()
    .replaceAll(' ', '-')
    .replaceAll('_', '-')
    .toLowerCase()
    .replace(/(^|-)([a-z])/g, (_, sep, c) => `${sep}${c.toUpperCase()}`)
  }`
}

function getMinecraftClass(baseItem) {
  return `minecraft-${baseItem
    .replaceAll(' ', '-')
    .replaceAll('_', '-')
    .toLowerCase()}`
}

export default function ItemIcon({ itemKey }) {
  const item = islesItems[itemKey]
  if (!item) return null

  const monumentaClass = getMonumentaClass(item.name)

  // Check if the monumenta class exists in the loaded stylesheets
  const monumentaExists = Array.from(document.styleSheets).some(sheet => {
    try {
      return Array.from(sheet.cssRules).some(rule => rule.selectorText === `.${monumentaClass}`)
    } catch { return false }
  })

  const baseClass = monumentaExists ? 'monumenta-items' : 'minecraft'
  const iconClass = monumentaExists ? monumentaClass : getMinecraftClass(item.base_item)

  return <div className={`${baseClass} ${iconClass}`}/>
}