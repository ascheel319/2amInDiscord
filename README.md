# I am changing this to connect to a chosen vc and say "it's 2am in your timezone, why are you in discord?" and then leave




# 2am In Discord bot
This repository contains the source code for a discord bot that will connect to a chosen voice channel and ask why people are there as it's 2am.

This is a fork of https://github.com/HOF-Clan/big-ben-clock-discord-bot-docker I just changed some things to make it for my needs.

You will need to invite the bot to your server. The bot needs at least "Connect" and "Speak" permissions.

## Commands
`!2amInDiscord set <voice channel name>` - Set a voice channel as the "Big Ben clock voice channel"  
`!2amInDiscord test` - Play the test sound and output debug to the chat  
`!2amInDiscord mute <tomorrow/week/specific date (format: YYYY-MM-DD)>` - Mute Big Ben Clock until a specific date  
`!2amInDiscord unmute` - Unmute Big Ben Clock  
