import { getMsUntilMidnightEastern } from '../../utils/dates'

export const DINA_CONDITIONS = {
  firstMeet: (playerData, flags) => !flags?.met_dina,
}

export const DINA_DIALOGUE = {
  // entry point selection — first condition that passes wins
  entry: [
    { condition: 'firstMeet', node: 'first_meet' },
    { default: true, node: 'greeting' },
  ],

  nodes: {
    first_meet: {
      speaker: 'Treasurer Dina',
      text: 
      `Please keep moving. You must have authorized access to enter the treasury.`,
      options: [
        { label: 'Can you tell me about shipments?', next: 'about_shipments' },
      ],
    },

    greeting: {
      speaker: 'Treasurer Dina',
        text: (playerData) => {
          const ms = getMsUntilMidnightEastern()
          const totalMinutes = Math.floor(ms / 60000)
          const hours = Math.floor(totalMinutes / 60)
          const minutes = totalMinutes % 60
          const timeLeft = hours === 0
            ? `about ${minutes} minute${minutes === 1 ? '' : 's'}`
            : minutes === 0
              ? `about ${hours} hour${hours === 1 ? '' : 's'}`
              : `about ${hours} hour${hours === 1 ? '' : 's'} and ${minutes} minute${minutes === 1 ? '' : 's'}`
          return `I was just getting another batch of shipments ready. Your next one will be ready in ${timeLeft}.`
        },
      options: [
        { label: 'Tell me about shipments.', next: 'about_shipments2' },
        { label: 'Tell me more about commerce.', next: 'about_trade' },
        { label: 'Goodbye.', next: null },
      ],
    },

    about_shipments: {
      speaker: 'Treasurer Dina',
      text:
      `Oh, you must be the adventurer we've opened a new line of trade with. Congratulations on the new business.`,
      options: [
        { label: 'Thanks! Can you tell me about shipments?', next: 'about_shipments2' },
      ],
      setsFlag: 'met_dina',
    },

    about_shipments2: {
      speaker: 'Treasurer Dina',
      text:
      `Shipments comprise of loot collected by Alnera's garrison from nearby monster dens and bandit camps.
      The city routinely clears out these points of interest and accrues surplus equipment.`,
      options: [
        { label: 'Alnera uses that equipment for trade?', next: 'about_shipments3' },
      ],
    },

    about_shipments3: {
      speaker: 'Treasurer Dina',
      text:
      `That is correct. Part of my job as Treasurer to the Pharoah is organizing this gear into shipments and
      tracking its distribution.`,
      options: [
        { label: 'I could use some new gear.', next: 'about_shipments4' },
      ],
    },

    about_shipments4: {
      speaker: 'Treasurer Dina',
      text:
      `You are lucky you can provide the Pharoah with so many riches. As part of your trade deal with Alnera,
      you will receive one shipment per day.`,
      options: [
        { label: 'Great!', next: 'about_shipments5' },
      ],
    },

    about_shipments5: {
      speaker: 'Treasurer Dina',
      text:
      `And your business has proved valuable to Ishnir. If you continue to increase your reputation with us,
      I will be able to set aside more equipment for you each day.`,
      options: [
        { label: 'Thank you for your help! Goodbye.', next: null },
      ],
    },

    about_trade: {
      speaker: 'Treasurer Dina',
      text:
      `As you continue to grow your trade business, you will likely strike deals with other groups. Now that
      you've opened trade with us, I can imagine the Chillwind Empire sending a representative to visit you soon.
      They will likely offer you shipments as well.`,
      options: [
        { label: 'Thank you for your help. Goodbye.', next: null },
      ],
    },

  }
}