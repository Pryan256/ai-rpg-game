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


  const statModifier = (statScore) => Math.floor((statScore - 10) / 2);

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    if (playerName.trim()) {
      setSubmitted(true);
      character.name = playerName;
  
      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: playerName, message: 'start' }), // ✅ FIXED
        });
  
        const data = await res.json();
        const aiMessage = { sender: 'ai', text: data.response };
        setMessages([aiMessage]);
        setOptions(data.options || []);
        detectRollRequest(data.response);
      } catch (error) {
        console.error('Error:', error);
        setMessages([{ sender: 'ai', text: '⚠️ Something went wrong getting your greeting.' }]);
      }
    }
  };
  

  const detectRollRequest = (text) => {
    const match = text.match(/make (an?|a)?\s*(\w+)\s+check(?:\s*\(DC\s*(\d+)\))?/i);
    if (match) {
      const ability = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
      const dc = match[3] ? parseInt(match[3]) : null;
  
      // Save the context sentence
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
  

  const sendMessage = async (msg = input) => {
    if (!msg.trim()) return;

    const playerMessage = { sender: 'player', text: msg };
    setMessages((prev) => [...prev, playerMessage]);
    setInput('');
    setOptions([]);
    setRollPrompt(null);
    setQuestionMode(false);
    setLoading(true);

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, message: msg }), // or 'start' for the first call
      });
      

      const data = await res.json();
      const aiMessage = { sender: 'ai', text: data.response };
      setMessages((prev) => [...prev, aiMessage]);
      setOptions(data.options || []);
      detectRollRequest(data.response);
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
  
    const rollResult = `🎲 ${rollPrompt.ability} check (DC ${rollPrompt.dc}): Rolled ${roll} + ${mod} = ${total}`;
    const playerMsg = `I rolled a ${total} on my ${rollPrompt.ability} check.` +
      (lastRollContext ? ` This was for the following prompt: "${lastRollContext}"` : '');
  
    setMessages((prev) => [...prev, { sender: 'player', text: rollResult }]);
    sendMessage(playerMsg);
    setRollPrompt(null);
    setLastRollContext('');
  };
  
  

  return (
    <div className="App">
      <h1>🧙 AI Dungeon Master</h1>
      <div className="container">
        {!submitted ? (
          <form onSubmit={handleNameSubmit} className="name-form">
            <input
              type="text"
              placeholder="Enter your character name..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
            <button type="submit">Start Adventure</button>
          </form>
        ) : (
          <div className="main-content">
            <div className="character-sheet">
              <h2>{playerName}</h2>
              <p><strong>Race:</strong> {character.race}</p>
              <p><strong>Class:</strong> {character.class}</p>
              <p><strong>Level:</strong> {character.level}</p>
              <p><strong>HP:</strong> {character.hp}</p>
              <h3>Stats</h3>
              <ul>
                {Object.entries(character.stats).map(([stat, value]) => (
                  <li key={stat}>{stat}: {value}</li>
                ))}
              </ul>
              <h3>Inventory</h3>
              <ul>
                {character.inventory.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>

            <div className="game-area">
              <div className="chat-box">
                {messages.map((msg, i) => (
                  <div key={i} className={msg.sender}>
                    <strong>{msg.sender === 'ai' ? 'DM' : playerName}:</strong> {msg.text}
                  </div>
                ))}
                {loading && <div className="ai">DM is thinking...</div>}
              </div>

              {rollPrompt && (
                <div className="roll-section">
                  {lastRollContext && (
                    <p className="roll-context">
                      🧠 Rolling for: <em>{lastRollContext}</em>
                    </p>
                  )}
                  <button onClick={handleRollCheck}>
                    🎲 Roll {rollPrompt.ability} Check{rollPrompt.dc ? ` (DC ${rollPrompt.dc})` : ''}
                  </button>
                </div>
              )}


              <div className="options">
                {options.map((option, i) => (
                  <button key={i} onClick={() => handleOptionClick(option)}>{option}</button>
                ))}
                <button onClick={() => setQuestionMode(true)}>❓ Ask a question</button>
              </div>

              {questionMode && (
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}>

                  <input
                    type="text"
                    placeholder="Ask the DM a question..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <button type="submit">Send</button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;