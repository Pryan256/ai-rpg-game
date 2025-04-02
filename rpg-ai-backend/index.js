const express = require('express');
const cors = require('cors');
const app = express();
const port = 3001;

require('dotenv').config();
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

app.post('/message', async (req, res) => {
  const { name, message } = req.body;

  // 🧙 Player's character sheet
  const playerState = {
    name,
    race: 'Elf',
    class: 'Wizard',
    level: 2,
    hp: 14,
    stats: {
      STR: 8,
      DEX: 14,
      CON: 12,
      INT: 16,
      WIS: 10,
      CHA: 10,
    },
    inventory: ['Spellbook', 'Staff', 'Potion of Healing']
  };

  // 🧠 DM system prompt
  const prompt = `You are the Dungeon Master for a Dungeons & Dragons 5e fantasy roleplaying game.

The player is:
- Name: ${playerState.name}
- Race: ${playerState.race}
- Class: ${playerState.class}
- Level: ${playerState.level}
- HP: ${playerState.hp}
- Stats: STR ${playerState.stats.STR}, DEX ${playerState.stats.DEX}, CON ${playerState.stats.CON}, INT ${playerState.stats.INT}, WIS ${playerState.stats.WIS}, CHA ${playerState.stats.CHA}
- Inventory: ${playerState.inventory.join(', ')}

🎭 DM Guidelines:
- Only narrate the world, never describe the player taking action unless they explicitly say so.
- If a player asks about something that might require a skill check (like identifying a plant or sensing danger), ask them to roll for it.
- Use the phrase: "Make a [Skill] check (DC [number])."
- Do NOT roll for the player. Wait for them to respond with their result.
- After receiving their roll, narrate success or failure accordingly.
- Be sure to clearly separate story text from choices.

🧠 Always respond only to the player's latest input. Continue the story logically.

📜 End each response with 2 to 4 short, clear choices the player can take next.

Use this format:
Story text...

Choices:
- Choice one
- Choice two
- Choice three`;

  try {
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: message }
      ],
    });

    const raw = chatResponse.choices[0].message.content;

    const [storyPart, choicePart] = raw.split(/Choices:/i);
    const choices = choicePart
      ? choicePart
          .trim()
          .split(/\n|-/)
          .map(line => line.trim())
          .filter(line => line.length > 0)
      : [];

    res.json({
      response: storyPart.trim(),
      options: choices
    });
  } catch (error) {
    console.error('❌ OpenAI Error:', error);
    res.status(500).send('Something went wrong talking to the Dungeon Master.');
  }
});

app.get('/', (req, res) => {
  res.send('RPG AI backend is running!');
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
