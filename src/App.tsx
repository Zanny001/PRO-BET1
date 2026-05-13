/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Clock, 
  ChevronRight, 
  Activity, 
  Search, 
  Wallet, 
  User, 
  TrendingUp, 
  History, 
  X, 
  Zap,
  Flame,
  Globe,
  Dribbble,
  Gamepad,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';

// --- Types ---

interface BetSelection {
  matchId: number;
  marketLabel: string; // "1", "X", "2"
  odds: number;
  teamName: string;
  opponentName: string;
}

interface Match {
  id: number;
  category: 'soccer' | 'basketball' | 'tennis' | 'esports';
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeOdds: number;
  drawOdds?: number;
  awayOdds: number;
  time: string;
  isLive: boolean;
  isHot?: boolean;
}

// --- Mock Initial Data (Will be updated by Socket) ---

const INITIAL_MATCHS: Match[] = [
  { id: 1, category: 'soccer', league: 'UEFA Champions League', homeTeam: 'Real Madrid', awayTeam: 'Man City', homeScore: 1, awayScore: 1, homeOdds: 2.10, drawOdds: 3.40, awayOdds: 2.85, time: "75'", isLive: true, isHot: true },
  { id: 2, category: 'soccer', league: 'English Premier League', homeTeam: 'Arsenal', awayTeam: 'Bayern', homeScore: 0, awayScore: 0, homeOdds: 1.95, drawOdds: 3.20, awayOdds: 3.10, time: "22'", isLive: true },
  { id: 3, category: 'basketball', league: 'NBA', homeTeam: 'LA Lakers', awayTeam: 'Golden State', homeScore: 92, awayScore: 88, homeOdds: 1.85, awayOdds: 2.05, time: "Q4 3:45", isLive: true, isHot: true },
  { id: 4, category: 'esports', league: 'LCS Spring', homeTeam: 'Team Liquid', awayTeam: 'Cloud9', homeScore: 1, awayScore: 0, homeOdds: 1.50, drawOdds: 0, awayOdds: 2.50, time: "G2 15:00", isLive: true },
  { id: 5, category: 'tennis', league: 'Wimbledon', homeTeam: 'Novak Djokovic', awayTeam: 'Carlos Alcaraz', homeScore: 2, awayScore: 2, homeOdds: 1.80, drawOdds: 0, awayOdds: 2.00, time: "Set 5", isLive: true, isHot: true },
  { id: 6, category: 'soccer', league: 'Spanish La Liga', homeTeam: 'Barcelona', awayTeam: 'Real Sociedad', homeScore: 0, awayScore: 0, homeOdds: 1.45, drawOdds: 4.50, awayOdds: 7.00, time: "Tomorrow", isLive: false },
];

const CATEGORIES = [
  { id: 'all', label: 'All Sports', icon: Globe },
  { id: 'soccer', label: 'Soccer', icon: Activity },
  { id: 'basketball', label: 'Basketball', icon: Dribbble },
  { id: 'tennis', label: 'Tennis', icon: Trophy },
  { id: 'esports', label: 'Esports', icon: Gamepad },
];

// --- Components ---

const OddButton = ({ 
  label, 
  value, 
  isSelected, 
  onClick 
}: { 
  label: string; 
  value: number; 
  isSelected: boolean; 
  onClick: () => void 
}) => {
  if (value === 0) return <div className="w-20" />;

  return (
    <button 
      onClick={onClick}
      className={`
        w-20 py-2 rounded-lg flex flex-col items-center transition-all duration-200 border
        ${isSelected 
          ? 'bg-yellow-500 text-black border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)]' 
          : 'bg-slate-700/50 border-slate-600 hover:border-yellow-500/50 hover:bg-slate-700'}
      `}
    >
      <span className={`text-[10px] uppercase font-bold ${isSelected ? 'text-black/60' : 'text-slate-400'}`}>
        {label}
      </span>
      <span className="font-mono font-bold tracking-tighter leading-none">{value.toFixed(2)}</span>
    </button>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('all');
  const [betslip, setBetslip] = useState<BetSelection[]>([]);
  const [stake, setStake] = useState<string>('10');
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHS);
  const [balance, setBalance] = useState<number>(0);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [showSlip, setShowSlip] = useState(false);

  // --- Socket & Initialization ---

  useEffect(() => {
    // Initial fetch for balance
    fetch('/api/user')
      .then(res => res.json())
      .then(data => setBalance(data.balance))
      .catch(err => console.error("Balance fetch error:", err));

    // Connect to Socket server
    const socket = io();

    socket.on('odds-update', (update) => {
      setMatches(prev => prev.map(m => {
        if (m.id === update.matchId) {
          return {
            ...m,
            homeOdds: parseFloat(update.homeOdds),
            awayOdds: parseFloat(update.awayOdds),
            drawOdds: update.drawOdds ? parseFloat(update.drawOdds) : m.drawOdds
          };
        }
        return m;
      }));
    });

    // Score updates simulation (Client-side sync for visual consistency)
    const interval = setInterval(() => {
      setMatches(prev => prev.map(match => {
        if (!match.isLive) return match;
        const shouldUpdateScore = Math.random() > 0.99;
        if (shouldUpdateScore) {
          return {
            ...match,
            homeScore: match.homeScore + (Math.random() > 0.5 ? 1 : 0),
            awayScore: match.awayScore + (Math.random() > 0.5 ? 0 : 1)
          };
        }
        return match;
      }));
    }, 10000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, []);

  const filteredMatches = useMemo(() => {
    if (activeTab === 'all') return matches;
    return matches.filter(m => m.category === activeTab);
  }, [activeTab, matches]);

  const toggleSelection = (match: Match, market: '1' | 'X' | '2', odds: number) => {
    const exists = betslip.find(s => s.matchId === match.id && s.marketLabel === market);

    if (exists) {
      setBetslip(prev => prev.filter(s => !(s.matchId === match.id && s.marketLabel === market)));
    } else {
      setBetslip(prev => [
        ...prev.filter(s => s.matchId !== match.id),
        {
          matchId: match.id,
          marketLabel: market,
          odds,
          teamName: market === '1' ? match.homeTeam : market === '2' ? match.awayTeam : 'Draw',
          opponentName: market === '1' ? match.awayTeam : market === '2' ? match.homeTeam : `${match.homeTeam} vs ${match.awayTeam}`
        }
      ]);
    }
  };

  const totalOdds = useMemo(() => {
    if (betslip.length === 0) return 0;
    return betslip.reduce((acc, curr) => acc * curr.odds, 1);
  }, [betslip]);

  const potentialPayout = useMemo(() => {
    const s = parseFloat(stake);
    if (isNaN(s)) return 0;
    return s * totalOdds;
  }, [stake, totalOdds]);

  const handlePlaceBet = async () => {
    if (betslip.length === 0 || parseFloat(stake) > balance) return;
    
    setIsPlacingBet(true);
    try {
      // In a real multi-selection world, we'd loop or have a batch endpoint.
      // For this demo, we'll place the first one or just send the aggregate data.
      const response = await fetch('/api/place-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stake: parseFloat(stake),
          odds: totalOdds,
          selection: betslip.map(b => b.marketLabel).join(','),
          matchId: betslip.map(b => b.matchId).join(',')
        })
      });

      const data = await response.json();
      if (data.success) {
        setBalance(data.newBalance);
        setBetslip([]);
        // Show success state
      } else {
        alert(data.error || "Failed to place bet");
      }
    } catch (err) {
      console.error("Bet placement error:", err);
      alert("Network error. Please try again.");
    } finally {
      setIsPlacingBet(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-500 p-1.5 rounded-lg">
              <Zap size={20} className="text-black fill-black" />
            </div>
            <h1 className="text-xl font-black tracking-tighter text-white">PRO<span className="text-yellow-500">BET</span></h1>
          </div>
          
          <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-400">
            <button className="text-yellow-500 font-bold border-b-2 border-yellow-500 py-5">Sports</button>
            <button className="hover:text-white transition py-5">In-Play</button>
            <button className="hover:text-white transition py-5">Casino</button>
            <button className="hover:text-white transition py-5">Promos</button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
            <Wallet size={16} className="text-yellow-500" />
            <motion.span 
              key={balance}
              initial={{ scale: 1.1, color: '#EAB308' }}
              animate={{ scale: 1, color: '#FFFFFF' }}
              className="font-mono text-sm font-bold"
            >
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </motion.span>
          </div>
          <button className="p-2 hover:bg-slate-800 rounded-full transition text-slate-400 hover:text-white">
            <Search size={20} />
          </button>
          <button className="bg-yellow-500 text-black px-5 py-2 rounded-lg font-bold hover:bg-yellow-400 transition transform active:scale-95 shadow-lg shadow-yellow-500/10">
            Deposit
          </button>
          <button className="p-1 px-4 py-2 border border-slate-700 rounded-lg hover:bg-slate-800 transition">
            <User size={20} />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 mt-16 flex flex-col md:flex-row max-w-[1600px] mx-auto w-full gap-6 p-6">
        
        {/* Left Sidebar - Navigation */}
        <aside className="hidden lg:flex flex-col w-64 gap-6 sticky top-22 h-fit">
          <div className="bg-slate-800/50 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-800/80">
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-500">Main Categories</h3>
            </div>
            <div className="p-2 space-y-1">
              {CATEGORIES.map((cat) => (
                <button 
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                    ${activeTab === cat.id ? 'bg-yellow-500 text-black font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                  `}
                >
                  <cat.icon size={18} />
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-2xl border border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-500">Trending Now</h3>
              <TrendingUp size={14} className="text-green-500" />
            </div>
            <div className="space-y-3">
              <TrendingItem title="Super Bowl LVIII" subtitle="NFL Finals" />
              <TrendingItem title="Champions League" subtitle="Quarter Finals" />
              <TrendingItem title="F1 Monaco GP" subtitle="Race Day" />
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1 space-y-6">
          {/* Banner */}
          <div className="relative group overflow-hidden rounded-3xl h-48 md:h-64 flex items-center px-8 sm:px-12">
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-slate-900/40 z-10" />
            <img 
              src="https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=2070" 
              className="absolute inset-0 w-full h-full object-cover grayscale opacity-30 group-hover:scale-105 transition-transform duration-700" 
              alt="Promo"
            />
            
            <div className="relative z-20 max-w-md space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500 text-black rounded-full text-[10px] font-black uppercase tracking-tighter">
                <Flame size={12} className="fill-black" /> Limited Offer
              </div>
              <h2 className="text-3xl md:text-5xl font-black italic uppercase leading-none">Double Your <span className="text-yellow-500">First Deposit</span></h2>
              <p className="text-slate-400 text-sm md:text-base font-medium">Join PRO-BET today and get up to $500 in free bets. Terms apply.</p>
              <button className="bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-yellow-500 transition">Claim Bonus</button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex items-center justify-between bg-slate-800/40 p-2 rounded-2xl border border-slate-800">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              <FilterChip label="Live Matches" active count={matches.filter(m => m.isLive).length} />
              <FilterChip label="Upcoming" />
              <FilterChip label="Finals" />
            </div>
            <div className="hidden sm:flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-500 pr-4">
              <span>View: Standard</span>
            </div>
          </div>

          {/* Matches List */}
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {filteredMatches.map((match) => (
                <motion.div 
                  key={match.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-slate-800/40 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300 group overflow-hidden"
                >
                  <div className="p-5 flex flex-col md:flex-row gap-6 md:items-center">
                    {/* Match Info */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        {match.isLive ? (
                          <div className="flex items-center bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-red-500/20">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5 animate-pulse" />
                            Live
                          </div>
                        ) : (
                          <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5">
                            <Clock size={12} /> Upcoming
                          </div>
                        )}
                        <span className="text-slate-500 text-[11px] font-bold uppercase tracking-tighter">
                          {match.league}
                        </span>
                        {match.isHot && <Flame size={14} className="text-orange-500 fill-orange-500" />}
                      </div>

                      <div className="flex items-center justify-between md:justify-start md:gap-12">
                        <div className="flex items-center gap-8">
                          <div className="space-y-1 text-center md:text-left min-w-[120px]">
                            <p className="font-display text-lg font-bold group-hover:text-yellow-500 transition-colors uppercase tracking-tight">{match.homeTeam}</p>
                            <p className="font-display text-lg font-bold group-hover:text-yellow-500 transition-colors uppercase tracking-tight">{match.awayTeam}</p>
                          </div>
                          <div className="bg-slate-900 px-3 py-1.5 rounded-lg flex flex-col items-center justify-center font-mono text-xl font-black text-yellow-500 min-w-[50px] shadow-inner">
                            <AnimatePresence mode="wait">
                              <motion.span 
                                key={`${match.id}-${match.homeScore}`} 
                                initial={{ opacity: 0, y: -10 }} 
                                animate={{ opacity: 1, y: 0 }}
                                className="leading-tight"
                              >
                                {match.homeScore}
                              </motion.span>
                            </AnimatePresence>
                            <AnimatePresence mode="wait">
                              <motion.span 
                                key={`${match.id}-${match.awayScore}`} 
                                initial={{ opacity: 0, y: 10 }} 
                                animate={{ opacity: 1, y: 0 }}
                                className="leading-tight"
                              >
                                {match.awayScore}
                              </motion.span>
                            </AnimatePresence>
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-2 text-slate-500 font-mono text-sm font-bold bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700/50">
                           {match.time}
                        </div>
                      </div>
                    </div>

                    {/* Odds */}
                    <div className="flex gap-4 items-center justify-between md:justify-end border-t md:border-t-0 border-slate-700/50 pt-4 md:pt-0">
                      <div className="flex gap-2">
                        <OddButton 
                          label="1" 
                          value={match.homeOdds} 
                          isSelected={betslip.some(s => s.matchId === match.id && s.marketLabel === '1')}
                          onClick={() => toggleSelection(match, '1', match.homeOdds)}
                        />
                        {match.drawOdds !== 0 && (
                          <OddButton 
                            label="X" 
                            value={match.drawOdds || 0} 
                            isSelected={betslip.some(s => s.matchId === match.id && s.marketLabel === 'X')}
                            onClick={() => toggleSelection(match, 'X', match.drawOdds || 0)}
                          />
                        )}
                        <OddButton 
                          label="2" 
                          value={match.awayOdds} 
                          isSelected={betslip.some(s => s.matchId === match.id && s.marketLabel === '2')}
                          onClick={() => toggleSelection(match, '2', match.awayOdds)}
                        />
                      </div>
                      <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-white transition group/stat">
                        <Activity size={20} className="group-hover/stat:scale-110 transition" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* Right Sidebar - Betslip */}
        <aside className={`
          fixed md:sticky bottom-0 md:top-22 right-0 left-0 md:left-auto md:w-96 z-50 
          transition-transform duration-300 ease-out
          ${showSlip || betslip.length > 0 ? 'translate-y-0' : 'translate-y-[calc(100%-60px)] md:translate-y-0'}
        `}>
          <div className="bg-slate-900 md:bg-slate-800/80 backdrop-blur-2xl rounded-t-3xl md:rounded-3xl border-t md:border border-slate-700 flex flex-col max-h-[80vh] md:max-h-[calc(100vh-120px)] shadow-2xl">
            {/* Slip Header */}
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/50 md:rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="relative">
                   <History size={20} className="text-yellow-500" />
                   {betslip.length > 0 && (
                     <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-black animate-bounce">
                       {betslip.length}
                     </span>
                   )}
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Betslip</h3>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setBetslip([])}
                  className="text-[10px] uppercase font-black text-slate-500 hover:text-red-500 transition"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Slip Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              {betslip.length === 0 ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-slate-700">
                    <History size={32} className="text-slate-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-400">Your betslip is empty</p>
                    <p className="text-xs text-slate-500">Pick some odds to get started!</p>
                  </div>
                </div>
              ) : (
                betslip.map((item) => (
                  <motion.div 
                    key={`${item.matchId}-${item.marketLabel}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-slate-700/30 p-3 rounded-xl border border-slate-700 group relative"
                  >
                    <button 
                      onClick={() => toggleSelection({ id: item.matchId } as any, item.marketLabel as any, item.odds)}
                      className="absolute top-2 right-2 text-slate-600 hover:text-white transition"
                    >
                      <X size={14} />
                    </button>
                    <div className="flex justify-between items-start mb-2">
                       <div>
                         <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-0.5">Match Result</p>
                         <h4 className="text-xs font-black uppercase tracking-tight">{item.teamName}</h4>
                       </div>
                       <motion.span 
                        key={item.odds}
                        initial={{ scale: 1.2, color: '#EAB308' }}
                        animate={{ scale: 1, color: '#FFFFFF' }}
                        className="font-mono text-sm font-bold bg-slate-700 px-1.5 py-0.5 rounded leading-none"
                       >
                         {item.odds.toFixed(2)}
                       </motion.span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                      <span>{item.opponentName}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Slip Bottom */}
            {betslip.length > 0 && (
              <div className="p-4 bg-slate-900/80 border-t border-slate-700 rounded-b-3xl space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    <span>Total Odds</span>
                    <span className="font-mono text-white text-sm">{totalOdds.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
                    <span className="text-xs font-black text-slate-400 pl-2">$</span>
                    <input 
                      type="number" 
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      className="bg-transparent border-none outline-none font-mono font-bold text-white w-full"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-end p-1">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Possible Win</span>
                  <span className="text-xl font-black text-yellow-500 font-mono tracking-tighter">
                    ${potentialPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <button 
                  onClick={handlePlaceBet}
                  disabled={isPlacingBet || parseFloat(stake) > balance}
                  className={`
                    w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-sm mt-2 transition-all transform active:scale-[0.98]
                    ${isPlacingBet || parseFloat(stake) > balance 
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                      : 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-xl shadow-yellow-500/10'}
                  `}
                >
                  {isPlacingBet ? (
                    <div className="flex items-center justify-center gap-2">
                      <Activity size={18} className="animate-spin" /> Placing...
                    </div>
                  ) : parseFloat(stake) > balance ? 'Insufficient Funds' : 'Place Bet'}
                </button>
                
                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest pt-2">
                  <ShieldCheck size={12} /> Encrypted Secure Bet
                </div>
              </div>
            )}

            {/* Mobile Expand Handle (Only visible on mobile when slip is small) */}
            <button 
              onClick={() => setShowSlip(!showSlip)}
              className="md:hidden h-1.5 w-12 bg-slate-700 rounded-full mx-auto my-2 shrink-0" 
            />
          </div>
        </aside>

      </main>

      {/* Ticker / Status Bar */}
      <footer className="bg-slate-900/50 border-t border-slate-800/50 h-10 px-6 flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-slate-600">
        <div className="flex gap-6 items-center">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            System Online
          </div>
          <div className="hidden sm:block">
            Realtime Socket: Connected
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5 text-yellow-500/50">
            <AlertCircle size={12} /> Gamble Responsibly
          </div>
          <span>v1.2.4 Elite</span>
        </div>
      </footer>
    </div>
  );
}

// --- Small Helper Components ---

function TrendingItem({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="group cursor-pointer">
      <p className="text-xs font-black text-slate-300 group-hover:text-yellow-500 transition-colors uppercase tracking-tight">{title}</p>
      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{subtitle}</p>
    </div>
  );
}

function FilterChip({ label, active, count }: { label: string; active?: boolean; count?: number }) {
  return (
    <button className={`
      whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all
      ${active ? 'bg-white text-black shadow-lg shadow-white/5' : 'bg-slate-800 text-slate-500 hover:text-white'}
    `}>
      {label} {count !== undefined && <span className={active ? 'text-black/50 ml-1' : 'ml-1 text-slate-600'}>({count})</span>}
    </button>
  );
}

