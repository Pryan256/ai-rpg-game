const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();
const port = 3001;

require('dotenv').config();
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const memoryPath = './memory.json'; // for clearing memory if needed

let memory = {
  playerName: '',
  lastPlayerMessage: '',
  lastDMPrompt: '',
  quest: '',
  knownItems: [],
  knownCharacters: [],
};

app.use(cors({
  origin: 'https://dancing-dolphin-3d57e1.netlify.app',
}));
app.use(express.json());

app.post('/message', async (req, res) => {
  const { name, message } = req.body;
  memory.playerName = name;
  memory.lastPlayerMessage = message;

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

  const prompt = `You are the Dungeon Master for a Dungeons & Dragons 5e fantasy roleplaying game.

The player is:
- Name: ${playerState.name}
- Race: ${playerState.race}
- Class: ${playerState.class}
- Level: ${playerState.level}
- HP: ${playerState.hp}
- Stats: STR ${playerState.stats.STR}, DEX ${playerState.stats.DEX}, CON ${playerState.stats.CON}, INT ${playerState.stats.INT}, WIS ${playerState.stats.WIS}, CHA ${playerState.stats.CHA}
- Inventory: ${playerState.inventory.join(', ')}

🧠 Memory from previous exchanges:
- Last player message: ${memory.lastPlayerMessage}
- Last DM prompt: ${memory.lastDMPrompt || 'N/A'}
- Current quest objective: ${memory.quest || 'Not yet established'}
- Known items: ${memory.knownItems.join(', ') || 'None'}
- Known characters: ${memory.knownCharacters.join(', ') || 'None'}

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
    memory.lastDMPrompt = raw;

    const [storyPart, choicePart] = raw.split(/Choices:/i);
    const choices = choicePart
      ? choicePart.trim().split(/\n|-/).map(line => line.trim()).filter(line => line.length > 0)
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

// 🧼 Clear memory
app.post('/clear-memory', (req, res) => {
  const emptyMemory = {
    quest: '',
    knownItems: [],
    knownCharacters: [],
    knownLocations: [],
    knownLaws: []
  };

  fs.writeFile(memoryPath, JSON.stringify(emptyMemory, null, 2), (err) => {
    if (err) {
      console.error('❌ Failed to clear memory:', err);
      return res.status(500).json({ success: false });
    }
    console.log('🧠 Memory cleared.');
    res.json({ success: true });
  });
});

// 🔍 New: Extract memory using GPT
app.post('/extract-memory', async (req, res) => {
  const { text } = req.body;

  const memoryPrompt = `You are managing memory for a fantasy RPG.

Given this narration, extract and return only the things the player should remember long-term.

Use this exact format:
{
  "knownCharacters": [],
  "knownItems": [],
  "knownLocations": [],
  "knownLaws": [],
  "quest": ""
}

Only return facts that are new and relevant. If nothing should be remembered, return empty values.`

  try {
    const memoryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: memoryPrompt },
        { role: 'user', content: text }
      ],
      response_format: 'json'
    });

    const json = memoryResponse.choices[0].message.content;
    res.json(JSON.parse(json));
  } catch (err) {
    console.error('❌ Memory extraction failed:', err);
    res.status(500).send('Could not extract memory.');
  }
});

app.get('/', (req, res) => {
  res.send('RPG AI backend is running!');
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
