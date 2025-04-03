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

  const updateMemoryFromResponse = (text) => {
    const newMemory = { ...memory };

    const characterMatches = [...text.matchAll(/\b(?:I am|My name is) ([A-Z][a-z]+(?: [A-Z][a-z]+)?)/g)].map(m => m[1]);
    const itemMatches = [...text.matchAll(/\b([A-Z][a-z]+(?: of [A-Z][a-z]+)*\b(?: Scroll| Amulet| Gem| Blade| Sword| Ring| Potion))/g)].map(m => m[1]);
    const locationMatches = [...text.matchAll(/\b(?:village|forest|cave|tower|citadel|temple|keep|ruins|city|town) of ([A-Z][a-z]+)/gi)].map(m => m[1]);
    const lawMatches = [...text.matchAll(/\b(?:forbidden|illegal|punishable|law of [A-Z][a-z]+)\b/gi)].map(m => m[0]);

    newMemory.knownCharacters = [...new Set([...newMemory.knownCharacters, ...characterMatches])];
    newMemory.knownItems = [...new Set([...newMemory.knownItems, ...itemMatches])];
    newMemory.knownLocations = [...new Set([...newMemory.knownLocations, ...locationMatches])];
    newMemory.knownLaws = [...new Set([...newMemory.knownLaws, ...lawMatches])];

    setMemory(newMemory);
  };

  // ... rest of the component remains unchanged

  return (
    // ... rest of the JSX stays the same
  );
}

export default App;
