import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trophy, Plus, Users, Calendar, Award, X, Trash2, ChevronLeft, ChevronRight, Check, Pencil, Lock, ChevronDown, ChevronUp, BarChart2, Crown, Filter, Save } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const DELETE_PASSWORD = 'soso1234';

const QUARTERS = [
  { value: 1, label: '1분기' },
  { value: 2, label: '2분기' },
  { value: 3, label: '3분기' },
  { value: 4, label: '4분기' },
];

const getMatchType = (players, allMembers) => {
  const getGender = (id) => allMembers.find(m => m.id === id)?.gender || null;
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

const getWeekDates = (baseDate) => {
  const d = new Date(baseDate);
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + i);
    return {
      dateStr: `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,
      day: date.getDate(), weekday: i, month: date.getMonth() + 1
    };
  });
};

const getDaysInMonth = (date) => {
  const year = date.getFullYear(), month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    days.push({ day: i, dateStr, weekday: (firstDay + i - 1) % 7 });
  }
  return days;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [members, setMembers] = useState([]);
  const [guests, setGuests] = useState([
    { id: 'guest1', name: '게스트1', gender: 'M', isGuest: true },
    { id: 'guest2', name: '게스트2', gender: 'M', isGuest: true },
  ]);
  const [matches, setMatches] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [officers, setOfficers] = useState([]);
  const [guestCounts, setGuestCounts] = useState({});
  const [attendanceConfirmed, setAttendanceConfirmed] = useState({});
  const [loading, setLoading] = useState(true);

  // 참석자 로컬 편집 상태
  const [localAttendance, setLocalAttendance] = useState(null); // null = 편집 안함
  const [localGuestCount, setLocalGuestCount] = useState(0);
  const [attendanceDirty, setAttendanceDirty] = useState(false);

  // 멤버 관련
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberGender, setNewMemberGender] = useState('M');
  const [newMemberType, setNewMemberType] = useState('regular');
  const [editingMember, setEditingMember] = useState(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberGender, setEditMemberGender] = useState('M');
  const [editMemberType, setEditMemberType] = useState('regular');
  const [memberSort, setMemberSort] = useState('name');
  const [memberFilter, setMemberFilter] = useState('all');
  const [showSortFilter, setShowSortFilter] = useState(false);
  const [showGuestConfig, setShowGuestConfig] = useState(false);

  // 경기 관련
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [isScheduledMode, setIsScheduledMode] = useState(false); // 대진 vs 결과
  const [teamA1, setTeamA1] = useState('');
  const [teamA2, setTeamA2] = useState('');
  const [teamB1, setTeamB1] = useState('');
  const [teamB2, setTeamB2] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [isDraw, setIsDraw] = useState(false);
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);

  // 점수 입력 모달 (대진 -> 결과 입력)
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scoringMatch, setScoringMatch] = useState(null);
  const [inputScoreA, setInputScoreA] = useState('');
  const [inputScoreB, setInputScoreB] = useState('');
  const [inputIsDraw, setInputIsDraw] = useState(false);

  // 캘린더
  const today = new Date().toISOString().split('T')[0];
  const [calendarMode, setCalendarMode] = useState('week');
  const [currentWeekBase, setCurrentWeekBase] = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [attendanceOpen, setAttendanceOpen] = useState(true);

  // 회장 설정
  const [showOfficerModal, setShowOfficerModal] = useState(false);
  const [officerYear, setOfficerYear] = useState(new Date().getFullYear());
  const [officerQuarter, setOfficerQuarter] = useState(Math.ceil((new Date().getMonth()+1)/3));
  const [officerMemberId, setOfficerMemberId] = useState('');

  // 분석
  const [analysisPeriod, setAnalysisPeriod] = useState('all');
  const [analysisSection, setAnalysisSection] = useState('partner');

  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth()+1)/3);

  useEffect(() => { loadData(); }, []);

  // 날짜 바뀌면 로컬 참석 상태 초기화
  useEffect(() => {
    if (selectedDate) {
      setLocalAttendance(null);
      setAttendanceDirty(false);
    }
  }, [selectedDate]);

  const allPlayers = [...members, ...guests];

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: m } = await supabase.from('members').select('*').order('created_at');
      const { data: mt } = await supabase.from('matches').select('*').order('match_order', { ascending: true });
      const { data: att } = await supabase.from('attendance').select('*');
      const { data: off } = await supabase.from('officers').select('*');
      const { data: gc } = await supabase.from('guest_attendance').select('*');
      const { data: ac } = await supabase.from('attendance_confirmed').select('*');

      setMembers(m || []);
      setMatches((mt || []).map(x => ({
        id: x.id,
        teamA1: x.team_a1, teamA2: x.team_a2,
        teamB1: x.team_b1, teamB2: x.team_b2,
        scoreA: x.score_a, scoreB: x.score_b,
        date: x.match_date,
        confirmed: x.confirmed || false,
        matchType: x.match_type || 'JB',
        isDraw: x.is_draw || false,
        isScheduled: x.is_scheduled || false,
        matchOrder: x.match_order || 0
      })));

      const attMap = {};
      (att || []).forEach(a => {
        if (!attMap[a.attend_date]) attMap[a.attend_date] = [];
        attMap[a.attend_date].push(a.member_id);
      });
      setAttendance(attMap);
      setOfficers(off || []);

      const gcMap = {};
      (gc || []).forEach(g => { gcMap[g.attend_date] = g.guest_count; });
      setGuestCounts(gcMap);

      const acMap = {};
      (ac || []).forEach(a => { acMap[a.attend_date] = a.confirmed; });
      setAttendanceConfirmed(acMap);

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

  // 참석자 로컬 토글 (저장 안함)
  const toggleLocalAttendance = (memberId) => {
    const base = localAttendance || (attendance[selectedDate] || []);
    const updated = base.includes(memberId)
      ? base.filter(id => id !== memberId)
      : [...base, memberId];
    setLocalAttendance(updated);
    setAttendanceDirty(true);
  };

  // 참석자 일괄 저장
  const saveAttendance = async () => {
    if (!attendanceDirty) return;
    if (attendanceConfirmed[selectedDate]) {
      if (!checkPassword()) return;
    }
    const current = attendance[selectedDate] || [];
    const next = localAttendance || current;

    const toAdd = next.filter(id => !current.includes(id));
    const toRemove = current.filter(id => !next.includes(id));

    for (const id of toAdd) {
      await supabase.from('attendance').insert({ attend_date: selectedDate, member_id: id });
    }
    for (const id of toRemove) {
      await supabase.from('attendance').delete().eq('attend_date', selectedDate).eq('member_id', id);
    }

    setAttendance(prev => ({ ...prev, [selectedDate]: next }));
    setLocalAttendance(null);
    setAttendanceDirty(false);
  };

  const updateGuestCount = async (date, count) => {
    const newCount = Math.max(0, count);
    await supabase.from('guest_attendance').upsert({ attend_date: date, guest_count: newCount }, { onConflict: 'attend_date' });
    setGuestCounts(prev => ({ ...prev, [date]: newCount }));
  };

  const confirmAttendance = async (date) => {
    if (!checkPassword()) return;
    // 저장 안된 변경사항 있으면 먼저 저장
    if (attendanceDirty) await saveAttendance();
    await supabase.from('attendance_confirmed').upsert({ attend_date: date, confirmed: true }, { onConflict: 'attend_date' });
    setAttendanceConfirmed(prev => ({ ...prev, [date]: true }));
  };

  const unconfirmAttendance = async (date) => {
    if (!checkPassword()) return;
    await supabase.from('attendance_confirmed').upsert({ attend_date: date, confirmed: false }, { onConflict: 'attend_date' });
    setAttendanceConfirmed(prev => ({ ...prev, [date]: false }));
  };

  const saveOfficer = async () => {
    if (!officerMemberId) { alert('회장을 선택해주세요.'); return; }
    if (!checkPassword()) return;
    const existing = officers.find(o => o.year === officerYear && o.quarter === officerQuarter);
    if (existing) await supabase.from('officers').delete().eq('id', existing.id);
    await supabase.from('officers').insert({ id: Date.now().toString(), member_id: officerMemberId, role: 'president', quarter: officerQuarter, year: officerYear });
    setShowOfficerModal(false); setOfficerMemberId('');
    await loadData();
  };

  const deleteOfficer = async (id) => {
    if (!checkPassword()) return;
    await supabase.from('officers').delete().eq('id', id);
    await loadData();
  };

  const getCurrentOfficer = (year, quarter) => {
    const o = officers.find(o => o.year === year && o.quarter === quarter);
    if (!o) return null;
    return { ...o, name: members.find(m => m.id === o.member_id)?.name || '?' };
  };

  const isCurrentPresident = (memberId) => officers.some(o => o.member_id === memberId && o.year === currentYear && o.quarter === currentQuarter);

  const addMember = async () => {
    if (!newMemberName.trim()) return;
    if (!checkPassword()) return;
    const newMember = { id: Date.now().toString(), name: newMemberName.trim(), gender: newMemberGender, member_type: newMemberType };
    const { error } = await supabase.from('members').insert(newMember);
    if (error) { alert('저장 실패: ' + error.message); return; }
    setMembers([...members, newMember]);
    setNewMemberName(''); setNewMemberGender('M'); setNewMemberType('regular');
    setShowAddMember(false);
  };

  const saveMember = async () => {
    if (!editMemberName.trim()) return;
    const { error } = await supabase.from('members').update({ name: editMemberName.trim(), gender: editMemberGender, member_type: editMemberType }).eq('id', editingMember.id);
    if (error) { alert('수정 실패: ' + error.message); return; }
    setMembers(members.map(m => m.id === editingMember.id ? { ...m, name: editMemberName.trim(), gender: editMemberGender, member_type: editMemberType } : m));
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
    && new Set([teamA1, teamA2, teamB1, teamB2]).size === 4;
  const isValidScore = scoreA !== '' && scoreB !== '';

  const getNextMatchOrder = (date) => {
    const dateMatches = matches.filter(m => m.date === date);
    return dateMatches.length > 0 ? Math.max(...dateMatches.map(m => m.matchOrder || 0)) + 1 : 1;
  };

  const openAddMatch = (date, scheduled = false) => {
    setEditingMatch(null);
    setTeamA1(''); setTeamA2(''); setTeamB1(''); setTeamB2('');
    setScoreA(''); setScoreB(''); setIsDraw(false);
    setIsScheduledMode(scheduled);
    setMatchDate(date || today);
    setShowAddMatch(true);
  };

  const openEditMatch = (match) => {
    setEditingMatch(match);
    setTeamA1(match.teamA1); setTeamA2(match.teamA2);
    setTeamB1(match.teamB1); setTeamB2(match.teamB2);
    setScoreA(String(match.scoreA || '')); setScoreB(String(match.scoreB || ''));
    setIsDraw(match.isDraw || false);
    setIsScheduledMode(match.isScheduled || false);
    setMatchDate(match.date);
    setShowAddMatch(true);
  };

  const openScoreModal = (match) => {
    setScoringMatch(match);
    setInputScoreA('');
    setInputScoreB('');
    setInputIsDraw(false);
    setShowScoreModal(true);
  };

  const saveScore = async () => {
    if (!scoringMatch) return;
    if (!inputIsDraw && (inputScoreA === '' || inputScoreB === '')) return;
    const drawVal = inputIsDraw || parseInt(inputScoreA) === parseInt(inputScoreB);
    const { error } = await supabase.from('matches').update({
      score_a: inputIsDraw ? 0 : parseInt(inputScoreA),
      score_b: inputIsDraw ? 0 : parseInt(inputScoreB),
      is_draw: drawVal,
      is_scheduled: false
    }).eq('id', scoringMatch.id);
    if (error) { alert('저장 실패: ' + error.message); return; }
    setShowScoreModal(false); setScoringMatch(null);
    setInputScoreA(''); setInputScoreB(''); setInputIsDraw(false);
    await loadData();
  };

  const saveMatch = async () => {
    if (!isValidMatch) return;
    if (!isScheduledMode && !isValidScore) return;

    const players = [teamA1, teamA2, teamB1, teamB2];
    const matchType = getMatchType(players, allPlayers);
    const drawVal = !isScheduledMode && (isDraw || parseInt(scoreA) === parseInt(scoreB));

    if (editingMatch) {
      const { error } = await supabase.from('matches').update({
        team_a1: teamA1, team_a2: teamA2, team_b1: teamB1, team_b2: teamB2,
        score_a: isScheduledMode ? null : parseInt(scoreA),
        score_b: isScheduledMode ? null : parseInt(scoreB),
        match_date: matchDate, match_type: matchType,
        is_draw: isScheduledMode ? false : drawVal,
        is_scheduled: isScheduledMode
      }).eq('id', editingMatch.id);
      if (error) { alert('수정 실패: ' + error.message); return; }
    } else {
      const matchOrder = getNextMatchOrder(matchDate);
      const { error } = await supabase.from('matches').insert({
        id: Date.now().toString(),
        team_a1: teamA1, team_a2: teamA2, team_b1: teamB1, team_b2: teamB2,
        score_a: isScheduledMode ? null : parseInt(scoreA),
        score_b: isScheduledMode ? null : parseInt(scoreB),
        match_date: matchDate, confirmed: false, match_type: matchType,
        is_draw: isScheduledMode ? false : drawVal,
        is_scheduled: isScheduledMode,
        match_order: matchOrder,
        guest_count: 0
      });
      if (error) { alert('저장 실패: ' + error.message); return; }
      const realPlayers = players.filter(id => !id.startsWith('guest'));
      if (realPlayers.length > 0 && !isScheduledMode) {
        await supabase.from('attendance').upsert(
          realPlayers.map(id => ({ attend_date: matchDate, member_id: id })),
          { onConflict: 'attend_date,member_id' }
        );
      }
    }
    setTeamA1(''); setTeamA2(''); setTeamB1(''); setTeamB2('');
    setScoreA(''); setScoreB(''); setIsDraw(false);
    setMatchDate(today); setShowAddMatch(false); setEditingMatch(null);
    await loadData();
  };

  const deleteMatch = async (match) => {
    if (match.confirmed) { if (!checkPassword()) return; }
    if (!confirm('이 경기 기록을 삭제하시겠습니까?')) return;
    await supabase.from('matches').delete().eq('id', match.id);
    await loadData();
  };

  const confirmDateMatches = async (date) => {
    const dateMatches = matches.filter(m => m.date === date && !m.confirmed && !m.isScheduled);
    if (dateMatches.length === 0) { alert('확정할 경기가 없습니다. (대진 경기는 점수 입력 후 확정 가능)'); return; }
    if (!confirm(`${date} 경기 ${dateMatches.length}개를 확정하시겠습니까?`)) return;
    for (const m of dateMatches) {
      await supabase.from('matches').update({ confirmed: true }).eq('id', m.id);
    }
    await loadData();
  };

  const unconfirmDateMatches = async (date) => {
    if (!checkPassword()) return;
    await supabase.from('matches').update({ confirmed: false }).eq('match_date', date);
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

  const getStats = () => {
    return members.map(member => {
      let wins = 0, losses = 0, draws = 0, gamesWon = 0, gamesLost = 0;
      let rankedWins = 0, rankedLosses = 0, rankedDraws = 0;
      let foWins = 0, foLosses = 0, foDraws = 0;
      let baekWins = 0, baekLosses = 0, baekDraws = 0;

      matches.filter(m => !m.isScheduled).forEach(m => {
        const inA = m.teamA1 === member.id || m.teamA2 === member.id;
        const inB = m.teamB1 === member.id || m.teamB2 === member.id;
        if (!inA && !inB) return;
        const isFo = m.teamA1 === member.id || m.teamB1 === member.id;
        const draw = m.isDraw || m.scoreA === m.scoreB;
        const won = !draw && (inA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA);
        const lost = !draw && !won;

        if (draw) { draws++; gamesWon += inA ? m.scoreA : m.scoreB; gamesLost += inA ? m.scoreB : m.scoreA; }
        else if (won) { wins++; gamesWon += inA ? m.scoreA : m.scoreB; gamesLost += inA ? m.scoreB : m.scoreA; }
        else { losses++; gamesWon += inA ? m.scoreA : m.scoreB; gamesLost += inA ? m.scoreB : m.scoreA; }

        if (isRanked(m.matchType)) {
          if (draw) rankedDraws++; else if (won) rankedWins++; else rankedLosses++;
        }
        if (isFo) {
          if (draw) foDraws++; else if (won) foWins++; else foLosses++;
        } else {
          if (draw) baekDraws++; else if (won) baekWins++; else baekLosses++;
        }
      });

      const rankedTotal = rankedWins + rankedLosses + rankedDraws;
      const winRate = rankedTotal > 0 ? ((rankedWins + rankedDraws * 0.5) / rankedTotal * 100) : 0;
      const attendanceCount = Object.values(attendance).filter(arr => arr.includes(member.id)).length;
      const isPresident = isCurrentPresident(member.id);
      const foTotal = foWins + foLosses + foDraws;
      const baekTotal = baekWins + baekLosses + baekDraws;
      const foWinRate = foTotal > 0 ? ((foWins + foDraws * 0.5) / foTotal * 100) : null;
      const baekWinRate = baekTotal > 0 ? ((baekWins + baekDraws * 0.5) / baekTotal * 100) : null;

      return { ...member, wins, losses, draws, total: wins+losses+draws, rankedWins, rankedLosses, rankedDraws, rankedTotal, winRate, gamesWon, gamesLost, attendanceCount, isPresident, foWins, foLosses, foDraws, foTotal, foWinRate, baekWins, baekLosses, baekDraws, baekTotal, baekWinRate };
    });
  };

  const allStats = getStats();
  const stats = [...allStats].sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.rankedWins !== a.rankedWins) return b.rankedWins - a.rankedWins;
    return (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost);
  });

  const getSortedFilteredStats = () => {
    let result = [...allStats];
    if (memberFilter === 'regular') result = result.filter(m => m.member_type === 'regular');
    else if (memberFilter === 'associate') result = result.filter(m => m.member_type === 'associate');
    if (memberSort === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    else if (memberSort === 'winRate') result.sort((a, b) => b.winRate - a.winRate);
    else if (memberSort === 'attendance') result.sort((a, b) => b.attendanceCount - a.attendanceCount);
    else if (memberSort === 'type') result.sort((a, b) => a.member_type === b.member_type ? a.name.localeCompare(b.name,'ko') : a.member_type==='regular'?-1:1);
    return result;
  };

  const filteredMatches = matches.filter(m => {
    if (!isRanked(m.matchType) || m.isScheduled) return false;
    if (analysisPeriod === 'year') return new Date(m.date).getFullYear() === currentYear;
    return true;
  });

  const getPartnerStats = () => {
    const combos = {};
    filteredMatches.forEach(m => {
      [
        { pair: [m.teamA1, m.teamA2].sort(), won: !m.isDraw && m.scoreA > m.scoreB, draw: m.isDraw || m.scoreA === m.scoreB, scoreFor: m.scoreA },
        { pair: [m.teamB1, m.teamB2].sort(), won: !m.isDraw && m.scoreB > m.scoreA, draw: m.isDraw || m.scoreA === m.scoreB, scoreFor: m.scoreB }
      ].forEach(({ pair, won, draw, scoreFor }) => {
        const key = pair.join('|');
        if (!combos[key]) combos[key] = { ids: pair, wins: 0, losses: 0, draws: 0, totalScore: 0 };
        if (draw) combos[key].draws++; else if (won) combos[key].wins++; else combos[key].losses++;
        combos[key].totalScore += scoreFor;
      });
    });
    return Object.values(combos).map(c => ({
      ...c, total: c.wins+c.losses+c.draws,
      winRate: c.wins+c.losses+c.draws > 0 ? ((c.wins+c.draws*0.5)/(c.wins+c.losses+c.draws)*100) : 0,
      avgScore: c.wins+c.losses+c.draws > 0 ? (c.totalScore/(c.wins+c.losses+c.draws)).toFixed(1) : 0,
      name1: getMemberName(c.ids[0]), name2: getMemberName(c.ids[1])
    })).filter(c => c.total >= 1).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
  };

  const getMatchupStats = () => {
    const matchups = {};
    filteredMatches.forEach(m => {
      const teamA = [m.teamA1, m.teamA2].sort().join('|');
      const teamB = [m.teamB1, m.teamB2].sort().join('|');
      const key = [teamA, teamB].sort().join('||');
      if (!matchups[key]) matchups[key] = { teamA: [m.teamA1, m.teamA2].sort(), teamB: [m.teamB1, m.teamB2].sort(), aWins: 0, bWins: 0, draws: 0 };
      const draw = m.isDraw || m.scoreA === m.scoreB;
      const isAFirst = [m.teamA1, m.teamA2].sort().join('|') === matchups[key].teamA.join('|');
      if (draw) matchups[key].draws++;
      else if (m.scoreA > m.scoreB) { if (isAFirst) matchups[key].aWins++; else matchups[key].bWins++; }
      else { if (isAFirst) matchups[key].bWins++; else matchups[key].aWins++; }
    });
    return Object.values(matchups).map(m => ({
      ...m, total: m.aWins+m.bWins+m.draws,
      teamAName: m.teamA.map(id => getMemberName(id)).join(' · '),
      teamBName: m.teamB.map(id => getMemberName(id)).join(' · ')
    })).filter(m => m.total >= 2).sort((a, b) => b.total - a.total);
  };

  const getSynergyStats = () => {
    return members.map(member => {
      const partnerStats = {};
      filteredMatches.forEach(m => {
        const inA = m.teamA1 === member.id || m.teamA2 === member.id;
        const inB = m.teamB1 === member.id || m.teamB2 === member.id;
        if (!inA && !inB) return;
        const partnerId = inA ? (m.teamA1 === member.id ? m.teamA2 : m.teamA1) : (m.teamB1 === member.id ? m.teamB2 : m.teamB1);
        const draw = m.isDraw || m.scoreA === m.scoreB;
        const won = !draw && (inA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA);
        if (!partnerStats[partnerId]) partnerStats[partnerId] = { wins: 0, losses: 0, draws: 0 };
        if (draw) partnerStats[partnerId].draws++; else if (won) partnerStats[partnerId].wins++; else partnerStats[partnerId].losses++;
      });
      const partners = Object.entries(partnerStats).map(([id, s]) => ({
        id, name: getMemberName(id), ...s, total: s.wins+s.losses+s.draws,
        winRate: s.wins+s.losses+s.draws > 0 ? ((s.wins+s.draws*0.5)/(s.wins+s.losses+s.draws)*100) : 0
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

  const formatMonth = (d) => `${d.getFullYear()}년 ${d.getMonth()+1}월`;
  const changeMonth = (delta) => { const d = new Date(calendarMonth); d.setMonth(d.getMonth()+delta); setCalendarMonth(d); };
  const changeWeek = (delta) => { const d = new Date(currentWeekBase); d.setDate(d.getDate()+delta*7); setCurrentWeekBase(d); };

  const weekDates = getWeekDates(currentWeekBase);
  const calYear = calendarMonth.getFullYear();
  const calQuarter = Math.ceil((calendarMonth.getMonth()+1)/3);
  const calOfficer = getCurrentOfficer(calYear, calQuarter);

  const selectedDateMatches = selectedDate
    ? [...matches.filter(m => m.date === selectedDate)].sort((a, b) => (a.matchOrder||0) - (b.matchOrder||0))
    : [];
  const currentAttendees = localAttendance || (attendance[selectedDate] || []);
  const selectedDateGuestCount = selectedDate ? (guestCounts[selectedDate] || 0) : 0;
  const isDateConfirmed = selectedDateMatches.length > 0 && selectedDateMatches.filter(m => !m.isScheduled).every(m => m.confirmed) && selectedDateMatches.filter(m => !m.isScheduled).length > 0;
  const hasUnconfirmed = selectedDateMatches.some(m => !m.confirmed && !m.isScheduled);
  const availablePlayers = showAddMatch ? getAvailablePlayers(matchDate) : [];

  const MemberSelect = ({ value, onChange, label, exclude = [], posLabel }) => (
    <div className="flex-1">
      {posLabel && <div className="text-xs text-stone-400 mb-1 text-center font-medium">{posLabel}</div>}
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-2.5 border border-stone-300 rounded-lg bg-white text-sm">
        <option value="">{label}</option>
        {availablePlayers.map(m => (
          <option key={m.id} value={m.id} disabled={exclude.includes(m.id)}>
            {m.gender==='M'?'♂':'♀'} {m.name}{m.isGuest?' (G)':''}
          </option>
        ))}
      </select>
    </div>
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
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.05) 20px, rgba(255,255,255,0.05) 40px)' }}></div>
        <div className="max-w-6xl mx-auto px-6 py-8 relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-yellow-300 flex items-center justify-center shadow-lg">
              <span className="text-2xl">🎾</span>
            </div>
            <div className="text-yellow-200 text-xs tracking-[0.3em] font-medium">SOSO TENNIS CLUB</div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">소소테니스클럽</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-emerald-100 text-sm font-light">{currentYear}년 · 총 {matches.filter(m=>!m.isScheduled).length}경기 · 멤버 {members.length}명</p>
            {getCurrentOfficer(currentYear, currentQuarter) && (
              <span className="flex items-center gap-1 bg-yellow-300/20 text-yellow-200 text-xs px-2 py-1 rounded-full">
                <Crown size={11}/> {currentQuarter}분기 회장: {getCurrentOfficer(currentYear, currentQuarter)?.name}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-stone-200 overflow-x-auto">
          {[
            { id: 'calendar', label: '캘린더', icon: Calendar },
            { id: 'ranking', label: '랭킹', icon: Trophy },
            { id: 'analysis', label: '분석', icon: BarChart2 },
            { id: 'matches', label: '경기', icon: Trophy },
            { id: 'members', label: '멤버', icon: Users }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-2.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${activeTab===tab.id?'bg-emerald-800 text-white':'text-stone-600 hover:bg-stone-100'}`}>
              <tab.icon size={13}/>{tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-32">

        {/* 캘린더 */}
        {activeTab === 'calendar' && (
          <div className="space-y-4">
            {/* 회장 배너 */}
            <div className="bg-white rounded-lg border border-stone-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-yellow-500"/>
                <div>
                  <div className="text-sm font-bold text-stone-800">{calYear}년 {calQuarter}분기 회장</div>
                  {calOfficer
                    ? <div className="flex items-center gap-2"><span className="text-sm text-emerald-700 font-semibold">{calOfficer.name}</span><button onClick={() => deleteOfficer(calOfficer.id)} className="text-xs text-stone-400">해제</button></div>
                    : <div className="text-xs text-stone-400">미설정</div>}
                </div>
              </div>
              <button onClick={() => { setOfficerYear(calYear); setOfficerQuarter(calQuarter); setOfficerMemberId(calOfficer?.member_id||''); setShowOfficerModal(true); }}
                className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                <Crown size={11}/> {calOfficer?'변경':'설정'}
              </button>
            </div>

            {/* 주/월 토글 */}
            <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
              <button onClick={() => setCalendarMode('week')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${calendarMode==='week'?'bg-white text-stone-800 shadow-sm':'text-stone-500'}`}>주간</button>
              <button onClick={() => setCalendarMode('month')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${calendarMode==='month'?'bg-white text-stone-800 shadow-sm':'text-stone-500'}`}>월간</button>
            </div>

            {/* 주간 */}
            {calendarMode === 'week' && (
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
                  <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-stone-100 rounded-full"><ChevronLeft size={18}/></button>
                  <div className="text-sm font-bold text-stone-800">{weekDates[0].month}월 {weekDates[0].day}일 - {weekDates[6].month}월 {weekDates[6].day}일</div>
                  <button onClick={() => changeWeek(1)} className="p-2 hover:bg-stone-100 rounded-full"><ChevronRight size={18}/></button>
                </div>
                <div className="grid grid-cols-7 border-b border-stone-100">
                  {['일','월','화','수','목','금','토'].map((d,i) => (
                    <div key={d} className={`text-center text-xs font-semibold py-2 ${i===0?'text-red-500':i===6?'text-blue-500':'text-stone-500'}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 border-t border-stone-100">
                  {weekDates.map(d => {
                    const dayAtt = attendance[d.dateStr] || [];
                    const dayMatches = matches.filter(m => m.date === d.dateStr);
                    const allConfirmed = dayMatches.filter(m=>!m.isScheduled).length > 0 && dayMatches.filter(m=>!m.isScheduled).every(m => m.confirmed);
                    const hasScheduled = dayMatches.some(m => m.isScheduled);
                    const isToday = d.dateStr === today;
                    const isSelected = selectedDate === d.dateStr;
                    return (
                      <button key={d.dateStr} onClick={() => setSelectedDate(d.dateStr)}
                        className={`p-2 text-left relative hover:bg-emerald-50 border-r border-stone-50 min-h-16 ${isSelected?'bg-emerald-100 ring-2 ring-emerald-600 ring-inset':''}`}>
                        <div className={`text-sm font-medium mb-1 ${isToday?'bg-emerald-800 text-white w-6 h-6 rounded-full flex items-center justify-center':d.weekday===0?'text-red-500':d.weekday===6?'text-blue-500':'text-stone-700'}`}>{d.day}</div>
                        <div className="flex flex-col gap-0.5">
                          {dayAtt.length > 0 && <div className="text-[10px] bg-emerald-100 text-emerald-800 rounded px-1 py-0.5 font-medium flex items-center gap-0.5"><Users size={8}/>{dayAtt.length}</div>}
                          {hasScheduled && <div className="text-[10px] bg-orange-100 text-orange-700 rounded px-1 py-0.5 font-medium">📋 대진</div>}
                          {dayMatches.filter(m=>!m.isScheduled).length > 0 && (
                            <div className={`text-[10px] rounded px-1 py-0.5 font-medium flex items-center gap-0.5 ${allConfirmed?'bg-blue-100 text-blue-800':'bg-yellow-100 text-yellow-800'}`}>
                              {allConfirmed?<Lock size={8}/>:'🎾'} {dayMatches.filter(m=>!m.isScheduled).length}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 월간 */}
            {calendarMode === 'month' && (
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
                  <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-stone-100 rounded-full"><ChevronLeft size={18}/></button>
                  <div className="text-center">
                    <h2 className="text-lg font-bold text-stone-800">{formatMonth(calendarMonth)}</h2>
                    <div className="text-xs text-stone-400">{calQuarter}분기</div>
                  </div>
                  <button onClick={() => changeMonth(1)} className="p-2 hover:bg-stone-100 rounded-full"><ChevronRight size={18}/></button>
                </div>
                <div className="grid grid-cols-7 border-b border-stone-100">
                  {['일','월','화','수','목','금','토'].map((d,i) => (
                    <div key={d} className={`text-center text-xs font-semibold py-2 ${i===0?'text-red-500':i===6?'text-blue-500':'text-stone-500'}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {getDaysInMonth(calendarMonth).map((d, idx) => {
                    if (!d) return <div key={idx} className="aspect-square border-b border-r border-stone-50"></div>;
                    const dayAtt = attendance[d.dateStr] || [];
                    const dayMatches = matches.filter(m => m.date === d.dateStr);
                    const allConfirmed = dayMatches.filter(m=>!m.isScheduled).length > 0 && dayMatches.filter(m=>!m.isScheduled).every(m => m.confirmed);
                    const hasScheduled = dayMatches.some(m => m.isScheduled);
                    const isToday = d.dateStr === today;
                    const isSelected = selectedDate === d.dateStr;
                    return (
                      <button key={idx} onClick={() => setSelectedDate(d.dateStr)}
                        className={`aspect-square border-b border-r border-stone-50 p-1.5 text-left relative hover:bg-emerald-50 ${isSelected?'bg-emerald-100 ring-2 ring-emerald-600 ring-inset':''}`}>
                        <div className={`text-sm font-medium ${isToday?'bg-emerald-800 text-white w-6 h-6 rounded-full flex items-center justify-center':d.weekday===0?'text-red-500':d.weekday===6?'text-blue-500':'text-stone-700'}`}>{d.day}</div>
                        {(dayAtt.length > 0 || dayMatches.length > 0) && (
                          <div className="absolute bottom-1 left-1 right-1 flex flex-col gap-0.5">
                            {dayAtt.length > 0 && <div className="text-[10px] bg-emerald-100 text-emerald-800 rounded px-1 py-0.5 font-medium flex items-center gap-0.5"><Users size={8}/>{dayAtt.length}</div>}
                            {hasScheduled && <div className="text-[10px] bg-orange-100 text-orange-700 rounded px-1 py-0.5 font-medium">📋</div>}
                            {dayMatches.filter(m=>!m.isScheduled).length > 0 && (
                              <div className={`text-[10px] rounded px-1 py-0.5 font-medium flex items-center gap-0.5 ${allConfirmed?'bg-blue-100 text-blue-800':'bg-yellow-100 text-yellow-800'}`}>
                                {allConfirmed?<Lock size={8}/>:'🎾'} {dayMatches.filter(m=>!m.isScheduled).length}
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 선택 날짜 상세 */}
            {selectedDate && (
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                  <h3 className="font-bold text-stone-800 flex items-center gap-2">
                    {selectedDate.replace(/-/g,'.')}
                    {isDateConfirmed && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Lock size={10}/>경기확정</span>}
                  </h3>
                  <button onClick={() => setSelectedDate(null)}><X size={16} className="text-stone-400"/></button>
                </div>
                <div className="p-4 space-y-4">

                  {/* 참석자 */}
                  <div className="border border-stone-200 rounded-lg overflow-hidden">
                    <button onClick={() => setAttendanceOpen(!attendanceOpen)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-stone-50 text-sm font-semibold text-stone-700">
                      <div className="flex items-center gap-1.5">
                        <Users size={14}/>
                        참석자 ({currentAttendees.length}명)
                        {attendanceConfirmed[selectedDate] && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Lock size={9}/>확정</span>}
                        {attendanceDirty && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">미저장</span>}
                      </div>
                      {attendanceOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>
                    {attendanceOpen && (
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          {members.map(m => {
                            const attended = currentAttendees.includes(m.id);
                            return (
                              <button key={m.id} onClick={() => toggleLocalAttendance(m.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${attended?`${getGenderBg(m.gender)} font-medium`:'bg-white border-stone-200 text-stone-600'}`}>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${attended?'bg-emerald-600 border-emerald-600':'border-stone-300'}`}>
                                  {attended && <Check size={12} className="text-white"/>}
                                </div>
                                <span className={`truncate ${attended?getGenderColor(m.gender):''}`}>{m.name}</span>
                                <span className={`text-xs px-1 rounded ml-auto flex-shrink-0 ${getGenderBadge(m.gender)}`}>{m.gender==='M'?'남':'여'}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* 저장 버튼 */}
                        {attendanceDirty && (
                          <button onClick={saveAttendance}
                            className="w-full py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5">
                            <Save size={14}/> 참석자 저장
                          </button>
                        )}

                        {/* 게스트 */}
                        <div className="flex items-center gap-3 px-1 pt-1 border-t border-stone-100">
                          <div className="flex items-center gap-2 text-sm text-stone-600">
                            <Users size={14} className="text-stone-400"/>
                            <span>게스트</span>
                          </div>
                          <div className="flex items-center gap-2 ml-auto">
                            <button onClick={() => updateGuestCount(selectedDate, selectedDateGuestCount - 1)}
                              className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center font-bold text-lg">-</button>
                            <span className="w-8 text-center font-bold text-stone-800">{selectedDateGuestCount}</span>
                            <button onClick={() => updateGuestCount(selectedDate, selectedDateGuestCount + 1)}
                              className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center font-bold text-lg">+</button>
                            <span className="text-sm text-stone-500">명</span>
                          </div>
                        </div>
                        <div className="text-xs text-stone-400 px-1">총 {currentAttendees.length + selectedDateGuestCount}명 참석</div>

                        {/* 참석 확정 */}
                        {attendanceConfirmed[selectedDate] ? (
                          <button onClick={() => unconfirmAttendance(selectedDate)}
                            className="w-full py-2 bg-stone-100 border border-stone-300 rounded-lg text-xs text-stone-600 flex items-center justify-center gap-1.5">
                            <Lock size={12}/> 참석 확정 해제 (비번 필요)
                          </button>
                        ) : (
                          <button onClick={() => confirmAttendance(selectedDate)}
                            className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
                            <Lock size={12}/> 참석자 확정하기
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 경기 목록 */}
                  {selectedDateMatches.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-stone-700 mb-2">🎾 경기 ({selectedDateMatches.length})</div>
                      <div className="space-y-2">
                        {selectedDateMatches.map((match, idx) => {
                          const typeInfo = getMatchTypeLabel(match.matchType);
                          const draw = match.isDraw || (match.scoreA === match.scoreB && !match.isScheduled);
                          return (
                            <div key={match.id} className={`p-3 rounded-lg border ${match.isScheduled?'bg-orange-50 border-orange-200':match.confirmed?'bg-blue-50 border-blue-200':'bg-stone-50 border-stone-200'}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-stone-500">{idx+1}경기</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                                {match.isScheduled
                                  ? <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">대진예정</span>
                                  : draw ? <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">무승부</span>
                                  : match.confirmed ? <span className="text-xs text-blue-600 flex items-center gap-0.5"><Lock size={10}/>확정</span>
                                  : <span className="text-xs text-stone-400">미확정</span>}
                                <div className="flex-1"></div>
                                {match.isScheduled && (
                                  <button onClick={() => openScoreModal(match)}
                                    className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">점수입력</button>
                                )}
                                {!match.confirmed && <button onClick={() => openEditMatch(match)} className="text-stone-400 p-1"><Pencil size={13}/></button>}
                                <button onClick={() => deleteMatch(match)} className="text-stone-300 p-1"><Trash2 size={13}/></button>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`flex-1 text-sm min-w-0 ${!match.isScheduled&&!draw&&match.scoreA>match.scoreB?'font-bold text-emerald-800':draw?'text-stone-600':'text-stone-500'}`}>
                                  <div className="truncate"><span className="text-xs text-stone-400 mr-1">포</span>{getMemberName(match.teamA1)}</div>
                                  <div className="truncate"><span className="text-xs text-stone-400 mr-1">백</span>{getMemberName(match.teamA2)}</div>
                                </div>
                                {match.isScheduled ? (
                                  <div className="font-mono text-stone-400 bg-stone-100 px-3 py-1.5 rounded text-sm flex-shrink-0">vs</div>
                                ) : (
                                  <div className={`font-mono font-bold px-2 py-1 rounded border text-sm flex-shrink-0 ${draw?'bg-yellow-50 border-yellow-200 text-yellow-700':'bg-white border-stone-200 text-stone-700'}`}>
                                    {match.scoreA} - {match.scoreB}
                                  </div>
                                )}
                                <div className={`flex-1 text-sm text-right min-w-0 ${!match.isScheduled&&!draw&&match.scoreB>match.scoreA?'font-bold text-emerald-800':draw?'text-stone-600':'text-stone-500'}`}>
                                  <div className="truncate"><span className="text-xs text-stone-400 mr-1">포</span>{getMemberName(match.teamB1)}</div>
                                  <div className="truncate"><span className="text-xs text-stone-400 mr-1">백</span>{getMemberName(match.teamB2)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {members.length >= 2 && (
                        <button onClick={() => openAddMatch(selectedDate, false)}
                          className="flex-1 py-2.5 border border-dashed border-stone-300 rounded-lg text-sm text-stone-600 flex items-center justify-center gap-1.5">
                          <Plus size={14}/> 경기 기록
                        </button>
                      )}
                      {members.length >= 2 && (
                        <button onClick={() => openAddMatch(selectedDate, true)}
                          className="flex-1 py-2.5 border border-dashed border-orange-300 rounded-lg text-sm text-orange-600 flex items-center justify-center gap-1.5">
                          <Plus size={14}/> 대진 등록
                        </button>
                      )}
                    </div>
                    {selectedDateMatches.filter(m=>!m.isScheduled).length > 0 && (
                      isDateConfirmed ? (
                        <button onClick={() => unconfirmDateMatches(selectedDate)}
                          className="w-full py-2.5 bg-stone-100 border border-stone-300 rounded-lg text-sm text-stone-600 flex items-center justify-center gap-1.5">
                          <Lock size={14}/> 경기 확정 해제 (비번 필요)
                        </button>
                      ) : hasUnconfirmed ? (
                        <button onClick={() => confirmDateMatches(selectedDate)}
                          className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5">
                          <Lock size={14}/> 경기 확정하기
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
            {stats.length === 0 ? <EmptyState icon={Trophy} title="아직 멤버가 없습니다" desc="멤버를 추가하고 경기를 기록해보세요"/> : (
              <>
                {stats.filter(s => s.rankedTotal > 0).length >= 3 && (
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[1,0,2].map((idx, pos) => {
                      const player = stats.filter(s => s.rankedTotal > 0)[idx];
                      if (!player) return <div key={idx}></div>;
                      const colors = [
                        { bg: 'bg-gradient-to-br from-yellow-400 to-yellow-600', text: 'text-yellow-900', medal: '🥇', label: '1위' },
                        { bg: 'bg-gradient-to-br from-stone-300 to-stone-400', text: 'text-stone-800', medal: '🥈', label: '2위' },
                        { bg: 'bg-gradient-to-br from-amber-600 to-amber-800', text: 'text-amber-50', medal: '🥉', label: '3위' }
                      ];
                      const c = colors[idx]; const heights = ['h-32','h-40','h-28'];
                      return (
                        <div key={player.id} className="flex flex-col items-center">
                          <div className="text-3xl mb-1">{c.medal}</div>
                          <div className="flex items-center gap-1 mb-1">
                            {player.isPresident && <Crown size={12} className="text-yellow-500 flex-shrink-0"/>}
                            <div className={`text-xs font-bold truncate max-w-full px-1 ${getGenderColor(player.gender)}`}>{player.name}</div>
                          </div>
                          <div className={`${c.bg} ${c.text} ${heights[pos]} w-full rounded-t-lg flex flex-col items-center justify-center shadow-md`}>
                            <div className="text-xs font-bold opacity-80">{c.label}</div>
                            <div className="text-2xl font-bold">{player.winRate.toFixed(0)}%</div>
                            <div className="text-xs opacity-90">{player.rankedWins}승 {player.rankedDraws>0?`${player.rankedDraws}무 `:''}{ player.rankedLosses}패</div>
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
                      <div key={player.id} className="px-4 py-3 flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx===0?'bg-yellow-100 text-yellow-700':idx===1?'bg-stone-100 text-stone-700':idx===2?'bg-amber-100 text-amber-700':'bg-stone-50 text-stone-500'}`}>{idx+1}</div>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${player.gender==='M'?'bg-blue-100 text-blue-700':'bg-pink-100 text-pink-600'}`}>{player.gender==='M'?'♂':'♀'}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {player.isPresident && <Crown size={13} className="text-yellow-500 flex-shrink-0"/>}
                            <span className={`font-semibold truncate ${getGenderColor(player.gender)}`}>{player.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${player.member_type==='regular'?'bg-emerald-100 text-emerald-700':'bg-stone-100 text-stone-500'}`}>{player.member_type==='regular'?'정':'준'}</span>
                          </div>
                          <div className="text-xs text-stone-500 mt-0.5">
                            {player.rankedTotal===0?`랭킹경기 없음 · 출석 ${player.attendanceCount}회`:`${player.rankedWins}승 ${player.rankedDraws>0?`${player.rankedDraws}무 `:''}${player.rankedLosses}패 · 출석 ${player.attendanceCount}회`}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xl font-bold text-emerald-700">{player.rankedTotal===0?'-':`${player.winRate.toFixed(1)}%`}</div>
                          <div className="text-xs text-stone-400">승률</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {stats.some(s => s.rankedTotal>0||s.attendanceCount>0) && (
                  <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4"><Award className="text-yellow-300" size={20}/><h3 className="text-lg font-bold">{currentYear} 소소테니스클럽 연말 시상</h3></div>
                    <div className="grid grid-cols-2 gap-3">
                      <AwardCard label="MVP · 최고 승률" winner={stats.filter(s=>s.rankedTotal>0)[0]?.name} value={stats.filter(s=>s.rankedTotal>0)[0]?`${stats.filter(s=>s.rankedTotal>0)[0].winRate.toFixed(1)}%`:'-'}/>
                      <AwardCard label="다승왕" winner={[...stats].sort((a,b)=>b.rankedWins-a.rankedWins)[0]?.name} value={`${[...stats].sort((a,b)=>b.rankedWins-a.rankedWins)[0]?.rankedWins||0}승`}/>
                      <AwardCard label="개근상 · 최다 출석" winner={[...stats].sort((a,b)=>b.attendanceCount-a.attendanceCount)[0]?.name} value={`${[...stats].sort((a,b)=>b.attendanceCount-a.attendanceCount)[0]?.attendanceCount||0}회`}/>
                      <AwardCard label="베스트 파트너" winner={bestCombos[0]?`${bestCombos[0].name1} · ${bestCombos[0].name2}`:'-'} value={bestCombos[0]?`${bestCombos[0].winRate.toFixed(0)}%`:'-'}/>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 분석 */}
        {activeTab === 'analysis' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setAnalysisPeriod('all')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${analysisPeriod==='all'?'bg-emerald-800 text-white border-emerald-800':'bg-white text-stone-600 border-stone-200'}`}>전체 기간</button>
              <button onClick={() => setAnalysisPeriod('year')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${analysisPeriod==='year'?'bg-emerald-800 text-white border-emerald-800':'bg-white text-stone-600 border-stone-200'}`}>{currentYear}년</button>
            </div>
            <div className="text-xs text-stone-400 px-1">※ 남복·여복·혼복 기준 · 랭킹 반영 경기 {filteredMatches.length}개</div>
            <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
              {[{id:'partner',label:'🤝 파트너'},{id:'matchup',label:'⚔️ 매치업'},{id:'synergy',label:'✨ 시너지'},{id:'position',label:'🎾 포/백'}].map(s => (
                <button key={s.id} onClick={() => setAnalysisSection(s.id)}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${analysisSection===s.id?'bg-white text-stone-800 shadow-sm':'text-stone-500'}`}>{s.label}</button>
              ))}
            </div>

            {analysisSection === 'partner' && (
              <div className="space-y-4">
                {filteredMatches.length === 0 ? <EmptyState icon={BarChart2} title="데이터가 없습니다" desc="경기를 기록하면 분석이 시작돼요"/> : (
                  <>
                    {bestCombos.length > 0 && <ComboCard title="🔥 베스트 조합 (2경기 이상)" combos={bestCombos} color="emerald" emoji={['🥇','🥈','🥉']} emojiColor="text-emerald-700"/>}
                    {worstCombos.length > 0 && <ComboCard title="⚠️ 워스트 조합 (2경기 이상)" combos={worstCombos} color="red" emoji={['💀','💀','💀']} emojiColor="text-red-500"/>}
                    {hiddenCombos.length > 0 && <ComboCard title="📈 숨은 꿀조합" combos={hiddenCombos} color="yellow" emoji={['💎','💎','💎']} emojiColor="text-yellow-600"/>}
                    <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-stone-100"><h3 className="font-bold text-stone-800 text-sm">📊 전체 조합 순위</h3></div>
                      <div className="divide-y divide-stone-100">
                        {partnerStats.map((c, i) => (
                          <div key={i} className="px-4 py-3 flex items-center gap-3">
                            <div className="text-xs text-stone-400 w-5">{i+1}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-stone-800">{c.name1} · {c.name2}</div>
                              <div className="text-xs text-stone-400">{c.total}경기 · {c.wins}승 {c.draws>0?`${c.draws}무 `:''}{ c.losses}패</div>
                            </div>
                            <div className={`text-base font-bold ${c.winRate>=60?'text-emerald-600':c.winRate>=40?'text-stone-600':'text-red-500'}`}>{c.winRate.toFixed(0)}%</div>
                          </div>
                        ))}
                        {partnerStats.length===0&&<div className="px-4 py-8 text-center text-sm text-stone-400">아직 데이터가 없어요</div>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {analysisSection === 'matchup' && (
              <div className="space-y-3">
                {matchupStats.length===0?<EmptyState icon={BarChart2} title="2경기 이상 맞붙은 조합이 없어요" desc="같은 조합으로 더 많이 경기하면 보여요"/>:(
                  <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-stone-100"><h3 className="font-bold text-stone-800 text-sm">⚔️ 매치업 전적</h3></div>
                    <div className="divide-y divide-stone-100">
                      {matchupStats.map((m, i) => (
                        <div key={i} className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`flex-1 text-sm min-w-0 ${m.aWins>m.bWins?'font-bold text-emerald-800':'text-stone-500'}`}><div className="truncate">{m.teamAName}</div></div>
                            <div className="flex-shrink-0 text-center">
                              <div className="font-mono font-bold text-stone-800 bg-stone-100 px-3 py-1 rounded text-sm">{m.aWins}{m.draws>0?` · ${m.draws}무 · `:' : '}{m.bWins}</div>
                              <div className="text-xs text-stone-400 mt-0.5">{m.total}경기</div>
                            </div>
                            <div className={`flex-1 text-sm text-right min-w-0 ${m.bWins>m.aWins?'font-bold text-emerald-800':'text-stone-500'}`}><div className="truncate">{m.teamBName}</div></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {analysisSection === 'synergy' && (
              <div className="space-y-3">
                {synergyStats.length===0?<EmptyState icon={BarChart2} title="데이터가 없습니다" desc="경기를 기록하면 분석이 시작돼요"/>:(
                  synergyStats.map(member => (
                    <div key={member.id} className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                      <div className={`px-4 py-3 border-b border-stone-100 ${getGenderBg(member.gender)}`}>
                        <h3 className={`font-bold text-sm flex items-center gap-2 ${getGenderColor(member.gender)}`}>
                          {member.gender==='M'?'♂':'♀'} {member.name}
                          <span className="text-xs font-normal text-stone-500">누구랑 잘 맞나요?</span>
                        </h3>
                      </div>
                      <div className="divide-y divide-stone-100">
                        {member.partners.map((p, i) => (
                          <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                            <div className="flex-1 text-sm text-stone-700">{p.name}</div>
                            <div className="text-xs text-stone-400">{p.total}경기 · {p.wins}승 {p.draws>0?`${p.draws}무 `:''}{ p.losses}패</div>
                            <div className={`text-base font-bold w-14 text-right ${p.winRate>=60?'text-emerald-600':p.winRate>=40?'text-stone-600':'text-red-500'}`}>{p.winRate.toFixed(0)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {analysisSection === 'position' && (
              <div className="space-y-3">
                {filteredMatches.length===0?<EmptyState icon={BarChart2} title="데이터가 없습니다" desc="경기를 기록하면 분석이 시작돼요"/>:(
                  <>
                    <div className="text-xs text-stone-400 px-1 bg-stone-50 rounded-lg p-3">🎾 왼쪽 선택 = <strong>포(앞)</strong>, 오른쪽 선택 = <strong>백(뒤)</strong> 기준으로 집계돼요.</div>
                    {allStats.filter(m=>m.foTotal>0||m.baekTotal>0).sort((a,b)=>(b.foWinRate||0)+(b.baekWinRate||0)-(a.foWinRate||0)-(a.baekWinRate||0)).map(member => (
                      <div key={member.id} className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                        <div className={`px-4 py-3 border-b border-stone-100 flex items-center gap-2 ${getGenderBg(member.gender)}`}>
                          {member.isPresident && <Crown size={13} className="text-yellow-500"/>}
                          <span className={`font-bold text-sm ${getGenderColor(member.gender)}`}>{member.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${getGenderBadge(member.gender)}`}>{member.gender==='M'?'남':'여'}</span>
                          {member.foWinRate!==null&&member.baekWinRate!==null&&(
                            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${member.foWinRate>member.baekWinRate?'bg-blue-100 text-blue-700':member.baekWinRate>member.foWinRate?'bg-orange-100 text-orange-700':'bg-stone-100 text-stone-600'}`}>
                              {member.foWinRate>member.baekWinRate?'포 특화':member.baekWinRate>member.foWinRate?'백 특화':'균형형'}
                            </span>
                          )}
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3">
                          <div className="bg-blue-50 rounded-lg p-3 text-center">
                            <div className="text-xs font-bold text-blue-700 mb-1">포 (앞)</div>
                            <div className="text-2xl font-bold text-blue-800">{member.foWinRate!==null?`${member.foWinRate.toFixed(0)}%`:'-'}</div>
                            <div className="text-xs text-blue-600 mt-1">{member.foWins}승 {member.foDraws>0?`${member.foDraws}무 `:''}{ member.foLosses}패</div>
                          </div>
                          <div className="bg-orange-50 rounded-lg p-3 text-center">
                            <div className="text-xs font-bold text-orange-700 mb-1">백 (뒤)</div>
                            <div className="text-2xl font-bold text-orange-800">{member.baekWinRate!==null?`${member.baekWinRate.toFixed(0)}%`:'-'}</div>
                            <div className="text-xs text-orange-600 mt-1">{member.baekWins}승 {member.baekDraws>0?`${member.baekDraws}무 `:''}{ member.baekLosses}패</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 경기 목록 */}
        {activeTab === 'matches' && (
          <div>
            {matches.length===0?<EmptyState icon={Calendar} title="경기 기록이 없습니다" desc="캘린더에서 날짜를 선택해 경기를 추가하세요"/>:(
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-stone-200 bg-stone-50">
                  <h2 className="text-lg font-bold text-stone-800">경기 기록 ({matches.filter(m=>!m.isScheduled).length}) · 대진 예정 ({matches.filter(m=>m.isScheduled).length})</h2>
                </div>
                <div className="divide-y divide-stone-100">
                  {[...matches].sort((a,b) => {
                    if (a.date !== b.date) return b.date.localeCompare(a.date);
                    return (a.matchOrder||0) - (b.matchOrder||0);
                  }).map((match, globalIdx) => {
                    const typeInfo = getMatchTypeLabel(match.matchType);
                    const draw = match.isDraw || (!match.isScheduled && match.scoreA === match.scoreB);
                    const sameDateMatches = matches.filter(m => m.date === match.date).sort((a,b) => (a.matchOrder||0)-(b.matchOrder||0));
                    const matchIdx = sameDateMatches.findIndex(m => m.id === match.id);
                    return (
                      <div key={match.id} className={`px-4 py-3 ${match.isScheduled?'bg-orange-50':''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-stone-400 font-mono">{match.date.slice(5)}</span>
                          <span className="text-xs text-stone-400">{matchIdx+1}경기</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                          {match.isScheduled?<span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">대진</span>:draw?<span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">무</span>:match.confirmed?<span className="text-xs text-blue-500 flex items-center gap-0.5"><Lock size={9}/>확정</span>:<span className="text-xs text-stone-300">미확정</span>}
                          <div className="flex-1"></div>
                          {!match.confirmed&&<button onClick={() => openEditMatch(match)} className="text-stone-300 p-1"><Pencil size={13}/></button>}
                          <button onClick={() => deleteMatch(match)} className="text-stone-300 p-1"><Trash2 size={13}/></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`flex-1 text-sm min-w-0 ${!match.isScheduled&&!draw&&match.scoreA>match.scoreB?'font-bold text-emerald-800':draw?'text-stone-600':'text-stone-500'}`}>
                            <div className="truncate"><span className="text-xs text-stone-400 mr-1">포</span>{getMemberName(match.teamA1)}</div>
                            <div className="truncate"><span className="text-xs text-stone-400 mr-1">백</span>{getMemberName(match.teamA2)}</div>
                          </div>
                          {match.isScheduled?(
                            <div className="font-mono text-stone-400 bg-stone-100 px-3 py-1.5 rounded text-sm flex-shrink-0">vs</div>
                          ):(
                            <div className={`font-mono font-bold px-3 py-1.5 rounded text-sm flex-shrink-0 ${draw?'bg-yellow-50 text-yellow-700':'bg-stone-100 text-stone-700'}`}>{match.scoreA} - {match.scoreB}</div>
                          )}
                          <div className={`flex-1 text-sm text-right min-w-0 ${!match.isScheduled&&!draw&&match.scoreB>match.scoreA?'font-bold text-emerald-800':draw?'text-stone-600':'text-stone-500'}`}>
                            <div className="truncate"><span className="text-xs text-stone-400 mr-1">포</span>{getMemberName(match.teamB1)}</div>
                            <div className="truncate"><span className="text-xs text-stone-400 mr-1">백</span>{getMemberName(match.teamB2)}</div>
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
              <button onClick={() => setShowGuestConfig(!showGuestConfig)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-stone-700">
                <div className="flex items-center gap-2"><Users size={15}/>게스트 설정</div>
                {showGuestConfig?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
              </button>
              {showGuestConfig && (
                <div className="px-4 pb-4 space-y-3 border-t border-stone-100 pt-3">
                  {guests.map((guest, i) => (
                    <div key={guest.id} className="flex items-center gap-2">
                      <div className="text-sm text-stone-600 w-16 flex-shrink-0">{i===0?'게스트1':'게스트2'}</div>
                      <input type="text" value={guest.name} onChange={e => setGuests(guests.map(g => g.id===guest.id?{...g,name:e.target.value}:g))} className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm"/>
                      <div className="flex rounded-lg border border-stone-300 overflow-hidden flex-shrink-0">
                        <button onClick={() => setGuests(guests.map(g => g.id===guest.id?{...g,gender:'M'}:g))} className={`px-3 py-2 text-sm font-medium ${guest.gender==='M'?'bg-blue-500 text-white':'bg-white text-stone-600'}`}>남</button>
                        <button onClick={() => setGuests(guests.map(g => g.id===guest.id?{...g,gender:'F'}:g))} className={`px-3 py-2 text-sm font-medium ${guest.gender==='F'?'bg-pink-500 text-white':'bg-white text-stone-600'}`}>여</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <button onClick={() => setShowSortFilter(!showSortFilter)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-stone-700">
                <div className="flex items-center gap-2">
                  <Filter size={15}/>정렬 / 필터
                  <span className="text-xs text-stone-400 font-normal">{memberFilter==='all'?'전체':memberFilter==='regular'?'정회원':'준회원'} · {memberSort==='name'?'이름순':memberSort==='winRate'?'승률순':memberSort==='attendance'?'참석순':'등급순'}</span>
                </div>
                {showSortFilter?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
              </button>
              {showSortFilter && (
                <div className="px-4 pb-4 border-t border-stone-100 pt-3 space-y-3">
                  <div>
                    <div className="text-xs font-medium text-stone-500 mb-2">필터</div>
                    <div className="flex gap-2">
                      {[['all','전체'],['regular','정회원'],['associate','준회원']].map(([v,l]) => (
                        <button key={v} onClick={() => setMemberFilter(v)} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${memberFilter===v?'bg-emerald-800 text-white border-emerald-800':'bg-white text-stone-600 border-stone-200'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-stone-500 mb-2">정렬</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[['name','이름순'],['winRate','승률순'],['attendance','참석순'],['type','등급순']].map(([v,l]) => (
                        <button key={v} onClick={() => setMemberSort(v)} className={`py-2 rounded-lg text-sm font-medium border ${memberSort===v?'bg-emerald-800 text-white border-emerald-800':'bg-white text-stone-600 border-stone-200'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {officers.length > 0 && (
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2"><Crown size={15} className="text-yellow-500"/><h3 className="text-sm font-bold text-stone-800">역대 회장</h3></div>
                <div className="divide-y divide-stone-100">
                  {[...officers].sort((a,b) => b.year-a.year||b.quarter-a.quarter).map(o => {
                    const mName = members.find(m => m.id===o.member_id)?.name||'?';
                    const isCurrent = o.year===currentYear&&o.quarter===currentQuarter;
                    return (
                      <div key={o.id} className="px-4 py-3 flex items-center gap-3">
                        <Crown size={14} className={isCurrent?'text-yellow-500':'text-stone-300'}/>
                        <div className="flex-1"><span className="font-semibold text-stone-800 text-sm">{mName}</span>{isCurrent&&<span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">현재</span>}</div>
                        <span className="text-xs text-stone-500">{o.year}년 {o.quarter}분기</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {getSortedFilteredStats().length===0?<EmptyState icon={Users} title="멤버가 없습니다" desc="아래 + 버튼으로 멤버를 추가하세요"/>:(
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getSortedFilteredStats().map(member => (
                  <div key={member.id} className={`bg-white rounded-lg border p-4 flex items-center gap-3 ${getGenderBg(member.gender)}`}>
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${member.gender==='M'?'bg-blue-100 text-blue-700':'bg-pink-100 text-pink-600'}`}>{member.name.charAt(0)}</div>
                      {member.isPresident&&<div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center"><Crown size={10} className="text-white"/></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-semibold truncate ${getGenderColor(member.gender)}`}>{member.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${getGenderBadge(member.gender)}`}>{member.gender==='M'?'남':'여'}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${member.member_type==='regular'?'bg-emerald-100 text-emerald-700':'bg-stone-100 text-stone-500'}`}>{member.member_type==='regular'?'정회원':'준회원'}</span>
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">{member.rankedTotal===0?`출석 ${member.attendanceCount}회`:`${member.rankedWins}승 ${member.rankedDraws>0?`${member.rankedDraws}무 `:''}${member.rankedLosses}패 · 출석 ${member.attendanceCount}회`}</div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditingMember(member); setEditMemberName(member.name); setEditMemberGender(member.gender); setEditMemberType(member.member_type||'regular'); }} className="text-stone-400 p-2"><Pencil size={15}/></button>
                      <button onClick={() => deleteMember(member.id)} className="text-stone-300 p-2"><Trash2 size={15}/></button>
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
        {activeTab==='members'&&<button onClick={() => setShowAddMember(true)} className="bg-emerald-800 text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-2"><Plus size={18}/><span className="font-medium text-sm">멤버 추가</span></button>}
        {(activeTab==='matches'||activeTab==='ranking')&&members.length>=2&&<button onClick={() => openAddMatch()} className="bg-emerald-800 text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-2"><Plus size={18}/><span className="font-medium text-sm">경기 기록</span></button>}
      </div>

      {/* 회장 설정 모달 */}
      {showOfficerModal && (
        <Modal onClose={() => setShowOfficerModal(false)} title="분기 회장 설정">
          <div className="space-y-3 mb-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-stone-600 mb-1.5">연도</label>
                <input type="number" value={officerYear} onChange={e => setOfficerYear(parseInt(e.target.value))} className="w-full px-3 py-2.5 border border-stone-300 rounded-lg text-center"/>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-stone-600 mb-1.5">분기</label>
                <div className="flex rounded-lg border border-stone-300 overflow-hidden">
                  {QUARTERS.map(q => <button key={q.value} onClick={() => setOfficerQuarter(q.value)} className={`flex-1 py-2.5 text-sm font-medium ${officerQuarter===q.value?'bg-emerald-700 text-white':'bg-white text-stone-600'}`}>{q.value}</button>)}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">{officerYear}년 {officerQuarter}분기 회장</label>
              <select value={officerMemberId} onChange={e => setOfficerMemberId(e.target.value)} className="w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white">
                <option value="">회장 선택</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.gender==='M'?'남':'여'} · {m.member_type==='regular'?'정회원':'준회원'})</option>)}
              </select>
            </div>
            <div className="text-xs text-stone-400">* 비밀번호가 필요합니다</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowOfficerModal(false)} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
            <button onClick={saveOfficer} className="flex-1 px-4 py-2.5 bg-yellow-500 text-white rounded-lg font-medium flex items-center justify-center gap-2"><Crown size={16}/> 설정</button>
          </div>
        </Modal>
      )}

      {/* 점수 입력 모달 (대진 -> 결과) */}
      {showScoreModal && (
        <Modal onClose={() => { setShowScoreModal(false); setScoringMatch(null); }} title="점수 입력">
          {scoringMatch && (
            <div className="space-y-4">
              <div className="bg-stone-50 rounded-lg p-3 text-sm text-stone-600 text-center">
                <div className="font-medium text-stone-800 mb-1">{scoringMatch.date.slice(5)} · {getMatchTypeLabel(scoringMatch.matchType).label}</div>
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <div><span className="text-xs text-stone-400 mr-1">포</span>{getMemberName(scoringMatch.teamA1)}</div>
                    <div><span className="text-xs text-stone-400 mr-1">백</span>{getMemberName(scoringMatch.teamA2)}</div>
                  </div>
                  <div className="text-stone-400 font-bold">vs</div>
                  <div className="text-right">
                    <div><span className="text-xs text-stone-400 mr-1">포</span>{getMemberName(scoringMatch.teamB1)}</div>
                    <div><span className="text-xs text-stone-400 mr-1">백</span>{getMemberName(scoringMatch.teamB2)}</div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <input type="number" min="0" value={inputScoreA} onChange={e => setInputScoreA(e.target.value)} placeholder="팀A 점수" disabled={inputIsDraw}
                  className="flex-1 px-3 py-3 border border-stone-300 rounded-lg text-center font-mono text-xl disabled:bg-stone-100"/>
                <div className="text-stone-400 font-bold text-lg">-</div>
                <input type="number" min="0" value={inputScoreB} onChange={e => setInputScoreB(e.target.value)} placeholder="팀B 점수" disabled={inputIsDraw}
                  className="flex-1 px-3 py-3 border border-stone-300 rounded-lg text-center font-mono text-xl disabled:bg-stone-100"/>
              </div>
              <button onClick={() => setInputIsDraw(!inputIsDraw)}
                className={`w-full py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 ${inputIsDraw?'bg-yellow-100 border-yellow-400 text-yellow-800':'bg-white border-stone-300 text-stone-600'}`}>
                🤝 {inputIsDraw?'무승부로 기록':'무승부인 경우 체크'}
              </button>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={() => { setShowScoreModal(false); setScoringMatch(null); }} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
            <button onClick={saveScore} disabled={!inputIsDraw&&(inputScoreA===''||inputScoreB==='')}
              className="flex-1 px-4 py-2.5 bg-emerald-800 text-white rounded-lg font-medium disabled:bg-stone-300">저장</button>
          </div>
        </Modal>
      )}

      {/* 멤버 추가 모달 */}
      {showAddMember && (
        <Modal onClose={() => setShowAddMember(false)} title="멤버 추가">
          <div className="space-y-3 mb-4">
            <input type="text" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} onKeyDown={e => e.key==='Enter'&&addMember()} placeholder="이름" autoFocus className="w-full px-4 py-3 border border-stone-300 rounded-lg"/>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">성별</label>
              <div className="flex rounded-lg border border-stone-300 overflow-hidden">
                <button onClick={() => setNewMemberGender('M')} className={`flex-1 py-2.5 text-sm font-medium ${newMemberGender==='M'?'bg-blue-500 text-white':'bg-white text-stone-600'}`}>♂ 남자</button>
                <button onClick={() => setNewMemberGender('F')} className={`flex-1 py-2.5 text-sm font-medium ${newMemberGender==='F'?'bg-pink-500 text-white':'bg-white text-stone-600'}`}>♀ 여자</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">회원 등급</label>
              <div className="flex rounded-lg border border-stone-300 overflow-hidden">
                <button onClick={() => setNewMemberType('regular')} className={`flex-1 py-2.5 text-sm font-medium ${newMemberType==='regular'?'bg-emerald-600 text-white':'bg-white text-stone-600'}`}>정회원</button>
                <button onClick={() => setNewMemberType('associate')} className={`flex-1 py-2.5 text-sm font-medium ${newMemberType==='associate'?'bg-stone-500 text-white':'bg-white text-stone-600'}`}>준회원</button>
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
            <input type="text" value={editMemberName} onChange={e => setEditMemberName(e.target.value)} autoFocus className="w-full px-4 py-3 border border-stone-300 rounded-lg"/>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">성별</label>
              <div className="flex rounded-lg border border-stone-300 overflow-hidden">
                <button onClick={() => setEditMemberGender('M')} className={`flex-1 py-2.5 text-sm font-medium ${editMemberGender==='M'?'bg-blue-500 text-white':'bg-white text-stone-600'}`}>♂ 남자</button>
                <button onClick={() => setEditMemberGender('F')} className={`flex-1 py-2.5 text-sm font-medium ${editMemberGender==='F'?'bg-pink-500 text-white':'bg-white text-stone-600'}`}>♀ 여자</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">회원 등급</label>
              <div className="flex rounded-lg border border-stone-300 overflow-hidden">
                <button onClick={() => setEditMemberType('regular')} className={`flex-1 py-2.5 text-sm font-medium ${editMemberType==='regular'?'bg-emerald-600 text-white':'bg-white text-stone-600'}`}>정회원</button>
                <button onClick={() => setEditMemberType('associate')} className={`flex-1 py-2.5 text-sm font-medium ${editMemberType==='associate'?'bg-stone-500 text-white':'bg-white text-stone-600'}`}>준회원</button>
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
        <Modal onClose={() => { setShowAddMatch(false); setEditingMatch(null); }} title={editingMatch?'경기 수정':isScheduledMode?'대진 등록':'경기 기록'}>
          <div className="space-y-3">
            {!editingMatch && (
              <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
                <button onClick={() => setIsScheduledMode(false)} className={`flex-1 py-2 rounded-md text-sm font-medium ${!isScheduledMode?'bg-white text-stone-800 shadow-sm':'text-stone-500'}`}>🎾 경기 결과</button>
                <button onClick={() => setIsScheduledMode(true)} className={`flex-1 py-2 rounded-md text-sm font-medium ${isScheduledMode?'bg-white text-stone-800 shadow-sm':'text-stone-500'}`}>📋 대진 등록</button>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">경기일</label>
              <input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} className="w-full px-3 py-2.5 border border-stone-300 rounded-lg"/>
            </div>
            {currentMatchType && (
              <div className={`text-center text-sm font-bold py-2 rounded-lg ${getMatchTypeLabel(currentMatchType).color}`}>
                {getMatchTypeLabel(currentMatchType).label}{!isRanked(currentMatchType)&&' · 랭킹 미반영'}
              </div>
            )}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <label className="text-xs font-bold text-emerald-800 mb-2 block">🏆 팀 A</label>
              <div className="flex gap-2 mb-2">
                <MemberSelect value={teamA1} onChange={setTeamA1} label="선택" posLabel="포 🟦" exclude={[teamA2,teamB1,teamB2].filter(Boolean)}/>
                <MemberSelect value={teamA2} onChange={setTeamA2} label="선택" posLabel="백 🟧" exclude={[teamA1,teamB1,teamB2].filter(Boolean)}/>
              </div>
              {!isScheduledMode && (
                <input type="number" min="0" value={scoreA} onChange={e => setScoreA(e.target.value)} placeholder="팀 A 점수" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center font-mono text-lg"/>
              )}
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
              <label className="text-xs font-bold text-stone-600 mb-2 block">팀 B</label>
              <div className="flex gap-2 mb-2">
                <MemberSelect value={teamB1} onChange={setTeamB1} label="선택" posLabel="포 🟦" exclude={[teamA1,teamA2,teamB2].filter(Boolean)}/>
                <MemberSelect value={teamB2} onChange={setTeamB2} label="선택" posLabel="백 🟧" exclude={[teamA1,teamA2,teamB1].filter(Boolean)}/>
              </div>
              {!isScheduledMode && (
                <input type="number" min="0" value={scoreB} onChange={e => setScoreB(e.target.value)} placeholder="팀 B 점수" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center font-mono text-lg"/>
              )}
            </div>
            {!isScheduledMode && (
              <button onClick={() => setIsDraw(!isDraw)}
                className={`w-full py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 ${isDraw?'bg-yellow-100 border-yellow-400 text-yellow-800':'bg-white border-stone-300 text-stone-600'}`}>
                🤝 {isDraw?'무승부로 기록':'무승부인 경우 체크'}
              </button>
            )}
            {availablePlayers.length < 4 && (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ 참석자가 부족해요. 캘린더에서 참석자를 먼저 체크해주세요.
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={() => { setShowAddMatch(false); setEditingMatch(null); }} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
            <button onClick={saveMatch} disabled={!isValidMatch||(isScheduledMode?false:!isValidScore)}
              className="flex-1 px-4 py-2.5 bg-emerald-800 text-white rounded-lg font-medium disabled:bg-stone-300">
              {editingMatch?'수정 완료':isScheduledMode?'대진 등록':'저장'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ComboCard({ title, combos, color, emoji, emojiColor }) {
  const bgMap = { emerald: 'bg-emerald-50', red: 'bg-red-50', yellow: 'bg-yellow-50' };
  const textMap = { emerald: 'text-emerald-800', red: 'text-red-700', yellow: 'text-yellow-700' };
  return (
    <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
      <div className={`px-4 py-3 border-b border-stone-100 ${bgMap[color]}`}>
        <h3 className={`font-bold text-sm ${textMap[color]}`}>{title}</h3>
      </div>
      <div className="divide-y divide-stone-100">
        {combos.map((c, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3">
            <div className="text-lg">{emoji[i]||emoji[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-stone-800 text-sm">{c.name1} · {c.name2}</div>
              <div className="text-xs text-stone-500">{c.wins}승 {c.draws>0?`${c.draws}무 `:''}{ c.losses}패{c.avgScore?' · 평균 '+c.avgScore+'점':''}</div>
            </div>
            <div className={`text-xl font-bold ${emojiColor}`}>{c.winRate.toFixed(0)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AwardCard({ label, winner, value }) {
  return (
    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
      <div className="text-xs text-yellow-200 tracking-wider mb-1">{label}</div>
      <div className="text-base font-bold truncate">{winner||'-'}</div>
      <div className="text-xs text-stone-300 mt-0.5">{value}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="bg-white rounded-lg border border-dashed border-stone-300 py-16 px-6 text-center">
      <Icon className="mx-auto text-stone-300 mb-3" size={40}/>
      <div className="font-semibold text-stone-700 mb-1">{title}</div>
      <div className="text-sm text-stone-500">{desc}</div>
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-stone-800">{title}</h3>
          <button onClick={onClose} className="text-stone-400 p-1"><X size={20}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}
