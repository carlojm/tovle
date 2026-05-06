// GPT GENERATED TEST TO GET THE FORMAT RIGHT


export const NYRA_CONDITIONS = {
  firstMeet: (playerData, flags) => !flags?.met_nyra,
}

export const NYRA_DIALOGUE = {
  // entry point selection — first condition that passes wins
  entry: [
    { condition: 'firstMeet', node: 'first_meet' },
    { default: true, node: 'greeting' },
  ],

  nodes: {
    first_meet: {
      speaker: 'Archivist Nyra',
      text: 
      `A visitor, welcome. I am Nyra, keeper of Alnera's records. 
      You must be the next adventurer to cause a commotion at the old Forum.`,
      options: [
        { label: 'That\'s me. What do you do here?', next: 'about_nyra' },
      ],
    },

    greeting: {
      speaker: 'Archivist Nyra',
      text: (playerData) => {
        const rep = playerData?.travel?.towns?.alnera?.reputation ?? 0
        const numtrades = playerData?.stats?.tradesByTown.alnera ?? 0
        return numtrades > 0
          ? `Welcome back. According to the ledgers, you've made ${numtrades} trades with our city. Thank you for your service to Ishnir.`
          : `Welcome back. The archive is quiet today. What brings you in?`
      },
      options: [
        { label: 'Tell me about Alnera.', next: 'about_alnera' },
        { label: 'Tell me about the trade routes.', next: 'trade_routes' },
        { label: 'Goodbye.', next: null },
      ],
    },

    about_nyra: {
      speaker: 'Archivist Nyra',
      text:
      `I am the Royal Archivist to the Pharoah. It is my duty to gather information about
      the world and document it for future study.`,
      options: [
        { label: 'What can you tell me about Alnera?', next: 'about_alnera' },
        { label: 'Do you maintain the trade ledgers?', next: 'about_nyra1' },
        { label: 'Goodbye.', next: null },
      ],
      setsFlag: 'met_nyra',
    },

    about_nyra1: {
      speaker: 'Archivist Nyra',
      text: `Yes, I do. This library maintains scrolls, tomes, and all sorts of records about 
      commerce across the Isles, which now includes your own fledgling trade business.`,
      options: [
        { label: 'Continue', next: 'about_alnera2' },
      ],
    },

    about_alnera: {
      speaker: 'Archivist Nyra',
      text: `Ah, it's such a magnificent city, isn't it? Alnera is the capital of Ishnir.
      It is a center for commerce across the Isles, which now includes your own fledgling trade business.`,
      options: [
        { label: 'Continue', next: 'about_alnera2' },
      ],
    },

    about_alnera2: {
      speaker: 'Archivist Nyra',
      text: `In fact, I have been looking through our records since our representative found you in the Forum.
      I'm more of a historian than an analyst, but there seems to be a correlation between trade across the Isles
      and the fortunes found in the ocean.`,
      options: [
        { label: 'Really? How can that be?', next: 'about_alnera3' },
        { label: 'That\'s all I needed. Goodbye.', next: null },
      ],
    },

    about_alnera3: {
      speaker: 'Archivist Nyra',
      text: `Maybe cargo is going overboard, or maybe there are other forces at work, but it seems
      that the more we trade, the richer the rewards found by adventurers under the sea.`,
      options: [
        { label: 'That\'s strange.', next: 'about_alnera4' },
      ],
    },

    about_alnera4: {
      speaker: 'Archivist Nyra',
      text: `I agree, but the data seems to show it. If you would like to view the records,
      there is a map on my desk you can view. It may help in your adventuring.`,
      options: [
        { label: 'Thank you for your help. Goodbye.', next: null },
      ],
    },

    trade_routes: {
      speaker: 'Archivist Nyra',
      text: `It seems that adventurers have found better loot in waters around active trade routes.
      There is a map of these effects on my desk that may help in your adventuring.`,
      options: [
        { label: 'Thank you. Goodbye.', next: null },
      ],
    },
  }
}