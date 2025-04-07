import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { v4 as uuidv4 } from 'uuid';

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
  const [turns, setTurns] = useState([]); // <-- new
  const [options, setOptions] = useState([]);
  const [showActions, setShowActions] = useState(false);
  const [rollPrompt, setRollPrompt] = useState(null);
  const [lastRollContext, setLastRollContext] = useState('');
  const [lastPlayerQuestion, setLastPlayerQuestion] = useState('');
  const [memory, setMemory] = useState({ quest: '', knownCharacters: [], knownItems: [], knownLocations: [], knownLaws: [] });
  const [highlights, setHighlights] = useState([]);
  const [loadingDM, setLoadingDM] = useState(false);
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('sessionId');
    if (stored) return stored;
    const newId = uuidv4();
    localStorage.setItem('sessionId', newId);
    return newId;
  });

  const chatRef = useRef();

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [turns]);

  const statModifier = (score) => Math.floor((score - 10) / 2);

  const highlightText = (text, highlights) => {
    if (!Array.isArray(highlights)) return text;
    let highlighted = text;
    highlights.forEach(({ text: phrase, type }) => {
      if (!phrase) return;
      const regex = new RegExp(`\\b(${phrase.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})\\b`, 'gi');
      highlighted = highlighted.replace(regex, `<span class="highlight-${type}">$1</span>`);
    });
    return highlighted;
  };

  const extractMemory = async (text) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/extract-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sessionId })
      });
      const extracted = await res.json();
      const safe = val => Array.isArray(val) ? val : [];
      setMemory(prev => ({
        quest: extracted.quest || prev.quest,
        knownCharacters: [...new Set([...prev.knownCharacters, ...safe(extracted.knownCharacters)])],
        knownItems: [...new Set([...prev.knownItems, ...safe(extracted.knownItems)])],
        knownLocations: [...new Set([...prev.knownLocations, ...safe(extracted.knownLocations)])],
        knownLaws: [...new Set([...prev.knownLaws, ...safe(extracted.knownLaws)])]
      }));
      setHighlights(safe(extracted.highlights));
    } catch (err) {
      console.error('Memory extraction failed:', err);
    }
  };

  const clearMemory = async () => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL}/clear-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      setMemory({ quest: '', knownCharacters: [], knownItems: [], knownLocations: [], knownLaws: [] });
      setHighlights([]);
    } catch (err) {
      console.error('Failed to clear memory:', err);
    }
  };

  const streamMessage = async (text, onDone = () => {}) => {
    const words = text.split(' ');
    let accumulated = '';
    setTurns(prev => [...prev.slice(0, -1), { ...prev[prev.length - 1], dm: '' }]);
    words.forEach((word, i) => {
      setTimeout(() => {
        accumulated += word + ' ';
        setTurns(prev => {
          const updated = [...prev];
          updated[updated.length - 1].dm = accumulated;
          return updated;
        });
        if (i === words.length - 1) {
          onDone();
          setLoadingDM(false);
        }
      }, i * 40);
    });
  };

  const sendMessage = async (msg = input) => {
    if (!msg.trim()) return;
    setInput('');
    setOptions([]);
    setRollPrompt(null);
    setLastPlayerQuestion(msg);
    setTurns(prev => [...prev, { player: msg, dm: '' }]);
    setLoadingDM(true);

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, message: msg, sessionId })
      });
      const data = await res.json();
      detectRollRequest(data.response);
      extractMemory(data.response);
      await streamMessage(data.response, () => setOptions(data.options || []));
    } catch (err) {
      console.error(err);
    }
  };

  const detectRollRequest = (text) => {
    const match = text.match(/make (an?|a)?\s*(\w+)\s+check(?:\s*\(DC\s*(\d+)\))?/i);
    if (match) {
      const ability = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
      const dc = match[3] ? parseInt(match[3]) : null;
      const sentenceMatch = text.match(/.*?make.*?check.*?[.?!]/i);
      setLastRollContext(sentenceMatch ? sentenceMatch[0] : '');
      setRollPrompt({ ability, dc });
    } else {
      setRollPrompt(null);
      setLastRollContext('');
    }
  };

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setSubmitted(true);
    character.name = playerName;
    sendMessage('start');
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
    const playerMsg = `I rolled a ${total} on my ${rollPrompt.ability} check.\nThis was in response to my question: \"${lastPlayerQuestion}\" and the DM's prompt: \"${lastRollContext}\"`;
    setTurns(prev => [...prev, { player: rollResult, dm: '' }]);
    sendMessage(playerMsg);
  };

  return (
    <div className="App">
      <header className="top-nav">
  <div className="nav-content">
    <span className="logo">🧙 AI Dungeon Master</span>
    {/* Future nav links can go here */}
  </div>
</header>

      {!submitted ? (
        <form onSubmit={handleNameSubmit} className="name-form">
          <input type="text" placeholder="Enter your character name..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
          <button type="submit">Start Adventure</button>
        </form>
      ) : (
        <div className="main-grid">
          <div className="column character-sheet">
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

          <div className="column game-area">
            {loadingDM && (
              <div className="dm-thinking">
                <span>🧙‍♂️ The Dungeon Master is thinking</span>
                <span className="dots">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </div>
            )}

          <div className="chat-box" ref={chatRef}>
            <div className="chat-box-inner">
              {turns.map((turn, i) => (
                <div key={i} className="chat-turn">
                  <div className="player"><strong>{playerName}:</strong> {turn.player}</div>
                  <div className="ai"><strong>DM:</strong> <span dangerouslySetInnerHTML={{ __html: highlightText(turn.dm, highlights) }} /></div>
                </div>
              ))}
            </div>
           </div>


            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="floating-input">
              <input type="text" placeholder="Ask a question..." value={input} onChange={(e) => setInput(e.target.value)} />
              <button type="button" onClick={() => setShowActions(prev => !prev)}>
                ⚔️ Actions
              </button>
              {showActions && (
                <div className="popup-actions">
                  {options.map((option, i) => (
                    <button key={i} onClick={() => handleOptionClick(option)}>{option}</button>
                  ))}
                  <button onClick={clearMemory}>🧼 Clear Memory</button>
                </div>
              )}
            </form>

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
          </div>

          <div className="column memory-sidebar">
            <h2>📖 World Memory</h2>
            <p><strong>🎯 Quest:</strong> {memory.quest || 'None yet'}</p>
            <p><strong>🎒 Items:</strong> {memory.knownItems.join(', ') || 'None'}</p>
            <p><strong>🧑‍🤝‍🧑 Characters:</strong> {memory.knownCharacters.join(', ') || 'None'}</p>
            <p><strong>🗺 Locations:</strong> {memory.knownLocations.join(', ') || 'None'}</p>
            <p><strong>📜 Laws:</strong> {memory.knownLaws.join(', ') || 'None'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
