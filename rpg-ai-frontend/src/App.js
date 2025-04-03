import React, { useState } from 'react';
import './App.css';

const character = {
  name: '',
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

function App() {
  const [playerName, setPlayerName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rollPrompt, setRollPrompt] = useState(null);
  const [questionMode, setQuestionMode] = useState(false);
  const [lastRollContext, setLastRollContext] = useState('');
  const [lastPlayerQuestion, setLastPlayerQuestion] = useState('');
  const [memory, setMemory] = useState({
    quest: '',
    knownCharacters: [],
    knownItems: [],
    knownLocations: [],
    knownLaws: []
  });
  const [highlights, setHighlights] = useState([]);

  const statModifier = (statScore) => Math.floor((statScore - 10) / 2);

  const clearMemory = async () => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL}/clear-memory`, {
        method: 'POST'
      });
      setMemory({
        quest: '',
        knownCharacters: [],
        knownItems: [],
        knownLocations: [],
        knownLaws: []
      });
      setHighlights([]);
    } catch (err) {
      console.error('Failed to clear memory:', err);
    }
  };

  const detectRollRequest = (text) => {
    const match = text.match(/make (an?|a)?\s*(\w+)\s+check(?:\s*\(DC\s*(\d+)\))?/i);
    if (match) {
      const ability = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
      const dc = match[3] ? parseInt(match[3]) : null;
      const sentenceMatch = text.match(/.*?make.*?check.*?[.?!]/i);
      if (sentenceMatch) {
        setLastRollContext(sentenceMatch[0]);
      } else {
        setLastRollContext('');
      }
      setRollPrompt({ ability, dc });
    } else {
      setRollPrompt(null);
      setLastRollContext('');
    }
  };

  const highlightText = (text, highlights) => {
    if (!Array.isArray(highlights)) return text;
    let highlighted = text;
    highlights.forEach(({ text: phrase, type }) => {
      if (!phrase || typeof phrase !== 'string') return;
      const regex = new RegExp(`\\b(${phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')})\\b`, 'gi');
      highlighted = highlighted.replace(regex, `<span class="highlight-${type}">$1</span>`);
    });
    return highlighted;
  };

  const extractMemory = async (text) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/extract-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const extracted = await res.json();
      const safe = (val) => Array.isArray(val) ? val : [];

      setMemory(prev => ({
        quest: extracted.quest || prev.quest,
        knownCharacters: Array.from(new Set([...prev.knownCharacters, ...safe(extracted.knownCharacters)])),
        knownItems: Array.from(new Set([...prev.knownItems, ...safe(extracted.knownItems)])),
        knownLocations: Array.from(new Set([...prev.knownLocations, ...safe(extracted.knownLocations)])),
        knownLaws: Array.from(new Set([...prev.knownLaws, ...safe(extracted.knownLaws)]))
      }));

      setHighlights(safe(extracted.highlights));
    } catch (err) {
      console.error('Memory extraction failed:', err);
    }
  };

  const streamMessage = async (text) => {
    const words = text.split(' ');
    let accumulated = '';
    for (let i = 0; i < words.length; i++) {
      accumulated += words[i] + ' ';
      setMessages(prev => {
        const newMessages = [...prev];
        const last = newMessages[newMessages.length - 1];
        if (last?.sender === 'ai') {
          newMessages[newMessages.length - 1] = { ...last, text: accumulated };
        } else {
          newMessages.push({ sender: 'ai', text: accumulated });
        }
        return newMessages;
      });
      await new Promise(r => setTimeout(r, 40));
    }
  };

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    if (playerName.trim()) {
      setSubmitted(true);
      character.name = playerName;

      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: playerName, message: 'start' })
        });
        const data = await res.json();
        const [storyPart, choicePart] = data.response.split(/Choices:/i);
        const choices = choicePart
          ? choicePart.trim().split(/\n|-/).map(line => line.trim()).filter(line => line.length > 0)
          : [];

        detectRollRequest(storyPart);
        extractMemory(storyPart);
        setOptions(choices);
        await streamMessage(storyPart);
      } catch (error) {
        console.error('Error:', error);
        setMessages([{ sender: 'ai', text: '⚠️ Something went wrong getting your greeting.' }]);
      }
    }
  };

  const sendMessage = async (msg = input) => {
    if (!msg.trim()) return;
    const playerMessage = { sender: 'player', text: msg };
    setMessages((prev) => [...prev, playerMessage]);
    setInput('');
    setOptions([]);
    setRollPrompt(null);
    setQuestionMode(false);
    setLastPlayerQuestion(msg);
    setLoading(true);

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, message: msg })
      });
      const data = await res.json();

      const [storyPart, choicePart] = data.response.split(/Choices:/i);
      const choices = choicePart
        ? choicePart.trim().split(/\n|-/).map(line => line.trim()).filter(line => line.length > 0)
        : [];

      detectRollRequest(storyPart);
      extractMemory(storyPart);
      setOptions(choices);
      await streamMessage(storyPart);
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [...prev, { sender: 'ai', text: '⚠️ Something went wrong talking to the Dungeon Master.' }]);
    }

    setLoading(false);
  };

  const handleOptionClick = (option) => {
    setInput(option);
    sendMessage(option);
  };

  const handleRollCheck = () => {
    if (!rollPrompt) return;
    const statMap = {
      Strength: 'STR', Dexterity: 'DEX', Constitution: 'CON', Intelligence: 'INT',
      Wisdom: 'WIS', Charisma: 'CHA', Arcana: 'INT', Nature: 'INT', Perception: 'WIS',
      Insight: 'WIS', History: 'INT', Investigation: 'INT'
    };
    const statKey = statMap[rollPrompt.ability] || 'INT';
    const roll = Math.floor(Math.random() * 20) + 1;
    const mod = statModifier(character.stats[statKey]);
    const total = roll + mod;
    const rollResult = `🎲 ${rollPrompt.ability} check${rollPrompt.dc ? ` (DC ${rollPrompt.dc})` : ''}: Rolled ${roll} + ${mod} = ${total}`;
    const playerMsg = `I rolled a ${total} on my ${rollPrompt.ability} check.\nThis was in response to my question: "${lastPlayerQuestion}" and the DM's prompt: "${lastRollContext}"`;
    setMessages((prev) => [...prev, { sender: 'player', text: rollResult }]);
    sendMessage(playerMsg);
    setRollPrompt(null);
    setLastRollContext('');
  };

  return (
    <div className="App">
      <h1>🧙 AI Dungeon Master</h1>
      {/* ... UI code remains unchanged ... */}
    </div>
  );
}

export default App;
