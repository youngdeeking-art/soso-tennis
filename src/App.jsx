import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trophy, Plus, Users, Calendar, Award, X, Trash2, ChevronLeft, ChevronRight, Check } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function App() {
  const [activeTab, setActiveTab] = useState('ranking');
  const [members, setMembers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  
  const [winnerId, setWinnerId] = useState('');
  const [loserId, setLoserId] = useState('');
  const [winnerGames, setWinnerGames] = useState('');
  const [loserGames, setLoserGames] = useState('');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);

  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: m } = await supabase.from('members').select('*').order('created_at');
      const { data: mt } = await supabase.from('matches').select('*').order('created_at', { ascending: false });
      const { data: att } = await supabase.from('attendance').select('*');
      
      setMembers(m || []);
      setMatches((mt || []).map(x => ({
        id: x.id,
        winnerId: x.winner_id,
        loserId: x.loser_id,
        winnerGames: x.winner_games,
        loserGames: x.loser_games,
        date: x.match_date
      })));
      
      const attMap = {};
      (att || []).forEach(a => {
        if (!attMap[a.attend_date]) attMap[a.attend_date] = [];
        attMap[a.attend_date].push(a.member_id);
      });
      setAttendance(attMap);
    } catch (e) {
      console.error('Load error:', e);
      alert('데이터 로딩 실패. 연결을 확인하세요.');
    } finally {
      setLoading(false);
    }
  };

  const addMember = async () => {
    if (!newMemberName.trim()) return;
    const newMember = { id: Date.now().toString(), name: newMemberName.trim() };
    const { error } = await supabase.from('members').insert(newMember);
    if (error) { alert('저장 실패: ' + error.message); return; }
    setMembers([...members, newMember]);
    setNewMemberName('');
    setShowAddMember(false);
  };

  const deleteMember = async (id) => {
    if (!confirm('이 멤버를 삭제하면 관련 경기 및 참석 기록도 모두 삭제됩니다. 계속하시겠습니까?')) return;
    await supabase.from('members').delete().eq('id', id);
    await supabase.from('matches').delete().or(`winner_id.eq.${id},loser_id.eq.${id}`);
    await supabase.from('attendance').delete().eq('member_id', id);
    await loadData();
  };

  const addMatch = async () => {
    if (!winnerId || !loserId || winnerId === loserId || !winnerGames || !loserGames) return;
    const newMatch = {
      id: Date.now().toString(),
      winner_id: winnerId,
      loser_id: loserId,
      winner_games: parseInt(winnerGames),
      loser_games: parseInt(loserGames),
      match_date: matchDate
    };
    const { error } = await supabase.from('matches').insert(newMatch);
    if (error) { alert('저장 실패: ' + error.message); return; }
    
    // 경기 참여자 자동 참석 처리
    await supabase.from('attendance').upsert([
      { attend_date: matchDate, member_id: winnerId },
      { attend_date: matchDate, member_id: loserId }
    ], { onConflict: 'attend_date,member_id' });
    
    setWinnerId(''); setLoserId(''); setWinnerGames(''); setLoserGames('');
    setMatchDate(new Date().toISOString().split('T')[0]);
    setShowAddMatch(false);
    await loadData();
  };

  const deleteMatch = async (id) => {
    if (!confirm('이 경기 기록을 삭제하시겠습니까?')) return;
    await supabase.from('matches').delete().eq('id', id);
    await loadData();
  };

  const toggleAttendance = async (date, memberId) => {
    const current = attendance[date] || [];
    const isAttending = current.includes(memberId);
    
    if (isAttending) {
      await supabase.from('attendance').delete()
        .eq('attend_date', date).eq('member_id', memberId);
    } else {
      await supabase.from('attendance').insert({ attend_date: date, member_id: memberId });
    }
    await loadData();
  };

  const getMemberName = (id) => members.find(m => m.id === id)?.name || '삭제됨';

  const getStats = () => {
    return members.map(member => {
      const wins = matches.filter(m => m.winnerId === member.id).length;
      const losses = matches.filter(m => m.loserId === member.id).length;
      const total = wins + losses;
      const winRate = total > 0 ? (wins / total * 100) : 0;
      
      let gamesWon = 0, gamesLost = 0;
      matches.forEach(m => {
        if (m.winnerId === member.id) { gamesWon += m.winnerGames; gamesLost += m.loserGames; }
        else if (m.loserId === member.id) { gamesWon += m.loserGames; gamesLost += m.winnerGames; }
      });

      const attendanceCount = Object.values(attendance).filter(arr => arr.includes(member.id)).length;
      
      return { ...member, wins, losses, total, winRate, gamesWon, gamesLost, gameDiff: gamesWon - gamesLost, attendanceCount };
    }).sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.gameDiff - a.gameDiff;
    });
  };

  const stats = getStats();
  const totalMatches = matches.length;
  const currentYear = new Date().getFullYear();

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
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

  const formatMonth = (date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  const changeMonth = (delta) => {
    const newDate = new Date(calendarMonth);
    newDate.setMonth(newDate.getMonth() + delta);
    setCalendarMonth(newDate);
  };

  const selectedDateMatches = selectedDate ? matches.filter(m => m.date === selectedDate) : [];
  const selectedDateAttendees = selectedDate ? (attendance[selectedDate] || []) : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 font-light tracking-widest text-sm">LOADING...</div>
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
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-1">
            소소테니스클럽
          </h1>
          <p className="text-emerald-100 text-sm font-light">
            {currentYear}년 · 총 {totalMatches}경기 · 멤버 {members.length}명
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-stone-200 overflow-x-auto">
          {[
            { id: 'ranking', label: '랭킹', icon: Trophy },
            { id: 'calendar', label: '캘린더', icon: Calendar },
            { id: 'matches', label: '경기', icon: Trophy },
            { id: 'members', label: '멤버', icon: Users }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-32">
        
        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-stone-100 rounded-full">
                  <ChevronLeft size={18} />
                </button>
                <h2 className="text-lg font-bold text-stone-800">{formatMonth(calendarMonth)}</h2>
                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-stone-100 rounded-full">
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="grid grid-cols-7 border-b border-stone-100">
                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                  <div key={d} className={`text-center text-xs font-semibold py-2 ${
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-stone-500'
                  }`}>
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {getDaysInMonth(calendarMonth).map((d, idx) => {
                  if (!d) return <div key={idx} className="aspect-square border-b border-r border-stone-50"></div>;
                  
                  const dayAttendance = attendance[d.dateStr] || [];
                  const dayMatches = matches.filter(m => m.date === d.dateStr);
                  const hasActivity = dayAttendance.length > 0 || dayMatches.length > 0;
                  const isToday = d.dateStr === new Date().toISOString().split('T')[0];
                  const isSelected = selectedDate === d.dateStr;
                  const weekday = idx % 7;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(d.dateStr)}
                      className={`aspect-square border-b border-r border-stone-50 p-1.5 text-left relative hover:bg-emerald-50 ${
                        isSelected ? 'bg-emerald-100 ring-2 ring-emerald-600 ring-inset' : ''
                      }`}
                    >
                      <div className={`text-sm font-medium ${
                        isToday ? 'bg-emerald-800 text-white w-6 h-6 rounded-full flex items-center justify-center' :
                        weekday === 0 ? 'text-red-500' : weekday === 6 ? 'text-blue-500' : 'text-stone-700'
                      }`}>
                        {d.day}
                      </div>
                      {hasActivity && (
                        <div className="absolute bottom-1 left-1 right-1 flex flex-col gap-0.5">
                          {dayAttendance.length > 0 && (
                            <div className="text-[10px] bg-emerald-100 text-emerald-800 rounded px-1 py-0.5 truncate font-medium flex items-center gap-0.5">
                              <Users size={8} />
                              {dayAttendance.length}
                            </div>
                          )}
                          {dayMatches.length > 0 && (
                            <div className="text-[10px] bg-yellow-100 text-yellow-800 rounded px-1 py-0.5 truncate font-medium flex items-center gap-0.5">
                              🎾 {dayMatches.length}
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
              <div className="flex items-center gap-1">
                <span className="inline-block bg-emerald-100 text-emerald-800 rounded px-1.5 py-0.5 font-medium">
                  <Users size={10} className="inline" /> N
                </span>
                참석
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block bg-yellow-100 text-yellow-800 rounded px-1.5 py-0.5 font-medium">🎾 N</span>
                경기
              </div>
            </div>

            {selectedDate && (
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                  <h3 className="font-bold text-stone-800">
                    {selectedDate.replace(/-/g, '.')}
                  </h3>
                  <button onClick={() => setSelectedDate(null)} className="text-stone-400">
                    <X size={16} />
                  </button>
                </div>
                
                <div className="p-4 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-stone-700 flex items-center gap-1.5 mb-2">
                      <Users size={14} />
                      참석자 ({selectedDateAttendees.length})
                    </div>
                    {members.length === 0 ? (
                      <div className="text-sm text-stone-400">멤버를 먼저 추가해주세요</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {members.map(m => {
                          const attended = selectedDateAttendees.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              onClick={() => toggleAttendance(selectedDate, m.id)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                                attended
                                  ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-medium'
                                  : 'bg-white border-stone-200 text-stone-600'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                attended ? 'bg-emerald-600 border-emerald-600' : 'border-stone-300'
                              }`}>
                                {attended && <Check size={12} className="text-white" />}
                              </div>
                              <span className="truncate">{m.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedDateMatches.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-stone-700 flex items-center gap-1.5 mb-2">
                        🎾 경기 ({selectedDateMatches.length})
                      </div>
                      <div className="space-y-2">
                        {selectedDateMatches.map(match => (
                          <div key={match.id} className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg">
                            <span className="text-emerald-700">🏆</span>
                            <span className="font-medium text-stone-800 flex-1 truncate text-sm">{getMemberName(match.winnerId)}</span>
                            <span className="text-sm font-mono font-bold text-stone-700 bg-white px-2 py-0.5 rounded border border-stone-200">
                              {match.winnerGames}-{match.loserGames}
                            </span>
                            <span className="text-stone-600 flex-1 truncate text-sm text-right">{getMemberName(match.loserId)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {members.length >= 2 && (
                    <button
                      onClick={() => {
                        setMatchDate(selectedDate);
                        setShowAddMatch(true);
                      }}
                      className="w-full py-2.5 border border-dashed border-stone-300 rounded-lg text-sm text-stone-600 flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} />
                      이 날짜에 경기 추가
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ranking' && (
          <div>
            {stats.length === 0 ? (
              <EmptyState icon={Trophy} title="아직 멤버가 없습니다" desc="멤버를 추가하고 경기를 기록해보세요" />
            ) : (
              <div className="space-y-3">
                {stats.filter(s => s.total > 0).length >= 3 && (
                  <div className="grid grid-cols-3 gap-3 mb-8">
                    {[1, 0, 2].map((idx, pos) => {
                      const player = stats[idx];
                      if (!player || player.total === 0) return <div key={idx}></div>;
                      const colors = [
                        { bg: 'bg-gradient-to-br from-yellow-400 to-yellow-600', text: 'text-yellow-900', medal: '🥇', label: '1위' },
                        { bg: 'bg-gradient-to-br from-stone-300 to-stone-400', text: 'text-stone-800', medal: '🥈', label: '2위' },
                        { bg: 'bg-gradient-to-br from-amber-600 to-amber-800', text: 'text-amber-50', medal: '🥉', label: '3위' }
                      ];
                      const color = colors[idx];
                      const heights = ['h-32', 'h-40', 'h-28'];
                      return (
                        <div key={player.id} className="flex flex-col items-center">
                          <div className="text-3xl mb-2">{color.medal}</div>
                          <div className="text-xs font-bold text-stone-600 mb-1 truncate max-w-full">{player.name}</div>
                          <div className={`${color.bg} ${color.text} ${heights[pos]} w-full rounded-t-lg flex flex-col items-center justify-center shadow-md`}>
                            <div className="text-xs font-bold tracking-widest opacity-80">{color.label}</div>
                            <div className="text-2xl font-bold">{player.winRate.toFixed(0)}%</div>
                            <div className="text-xs opacity-90">{player.wins}승 {player.losses}패</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-stone-200 bg-stone-50">
                    <h2 className="text-lg font-bold text-stone-800">전체 랭킹</h2>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {stats.map((player, idx) => (
                      <div key={player.id} className="px-5 py-4 flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                          idx === 1 ? 'bg-stone-100 text-stone-700' :
                          idx === 2 ? 'bg-amber-100 text-amber-700' :
                          'bg-stone-50 text-stone-500'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-stone-800 truncate">{player.name}</div>
                          <div className="text-xs text-stone-500 mt-0.5">
                            {player.total === 0 ? `경기 없음 · 출석 ${player.attendanceCount}회` : 
                              `${player.wins}승 ${player.losses}패 · 게임 ${player.gamesWon}-${player.gamesLost} · 출석 ${player.attendanceCount}회`}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xl font-bold text-emerald-700">
                            {player.total === 0 ? '-' : `${player.winRate.toFixed(1)}%`}
                          </div>
                          <div className="text-xs text-stone-400">승률</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {stats.filter(s => s.total > 0 || s.attendanceCount > 0).length > 0 && (
                  <div className="mt-8 bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Award className="text-yellow-300" size={20} />
                      <h3 className="text-lg font-bold">{currentYear} 소소테니스클럽 연말 시상</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <AwardCard 
                        label="MVP · 최고 승률"
                        winner={stats.filter(s => s.total > 0)[0]?.name}
                        value={stats.filter(s => s.total > 0)[0] ? `${stats.filter(s => s.total > 0)[0].winRate.toFixed(1)}%` : '-'}
                      />
                      <AwardCard 
                        label="다승왕"
                        winner={[...stats].sort((a, b) => b.wins - a.wins)[0]?.name}
                        value={[...stats].sort((a, b) => b.wins - a.wins)[0] ? `${[...stats].sort((a, b) => b.wins - a.wins)[0].wins}승` : '-'}
                      />
                      <AwardCard 
                        label="개근상 · 최다 출석"
                        winner={[...stats].sort((a, b) => b.attendanceCount - a.attendanceCount)[0]?.name}
                        value={[...stats].sort((a, b) => b.attendanceCount - a.attendanceCount)[0] ? `${[...stats].sort((a, b) => b.attendanceCount - a.attendanceCount)[0].attendanceCount}회` : '-'}
                      />
                      <AwardCard 
                        label="투혼상 · 최다 경기"
                        winner={[...stats].sort((a, b) => b.total - a.total)[0]?.name}
                        value={[...stats].sort((a, b) => b.total - a.total)[0] ? `${[...stats].sort((a, b) => b.total - a.total)[0].total}경기` : '-'}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'matches' && (
          <div>
            {matches.length === 0 ? (
              <EmptyState icon={Calendar} title="경기 기록이 없습니다" desc="오른쪽 아래 + 버튼으로 경기를 추가하세요" />
            ) : (
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-stone-200 bg-stone-50">
                  <h2 className="text-lg font-bold text-stone-800">경기 기록 ({matches.length})</h2>
                </div>
                <div className="divide-y divide-stone-100">
                  {matches.map(match => (
                    <div key={match.id} className="px-4 py-3 group">
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-stone-400 w-16 flex-shrink-0 font-mono">
                          {match.date.slice(5)}
                        </div>
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <span className="text-emerald-700 flex-shrink-0">🏆</span>
                          <span className="font-semibold text-stone-800 truncate">{getMemberName(match.winnerId)}</span>
                          <div className="text-xs font-mono font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded flex-shrink-0">
                            {match.winnerGames}-{match.loserGames}
                          </div>
                          <span className="text-stone-600 truncate text-right">{getMemberName(match.loserId)}</span>
                        </div>
                        <button onClick={() => deleteMatch(match.id)} className="text-stone-400 p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div>
            {members.length === 0 ? (
              <EmptyState icon={Users} title="멤버를 추가해주세요" desc="오른쪽 아래 + 버튼으로 멤버를 추가하세요" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {stats.map(member => (
                  <div key={member.id} className="bg-white rounded-lg border border-stone-200 p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-lg flex-shrink-0">
                      {member.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-stone-800 truncate">{member.name}</div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {member.total === 0 ? `출석 ${member.attendanceCount}회` : `${member.wins}승 ${member.losses}패 · 출석 ${member.attendanceCount}회`}
                      </div>
                    </div>
                    <button onClick={() => deleteMember(member.id)} className="text-stone-400 p-2">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-20">
        {activeTab === 'members' && (
          <button onClick={() => setShowAddMember(true)} className="bg-emerald-800 text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-2">
            <Plus size={18} />
            <span className="font-medium text-sm">멤버 추가</span>
          </button>
        )}
        {(activeTab === 'matches' || activeTab === 'ranking') && members.length >= 2 && (
          <button onClick={() => setShowAddMatch(true)} className="bg-emerald-800 text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-2">
            <Plus size={18} />
            <span className="font-medium text-sm">경기 기록</span>
          </button>
        )}
      </div>

      {showAddMember && (
        <Modal onClose={() => setShowAddMember(false)} title="멤버 추가">
          <input
            type="text"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMember()}
            placeholder="이름"
            autoFocus
            className="w-full px-4 py-3 border border-stone-300 rounded-lg mb-4"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowAddMember(false)} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
            <button onClick={addMember} className="flex-1 px-4 py-2.5 bg-emerald-800 text-white rounded-lg font-medium">추가</button>
          </div>
        </Modal>
      )}

      {showAddMatch && (
        <Modal onClose={() => setShowAddMatch(false)} title="경기 기록">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">경기일</label>
              <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-lg" />
            </div>
            
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <label className="block text-xs font-bold text-emerald-800 mb-2">🏆 승자</label>
              <div className="flex gap-2">
                <select value={winnerId} onChange={(e) => setWinnerId(e.target.value)}
                  className="flex-1 px-3 py-2.5 border border-stone-300 rounded-lg bg-white">
                  <option value="">선택</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id} disabled={m.id === loserId}>{m.name}</option>
                  ))}
                </select>
                <input type="number" min="0" value={winnerGames} onChange={(e) => setWinnerGames(e.target.value)} placeholder="게임"
                  className="w-20 px-3 py-2.5 border border-stone-300 rounded-lg text-center font-mono" />
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
              <label className="block text-xs font-bold text-stone-600 mb-2">패자</label>
              <div className="flex gap-2">
                <select value={loserId} onChange={(e) => setLoserId(e.target.value)}
                  className="flex-1 px-3 py-2.5 border border-stone-300 rounded-lg bg-white">
                  <option value="">선택</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id} disabled={m.id === winnerId}>{m.name}</option>
                  ))}
                </select>
                <input type="number" min="0" value={loserGames} onChange={(e) => setLoserGames(e.target.value)} placeholder="게임"
                  className="w-20 px-3 py-2.5 border border-stone-300 rounded-lg text-center font-mono" />
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 mt-5">
            <button onClick={() => setShowAddMatch(false)} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
            <button onClick={addMatch} disabled={!winnerId || !loserId || !winnerGames || !loserGames}
              className="flex-1 px-4 py-2.5 bg-emerald-800 text-white rounded-lg font-medium disabled:bg-stone-300">저장</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AwardCard({ label, winner, value }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
      <div className="text-xs text-yellow-200 tracking-wider mb-1 font-medium">{label}</div>
      <div className="text-lg font-bold truncate">{winner || '-'}</div>
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
      <div 
        className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-stone-800">{title}</h3>
          <button onClick={onClose} className="text-stone-400 p-1">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
