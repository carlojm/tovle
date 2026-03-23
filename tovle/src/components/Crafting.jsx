import { usePlayer } from '../context/PlayerContext'
import { ITEM_MAP } from '../data/itemMap'
import './Crafting.css'

const UPGRADES = [
  {
    id: 'distancePrecision',
    name: 'Distance Precision',
    description: [
      'Distance hints show a large range (e.g. 300-500 blocks away)',
      'Hints show approximate distance ±100 (e.g. ~500 blocks away)',
      'Hints show near-exact distance ±10 (e.g. ~550 blocks away)',
      'Hints show exact distance',
      'None'
    ],
    maxTier: 3,
    costs: [
      // tier 0→1
      [{ itemId: 'eye_of_viridia', quantity: 3 }],
      // tier 1→2
      [{ itemId: 'eye_of_viridia', quantity: 5 }, { itemId: 'gold_nugget', quantity: 5 }],
      // tier 2→3
      [{ itemId: 'eye_of_viridia', quantity: 5 }, { itemId: 'ade', quantity: 1 }],
    ]
  },
  {
    id: 'directionArrows',
    name: 'Truer North',
    description: [
      'Hints show 4 cardinal directions only (↑ ↓ ← →)',
      'Hints show all 8 directions (↑ ↓ ← → ↗ ↘ ↙ ↖)',
      'None'
    ],
    maxTier: 1,
    costs: [
      // tier 0→1
      [{ itemId: 'iron_nugget', quantity: 10 }, { itemId: 'hyperexperience', quantity: 1 }],
    ]
  },
  {
    id: 'fishingNet',
    name: 'Fishing Net',
    description: [
      'None',
      'Buy a fishing net from Vigora. Fish will now show up in cache loot.',
      'Upgrade your net to catch more types of fish.',
      'None',
    ],
    maxTier: 2,
    costs: [
      [{ itemId: 'den_piece_100', quantity: 1 }, { itemId: 'hypercrystalline_shard', quantity: 1 }],
      [{ itemId: 'twisted_strand', quantity: 2 }, { itemId: 'hypercrystalline_shard', quantity: 1 }],
    ]
  },
  {
    id: 'buildHabitat',
    name: 'Build Habitat',
    description: [
      'None',
      'Build an underwater habitat with all this scrap material.',
      'WIP',
    ],
    maxTier: 1,
    costs: [
      [
        { itemId: 'prismarine_block', quantity: 10 },
        { itemId: 'prismarine_brick', quantity: 10 },
        { itemId: 'prismarine_wall', quantity: 10 },
        { itemId: 'warped_stem', quantity: 5 },
        { itemId: 'warped_hyphae', quantity: 5 },
      ]
    ]
  },
  {
    id: 'newHire',
    name: 'New Hire',
    description: [
      'None',
      'An axolotl wants to live in your newly crafted habitat. Searches for caches in exchange for fish.',
      'WIP',
    ],
    maxTier: 1,
    requiresUpgrade: 'buildHabitat', // hidden until this is owned
    costs: [
      [{ itemId: 'viridian_cod', quantity: 1 }],
    ]
  },
]

const Crafting = () => {
  const { uid, playerData, save } = usePlayer()
  const upgrades = playerData?.upgrades ?? {}
  const items = playerData?.inventory?.items ?? []

  const getItemQuantity = (itemId) => {
    const found = items.find(i => i.itemId === itemId)
    return found?.quantity ?? 0
  }

  const canAfford = (cost) => {
    return cost.every(c => getItemQuantity(c.itemId) >= c.quantity)
  }

  const handleCraft = async (upgrade) => {
    const currentTier = upgrades[upgrade.id] ?? 0
    if (currentTier >= upgrade.maxTier) return

    const cost = upgrade.costs[currentTier]
    if (!canAfford(cost)) return

    //deduct items
    const updatedItems = items.map(item => {
      const costEntry = cost.find(c => c.itemId === item.itemId)
      if (!costEntry) return item
      return {...item, quantity: item.quantity - costEntry.quantity }
    }).filter(item => item.quantity > 0)

    const newValue = currentTier + 1

    // special case: New Hire creates an axolotl on the backend
    if (upgrade.id === 'newHire') {
      try {
        const res = await fetch('/api/create-axolotl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid })
        })
        const data = await res.json()
        if (!res.ok) { console.error(data.error); return }

        save({
          upgrades: { ...upgrades, [upgrade.id]: newValue },
          inventory: { ...playerData.inventory, items: updatedItems },
          axolotls: [...(playerData.axolotls ?? []), data.axolotl],
        })
      } catch (err) {
        console.error('Failed to create axolotl:', err)
      }
      return
    }

    save({
      upgrades: {
        ...upgrades, [upgrade.id]: newValue,
      },
      inventory: {
        ...playerData.inventory,
        items: updatedItems,
      }
    })
  }

  const visibleUpgrades = UPGRADES.filter(upgrade => {
    if (!upgrade.requiresUpgrade) return true
    return (upgrades[upgrade.requiresUpgrade] ?? 0) >= 1
  })

  return (
    <div className="crafting-container">
      {visibleUpgrades.map(upgrade => {
        const currentTier = upgrades[upgrade.id] ?? 0
        const isMaxed = currentTier >= upgrade.maxTier
        const cost = isMaxed ? null : upgrade.costs[currentTier]
        const affordable = cost ? canAfford(cost) : false

        return (
          <div key={upgrade.id} className="crafting-card">
            <div className="crafting-card-header">
              <span className="crafting-name">{upgrade.name}</span>
              <span className="crafting-tier">
                {isMaxed ? 'Maxed' : `Tier ${currentTier}/${upgrade.maxTier}`}
              </span>
            </div>

            <p className="crafting-description current">Current: {upgrade.description[currentTier]}</p>
            {!isMaxed && (
              <p className="crafting-description next">Next: {upgrade.description[currentTier + 1]}</p>
            )}

            {!isMaxed && (
              <>
                <div className="crafting-cost">
                  {cost.map(c => {
                    const have = getItemQuantity(c.itemId)
                    const enough = have >= c.quantity
                    const itemDef = ITEM_MAP[c.itemId]
                    return (
                      <div key={c.itemId} className={`crafting-cost-item ${enough ? '' : 'crafting-cost-missing'}`}>
                        {itemDef && (
                          <img
                            src={itemDef.img}
                            alt={c.itemId}
                            className="crafting-cost-icon"
                            style={{imageRendering: 'pixelated'}}
                          />
                        )}
                        <span>{have}/{c.quantity}</span>
                      </div>
                    )
                  })}
                </div>
                <button
                  className={`submit-button ${!affordable ? 'disable-button' : ''}`}
                  onClick={() => affordable && handleCraft(upgrade)}
                >
                  Craft
                </button>
              </>
            )}

            {isMaxed && (
              <p className="crafting-maxed">Fully upgraded</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default Crafting