// src/data/townConfig.js
import alnera from '../assets/alnera.png'
import frostgate from '../assets/frostgate.png'
import mistport from '../assets/mistport.png'
import steelmeld from '../assets/steelmeld.png'

export const TOWN_CONFIG = {
  alnera: {
    id: 'alnera',
    name: 'Alnera',
    description: 'The bustling capital of the Ishnir Empire. Boosts from Alnera affect the East half of the map.',
    coordinates: { x: 380, z: 760 },
    hemisphere: 'east',
    image: alnera,
    favoriteItems: [], // fill in later
  },
  frostgate: {
    id: 'frostgate',
    name: 'Frostgate',
    description: 'An oceanside citadel serving as the capital of the Chillwind Empire. Boosts from Frostgate affect the West half of the map.',
    coordinates: { x: -1500, z: 970 },
    hemisphere: 'west',
    image: frostgate,
    favoriteItems: [],
  },
  mistport: {
    id: 'mistport',
    name: 'Mistport',
    description: 'An island town of pirates. Yarrr! Boosts from Mistport affect the South half of the map.',
    coordinates: { x: -750, z: 1340 },
    hemisphere: 'south',
    image: mistport,
    favoriteItems: [],
  },
  steelmeld: {
    id: 'steelmeld',
    name: 'Steelmeld',
    description: 'An isolated underground settlement built long ago, now serving as a research site. Boosts from Steelmeld affect the North half of the map.',
    coordinates: { x: -420, z: -460 },
    hemisphere: 'north',
    image: steelmeld,
    favoriteItems: [],
  },
}

// unlock order — tied to forum tier progression
export const TOWN_UNLOCK_ORDER = ['alnera', 'frostgate', 'mistport', 'steelmeld']