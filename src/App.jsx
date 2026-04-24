import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trophy, Plus, Users, Calendar, Award, X, Trash2, ChevronLeft, ChevronRight, Check, Pencil, Lock, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const DELETE_PASSWORD = 'soso1234';

const getMatchType = (players, allMembers) => {
  const getGender = (id) => {
    const m = allMembers.find(m => m.id === id);
    return m ? m.gender : null;
  };
  const genders = players.map(getGender);
  if (genders.some(g => !g)) return 'JB';
  const mCount = genders.filter(g => g === 'M').length;
  const fCount = genders.filter(g => g === 'F').length;
  if (mCount === 4) return 'MB';
  if (fCount === 4) return 'FB';
  if (mCount === 2 && fCount === 2) return 'MX';
  return 'JB';
};

const getMatchTypeLabel = (type) => {
  if (type === 'MB') return { label: '남복', color: 'bg-blue-100 text-blue-700' };
  if (type === 'FB') return { label: '여복', color: 'bg-pink-100 text-pink-700' };
  if (type === 'MX') return { label: '혼복', color: 'bg-purple-100 text-purple-700' };
  return { label: '잡복', color: 'bg-stone-100 text-stone-500' };
};

const isRanked = (type) => type === 'MB' || type === 'FB' || type === 'MX';

export default function App() {
  const [activeTab, setActiveTab] = useState('ranking');
  const [members, setMembers] = useState([]);
  const [guests, setGuests] = useState([
    { id: 'guest1', name: '게스트1', gender: 'M', isGuest: true },
    { id: 'guest2', name: '게스트2', gender: 'M', isGuest: true },
  ]);
  const [matches, setMatches] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);

  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberGender, setNewMemberGender] = useState('M');
  const [editingMember, setEditingMember] = useState(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberGender, setEditMemberGender] = useState('M');

  const [showAddMatch, setShowAddMatch] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [teamA1, setTeamA1] = useState('');
  const [teamA2, setTeamA2] = useState('');
  const [teamB1, setTeamB1] = useState('');
  const [teamB2, setTeamB2] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);

  const [showGuestConfig, setShowGuestConfig] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [attendanceOpen, setAttendanceOpen] = useState(true);

  // 분석 탭
  const [analysisPeriod, setAnalysisPeriod] = useState('all'); // 'all' | 'year'
  const [analysisSection, setAnalysisSection] = useState('partner'); // 'partner' | 'matchup' | 'synergy'

  useEffect(() => { loadData(); }, []);

  const allPlayers = [...members, ...guests];

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: m } = await supabase.from('members').select('*').order('created_at');
      const { data: mt } = await supabase.from('matches').select('*').order('created_at', { ascending: false });
      const { data: att } = await supabase.from('attendance').select('*');
      setMembers(m || []);
      setMatches((mt || []).map(x => ({
        id: x.id,
        teamA1: x.team_a1, teamA2: x.team_a2,
        teamB1: x.team_b1, teamB2: x.team_b2,
        scoreA: x.score_a, scoreB: x.score_b,
        date: x.match_date,
        confirmed: x.confirmed || false,
        matchType: x.match_type || 'JB'
      })));
      const attMap = {};
      (att || []).forEach(a => {
        if (!attMap[a.attend_date]) attMap[a.attend_date] = [];
        attMap[a.attend_date].push(a.member_id);
      });
      setAttendance(attMap);
    } catch (e) {
      alert('데이터 로딩 실패.');
    } finally {
      setLoading(false);
    }
  };

  const checkPassword = () => {
    const pw = prompt('비밀번호를 입력하세요:');
    if (pw !== DELETE_PASSWORD) { alert('비밀번호가 틀렸습니다.'); return false; }
    return true;
  };

  const addMember = async () => {
    if (!newMemberName.trim()) return;
    if (!checkPassword()) return;
    const newMember = { id: Date.now().toString(), name: newMemberName.trim(), gender: newMemberGender };
    const { error } = await supabase.from('members').insert(newMember);
    if (error) { alert('저장 실패: ' + error.message); return; }
    setMembers([...members, newMember]);
    setNewMemberName(''); setNewMemberGender('M');
    setShowAddMember(false);
  };

  const saveMember = async () => {
    if (!editMemberName.trim()) return;
    const { error } = await supabase.from('members').update({ name: editMemberName.trim(), gender: editMemberGender }).eq('id', editingMember.id);
    if (error) { alert('수정 실패: ' + error.message); return; }
    setMembers(members.map(m => m.id === editingMember.id ? { ...m, name: editMemberName.trim(), gender: editMemberGender } : m));
    setEditingMember(null);
  };

  const deleteMember = async (id) => {
    if (!checkPassword()) return;
    if (!confirm('이 멤버를 삭제하시겠습니까?')) return;
    await supabase.from('members').delete().eq('id', id);
    await supabase.from('attendance').delete().eq('member_id', id);
    await loadData();
  };

  const getAvailablePlayers = (date) => {
    const attendees = attendance[date] || [];
    const attendingMembers = members.filter(m => attendees.includes(m.id));
    return [...attendingMembers, ...guests];
  };

  const currentPlayers = [teamA1, teamA2, teamB1, teamB2].filter(Boolean);
  const currentMatchType = currentPlayers.length === 4 ? getMatchType(currentPlayers, allPlayers) : null;

  const isValidMatch = teamA1 && teamA2 && teamB1 && teamB2
    && new Set([teamA1, teamA2, teamB1, teamB2]).size === 4
    && scoreA !== '' && scoreB !== '';

  const openAddMatch = (date) => {
    setEditingMatch(null);
    setTeamA1(''); setTeamA2(''); setTeamB1(''); setTeamB2('');
    setScoreA(''); setScoreB('');
    setMatchDate(date || new Date().toISOString().split('T')[0]);
    setShowAddMatch(true);
  };

  const openEditMatch = (match) => {
    setEditingMatch(match);
    setTeamA1(match.teamA1); setTeamA2(match.teamA2);
    setTeamB1(match.teamB1); setTeamB2(match.teamB2);
    setScoreA(String(match.scoreA)); setScoreB(String(match.scoreB));
    setMatchDate(match.date);
    setShowAddMatch(true);
  };

  const saveMatch = async () => {
    if (!isValidMatch) return;
    const players = [teamA1, teamA2, teamB1, teamB2];
    const matchType = getMatchType(players, allPlayers);
    if (editingMatch) {
      const { error } = await supabase.from('matches').update({
        team_a1: teamA1, team_a2: teamA2, team_b1: teamB1, team_b2: teamB2,
        score_a: parseInt(scoreA), score_b: parseInt(scoreB),
        match_date: matchDate, match_type: matchType
      }).eq('id', editingMatch.id);
      if (error) { alert('수정 실패: ' + error.message); return; }
    } else {
      const newMatch = {
        id: Date.now().toString(),
        team_a1: teamA1, team_a2: teamA2, team_b1: teamB1, team_b2: teamB2,
        score_a: parseInt(scoreA), score_b: parseInt(scoreB),
        match_date: matchDate, confirmed: false, match_type: matchType
      };
      const { error } = await supabase.from('matches').insert(newMatch);
      if (error) { alert('저장 실패: ' + error.message); return; }
      const realPlayers = players.filter(id => !id.startsWith('guest'));
      if (realPlayers.length > 0) {
        await supabase.from('attendance').upsert(
          realPlayers.map(id => ({ attend_date: matchDate, member_id: id })),
          { onConflict: 'attend_date,member_id' }
        );
      }
    }
    setTeamA1(''); setTeamA2(''); setTeamB1(''); setTeamB2('');
    setScoreA(''); setScoreB('');
    setMatchDate(new Date().toISOString().split('T')[0]);
    setShowAddMatch(false); setEditingMatch(null);
    await loadData();
  };

  const deleteMatch = async (match) => {
    if (match.confirmed) { if (!checkPassword()) return; }
    if (!confirm('이 경기 기록을 삭제하시겠습니까?')) return;
    await supabase.from('matches').delete().eq('id', match.id);
    await loadData();
  };

  const confirmDateMatches = async (date) => {
    const dateMatches = matches.filter(m => m.date === date && !m.confirmed);
    if (dateMatches.length === 0) { alert('확정할 경기가 없습니다.'); return; }
    if (!confirm(`${date} 경기 ${dateMatches.length}개를 확정하시겠습니까?`)) return;
    await supabase.from('matches').update({ confirmed: true }).eq('match_date', date);
    await loadData();
  };

  const unconfirmDateMatches = async (date) => {
    if (!checkPassword()) return;
    await supabase.from('matches').update({ confirmed: false }).eq('match_date', date);
    await loadData();
  };

  const toggleAttendance = async (date, memberId) => {
    const current = attendance[date] || [];
    if (current.includes(memberId)) {
      await supabase.from('attendance').delete().eq('attend_date', date).eq('member_id', memberId);
    } else {
      await supabase.from('attendance').insert({ attend_date: date, member_id: memberId });
    }
    await loadData();
  };

  const getMemberName = (id) => {
    const guest = guests.find(g => g.id === id);
    if (guest) return guest.name;
    return members.find(m => m.id === id)?.name || '?';
  };

  const getGenderColor = (gender) => gender === 'M' ? 'text-blue-600' : 'text-pink-500';
  const getGenderBg = (gender) => gender === 'M' ? 'bg-blue-50 border-blue-200' : 'bg-pink-50 border-pink-200';
  const getGenderBadge = (gender) => gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-600';

  // 분석용 필터된 경기
  const currentYear = new Date().getFullYear();
  const filteredMatches = matches.filter(m => {
    if (!isRanked(m.matchType)) return false;
    if (analysisPeriod === 'year') return new Date(m.date).getFullYear() === currentYear;
    return true;
  });

  // 파트너 조합 분석
  const getPartnerStats = () => {
    const combos = {};
    filteredMatches.forEach(m => {
      const pairs = [
        { pair: [m.teamA1, m.teamA2].sort(), won: m.scoreA > m.scoreB, scoreFor: m.scoreA, scoreAgainst: m.scoreB },
        { pair: [m.teamB1, m.teamB2].sort(), won: m.scoreB > m.scoreA, scoreFor: m.scoreB, scoreAgainst: m.scoreA }
      ];
      pairs.forEach(({ pair, won, scoreFor, scoreAgainst }) => {
        const key = pair.join('|');
        if (!combos[key]) combos[key] = { ids: pair, wins: 0, losses: 0, totalScore: 0, totalAgainst: 0 };
        if (won) combos[key].wins++;
        else combos[key].losses++;
        combos[key].totalScore += scoreFor;
        combos[key].totalAgainst += scoreAgainst;
      });
    });
    return Object.values(combos).map(c => ({
      ...c,
      total: c.wins + c.losses,
      winRate: c.wins + c.losses > 0 ? (c.wins / (c.wins + c.losses) * 100) : 0,
      avgScore: c.wins + c.losses > 0 ? (c.totalScore / (c.wins + c.losses)).toFixed(1) : 0,
      name1: getMemberName(c.ids[0]),
      name2: getMemberName(c.ids[1])
    })).filter(c => c.total >= 1).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
  };

  // 매치업 분석
  const getMatchupStats = () => {
    const matchups = {};
    filteredMatches.forEach(m => {
      const teamA = [m.teamA1, m.teamA2].sort().join('|');
      const teamB = [m.teamB1, m.teamB2].sort().join('|');
      const key = [teamA, teamB].sort().join('||');
      if (!matchups[key]) {
        matchups[key] = {
          teamA: [m.teamA1, m.teamA2].sort(),
          teamB: [m.teamB1, m.teamB2].sort(),
          aWins: 0, bWins: 0
        };
      }
      const isAFirst = [m.teamA1, m.teamA2].sort().join('|') === matchups[key].teamA.join('|');
      if (m.scoreA > m.scoreB) { if (isAFirst) matchups[key].aWins++; else matchups[key].bWins++; }
      else { if (isAFirst) matchups[key].bWins++; else matchups[key].aWins++; }
    });
    return Object.values(matchups).map(m => ({
      ...m,
      total: m.aWins + m.bWins,
      teamAName: m.teamA.map(id => getMemberName(id)).join(' · '),
      teamBName: m.teamB.map(id => getMemberName(id)).join(' · ')
    })).filter(m => m.total >= 2).sort((a, b) => b.total - a.total);
  };

  // 개인 시너지
  const getSynergyStats = () => {
    return members.map(member => {
      const partnerStats = {};
      filteredMatches.forEach(m => {
        const inA = m.teamA1 === member.id || m.teamA2 === member.id;
        const inB = m.teamB1 === member.id || m.teamB2 === member.id;
        if (!inA && !inB) return;
        const partnerId = inA
          ? (m.teamA1 === member.id ? m.teamA2 : m.teamA1)
          : (m.teamB1 === member.id ? m.teamB2 : m.teamB1);
        const won = inA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
        if (!partnerStats[partnerId]) partnerStats[partnerId] = { wins: 0, losses: 0 };
        if (won) partnerStats[partnerId].wins++;
        else partnerStats[partnerId].losses++;
      });
      const partners = Object.entries(partnerStats).map(([id, s]) => ({
        id, name: getMemberName(id),
        ...s, total: s.wins + s.losses,
        winRate: s.wins + s.losses > 0 ? (s.wins / (s.wins + s.losses) * 100) : 0
      })).filter(p => p.total >= 1).sort((a, b) => b.winRate - a.winRate);
      return { ...member, partners };
    }).filter(m => m.partners.length > 0);
  };

  const partnerStats = getPartnerStats();
  const matchupStats = getMatchupStats();
  const synergyStats = getSynergyStats();

  const bestCombos = partnerStats.filter(c => c.total >= 2).slice(0, 3);
  const worstCombos = [...partnerStats].filter(c => c.total >= 2).sort((a, b) => a.winRate - b.winRate).slice(0, 3);
  const hiddenCombos = partnerStats.filter(c => c.total === 1 && c.winRate === 100).slice(0, 3);

  const getStats = () => {
    return members.map(member => {
      let wins = 0, losses = 0, gamesWon = 0, gamesLost = 0;
      let rankedWins = 0, rankedLosses = 0;
      matches.forEach(m => {
        const inA = m.teamA1 === member.id || m.teamA2 === member.id;
        const inB = m.teamB1 === member.id || m.teamB2 === member.id;
        if (!inA && !inB) return;
        const won = inA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
        if (won) { wins++; gamesWon += inA ? m.scoreA : m.scoreB; gamesLost += inA ? m.scoreB : m.scoreA; }
        else { losses++; gamesWon += inA ? m.scoreA : m.scoreB; gamesLost += inA ? m.scoreB : m.scoreA; }
        if (isRanked(m.matchType)) { if (won) rankedWins++; else rankedLosses++; }
      });
      const rankedTotal = rankedWins + rankedLosses;
      const winRate = rankedTotal > 0 ? (rankedWins / rankedTotal * 100) : 0;
      const attendanceCount = Object.values(attendance).filter(arr => arr.includes(member.id)).length;
      return { ...member, wins, losses, total: wins + losses, rankedWins, rankedLosses, rankedTotal, winRate, gamesWon, gamesLost, attendanceCount };
    }).sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.rankedWins !== a.rankedWins) return b.rankedWins - a.rankedWins;
      return (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost);
    });
  };

  const stats = getStats();

  const getDaysInMonth = (date) => {
    const year = date.getFullYear(), month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ day: i, dateStr });
    }
    return days;
  };

  const formatMonth = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  const changeMonth = (delta) => {
    const d = new Date(calendarMonth);
    d.setMonth(d.getMonth() + delta);
    setCalendarMonth(d);
  };

  const selectedDateMatches = selectedDate ? matches.filter(m => m.date === selectedDate) : [];
  const selectedDateAttendees = selectedDate ? (attendance[selectedDate] || []) : [];
  const isDateConfirmed = selectedDateMatches.length > 0 && selectedDateMatches.every(m => m.confirmed);
  const hasUnconfirmed = selectedDateMatches.some(m => !m.confirmed);
  const availablePlayers = showAddMatch ? getAvailablePlayers(matchDate) : [];

  const MemberSelect = ({ value, onChange, label, exclude = [] }) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="flex-1 px-3 py-2.5 border border-stone-300 rounded-lg bg-white text-sm">
      <option value="">{label}</option>
      {availablePlayers.map(m => (
        <option key={m.id} value={m.id} disabled={exclude.includes(m.id)}>
          {m.gender === 'M' ? '♂' : '♀'} {m.name}{m.isGuest ? ' (게스트)' : ''}
        </option>
      ))}
    </select>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 tracking-widest text-sm">LOADING...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.05) 20px, rgba(255,255,255,0.05) 40px)'
        }}></div>
        <div className="max-w-6xl mx-auto px-6 py-8 relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-yellow-300 flex items-center justify-center shadow-lg">
              <span className="text-2xl">🎾</span>
            </div>
            <div className="text-yellow-200 text-xs tracking-[0.3em] font-medium">SOSO TENNIS CLUB</div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">소소테니스클럽</h1>
          <p className="text-emerald-100 text-sm font-light">
            {currentYear}년 · 총 {matches.length}경기 · 멤버 {members.length}명
          </p>
        </div>
      </header>

      {/* 탭 */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-stone-200 overflow-x-auto">
          {[
            { id: 'ranking', label: '랭킹', icon: Trophy },
            { id: 'calendar', label: '캘린더', icon: Calendar },
            { id: 'analysis', label: '분석', icon: BarChart2 },
            { id: 'matches', label: '경기', icon: Trophy },
            { id: 'members', label: '멤버', icon: Users }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-2.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-emerald-800 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}>
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-32">

        {/* 분석 탭 */}
        {activeTab === 'analysis' && (
          <div className="space-y-4">
            {/* 기간 선택 */}
            <div className="flex gap-2">
              <button onClick={() => setAnalysisPeriod('all')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${analysisPeriod === 'all' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-white text-stone-600 border-stone-200'}`}>
                전체 기간
              </button>
              <button onClick={() => setAnalysisPeriod('year')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${analysisPeriod === 'year' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-white text-stone-600 border-stone-200'}`}>
                {currentYear}년
              </button>
            </div>

            <div className="text-xs text-stone-400 px-1">※ 남복·여복·혼복 기준 (잡복 제외) · 랭킹 반영 경기 {filteredMatches.length}개</div>

            {/* 섹션 선택 */}
            <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
              {[
                { id: 'partner', label: '🤝 파트너 조합' },
                { id: 'matchup', label: '⚔️ 매치업' },
                { id: 'synergy', label: '✨ 개인 시너지' }
              ].map(s => (
                <button key={s.id} onClick={() => setAnalysisSection(s.id)}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${analysisSection === s.id ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'}`}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* 파트너 조합 */}
            {analysisSection === 'partner' && (
              <div className="space-y-4">
                {filteredMatches.length === 0 ? (
                  <EmptyState icon={BarChart2} title="데이터가 없습니다" desc="경기를 기록하면 분석이 시작돼요" />
                ) : (
                  <>
                    {/* 베스트 조합 */}
                    {bestCombos.length > 0 && (
                      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-stone-100 bg-emerald-50">
                          <h3 className="font-bold text-emerald-800 text-sm">🔥 베스트 조합 (2경기 이상)</h3>
                        </div>
                        <div className="divide-y divide-stone-100">
                          {bestCombos.map((c, i) => (
                            <div key={i} className="px-4 py-3 flex items-center gap-3">
                              <div className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-stone-800 text-sm">{c.name1} · {c.name2}</div>
                                <div className="text-xs text-stone-500">{c.wins}승 {c.losses}패 · 평균 {c.avgScore}점</div>
                              </div>
                              <div className="text-xl font-bold text-emerald-700">{c.winRate.toFixed(0)}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 워스트 조합 */}
                    {worstCombos.length > 0 && (
                      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-stone-100 bg-red-50">
                          <h3 className="font-bold text-red-700 text-sm">⚠️ 워스트 조합 (2경기 이상)</h3>
                        </div>
                        <div className="divide-y divide-stone-100">
                          {worstCombos.map((c, i) => (
                            <div key={i} className="px-4 py-3 flex items-center gap-3">
                              <div className="text-lg">💀</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-stone-800 text-sm">{c.name1} · {c.name2}</div>
                                <div className="text-xs text-stone-500">{c.wins}승 {c.losses}패 · 평균 {c.avgScore}점</div>
                              </div>
                              <div className="text-xl font-bold text-red-500">{c.winRate.toFixed(0)}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 숨은 꿀조합 */}
                    {hiddenCombos.length > 0 && (
                      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-stone-100 bg-yellow-50">
                          <h3 className="font-bold text-yellow-700 text-sm">📈 숨은 꿀조합 (1경기, 전승)</h3>
                        </div>
                        <div className="divide-y divide-stone-100">
                          {hiddenCombos.map((c, i) => (
                            <div key={i} className="px-4 py-3 flex items-center gap-3">
                              <div className="text-lg">💎</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-stone-800 text-sm">{c.name1} · {c.name2}</div>
                                <div className="text-xs text-stone-500">{c.wins}승 {c.losses}패</div>
                              </div>
                              <div className="text-xl font-bold text-yellow-600">100%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 전체 조합 테이블 */}
                    <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-stone-100">
                        <h3 className="font-bold text-stone-800 text-sm">📊 전체 조합 순위</h3>
                      </div>
                      <div className="divide-y divide-stone-100">
                        {partnerStats.map((c, i) => (
                          <div key={i} className="px-4 py-3 flex items-center gap-3">
                            <div className="text-xs text-stone-400 w-5">{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-stone-800">{c.name1} · {c.name2}</div>
                              <div className="text-xs text-stone-400">{c.total}경기 · {c.wins}승 {c.losses}패</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className={`text-base font-bold ${c.winRate >= 60 ? 'text-emerald-600' : c.winRate >= 40 ? 'text-stone-600' : 'text-red-500'}`}>
                                {c.winRate.toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        ))}
                        {partnerStats.length === 0 && (
                          <div className="px-4 py-8 text-center text-sm text-stone-400">아직 데이터가 없어요</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 매치업 분석 */}
            {analysisSection === 'matchup' && (
              <div className="space-y-3">
                {matchupStats.length === 0 ? (
                  <EmptyState icon={BarChart2} title="2경기 이상 맞붙은 조합이 없어요" desc="같은 조합으로 더 많이 경기하면 보여요" />
                ) : (
                  <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-stone-100">
                      <h3 className="font-bold text-stone-800 text-sm">⚔️ 매치업 전적 (2경기 이상)</h3>
                    </div>
                    <div className="divide-y divide-stone-100">
                      {matchupStats.map((m, i) => (
                        <div key={i} className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`flex-1 text-sm min-w-0 ${m.aWins > m.bWins ? 'font-bold text-emerald-800' : 'text-stone-500'}`}>
                              <div className="truncate">{m.teamAName}</div>
                            </div>
                            <div className="flex-shrink-0 text-center">
                              <div className="font-mono font-bold text-stone-800 bg-stone-100 px-3 py-1 rounded text-sm">
                                {m.aWins} : {m.bWins}
                              </div>
                              <div className="text-xs text-stone-400 mt-0.5">{m.total}경기</div>
                            </div>
                            <div className={`flex-1 text-sm text-right min-w-0 ${m.bWins > m.aWins ? 'font-bold text-emerald-800' : 'text-stone-500'}`}>
                              <div className="truncate">{m.teamBName}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 개인 시너지 */}
            {analysisSection === 'synergy' && (
              <div className="space-y-3">
                {synergyStats.length === 0 ? (
                  <EmptyState icon={BarChart2} title="데이터가 없습니다" desc="경기를 기록하면 분석이 시작돼요" />
                ) : (
                  synergyStats.map(member => (
                    <div key={member.id} className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                      <div className={`px-4 py-3 border-b border-stone-100 ${getGenderBg(member.gender)}`}>
                        <h3 className={`font-bold text-sm flex items-center gap-2 ${getGenderColor(member.gender)}`}>
                          {member.gender === 'M' ? '♂' : '♀'} {member.name}
                          <span className="text-xs font-normal text-stone-500">누구랑 잘 맞나요?</span>
                        </h3>
                      </div>
                      <div className="divide-y divide-stone-100">
                        {member.partners.map((p, i) => (
                          <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                            <div className="flex-1 text-sm text-stone-700">{p.name}</div>
                            <div className="text-xs text-stone-400">{p.total}경기 · {p.wins}승 {p.losses}패</div>
                            <div className={`text-base font-bold w-14 text-right ${p.winRate >= 60 ? 'text-emerald-600' : p.winRate >= 40 ? 'text-stone-600' : 'text-red-500'}`}>
                              {p.winRate.toFixed(0)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* 캘린더 */}
        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-stone-100 rounded-full"><ChevronLeft size={18} /></button>
                <h2 className="text-lg font-bold text-stone-800">{formatMonth(calendarMonth)}</h2>
                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-stone-100 rounded-full"><ChevronRight size={18} /></button>
              </div>
              <div className="grid grid-cols-7 border-b border-stone-100">
                {['일','월','화','수','목','금','토'].map((d, i) => (
                  <div key={d} className={`text-center text-xs font-semibold py-2 ${i===0?'text-red-500':i===6?'text-blue-500':'text-stone-500'}`}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {getDaysInMonth(calendarMonth).map((d, idx) => {
                  if (!d) return <div key={idx} className="aspect-square border-b border-r border-stone-50"></div>;
                  const dayAtt = attendance[d.dateStr] || [];
                  const dayMatches = matches.filter(m => m.date === d.dateStr);
                  const allConfirmed = dayMatches.length > 0 && dayMatches.every(m => m.confirmed);
                  const isToday = d.dateStr === new Date().toISOString().split('T')[0];
                  const isSelected = selectedDate === d.dateStr;
                  const weekday = idx % 7;
                  return (
                    <button key={idx} onClick={() => setSelectedDate(d.dateStr)}
                      className={`aspect-square border-b border-r border-stone-50 p-1.5 text-left relative hover:bg-emerald-50 ${isSelected ? 'bg-emerald-100 ring-2 ring-emerald-600 ring-inset' : ''}`}>
                      <div className={`text-sm font-medium ${isToday ? 'bg-emerald-800 text-white w-6 h-6 rounded-full flex items-center justify-center' : weekday===0?'text-red-500':weekday===6?'text-blue-500':'text-stone-700'}`}>
                        {d.day}
                      </div>
                      {(dayAtt.length > 0 || dayMatches.length > 0) && (
                        <div className="absolute bottom-1 left-1 right-1 flex flex-col gap-0.5">
                          {dayAtt.length > 0 && <div className="text-[10px] bg-emerald-100 text-emerald-800 rounded px-1 py-0.5 font-medium flex items-center gap-0.5"><Users size={8}/>{dayAtt.length}</div>}
                          {dayMatches.length > 0 && (
                            <div className={`text-[10px] rounded px-1 py-0.5 font-medium flex items-center gap-0.5 ${allConfirmed ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {allConfirmed ? <Lock size={8}/> : '🎾'} {dayMatches.length}
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 text-xs text-stone-500 px-1">
              <div className="flex items-center gap-1"><span className="bg-emerald-100 text-emerald-800 rounded px-1.5 py-0.5 font-medium"><Users size={10} className="inline"/> N</span> 참석</div>
              <div className="flex items-center gap-1"><span className="bg-yellow-100 text-yellow-800 rounded px-1.5 py-0.5 font-medium">🎾 N</span> 경기</div>
              <div className="flex items-center gap-1"><span className="bg-blue-100 text-blue-800 rounded px-1.5 py-0.5 font-medium"><Lock size={10} className="inline"/> N</span> 확정</div>
            </div>

            {selectedDate && (
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                  <h3 className="font-bold text-stone-800 flex items-center gap-2">
                    {selectedDate.replace(/-/g, '.')}
                    {isDateConfirmed && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Lock size={10}/>확정</span>}
                  </h3>
                  <button onClick={() => setSelectedDate(null)}><X size={16} className="text-stone-400" /></button>
                </div>
                <div className="p-4 space-y-4">
                  {/* 참석자 접었다 폈다 */}
                  <div className="border border-stone-200 rounded-lg overflow-hidden">
                    <button onClick={() => setAttendanceOpen(!attendanceOpen)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-stone-50 text-sm font-semibold text-stone-700">
                      <div className="flex items-center gap-1.5"><Users size={14} />참석자 ({selectedDateAttendees.length}명)</div>
                      {attendanceOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {attendanceOpen && (
                      <div className="p-3 grid grid-cols-2 gap-2">
                        {members.map(m => {
                          const attended = selectedDateAttendees.includes(m.id);
                          return (
                            <button key={m.id} onClick={() => toggleAttendance(selectedDate, m.id)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${attended ? `${getGenderBg(m.gender)} font-medium` : 'bg-white border-stone-200 text-stone-600'}`}>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${attended ? 'bg-emerald-600 border-emerald-600' : 'border-stone-300'}`}>
                                {attended && <Check size={12} className="text-white" />}
                              </div>
                              <span className={`truncate ${attended ? getGenderColor(m.gender) : ''}`}>{m.name}</span>
                              <span className={`text-xs px-1 rounded ml-auto flex-shrink-0 ${getGenderBadge(m.gender)}`}>{m.gender === 'M' ? '남' : '여'}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 경기 목록 */}
                  {selectedDateMatches.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-stone-700 mb-2">🎾 경기 ({selectedDateMatches.length})</div>
                      <div className="space-y-2">
                        {selectedDateMatches.map(match => {
                          const typeInfo = getMatchTypeLabel(match.matchType);
                          return (
                            <div key={match.id} className={`p-3 rounded-lg border ${match.confirmed ? 'bg-blue-50 border-blue-200' : 'bg-stone-50 border-stone-200'}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                                {match.confirmed
                                  ? <span className="text-xs text-blue-600 flex items-center gap-0.5"><Lock size={10}/>확정</span>
                                  : <span className="text-xs text-stone-400">미확정</span>}
                                {!isRanked(match.matchType) && <span className="text-xs text-stone-400">미반영</span>}
                                <div className="flex-1"></div>
                                {!match.confirmed && <button onClick={() => openEditMatch(match)} className="text-stone-400 p-1"><Pencil size={13}/></button>}
                                <button onClick={() => deleteMatch(match)} className="text-stone-300 p-1"><Trash2 size={13}/></button>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`flex-1 text-sm min-w-0 ${match.scoreA > match.scoreB ? 'font-bold text-emerald-800' : 'text-stone-500'}`}>
                                  <div className="truncate">{getMemberName(match.teamA1)}</div>
                                  <div className="truncate">{getMemberName(match.teamA2)}</div>
                                </div>
                                <div className="font-mono font-bold text-stone-700 bg-white px-2 py-1 rounded border border-stone-200 text-sm flex-shrink-0">
                                  {match.scoreA} - {match.scoreB}
                                </div>
                                <div className={`flex-1 text-sm text-right min-w-0 ${match.scoreB > match.scoreA ? 'font-bold text-emerald-800' : 'text-stone-500'}`}>
                                  <div className="truncate">{getMemberName(match.teamB1)}</div>
                                  <div className="truncate">{getMemberName(match.teamB2)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {members.length >= 2 && (
                      <button onClick={() => openAddMatch(selectedDate)}
                        className="w-full py-2.5 border border-dashed border-stone-300 rounded-lg text-sm text-stone-600 flex items-center justify-center gap-1.5">
                        <Plus size={14} /> 경기 추가
                      </button>
                    )}
                    {selectedDateMatches.length > 0 && (
                      isDateConfirmed ? (
                        <button onClick={() => unconfirmDateMatches(selectedDate)}
                          className="w-full py-2.5 bg-stone-100 border border-stone-300 rounded-lg text-sm text-stone-600 flex items-center justify-center gap-1.5">
                          <Lock size={14} /> 확정 해제 (비번 필요)
                        </button>
                      ) : hasUnconfirmed ? (
                        <button onClick={() => confirmDateMatches(selectedDate)}
                          className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5">
                          <Lock size={14} /> 오늘 경기 확정하기
                        </button>
                      ) : null
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 랭킹 */}
        {activeTab === 'ranking' && (
          <div className="space-y-4">
            {stats.length === 0 ? (
              <EmptyState icon={Trophy} title="아직 멤버가 없습니다" desc="멤버를 추가하고 경기를 기록해보세요" />
            ) : (
              <>
                {stats.filter(s => s.rankedTotal > 0).length >= 3 && (
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[1, 0, 2].map((idx, pos) => {
                      const player = stats.filter(s => s.rankedTotal > 0)[idx];
                      if (!player) return <div key={idx}></div>;
                      const colors = [
                        { bg: 'bg-gradient-to-br from-yellow-400 to-yellow-600', text: 'text-yellow-900', medal: '🥇', label: '1위' },
                        { bg: 'bg-gradient-to-br from-stone-300 to-stone-400', text: 'text-stone-800', medal: '🥈', label: '2위' },
                        { bg: 'bg-gradient-to-br from-amber-600 to-amber-800', text: 'text-amber-50', medal: '🥉', label: '3위' }
                      ];
                      const c = colors[idx];
                      const heights = ['h-32', 'h-40', 'h-28'];
                      return (
                        <div key={player.id} className="flex flex-col items-center">
                          <div className="text-3xl mb-1">{c.medal}</div>
                          <div className={`text-xs font-bold mb-1 truncate max-w-full px-1 ${getGenderColor(player.gender)}`}>{player.name}</div>
                          <div className={`${c.bg} ${c.text} ${heights[pos]} w-full rounded-t-lg flex flex-col items-center justify-center shadow-md`}>
                            <div className="text-xs font-bold opacity-80">{c.label}</div>
                            <div className="text-2xl font-bold">{player.winRate.toFixed(0)}%</div>
                            <div className="text-xs opacity-90">{player.rankedWins}승 {player.rankedLosses}패</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-stone-800">전체 랭킹</h2>
                    <div className="text-xs text-stone-400">남복·혼복·여복만 반영</div>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {stats.map((player, idx) => (
                      <div key={player.id} className="px-4 py-3 flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          idx===0?'bg-yellow-100 text-yellow-700':idx===1?'bg-stone-100 text-stone-700':idx===2?'bg-amber-100 text-amber-700':'bg-stone-50 text-stone-500'
                        }`}>{idx + 1}</div>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${player.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-600'}`}>
                          {player.gender === 'M' ? '♂' : '♀'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold truncate ${getGenderColor(player.gender)}`}>{player.name}</div>
                          <div className="text-xs text-stone-500 mt-0.5">
                            {player.rankedTotal === 0 ? `랭킹경기 없음 · 출석 ${player.attendanceCount}회` : `${player.rankedWins}승 ${player.rankedLosses}패 · 출석 ${player.attendanceCount}회`}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xl font-bold text-emerald-700">{player.rankedTotal === 0 ? '-' : `${player.winRate.toFixed(1)}%`}</div>
                          <div className="text-xs text-stone-400">승률</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {stats.some(s => s.rankedTotal > 0 || s.attendanceCount > 0) && (
                  <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Award className="text-yellow-300" size={20} />
                      <h3 className="text-lg font-bold">{currentYear} 소소테니스클럽 연말 시상</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <AwardCard label="MVP · 최고 승률" winner={stats.filter(s=>s.rankedTotal>0)[0]?.name} value={stats.filter(s=>s.rankedTotal>0)[0] ? `${stats.filter(s=>s.rankedTotal>0)[0].winRate.toFixed(1)}%` : '-'} />
                      <AwardCard label="다승왕" winner={[...stats].sort((a,b)=>b.rankedWins-a.rankedWins)[0]?.name} value={`${[...stats].sort((a,b)=>b.rankedWins-a.rankedWins)[0]?.rankedWins||0}승`} />
                      <AwardCard label="개근상 · 최다 출석" winner={[...stats].sort((a,b)=>b.attendanceCount-a.attendanceCount)[0]?.name} value={`${[...stats].sort((a,b)=>b.attendanceCount-a.attendanceCount)[0]?.attendanceCount||0}회`} />
                      <AwardCard label="베스트 파트너 조합" winner={bestCombos[0] ? `${bestCombos[0].name1} · ${bestCombos[0].name2}` : '-'} value={bestCombos[0] ? `${bestCombos[0].winRate.toFixed(0)}% (${bestCombos[0].total}경기)` : '-'} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 경기 목록 */}
        {activeTab === 'matches' && (
          <div>
            {matches.length === 0 ? (
              <EmptyState icon={Calendar} title="경기 기록이 없습니다" desc="캘린더에서 날짜를 선택해 경기를 추가하세요" />
            ) : (
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-stone-200 bg-stone-50">
                  <h2 className="text-lg font-bold text-stone-800">경기 기록 ({matches.length})</h2>
                </div>
                <div className="divide-y divide-stone-100">
                  {matches.map(match => {
                    const typeInfo = getMatchTypeLabel(match.matchType);
                    return (
                      <div key={match.id} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-stone-400 font-mono">{match.date.slice(5)}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                          {match.confirmed
                            ? <span className="text-xs text-blue-500 flex items-center gap-0.5"><Lock size={9}/>확정</span>
                            : <span className="text-xs text-stone-300">미확정</span>}
                          <div className="flex-1"></div>
                          {!match.confirmed && <button onClick={() => openEditMatch(match)} className="text-stone-300 p-1"><Pencil size={13}/></button>}
                          <button onClick={() => deleteMatch(match)} className="text-stone-300 p-1"><Trash2 size={13}/></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`flex-1 text-sm min-w-0 ${match.scoreA > match.scoreB ? 'font-bold text-emerald-800' : 'text-stone-500'}`}>
                            <div className="truncate">{getMemberName(match.teamA1)}</div>
                            <div className="truncate">{getMemberName(match.teamA2)}</div>
                          </div>
                          <div className="font-mono font-bold text-stone-700 bg-stone-100 px-3 py-1.5 rounded text-sm flex-shrink-0">
                            {match.scoreA} - {match.scoreB}
                          </div>
                          <div className={`flex-1 text-sm text-right min-w-0 ${match.scoreB > match.scoreA ? 'font-bold text-emerald-800' : 'text-stone-500'}`}>
                            <div className="truncate">{getMemberName(match.teamB1)}</div>
                            <div className="truncate">{getMemberName(match.teamB2)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 멤버 */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <button onClick={() => setShowGuestConfig(!showGuestConfig)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-stone-700">
                <div className="flex items-center gap-2"><Users size={15} />게스트 설정</div>
                {showGuestConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showGuestConfig && (
                <div className="px-4 pb-4 space-y-3 border-t border-stone-100 pt-3">
                  {guests.map((guest, i) => (
                    <div key={guest.id} className="flex items-center gap-2">
                      <div className="text-sm text-stone-600 w-16 flex-shrink-0">{i === 0 ? '게스트1' : '게스트2'}</div>
                      <input type="text" value={guest.name}
                        onChange={e => setGuests(guests.map(g => g.id === guest.id ? { ...g, name: e.target.value } : g))}
                        className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm" placeholder="이름" />
                      <div className="flex rounded-lg border border-stone-300 overflow-hidden flex-shrink-0">
                        <button onClick={() => setGuests(guests.map(g => g.id === guest.id ? { ...g, gender: 'M' } : g))}
                          className={`px-3 py-2 text-sm font-medium ${guest.gender === 'M' ? 'bg-blue-500 text-white' : 'bg-white text-stone-600'}`}>남</button>
                        <button onClick={() => setGuests(guests.map(g => g.id === guest.id ? { ...g, gender: 'F' } : g))}
                          className={`px-3 py-2 text-sm font-medium ${guest.gender === 'F' ? 'bg-pink-500 text-white' : 'bg-white text-stone-600'}`}>여</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {stats.length === 0 ? (
              <EmptyState icon={Users} title="멤버를 추가해주세요" desc="아래 + 버튼으로 멤버를 추가하세요" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {stats.map(member => (
                  <div key={member.id} className={`bg-white rounded-lg border p-4 flex items-center gap-4 ${getGenderBg(member.gender)}`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${member.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-600'}`}>
                      {member.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`font-semibold truncate ${getGenderColor(member.gender)}`}>{member.name}</div>
                        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${getGenderBadge(member.gender)}`}>{member.gender === 'M' ? '남' : '여'}</span>
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {member.rankedTotal === 0 ? `출석 ${member.attendanceCount}회` : `${member.rankedWins}승 ${member.rankedLosses}패 · 출석 ${member.attendanceCount}회`}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingMember(member); setEditMemberName(member.name); setEditMemberGender(member.gender); }} className="text-stone-400 p-2">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => deleteMember(member.id)} className="text-stone-300 p-2">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FABs */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-20">
        {activeTab === 'members' && (
          <button onClick={() => setShowAddMember(true)} className="bg-emerald-800 text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-2">
            <Plus size={18} /><span className="font-medium text-sm">멤버 추가</span>
          </button>
        )}
        {(activeTab === 'matches' || activeTab === 'ranking') && members.length >= 2 && (
          <button onClick={() => openAddMatch()} className="bg-emerald-800 text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-2">
            <Plus size={18} /><span className="font-medium text-sm">경기 기록</span>
          </button>
        )}
      </div>

      {/* 멤버 추가 모달 */}
      {showAddMember && (
        <Modal onClose={() => setShowAddMember(false)} title="멤버 추가">
          <div className="space-y-3 mb-4">
            <input type="text" value={newMemberName} onChange={e => setNewMemberName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMember()}
              placeholder="이름" autoFocus className="w-full px-4 py-3 border border-stone-300 rounded-lg" />
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">성별</label>
              <div className="flex rounded-lg border border-stone-300 overflow-hidden">
                <button onClick={() => setNewMemberGender('M')} className={`flex-1 py-2.5 text-sm font-medium ${newMemberGender === 'M' ? 'bg-blue-500 text-white' : 'bg-white text-stone-600'}`}>♂ 남자</button>
                <button onClick={() => setNewMemberGender('F')} className={`flex-1 py-2.5 text-sm font-medium ${newMemberGender === 'F' ? 'bg-pink-500 text-white' : 'bg-white text-stone-600'}`}>♀ 여자</button>
              </div>
            </div>
          </div>
          <div className="text-xs text-stone-400 mb-3">* 멤버 추가 시 비밀번호가 필요합니다</div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddMember(false)} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
            <button onClick={addMember} className="flex-1 px-4 py-2.5 bg-emerald-800 text-white rounded-lg font-medium">추가</button>
          </div>
        </Modal>
      )}

      {/* 멤버 수정 모달 */}
      {editingMember && (
        <Modal onClose={() => setEditingMember(null)} title="멤버 수정">
          <div className="space-y-3 mb-4">
            <input type="text" value={editMemberName} onChange={e => setEditMemberName(e.target.value)}
              autoFocus className="w-full px-4 py-3 border border-stone-300 rounded-lg" />
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">성별</label>
              <div className="flex rounded-lg border border-stone-300 overflow-hidden">
                <button onClick={() => setEditMemberGender('M')} className={`flex-1 py-2.5 text-sm font-medium ${editMemberGender === 'M' ? 'bg-blue-500 text-white' : 'bg-white text-stone-600'}`}>♂ 남자</button>
                <button onClick={() => setEditMemberGender('F')} className={`flex-1 py-2.5 text-sm font-medium ${editMemberGender === 'F' ? 'bg-pink-500 text-white' : 'bg-white text-stone-600'}`}>♀ 여자</button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditingMember(null)} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
            <button onClick={saveMember} className="flex-1 px-4 py-2.5 bg-emerald-800 text-white rounded-lg font-medium">저장</button>
          </div>
        </Modal>
      )}

      {/* 경기 추가/수정 모달 */}
      {showAddMatch && (
        <Modal onClose={() => { setShowAddMatch(false); setEditingMatch(null); }} title={editingMatch ? '경기 수정' : '경기 기록'}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">경기일</label>
              <input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-lg" />
            </div>
            {currentMatchType && (
              <div className={`text-center text-sm font-bold py-2 rounded-lg ${getMatchTypeLabel(currentMatchType).color}`}>
                {getMatchTypeLabel(currentMatchType).label}
                {!isRanked(currentMatchType) && ' · 랭킹 미반영'}
              </div>
            )}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-emerald-800">🏆 팀 A</label>
                {scoreA !== '' && scoreB !== '' && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${parseInt(scoreA) > parseInt(scoreB) ? 'bg-emerald-200 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}>
                    {parseInt(scoreA) > parseInt(scoreB) ? '승' : '패'}
                  </span>
                )}
              </div>
              <div className="flex gap-2 mb-2">
                <MemberSelect value={teamA1} onChange={setTeamA1} label="선수 1" exclude={[teamA2, teamB1, teamB2].filter(Boolean)} />
                <MemberSelect value={teamA2} onChange={setTeamA2} label="선수 2" exclude={[teamA1, teamB1, teamB2].filter(Boolean)} />
              </div>
              <input type="number" min="0" value={scoreA} onChange={e => setScoreA(e.target.value)}
                placeholder="팀 A 게임 수" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center font-mono text-lg" />
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-stone-600">팀 B</label>
                {scoreA !== '' && scoreB !== '' && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${parseInt(scoreB) > parseInt(scoreA) ? 'bg-emerald-200 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}>
                    {parseInt(scoreB) > parseInt(scoreA) ? '승' : '패'}
                  </span>
                )}
              </div>
              <div className="flex gap-2 mb-2">
                <MemberSelect value={teamB1} onChange={setTeamB1} label="선수 1" exclude={[teamA1, teamA2, teamB2].filter(Boolean)} />
                <MemberSelect value={teamB2} onChange={setTeamB2} label="선수 2" exclude={[teamA1, teamA2, teamB1].filter(Boolean)} />
              </div>
              <input type="number" min="0" value={scoreB} onChange={e => setScoreB(e.target.value)}
                placeholder="팀 B 게임 수" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center font-mono text-lg" />
            </div>
            {availablePlayers.length < 4 && (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ 참석자가 부족해요. 캘린더에서 참석자를 먼저 체크해주세요. 게스트 2명은 항상 선택 가능해요.
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={() => { setShowAddMatch(false); setEditingMatch(null); }} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
            <button onClick={saveMatch} disabled={!isValidMatch} className="flex-1 px-4 py-2.5 bg-emerald-800 text-white rounded-lg font-medium disabled:bg-stone-300">
              {editingMatch ? '수정 완료' : '저장'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AwardCard({ label, winner, value }) {
  return (
    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
      <div className="text-xs text-yellow-200 tracking-wider mb-1">{label}</div>
      <div className="text-base font-bold truncate">{winner || '-'}</div>
      <div className="text-xs text-stone-300 mt-0.5">{value}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="bg-white rounded-lg border border-dashed border-stone-300 py-16 px-6 text-center">
      <Icon className="mx-auto text-stone-300 mb-3" size={40} />
      <div className="font-semibold text-stone-700 mb-1">{title}</div>
      <div className="text-sm text-stone-500">{desc}</div>
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-stone-800">{title}</h3>
          <button onClick={onClose} className="text-stone-400 p-1"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
