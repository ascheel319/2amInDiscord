const TwoamInDiscord = require('./2amInDiscord');

// Create the Big Ben Clock instance
const twoamInDiscord = new TwoamInDiscord();

// Initialise the bot
twoamInDiscord.init().catch(console.error);