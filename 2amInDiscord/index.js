require('dotenv').config();
const Discord = require('discord.js');
const schedule = require('node-schedule');
const moment = require('moment');
const _ = require('lodash');

const Database = require('../Database');

class TwoamInDiscord {
    /**
     * 2amInDiscord constructor
     */
    constructor() {
        // Fetch the bot token from the environment
        this.botToken = process.env.BOT_TOKEN;

        // Database instance
        this.database = new Database(process.env.DATABASE_URL, { ssl: process.env.DATABASE_SECURE });

        // Create the bot
        this.bot = new Discord.Client();
    }

    /**
     * Initialise the bot
     */
    async init() {
        console.info("Initialise...");

        // Ensure we have a bot token
        if (_.isEmpty(this.botToken)) {
            console.error("Please provide a BOT_TOKEN inside the .env file");
        }

        // Create an event for when the bot is ready
        this.bot.on('ready', () => {
            console.info(`Logged in as ${this.bot.user.tag}!`);

            // Register any commands
            this.registerCommands();

            // Create the scheduler
            this.createScheduler();
        });

        // Hide Bot
        this.bot.user.setStatus('Invisible');

        // Catch any errors
        this.bot.on('error', (error) => {
            console.error(error);
        });

        // Initialise the database
        await this.database.init();

        // Log the bot in
        await this.bot.login(this.botToken);
    }

    /**
     * Register any commands
     */
    registerCommands() {
        // Catch the message event
        this.bot.on('message', (message) => {
            // Command prefix
            let prefix = "!2amInDiscord";

            // Set a voice channel as the "2amInDiscord" channel
            if (message.content.trim().startsWith(prefix)) {
                // Fetch the arguments of the command
                const args = message.content.replace(`${prefix} `, "").split(" ");

                // Fetch the command
                const command = args.shift().toLowerCase().replace(prefix, '');

                // Set channel command
                if (command === "set") {
                    // Fetch the channel name
                    let channelName = args.join(' ');

                    // Attempt to find the voice channel
                    let voiceChannel = message.guild.channels.cache.find((channel) => {
                        return channel.name === channelName && channel.type === "voice";
                    });

                    if (voiceChannel) {
                        // Remove any existing channels
                        this.database.deleteServer(message.guild.id);

                        // Add the channel
                        this.database.addServer(message.guild.id, voiceChannel.id).then(() => {
                            message.channel.send(`Set '${voiceChannel.name}' as 2amInDiscord voice channel`);
                        }).catch((err) => {
                            message.channel.send(`Oh no! Something went wrong while setting your channel`);
                            console.error(err);
                        });
                    } else {
                        message.channel.send(`Could not find voice channel '${channelName}'`);
                    }
                } else if (command === "test") {
                    // Find the servers record
                    this.database.getServer(message.guild.id).then((response) => {
                        let server = response.rows[0];

                        if (server && !_.isEmpty(server.channel_id)) {
                            message.channel.send(`Attempting to join server ${message.guild.id}...`);

                            // Attempt to find the guild
                            let guild = this.bot.guilds.cache.find((guild) => guild.id === server.server_id);

                            if (guild) {
                                // Attempt to find the channel
                                let channel = guild.channels.cache.find((channel) => channel.id === server.channel_id);

                                message.channel.send(`Attempting to join channel ${channel.id} on server ${guild.id}`);

                                channel.join().then((connection) => {
                                    if (server.mute_until && typeof server.mute_until === "string" && moment(server.mute_until).isAfter(moment())) {
                                        message.channel.send(`Server ${guild.id} is muted until ${moment(server.mute_until).format('YYYY-MM-DD HH:mm:ss')}`);
                                        message.channel.send(`Leaving...`);
                                        channel.leave();
                                    } else {
                                        const dispatcher = connection.play("./Assets/WhyAreYouOnDiscord.mp3");

                                        message.channel.send(`Attempting to play test sound in ${channel.id}...`);

                                        // Leave the channel once we're done
                                        dispatcher.on('finish', () => {
                                            message.channel.send(`Leaving...`);

                                            channel.leave();
                                        });
                                    }
                                });
                            } else {
                                message.channel.send("Could not find your server, please kick and re-invite the 2amInDiscord bot.");
                            }
                        } else {
                            message.channel.send(`You must set a voice channel before setting a frequency (!2amInDiscord set <voice channel name>)`);
                        }
                    });
                } else if (command === "mute") {
                    // Find the servers record
                    this.database.getServer(message.guild.id).then((response) => {
                        let server = response.rows[0];

                        if (server && !_.isEmpty(server.channel_id)) {
                            let until = args.join().trim();

                            // Attempt to parse the until date
                            switch (until) {
                                case 'tomorrow':
                                    until = moment().endOf('day');
                                    break;
                                case 'week':
                                    until = moment().add(1, 'week').endOf('day');
                                    break;
                                default:
                                    if (until.length === 0) {
                                        until = moment().endOf('day');
                                    } else {
                                        until = moment(until).startOf('day');
                                    }
                            }

                            this.database.setMuteUntil(message.guild.id, until.format('YYYY-MM-DD HH:mm:ss'));

                            message.channel.send(`Muting 2amInDiscord until ${until.format('dddd, MMMM Do YYYY, HH:mm:ss')}. Use "!2amInDiscord unmute" to unmute sooner.`);
                        } else {
                            message.channel.send(`You must set a voice channel before setting a frequency (!2amInDiscord set <voice channel name>)`);
                        }
                    });
                } else if (command === "unmute") {
                    // Find the servers record
                    this.database.getServer(message.guild.id).then((response) => {
                        let server = response.rows[0];

                        if (server && !_.isEmpty(server.channel_id)) {
                            this.database.setMuteUntil(message.guild.id, null);

                            message.channel.send(`Unmuted 2amInDiscord.`);
                        } else {
                            message.channel.send(`You must set a voice channel before setting a frequency (!2amInDiscord set <voice channel name>)`);
                        }
                    });
                } else {
                    message.channel.send("Available commands:\n\n!2amInDiscord set <voice channel name>\n!2amInDiscord frequency <1-12>\n!2amInDiscord test\n!2amInDiscord mute <tomorrow/week/specific date (format: YYYY-MM-DD)>\n!2amInDiscord unmute");
                }
            }
        });
    }

    /**
     * Create the scheduler
     */
    createScheduler() {
        // Schedule a job for every hour
        //schedule.scheduleJob('0 * * * *', () => {
        schedule.scheduleJob('0 2 * * *', () => {
            // Get the hour
            let hour = moment().format('h');

            console.info(`Running schedule at ${moment().format('Y-m-d H:m:s')}`);

            // Get all servers
            this.database.getAllServers().then((response) => {
                let servers = response.rows;

                // Loop through the servers
                servers.forEach((server) => {
                    // Attempt to find the guild
                    let guild = this.bot.guilds.cache.find((guild) => guild.id === server.server_id);

                    // Determine if we should play a chime base do the servers "mute until" setting
                    if (server.mute_until && typeof server.mute_until === "string" && moment(server.mute_until).isAfter(moment())) {
                        playChimes = false;
                    }

                    if (guild && playChimes) {
                        // Find the channel in the server
                        let channel = guild.channels.cache.find((channel) => channel.id === server.channel_id);

                        console.info(`Attempting to join channel ${channel.id} on server ${guild.id}`);

                        if (channel && channel.members.array().length > 0) {
                            // Play the chime
                            channel.join().then((connection) => {
                                // const dispatcher = connection.play(`./Assets/${hour}.mp3`);
                                const dispatcher = connection.play("./Assets/WhyAreYouOnDiscord.mp3");

                                console.info(`Playing ./Assets/WhyAreYouOnDiscord.mp3 in channel ${channel.id}`);

                                // Leave the channel once we're done
                                dispatcher.on("finish", () => {
                                    channel.leave();
                                });
                            });
                        } else {
                            if (channel) {
                                console.info(`Channel ${channel.id} does not have any members`);
                            } else {
                                // TODO: Delete record as channel no longer exists
                                console.info(`Channel ${channel.id} does not exist`);
                            }
                        }
                    } else {
                        if (guild) {
                            console.info(`Deferring chime on server ${guild.id}. Frequency: ${server.frequency}. Mute Until: ${server.mute_until}`);
                        } else {
                            // TODO: Delete record as server no longer exists
                            console.info(`Server ${server.id} does not exist`);
                        }
                    }
                });
            });
        });
    }
}

module.exports = TwoamInDiscord;
