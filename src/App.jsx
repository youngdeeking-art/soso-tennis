import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createClient } from '@supabase/supabase-js';
import { Trophy, Plus, Users, Calendar, Award, X, Trash2, ChevronLeft, ChevronRight, Check, Pencil, Lock, ChevronDown, ChevronUp, BarChart2, Crown, Filter, Save } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const DELETE_PASSWORD = 'soso1234';
const QUARTERS = [{ value: 1 },{ value: 2 },{ value: 3 },{ value: 4 }];

const getMatchType = (players, allMembers) => {
  const genders = players.map(id => allMembers.find(m => m.id === id)?.gender || null);
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
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
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

const CalBadge = ({ children, className }) => (
  <div className={`text-[9px] rounded px-0.5 py-0.5 font-medium leading-tight flex items-center justify-center ${className}`}>
    {children}
  </div>
);

// 게스트 ID에서 성별 추출
const getGuestGender = (id) => {
  const m = id.match(/guest_[\d-]+_([MF])_/);
  return m ? m[1] : 'M';
};

export default function App() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [members, setMembers] = useState([]);
  const [dateGuests, setDateGuests] = useState({}); // { dateStr: [{id,name,gender,isGuest,originalName}] }
  const [matches, setMatches] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [officers, setOfficers] = useState([]);
  const [attendanceConfirmed, setAttendanceConfirmed] = useState({});
  const [loading, setLoading] = useState(true);

  const [localAttendance, setLocalAttendance] = useState(null);
  const [attendanceDirty, setAttendanceDirty] = useState(false);

  const [selectedMatchIds, setSelectedMatchIds] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [editOrderMode, setEditOrderMode] = useState(false); // 순서 편집 모드
  const [localMatchOrder, setLocalMatchOrder] = useState([]); // 로컬 순서
  const [swapMode, setSwapMode] = useState(false); // 선수 교체 모드
  const [swapTarget, setSwapTarget] = useState(null); // 첫 번째 선택 선수

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

  const [showAddMatch, setShowAddMatch] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [isScheduledMode, setIsScheduledMode] = useState(false);
  const [teamA1, setTeamA1] = useState('');
  const [teamA2, setTeamA2] = useState('');
  const [teamB1, setTeamB1] = useState('');
  const [teamB2, setTeamB2] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [isDraw, setIsDraw] = useState(false);
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);

  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scoringMatch, setScoringMatch] = useState(null);
  const [inputScoreA, setInputScoreA] = useState('');
  const [inputScoreB, setInputScoreB] = useState('');
  const [inputIsDraw, setInputIsDraw] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
  const [importPreview, setImportPreview] = useState(null);

  // 자동 대진 생성
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [showDayResultModal, setShowDayResultModal] = useState(false);
  const [dayResultDate, setDayResultDate] = useState(null);
  const [autoDate, setAutoDate] = useState(new Date().toISOString().split('T')[0]);
  const [autoRatioMB, setAutoRatioMB] = useState(2); // 남복
  const [autoRatioMX, setAutoRatioMX] = useState(4); // 혼복
  const [autoRatioFB, setAutoRatioFB] = useState(2); // 여복
  const [autoPreview, setAutoPreview] = useState(null);
  const [swapSelected, setSwapSelected] = useState([]); // 교체할 선수 2명 선택

  const today = new Date().toISOString().split('T')[0];
  const [calendarMode, setCalendarMode] = useState('week');
  const [currentWeekBase, setCurrentWeekBase] = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [attendanceOpen, setAttendanceOpen] = useState(true);

  const [showOfficerModal, setShowOfficerModal] = useState(false);
  const [officerYear, setOfficerYear] = useState(new Date().getFullYear());
  const [officerQuarter, setOfficerQuarter] = useState(Math.ceil((new Date().getMonth()+1)/3));
  const [officerMemberId, setOfficerMemberId] = useState('');

  const [analysisPeriod, setAnalysisPeriod] = useState('all');
  const [analysisQuarter, setAnalysisQuarter] = useState(Math.ceil((new Date().getMonth()+1)/3));
  const [rankingPeriod, setRankingPeriod] = useState('quarter'); // quarter|month|year|all
  const [rankingYear, setRankingYear] = useState(new Date().getFullYear());
  const [rankingQuarter, setRankingQuarter] = useState(Math.ceil((new Date().getMonth()+1)/3));
  const [rankingMonth, setRankingMonth] = useState(new Date().getMonth()+1);
  const [analysisSection, setAnalysisSection] = useState('partner');

  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth()+1)/3);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (selectedDate) {
      setLocalAttendance(null);
      setAttendanceDirty(false);
      setSelectMode(false);
      setSelectedMatchIds([]);
    }
  }, [selectedDate]);

  // 게스트 DB에서 전체 로드
  const loadGuests = async () => {
    const { data, error } = await supabase.from('date_guests').select('*').order('guest_order', { ascending: true });
    if (error) { console.error('게스트 로드 실패:', error); return; }
    const dgMap = {};
    (data || []).forEach(g => {
      if (!dgMap[g.attend_date]) dgMap[g.attend_date] = [];
      dgMap[g.attend_date].push({ id: g.id, name: g.name, gender: g.gender, isGuest: true, originalName: g.original_name });
    });
    setDateGuests(dgMap);
  };

  // DnD 센서 설정 - 모바일 꾹 누르기 500ms 후 드래그 시작
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localMatchOrder.findIndex(m => m.id === active.id);
    const newIndex = localMatchOrder.findIndex(m => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setLocalMatchOrder(prev => arrayMove(prev, oldIndex, newIndex));
  };

  const saveMatchOrder = async () => {
    for (let i = 0; i < localMatchOrder.length; i++) {
      await supabase.from('matches').update({ match_order: i + 1 }).eq('id', localMatchOrder[i].id);
    }
    setEditOrderMode(false);
    setLocalMatchOrder([]);
    await loadAll();
  };

  // 선수 교체 (DB 저장)
  const handleSwapPlayer = async (targetPlayer, slot, matchId) => {
    if (!swapTarget) {
      setSwapTarget({ player: targetPlayer, slot, matchId });
      return;
    }
    if (swapTarget.player.id === targetPlayer.id) {
      setSwapTarget(null);
      return;
    }
    // 두 선수 교체
    const slotMap = { a1: 'team_a1', a2: 'team_a2', b1: 'team_b1', b2: 'team_b2' };
    if (swapTarget.matchId === matchId) {
      // 같은 경기 내 교체
      await supabase.from('matches').update({
        [slotMap[swapTarget.slot]]: targetPlayer.id,
        [slotMap[slot]]: swapTarget.player.id,
      }).eq('id', matchId);
    } else {
      // 다른 경기 간 교체
      await supabase.from('matches').update({ [slotMap[swapTarget.slot]]: targetPlayer.id }).eq('id', swapTarget.matchId);
      await supabase.from('matches').update({ [slotMap[slot]]: swapTarget.player.id }).eq('id', matchId);
    }
    setSwapTarget(null);
    setSwapMode(false);
    await loadAll();
  };

  // 포/백 교체 (DB 저장)
  const swapPoBack = async (match, team) => {
    if (team === 'A') {
      await supabase.from('matches').update({ team_a1: match.teamA2, team_a2: match.teamA1 }).eq('id', match.id);
    } else {
      await supabase.from('matches').update({ team_b1: match.teamB2, team_b2: match.teamB1 }).eq('id', match.id);
    }
    await loadAll();
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      const [{ data: m }, { data: mt }, { data: att }, { data: off }, { data: ac }] = await Promise.all([
        supabase.from('members').select('*').order('created_at'),
        supabase.from('matches').select('*').order('match_order', { ascending: true }),
        supabase.from('attendance').select('*'),
        supabase.from('officers').select('*'),
        supabase.from('attendance_confirmed').select('*'),
      ]);
      setMembers(m || []);
      setMatches((mt || []).map(x => ({
        id: x.id, teamA1: x.team_a1, teamA2: x.team_a2, teamB1: x.team_b1, teamB2: x.team_b2,
        scoreA: x.score_a, scoreB: x.score_b, date: x.match_date,
        confirmed: x.confirmed || false, matchType: x.match_type || 'JB',
        isDraw: x.is_draw || false, isScheduled: x.is_scheduled || false, matchOrder: x.match_order || 0
      })));
      const attMap = {};
      (att || []).forEach(a => { if (!attMap[a.attend_date]) attMap[a.attend_date] = []; attMap[a.attend_date].push(a.member_id); });
      setAttendance(attMap);
      setOfficers(off || []);
      const acMap = {};
      (ac || []).forEach(a => { acMap[a.attend_date] = a.confirmed; });
      setAttendanceConfirmed(acMap);
      await loadGuests();
    } catch (e) {
      alert('데이터 로딩 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const checkPassword = () => {
    const pw = prompt('비밀번호를 입력하세요:');
    if (pw !== DELETE_PASSWORD) { alert('비밀번호가 틀렸습니다.'); return false; }
    return true;
  };

  // 게스트 추가 - DB에 바로 저장, 완료 후 전체 다시 로드
  const addDateGuest = async (date, gender) => {
    if (attendanceConfirmed[date]) { if (!checkPassword()) return; }
    const current = dateGuests[date] || [];
    const sameGenderCount = current.filter(g => g.gender === gender).length;
    const num = sameGenderCount + 1;
    const name = gender === 'M' ? `남게스트${num}` : `여게스트${num}`;
    const id = `guest_${date}_${gender}_${Date.now()}`;
    const guestOrder = current.length + 1;

    const { error } = await supabase.from('date_guests').insert({
      id, attend_date: date, name, gender, original_name: null, guest_order: guestOrder
    });

    if (error) {
      alert('게스트 추가 실패: ' + error.message);
      return;
    }
    await loadGuests();
  };

  // 게스트 삭제 - DB에서 바로 삭제, 완료 후 전체 다시 로드
  const removeDateGuest = async (date, guestId) => {
    if (attendanceConfirmed[date]) { if (!checkPassword()) return; }
    const { error } = await supabase.from('date_guests').delete().eq('id', guestId);
    if (error) { alert('게스트 삭제 실패: ' + error.message); return; }
    await loadGuests();
    if (teamA1 === guestId) setTeamA1('');
    if (teamA2 === guestId) setTeamA2('');
    if (teamB1 === guestId) setTeamB1('');
    if (teamB2 === guestId) setTeamB2('');
  };

  const toggleLocalAttendance = async (memberId) => {
    if (attendanceConfirmed[selectedDate]) {
      if (!checkPassword()) return;
      // 비번 맞으면 확정 자동 해제
      await supabase.from('attendance_confirmed').upsert({ attend_date: selectedDate, confirmed: false }, { onConflict: 'attend_date' });
      setAttendanceConfirmed(prev => ({ ...prev, [selectedDate]: false }));
    }
    const base = localAttendance || (attendance[selectedDate] || []);
    const updated = base.includes(memberId) ? base.filter(id => id !== memberId) : [...base, memberId];
    setLocalAttendance(updated);
    setAttendanceDirty(true);
  };

  const saveAttendance = async () => {
    if (!attendanceDirty) return;
    if (attendanceConfirmed[selectedDate]) { if (!checkPassword()) return; }
    const current = attendance[selectedDate] || [];
    const next = localAttendance || current;
    for (const id of next.filter(id => !current.includes(id))) await supabase.from('attendance').insert({ attend_date: selectedDate, member_id: id });
    for (const id of current.filter(id => !next.includes(id))) await supabase.from('attendance').delete().eq('attend_date', selectedDate).eq('member_id', id);
    setAttendance(prev => ({ ...prev, [selectedDate]: next }));
    setLocalAttendance(null);
    setAttendanceDirty(false);
  };

  const confirmAttendance = async (date) => {
    if (!checkPassword()) return;
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
    await loadAll();
  };

  const deleteOfficer = async (id) => { if (!checkPassword()) return; await supabase.from('officers').delete().eq('id', id); await loadAll(); };
  const getCurrentOfficer = (year, quarter) => { const o = officers.find(o => o.year === year && o.quarter === quarter); if (!o) return null; return { ...o, name: members.find(m => m.id === o.member_id)?.name || '?' }; };
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
    await loadAll();
  };

  const getAvailablePlayers = (date) => {
    const attendees = attendance[date] || [];
    return [...members.filter(m => attendees.includes(m.id)), ...(dateGuests[date] || [])];
  };

  const getAllPlayersForDate = (date) => [...members, ...(dateGuests[date] || [])];

  const getMemberName = (id, date) => {
    if (!id) return '?';
    if (id.startsWith('guest_')) {
      const guests = date ? (dateGuests[date] || []) : [];
      const g = guests.find(g => g.id === id);
      if (g) return g.name;
      const gender = getGuestGender(id);
      return gender === 'M' ? '남게스트' : '여게스트';
    }
    return members.find(m => m.id === id)?.name || '?';
  };

  const normalizeId = (id) => {
    if (!id) return id;
    if (id.startsWith('guest_')) return getGuestGender(id) === 'M' ? '__GUEST_M__' : '__GUEST_F__';
    return id;
  };

  const normalizeNameForAnalysis = (id) => {
    if (id === '__GUEST_M__') return '남게스트';
    if (id === '__GUEST_F__') return '여게스트';
    return members.find(m => m.id === id)?.name || '?';
  };

  const currentPlayers = [teamA1, teamA2, teamB1, teamB2].filter(Boolean);
  const currentMatchType = currentPlayers.length === 4 ? getMatchType(currentPlayers, getAllPlayersForDate(matchDate)) : null;
  const isValidMatch = teamA1 && teamA2 && teamB1 && teamB2 && new Set([teamA1, teamA2, teamB1, teamB2]).size === 4;
  const isValidScore = scoreA !== '' && scoreB !== '';

  const getNextMatchOrder = (date) => {
    const dm = matches.filter(m => m.date === date);
    return dm.length > 0 ? Math.max(...dm.map(m => m.matchOrder || 0)) + 1 : 1;
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
    setScoreA(String(match.scoreA ?? '')); setScoreB(String(match.scoreB ?? ''));
    setIsDraw(match.isDraw || false);
    setIsScheduledMode(match.isScheduled || false);
    setMatchDate(match.date);
    setShowAddMatch(true);
  };

  const openScoreModal = (match) => { setScoringMatch(match); setInputScoreA(''); setInputScoreB(''); setInputIsDraw(false); setShowScoreModal(true); };

  const saveScore = async () => {
    if (!scoringMatch) return;
    if (!inputIsDraw && (inputScoreA === '' || inputScoreB === '')) return;
    const drawVal = inputIsDraw || parseInt(inputScoreA) === parseInt(inputScoreB);
    const { error } = await supabase.from('matches').update({
      score_a: inputIsDraw ? 0 : parseInt(inputScoreA),
      score_b: inputIsDraw ? 0 : parseInt(inputScoreB),
      is_draw: drawVal, is_scheduled: false
    }).eq('id', scoringMatch.id);
    if (error) { alert('저장 실패: ' + error.message); return; }
    setShowScoreModal(false); setScoringMatch(null);
    await loadAll();
  };

  const saveMatch = async () => {
    if (!isValidMatch) return;
    if (!isScheduledMode && !isValidScore) return;
    const players = [teamA1, teamA2, teamB1, teamB2];
    const matchType = getMatchType(players, getAllPlayersForDate(matchDate));
    const drawVal = !isScheduledMode && (isDraw || parseInt(scoreA) === parseInt(scoreB));
    if (editingMatch) {
      const { error } = await supabase.from('matches').update({
        team_a1: teamA1, team_a2: teamA2, team_b1: teamB1, team_b2: teamB2,
        score_a: isScheduledMode ? null : parseInt(scoreA),
        score_b: isScheduledMode ? null : parseInt(scoreB),
        match_date: matchDate, match_type: matchType,
        is_draw: isScheduledMode ? false : drawVal, is_scheduled: isScheduledMode
      }).eq('id', editingMatch.id);
      if (error) { alert('수정 실패: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('matches').insert({
        id: Date.now().toString(),
        team_a1: teamA1, team_a2: teamA2, team_b1: teamB1, team_b2: teamB2,
        score_a: isScheduledMode ? null : parseInt(scoreA),
        score_b: isScheduledMode ? null : parseInt(scoreB),
        match_date: matchDate, confirmed: false, match_type: matchType,
        is_draw: isScheduledMode ? false : drawVal, is_scheduled: isScheduledMode,
        match_order: getNextMatchOrder(matchDate)
      });
      if (error) { alert('저장 실패: ' + error.message); return; }
      const realPlayers = players.filter(id => !id.startsWith('guest'));
      if (realPlayers.length > 0 && !isScheduledMode) {
        await supabase.from('attendance').upsert(realPlayers.map(id => ({ attend_date: matchDate, member_id: id })), { onConflict: 'attend_date,member_id' });
      }
    }
    setTeamA1(''); setTeamA2(''); setTeamB1(''); setTeamB2('');
    setScoreA(''); setScoreB(''); setIsDraw(false);
    setMatchDate(today); setShowAddMatch(false); setEditingMatch(null);
    await loadAll();
  };

  const deleteMatch = async (match) => {
    if (match.confirmed) { if (!checkPassword()) return; }
    if (!confirm('이 경기 기록을 삭제하시겠습니까?')) return;
    await supabase.from('matches').delete().eq('id', match.id);
    await loadAll();
  };

  const toggleSelectMatch = (id) => setSelectedMatchIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const deleteSelectedMatches = async () => {
    if (selectedMatchIds.length === 0) return;
    if (!checkPassword()) return;
    if (!confirm(`선택한 ${selectedMatchIds.length}개 경기를 삭제하시겠습니까?`)) return;
    for (const id of selectedMatchIds) await supabase.from('matches').delete().eq('id', id);
    setSelectedMatchIds([]); setSelectMode(false);
    await loadAll();
  };

  const deleteAllDateMatches = async (date) => {
    if (!checkPassword()) return;
    const dm = matches.filter(m => m.date === date);
    if (!confirm(`${date} 경기 ${dm.length}개를 전부 삭제하시겠습니까?`)) return;
    for (const m of dm) await supabase.from('matches').delete().eq('id', m.id);
    setSelectMode(false); setSelectedMatchIds([]);
    await loadAll();
  };

  const confirmDateMatches = async (date) => {
    const dm = matches.filter(m => m.date === date && !m.confirmed && !m.isScheduled);
    if (dm.length === 0) { alert('확정할 경기가 없습니다.'); return; }
    if (!confirm(`${date} 경기 ${dm.length}개를 확정하시겠습니까?`)) return;
    for (const m of dm) await supabase.from('matches').update({ confirmed: true }).eq('id', m.id);
    await loadAll();
  };

  const unconfirmDateMatches = async (date) => {
    if (!checkPassword()) return;
    await supabase.from('matches').update({ confirmed: false }).eq('match_date', date);
    await loadAll();
  };

  // ───────────────────────────────
  // 자동 대진 생성
  // ───────────────────────────────
  // 특정 날짜의 개인별 통계
  const getDayStats = (date) => {
    const dayMatches = matches.filter(m => m.date === date && !m.isScheduled && m.scoreA !== null);
    const attendees = attendance[date] || [];
    const dayGuests = dateGuests[date] || [];
    const dayPlayers = [
      ...members.filter(m => attendees.includes(m.id)),
      ...dayGuests
    ];

    return dayPlayers.map(player => {
      let wins = 0, losses = 0, draws = 0, gamesWon = 0, gamesLost = 0;
      dayMatches.forEach(m => {
        const inA = m.teamA1 === player.id || m.teamA2 === player.id;
        const inB = m.teamB1 === player.id || m.teamB2 === player.id;
        if (!inA && !inB) return;
        const draw = m.isDraw || m.scoreA === m.scoreB;
        const won = !draw && (inA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA);
        if (draw) { draws++; gamesWon += inA ? m.scoreA : m.scoreB; gamesLost += inA ? m.scoreB : m.scoreA; }
        else if (won) { wins++; gamesWon += inA ? m.scoreA : m.scoreB; gamesLost += inA ? m.scoreB : m.scoreA; }
        else { losses++; gamesWon += inA ? m.scoreA : m.scoreB; gamesLost += inA ? m.scoreB : m.scoreA; }
      });
      const total = wins + losses + draws;
      const winRate = total > 0 ? ((wins + draws * 0.5) / total * 100) : 0;
      return { ...player, wins, losses, draws, total, winRate, gamesWon, gamesLost };
    }).filter(p => p.total > 0)
      .sort((a, b) => b.winRate - a.winRate || b.gamesWon - a.gamesWon || a.gamesLost - b.gamesLost);
  };

  // 당일 파트너 통계
  const getDayPartnerStats = (date) => {
    const dayMatches = matches.filter(m => m.date === date && !m.isScheduled && m.scoreA !== null);
    const combos = {};
    dayMatches.forEach(m => {
      [
        { pair: [m.teamA1, m.teamA2].sort(), won: !m.isDraw && m.scoreA > m.scoreB, draw: m.isDraw || m.scoreA === m.scoreB },
        { pair: [m.teamB1, m.teamB2].sort(), won: !m.isDraw && m.scoreB > m.scoreA, draw: m.isDraw || m.scoreA === m.scoreB }
      ].forEach(({ pair, won, draw }) => {
        const key = pair.join('|');
        if (!combos[key]) combos[key] = { ids: pair, wins: 0, losses: 0, draws: 0 };
        if (draw) combos[key].draws++; else if (won) combos[key].wins++; else combos[key].losses++;
      });
    });
    return Object.values(combos).map(c => ({
      ...c, total: c.wins + c.losses + c.draws,
      winRate: c.wins + c.losses + c.draws > 0 ? ((c.wins + c.draws * 0.5) / (c.wins + c.losses + c.draws) * 100) : 0,
      name1: getMemberName(c.ids[0], date), name2: getMemberName(c.ids[1], date)
    })).filter(c => c.total >= 1).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
  };

  const generateAutoSchedule = () => {
    const players = getAvailablePlayers(autoDate);
    if (players.length < 4) { alert('참석자가 4명 이상이어야 해요!'); return; }

    const totalGames = autoRatioMB + autoRatioMX + autoRatioFB;
    const males = players.filter(p => p.gender === 'M');
    const females = players.filter(p => p.gender === 'F');

    // 승률 점수 (없으면 50)
    const getScore = (id) => {
      const stat = allStats.find(s => s.id === id);
      return (!stat || stat.rankedTotal === 0) ? 50 : stat.winRate;
    };

    // 헬퍼
    const pairKey = (a, b) => [a, b].sort().join('|');
    const matchKey = (ids) => [...ids].sort().join('|');

    // 추적
    const usedMatches = new Set(); // 같은 4명 조합
    const partnerCount = {};       // 파트너 횟수
    const playCount = {};          // 총 출전 횟수
    const lastPlayedGame = {};     // 마지막 출전 경기 인덱스
    const consecCount = {};        // 연속 출전 수

    players.forEach(p => { playCount[p.id] = 0; lastPlayedGame[p.id] = -99; consecCount[p.id] = 0; });

    const updateTracking = (a1, a2, b1, b2, gi) => {
      const ids = [a1.id, a2.id, b1.id, b2.id];
      usedMatches.add(matchKey(ids));
      const pk1 = pairKey(a1.id, a2.id), pk2 = pairKey(b1.id, b2.id);
      partnerCount[pk1] = (partnerCount[pk1]||0) + 1;
      partnerCount[pk2] = (partnerCount[pk2]||0) + 1;
      ids.forEach(id => {
        consecCount[id] = lastPlayedGame[id] === gi - 1 ? consecCount[id] + 1 : 0;
        lastPlayedGame[id] = gi;
        playCount[id]++;
      });
    };

    // 조합 점수 계산 (낮을수록 좋음)
    const scoreCombo = (a1, a2, b1, b2, gi, strictNoDup) => {
      const ids = [a1.id, a2.id, b1.id, b2.id];
      const mk = matchKey(ids);
      // 같은 4명 조합 이미 있으면 strictNoDup모드에서 무한대
      if (strictNoDup && usedMatches.has(mk)) return Infinity;

      let score = 0;

      // 팀 밸런스 (낮을수록 좋음 → 0 가중치 높게)
      const aAvg = (getScore(a1.id) + getScore(a2.id)) / 2;
      const bAvg = (getScore(b1.id) + getScore(b2.id)) / 2;
      score += Math.abs(aAvg - bAvg) * 2;

      // 파트너 중복 페널티
      score += (partnerCount[pairKey(a1.id, a2.id)]||0) * 15;
      score += (partnerCount[pairKey(b1.id, b2.id)]||0) * 15;

      // 연속 출전 페널티 (3경기 연속이면 매우 높게)
      ids.forEach(id => {
        const consec = lastPlayedGame[id] === gi - 1 ? consecCount[id] + 1 : 0;
        if (consec >= 3) score += 100; // 3연속 강력 억제
        else if (consec === 2) score += 30;
        else if (consec === 1) score += 5;
      });

      // 출전 횟수 균형
      const maxPlay = Math.max(...ids.map(id => playCount[id]));
      const minPlayAll = Math.min(...players.map(p => playCount[p.id]));
      score += (maxPlay - minPlayAll) * 3;

      return score;
    };

    // 모든 가능한 조합 생성
    const getCandidates = (type) => {
      const candidates = [];
      if (type === 'MB') {
        if (males.length < 4) return [];
        for (let i=0;i<males.length;i++) for (let j=i+1;j<males.length;j++)
          for (let k=0;k<males.length;k++) { if(k===i||k===j) continue;
            for (let l=k+1;l<males.length;l++) { if(l===i||l===j) continue;
              candidates.push({ a1:males[i], a2:males[j], b1:males[k], b2:males[l] });
            }}
      } else if (type === 'FB') {
        if (females.length < 4) return [];
        for (let i=0;i<females.length;i++) for (let j=i+1;j<females.length;j++)
          for (let k=0;k<females.length;k++) { if(k===i||k===j) continue;
            for (let l=k+1;l<females.length;l++) { if(l===i||l===j) continue;
              candidates.push({ a1:females[i], a2:females[j], b1:females[k], b2:females[l] });
            }}
      } else { // MX: 여자=포, 남자=백
        if (males.length < 2 || females.length < 2) return [];
        for (let fi=0;fi<females.length;fi++) for (let fj=0;fj<females.length;fj++) { if(fi===fj) continue;
          for (let mi=0;mi<males.length;mi++) for (let mj=0;mj<males.length;mj++) { if(mi===mj) continue;
            candidates.push({ a1:females[fi], a2:males[mi], b1:females[fj], b2:males[mj] });
          }}
      }
      return candidates;
    };

    // 경기 타입 순서 생성
    const gameTypes = [];
    for (let i=0;i<autoRatioMB;i++) gameTypes.push('MB');
    for (let i=0;i<autoRatioFB;i++) gameTypes.push('FB');
    for (let i=0;i<autoRatioMX;i++) gameTypes.push('MX');
    // 타입 섞기
    for (let i=gameTypes.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [gameTypes[i],gameTypes[j]]=[gameTypes[j],gameTypes[i]]; }

    const games = [];

    for (let gi = 0; gi < gameTypes.length; gi++) {
      const type = gameTypes[gi];
      const candidates = getCandidates(type);
      if (candidates.length === 0) continue;

      // 1차: 중복 없이 최적 선택
      let best = null, bestScore = Infinity;
      for (const c of candidates) {
        const s = scoreCombo(c.a1, c.a2, c.b1, c.b2, gi, true);
        if (s < bestScore) { bestScore = s; best = c; }
      }

      // 2차: 중복 없는 조합이 없으면 (인원 부족) 파트너만 바꿔서 선택
      if (best === null || bestScore === Infinity) {
        bestScore = Infinity;
        for (const c of candidates) {
          const s = scoreCombo(c.a1, c.a2, c.b1, c.b2, gi, false);
          if (s < bestScore) { bestScore = s; best = c; }
        }
      }

      if (best) {
        games.push({ ...best, type });
        updateTracking(best.a1, best.a2, best.b1, best.b2, gi);
      }
    }

    setAutoPreview(games);
  };

  const applyAutoSchedule = async () => {
    if (!autoPreview || autoPreview.length === 0) return;
    const baseOrder = matches.filter(m => m.date === autoDate).length;
    for (let i = 0; i < autoPreview.length; i++) {
      const g = autoPreview[i];
      await supabase.from('matches').insert({
        id: `${Date.now()}_auto_${i}`,
        team_a1: g.a1.id, team_a2: g.a2.id, team_b1: g.b1.id, team_b2: g.b2.id,
        score_a: null, score_b: null, match_date: autoDate,
        confirmed: false, match_type: g.type, is_draw: false,
        is_scheduled: true, match_order: baseOrder + i + 1
      });
    }
    await loadAll();
    setShowAutoModal(false);
    setAutoPreview(null);
    alert(`${autoPreview.length}경기 대진이 등록됐어요!`);
  };

  // ───────────────────────────────
  // 대진표 파싱 (개선)
  // ───────────────────────────────
  const parseImportText = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const attendeeNames = [], guestNames = [], matchList = [];
    let section = '', currentMatch = null;

    const cleanName = (n) => { let r = n.replace(/\(게스트\)|\(Guest\)/gi,'').replace(/\(.*?\)/g,'').trim(); r = r.replace(/^남자게스트/, '남게스트').replace(/^여자게스트/, '여게스트'); return r; };
    const isGuest = (n) => n.includes('(게스트)') || n.includes('(Guest)');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('참석자')) { section = 'attendees'; continue; }

      // 형식1: ■ 21:00 혼복①
      if (line.match(/^[■●▶◆]\s*\d{2}:\d{2}/)) {
        if (currentMatch) matchList.push(currentMatch);
        const tm = line.match(/^[■●▶◆]\s*(\d{2}:\d{2})\s*(.*)/);
        currentMatch = { time: tm?.[1]||'', title: tm?.[2]||'', teamA: [], teamB: [], side: 'A' };
        section = 'match'; continue;
      }

      // 형식2: 21:00 (남복 1)
      if (line.match(/^\d{2}:\d{2}/)) {
        if (currentMatch) matchList.push(currentMatch);
        const tm = line.match(/^(\d{2}:\d{2})\s*(.*)/);
        currentMatch = { time: tm?.[1]||'', title: tm?.[2]||'', teamA: [], teamB: [], side: 'A' };
        section = 'match'; continue;
      }

      // 형식3: 1경기 (21:00) [혼복] 또는 ■ 1경기 (21:00)
      if (line.match(/^[■●▶◆]?\s*\d+경기/)) {
        if (currentMatch) matchList.push(currentMatch);
        const tm = line.match(/(\d{2}:\d{2})/);
        currentMatch = { time: tm?.[1]||'', title: line, teamA: [], teamB: [], side: 'A' };
        section = 'match'; continue;
      }

      // 형식2 경기줄: "신영대 / 남게스트 vs 윤찬민 / 최푸름"
      if (section === 'match' && currentMatch && line.match(/\s+vs\s+/i)) {
        const parts = line.split(/\s+vs\s+/i);
        parts[0].split('/').map(n=>cleanName(n)).filter(Boolean).forEach(n => currentMatch.teamA.push(n));
        if (parts[1]) parts[1].split('/').map(n=>cleanName(n)).filter(Boolean).forEach(n => currentMatch.teamB.push(n));
        continue;
      }

      if (section === 'attendees') {
        if (line === '남자' || line === '여자') continue;
        line.split(/[\/,]/).map(n => n.trim()).filter(Boolean).forEach(name => {
          if (isGuest(name)) guestNames.push(cleanName(name));
          else attendeeNames.push(name);
        });
        continue;
      }

      if (section === 'match' && currentMatch) {
        if (line === 'vs' || line === 'VS') { currentMatch.side = 'B'; continue; }
        line.split(/[,،、]/).map(n => n.trim()).filter(Boolean).forEach(name => {
          const cn = cleanName(name);
          if (currentMatch.side === 'A') currentMatch.teamA.push(cn);
          else currentMatch.teamB.push(cn);
        });
      }
    }
    if (currentMatch) matchList.push(currentMatch);
    return { attendeeNames, guestNames, matchList };
  };

  // 이름 유사도 매칭 (공백/괄호 제거 후 비교)
  const normalizeName = (name) => name.replace(/\s|\(.*?\)/g, '').trim();

  const findMemberByName = (name) => {
    const normalized = normalizeName(name);
    let found = members.find(m => m.name === name);
    if (found) return found;
    found = members.find(m => normalizeName(m.name) === normalized);
    if (found) return found;
    found = members.find(m => m.name.includes(normalized) || normalized.includes(m.name));
    return found || null;
  };

  // 이름이 게스트인지 확인 (남게스트1, 남게스트2, 여게스트1 등)
  const isGuestName = (name) => {
    const n = name.trim();
    return /^(남게스트|여게스트|남자게스트|여자게스트)\d*$/.test(n) || n.includes('(게스트)') || n.includes('(Guest)');
  };
  const getGuestGenderFromName = (name) => {
    const n = name.trim();
    return (n.startsWith('여게스트') || n.startsWith('여자게스트')) ? 'F' : 'M';
  };
  // 남자게스트1 → 남게스트1 정규화
  const normalizeGuestName = (name) => {
    return name.replace(/^남자게스트/, '남게스트').replace(/^여자게스트/, '여게스트');
  };
  // 게스트 이름으로 DB 게스트 찾기 (남게스트1 → 해당 날짜의 남게스트1)
  const findGuestByName = (name, date) => {
    const guests = dateGuests[date] || [];
    // 정확히 일치
    const exact = guests.find(g => g.name === name);
    if (exact) return exact;
    // originalName 일치
    const byOrig = guests.find(g => g.originalName === name);
    if (byOrig) return byOrig;
    return null;
  };

  const handleImportPreview = () => {
    if (!importText.trim()) return;
    const parsed = parseImportText(importText);
    const matched = [], unmatched = [], fuzzyMatched = [];

    parsed.attendeeNames.forEach(name => {
      // 게스트 이름이면 guestNames로 이동
      if (isGuestName(name)) { parsed.guestNames.push(name); return; }
      const exact = members.find(m => m.name === name);
      if (exact) { matched.push({ input: name, member: exact }); return; }
      const fuzzy = findMemberByName(name);
      if (fuzzy) { fuzzyMatched.push({ input: name, member: fuzzy }); return; }
      unmatched.push(name);
    });
    // matchList에서도 게스트 이름 추출
    parsed.matchList.forEach(m => {
      [...m.teamA, ...m.teamB].forEach(name => {
        if (isGuestName(name) && !parsed.guestNames.includes(name)) {
          parsed.guestNames.push(name);
        }
      });
    });

    // 경기에서 등장하는 이름도 체크
    const matchNames = new Set();
    parsed.matchList.forEach(m => { [...m.teamA, ...m.teamB].forEach(n => matchNames.add(n)); });
    const allKnownNames = new Set([
      ...matched.map(x => x.input),
      ...fuzzyMatched.map(x => x.input),
      ...parsed.guestNames
    ]);
    const unknownInMatches = [...matchNames].filter(n => !allKnownNames.has(n) && !members.find(m => m.name === n) && !findMemberByName(n));

    const existingScheduled = matches.filter(m => m.date === importDate && m.isScheduled);
    setImportPreview({
      ...parsed,
      matched, fuzzyMatched, unmatched, unknownInMatches,
      hasDuplicate: existingScheduled.length > 0,
      existingCount: existingScheduled.length
    });
  };

  const applyImport = async (date, preview) => {
    if (!preview) return;
    const { matched, fuzzyMatched, guestNames, matchList } = preview;

    // 1. 참석자 저장 (정확 매칭 + 유사 매칭)
    const allMatchedMembers = [...(matched || []).map(x => x.member), ...(fuzzyMatched || []).map(x => x.member)];
    const memberIds = [...new Set(allMatchedMembers.map(m => m.id))];
    const current = attendance[date] || [];
    for (const id of memberIds.filter(id => !current.includes(id))) await supabase.from('attendance').insert({ attend_date: date, member_id: id });

    // 2. 게스트 추가 - 중복 없이 DB에 저장
    const existingGuests = dateGuests[date] || [];
    const guestIdMap = {};
    const uniqueGuestNames = [...new Set(guestNames)];

    for (let i = 0; i < uniqueGuestNames.length; i++) {
      const name = uniqueGuestNames[i];
      // 기존 게스트에서 이름 또는 originalName으로 찾기
      const existing = existingGuests.find(g => g.originalName === name || g.name === name);
      if (existing) { guestIdMap[name] = existing.id; continue; }
      // 멤버 목록에서 성별 추정, 게스트 이름이면 이름으로 성별 추정
      const knownMember = members.find(m => m.name === name);
      const gender = knownMember ? knownMember.gender : isGuestName(name) ? getGuestGenderFromName(name) : 'M';
      const currentGuests = [...existingGuests, ...Object.values(guestIdMap).map(id => ({ id, gender }))];
      const sameGenderCount = existingGuests.filter(g => g.gender === gender).length + Object.values(guestIdMap).filter(id => getGuestGender(id) === gender).length;
      const num = sameGenderCount + 1;
      const guestName = gender === 'M' ? `남게스트${num}` : `여게스트${num}`;
      const guestId = `guest_${date}_${gender}_${Date.now() + i}`;
      const { error } = await supabase.from('date_guests').insert({
        id: guestId, attend_date: date, name: guestName, gender, original_name: name, guest_order: existingGuests.length + i + 1
      });
      if (!error) guestIdMap[name] = guestId;
    }

    // 3. 전체 플레이어 맵 (정확매칭 + 유사매칭 + 게스트)
    // DB에서 직접 읽어오기 (state 업데이트 타이밍 문제 방지)
    const { data: freshGuestData } = await supabase.from('date_guests').select('*').eq('attend_date', date);
    const freshGuests = (freshGuestData || []).map(g => ({ id: g.id, name: g.name, gender: g.gender, originalName: g.original_name }));
    await loadGuests(); // state도 업데이트

    const allPlayerMap = {};
    members.forEach(m => { allPlayerMap[m.name] = { id: m.id, gender: m.gender }; });
    if (matched) matched.forEach(x => { allPlayerMap[x.input] = { id: x.member.id, gender: x.member.gender }; });
    if (fuzzyMatched) fuzzyMatched.forEach(x => { allPlayerMap[x.input] = { id: x.member.id, gender: x.member.gender }; });
    freshGuests.forEach(g => {
      allPlayerMap[g.name] = { id: g.id, gender: g.gender };
      if (g.originalName) allPlayerMap[g.originalName] = { id: g.id, gender: g.gender };
      // 남게스트1 → 남게스트 prefix도 등록 (첫 번째)
      const prefix = g.gender === 'M' ? '남게스트' : '여게스트';
      if (!allPlayerMap[prefix]) allPlayerMap[prefix] = { id: g.id, gender: g.gender };
    });
    uniqueGuestNames.forEach(name => {
      if (guestIdMap[name]) {
        const gender = getGuestGender(guestIdMap[name]);
        allPlayerMap[name] = { id: guestIdMap[name], gender };
        // 정규화된 이름도 등록
        const normalized = normalizeGuestName(name);
        if (normalized !== name) allPlayerMap[normalized] = { id: guestIdMap[name], gender };
      }
    });

    // 4. 대진 등록
    let insertedCount = 0;
    for (let i = 0; i < matchList.length; i++) {
      const match = matchList[i];
      const [a1n, a2n] = match.teamA, [b1n, b2n] = match.teamB;
      const a1 = allPlayerMap[a1n], a2 = allPlayerMap[a2n], b1 = allPlayerMap[b1n], b2 = allPlayerMap[b2n];
      if (!a1 || !a2 || !b1 || !b2) continue;
      const assignPos = (p1, p2) => {
        if (p1.gender === 'F' && p2.gender === 'M') return [p1.id, p2.id];
        if (p1.gender === 'M' && p2.gender === 'F') return [p2.id, p1.id];
        return [p1.id, p2.id];
      };
      const [ta1, ta2] = assignPos(a1, a2), [tb1, tb2] = assignPos(b1, b2);
      const genders = [ta1, ta2, tb1, tb2].map(id => allPlayerMap[Object.keys(allPlayerMap).find(k => allPlayerMap[k].id === id)]?.gender || (id.startsWith('guest_') ? getGuestGender(id) : members.find(m => m.id === id)?.gender));
      const mC = genders.filter(g => g === 'M').length, fC = genders.filter(g => g === 'F').length;
      let matchType = 'JB';
      if (mC === 4) matchType = 'MB'; else if (fC === 4) matchType = 'FB'; else if (mC === 2 && fC === 2) matchType = 'MX';
      await supabase.from('matches').insert({
        id: `${Date.now()}_${i}`, team_a1: ta1, team_a2: ta2, team_b1: tb1, team_b2: tb2,
        score_a: null, score_b: null, match_date: date, confirmed: false,
        match_type: matchType, is_draw: false, is_scheduled: true,
        match_order: matches.filter(m => m.date === date).length + insertedCount + 1
      });
      insertedCount++;
    }
    await loadAll();
    setShowImportModal(false); setImportText(''); setImportPreview(null);
    alert(`완료! 참석자 ${memberIds.length}명, 게스트 ${uniqueGuestNames.length}명, 대진 ${insertedCount}경기 등록됐어요!`);
  };

  const getGenderColor = (g) => g === 'M' ? 'text-blue-600' : 'text-pink-500';
  const getGenderBg = (g) => g === 'M' ? 'bg-blue-50 border-blue-200' : 'bg-pink-50 border-pink-200';
  const getGenderBadge = (g) => g === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-600';

  // 랭킹 기간 필터
  const getRankingFilteredMatches = () => {
    return matches.filter(m => {
      if (m.isScheduled) return false;
      const d = new Date(m.date);
      const y = d.getFullYear(), mo = d.getMonth()+1, q = Math.ceil(mo/3);
      if (rankingPeriod === 'quarter') return y === rankingYear && q === rankingQuarter;
      if (rankingPeriod === 'month') return y === rankingYear && mo === rankingMonth;
      if (rankingPeriod === 'year') return y === rankingYear;
      return true; // all
    });
  };

  const getStats = (filteredM) => members.map(member => {
    const matchPool = filteredM || matches.filter(m => !m.isScheduled);
    let wins=0,losses=0,draws=0,gW=0,gL=0,rW=0,rL=0,rD=0,foW=0,foL=0,foD=0,bW=0,bL=0,bD=0;
    matchPool.forEach(m => {
      const inA=m.teamA1===member.id||m.teamA2===member.id, inB=m.teamB1===member.id||m.teamB2===member.id;
      if(!inA&&!inB) return;
      const isFo=m.teamA1===member.id||m.teamB1===member.id;
      const draw=m.isDraw||m.scoreA===m.scoreB, won=!draw&&(inA?m.scoreA>m.scoreB:m.scoreB>m.scoreA);
      if(draw){draws++;gW+=inA?(m.scoreA||0):(m.scoreB||0);gL+=inA?(m.scoreB||0):(m.scoreA||0);}
      else if(won){wins++;gW+=inA?(m.scoreA||0):(m.scoreB||0);gL+=inA?(m.scoreB||0):(m.scoreA||0);}
      else{losses++;gW+=inA?(m.scoreA||0):(m.scoreB||0);gL+=inA?(m.scoreB||0):(m.scoreA||0);}
      if(isRanked(m.matchType)){if(draw)rD++;else if(won)rW++;else rL++;}
      if(isFo){if(draw)foD++;else if(won)foW++;else foL++;}else{if(draw)bD++;else if(won)bW++;else bL++;}
    });
    const rT=rW+rL+rD, wr=rT>0?((rW+rD*0.5)/rT*100):0;
    const attC=Object.values(attendance).filter(arr=>arr.includes(member.id)).length;
    const foT=foW+foL+foD, bT=bW+bL+bD;
    return {...member,wins,losses,draws,total:wins+losses+draws,rankedWins:rW,rankedLosses:rL,rankedDraws:rD,rankedTotal:rT,winRate:wr,gamesWon:gW,gamesLost:gL,attendanceCount:attC,isPresident:isCurrentPresident(member.id),foWins:foW,foLosses:foL,foDraws:foD,foTotal:foT,foWinRate:foT>0?((foW+foD*0.5)/foT*100):null,baekWins:bW,baekLosses:bL,baekDraws:bD,baekTotal:bT,baekWinRate:bT>0?((bW+bD*0.5)/bT*100):null};
  });

  const allStats = getStats(); // 전체 (분석탭용)
  const rankingStats = getStats(getRankingFilteredMatches()); // 기간 필터 (랭킹탭용)
  const stats = [...rankingStats].sort((a,b)=>b.winRate-a.winRate||b.rankedWins-a.rankedWins||(b.gamesWon-b.gamesLost)-(a.gamesWon-a.gamesLost)||b.attendanceCount-a.attendanceCount);

  const getSortedFilteredStats = () => {
    let r=[...allStats];
    if(memberFilter==='regular')r=r.filter(m=>m.member_type==='regular');
    else if(memberFilter==='associate')r=r.filter(m=>m.member_type==='associate');
    if(memberSort==='name')r.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
    else if(memberSort==='winRate')r.sort((a,b)=>b.winRate-a.winRate);
    else if(memberSort==='attendance')r.sort((a,b)=>b.attendanceCount-a.attendanceCount);
    else if(memberSort==='type')r.sort((a,b)=>a.member_type===b.member_type?a.name.localeCompare(b.name,'ko'):a.member_type==='regular'?-1:1);
    return r;
  };

  const filteredMatches=matches.filter(m=>{
    if(!isRanked(m.matchType)||m.isScheduled)return false;
    const d=new Date(m.date), y=d.getFullYear(), q=Math.ceil((d.getMonth()+1)/3);
    if(analysisPeriod==='year') return y===currentYear;
    if(analysisPeriod==='quarter') return y===currentYear && q===analysisQuarter;
    return true;
  });

  const getPartnerStats=()=>{
    const combos={};
    filteredMatches.forEach(m=>{
      [{pair:[normalizeId(m.teamA1),normalizeId(m.teamA2)].sort(),won:!m.isDraw&&m.scoreA>m.scoreB,draw:m.isDraw||m.scoreA===m.scoreB,sf:m.scoreA||0},
       {pair:[normalizeId(m.teamB1),normalizeId(m.teamB2)].sort(),won:!m.isDraw&&m.scoreB>m.scoreA,draw:m.isDraw||m.scoreA===m.scoreB,sf:m.scoreB||0}
      ].forEach(({pair,won,draw,sf})=>{
        const key=pair.join('|');
        if(!combos[key])combos[key]={ids:pair,wins:0,losses:0,draws:0,ts:0};
        if(draw)combos[key].draws++;else if(won)combos[key].wins++;else combos[key].losses++;
        combos[key].ts+=sf;
      });
    });
    return Object.values(combos).map(c=>({...c,total:c.wins+c.losses+c.draws,winRate:c.wins+c.losses+c.draws>0?((c.wins+c.draws*0.5)/(c.wins+c.losses+c.draws)*100):0,avgScore:c.wins+c.losses+c.draws>0?(c.ts/(c.wins+c.losses+c.draws)).toFixed(1):0,name1:normalizeNameForAnalysis(c.ids[0]),name2:normalizeNameForAnalysis(c.ids[1])})).filter(c=>c.total>=1).sort((a,b)=>b.winRate-a.winRate||b.wins-a.wins);
  };

  const getMatchupStats=()=>{
    const mu={};
    filteredMatches.forEach(m=>{
      const tA=[normalizeId(m.teamA1),normalizeId(m.teamA2)].sort().join('|'),tB=[normalizeId(m.teamB1),normalizeId(m.teamB2)].sort().join('|');
      const key=[tA,tB].sort().join('||');
      if(!mu[key])mu[key]={teamA:[normalizeId(m.teamA1),normalizeId(m.teamA2)].sort(),teamB:[normalizeId(m.teamB1),normalizeId(m.teamB2)].sort(),aWins:0,bWins:0,draws:0};
      const draw=m.isDraw||m.scoreA===m.scoreB;
      const isAFirst=[normalizeId(m.teamA1),normalizeId(m.teamA2)].sort().join('|')===mu[key].teamA.join('|');
      if(draw)mu[key].draws++;else if(m.scoreA>m.scoreB){if(isAFirst)mu[key].aWins++;else mu[key].bWins++;}else{if(isAFirst)mu[key].bWins++;else mu[key].aWins++;}
    });
    return Object.values(mu).map(m=>({...m,total:m.aWins+m.bWins+m.draws,teamAName:m.teamA.map(id=>normalizeNameForAnalysis(id)).join(' · '),teamBName:m.teamB.map(id=>normalizeNameForAnalysis(id)).join(' · ')})).filter(m=>m.total>=2).sort((a,b)=>b.total-a.total);
  };

  const getSynergyStats=()=>members.map(member=>{
    const ps={};
    filteredMatches.forEach(m=>{
      const inA=m.teamA1===member.id||m.teamA2===member.id, inB=m.teamB1===member.id||m.teamB2===member.id;
      if(!inA&&!inB)return;
      const pid=normalizeId(inA?(m.teamA1===member.id?m.teamA2:m.teamA1):(m.teamB1===member.id?m.teamB2:m.teamB1));
      const draw=m.isDraw||m.scoreA===m.scoreB, won=!draw&&(inA?m.scoreA>m.scoreB:m.scoreB>m.scoreA);
      if(!ps[pid])ps[pid]={wins:0,losses:0,draws:0};
      if(draw)ps[pid].draws++;else if(won)ps[pid].wins++;else ps[pid].losses++;
    });
    const partners=Object.entries(ps).map(([id,s])=>({id,name:normalizeNameForAnalysis(id),...s,total:s.wins+s.losses+s.draws,winRate:s.wins+s.losses+s.draws>0?((s.wins+s.draws*0.5)/(s.wins+s.losses+s.draws)*100):0})).filter(p=>p.total>=1).sort((a,b)=>b.winRate-a.winRate);
    return {...member,partners};
  }).filter(m=>m.partners.length>0);

  const partnerStats=getPartnerStats(), matchupStats=getMatchupStats(), synergyStats=getSynergyStats();
  const bestCombos=partnerStats.filter(c=>c.total>=2).slice(0,3);
  const worstCombos=[...partnerStats].filter(c=>c.total>=2).sort((a,b)=>a.winRate-b.winRate).slice(0,3);
  const hiddenCombos=partnerStats.filter(c=>c.total===1&&c.winRate===100).slice(0,3);

  const changeMonth=(delta)=>{const d=new Date(calendarMonth);d.setMonth(d.getMonth()+delta);setCalendarMonth(d);};
  const changeWeek=(delta)=>{const d=new Date(currentWeekBase);d.setDate(d.getDate()+delta*7);setCurrentWeekBase(d);};
  const weekDates=getWeekDates(currentWeekBase);
  const calYear=calendarMonth.getFullYear(), calQuarter=Math.ceil((calendarMonth.getMonth()+1)/3);
  const calOfficer=getCurrentOfficer(calYear,calQuarter);

  const selectedDateMatches=selectedDate?[...matches.filter(m=>m.date===selectedDate)].sort((a,b)=>(a.matchOrder||0)-(b.matchOrder||0)):[];
  const currentAttendees=localAttendance||(attendance[selectedDate]||[]);
  const selectedDateGuests=selectedDate?(dateGuests[selectedDate]||[]):[];
  const isDateConfirmed=selectedDateMatches.filter(m=>!m.isScheduled).length>0&&selectedDateMatches.filter(m=>!m.isScheduled).every(m=>m.confirmed);
  const hasUnconfirmed=selectedDateMatches.some(m=>!m.confirmed&&!m.isScheduled);
  const availablePlayers=showAddMatch?getAvailablePlayers(matchDate):[];

  const MemberSelect=({value,onChange,label,exclude=[],posLabel})=>(
    <div className="flex-1">
      {posLabel&&<div className="text-xs text-stone-400 mb-1 text-center font-medium">{posLabel}</div>}
      <select value={value} onChange={e=>onChange(e.target.value)} className="w-full px-2 py-2.5 border border-stone-300 rounded-lg bg-white text-sm">
        <option value="">{label}</option>
        {availablePlayers.map(m=>(
          <option key={m.id} value={m.id} disabled={exclude.includes(m.id)}>
            {m.gender==='M'?'♂':'♀'} {m.name}{m.isGuest?' (게스트)':''}
          </option>
        ))}
      </select>
    </div>
  );

  const renderCalBadges=(dateStr,isSmall=false)=>{
    const dayAtt=attendance[dateStr]||[], dayMatches=matches.filter(m=>m.date===dateStr);
    const realM=dayMatches.filter(m=>!m.isScheduled), sched=dayMatches.filter(m=>m.isScheduled);
    const allConf=realM.length>0&&realM.every(m=>m.confirmed);
    return(
      <div className={`flex flex-col gap-0.5 ${isSmall?'absolute bottom-0.5 left-0.5 right-0.5':''}`}>
        {dayAtt.length>0&&<CalBadge className="bg-emerald-100 text-emerald-800"><Users size={7} className="mr-0.5"/>{dayAtt.length}</CalBadge>}
        {sched.length>0&&<CalBadge className="bg-orange-100 text-orange-700">📋{sched.length}</CalBadge>}
        {realM.length>0&&<CalBadge className={allConf?'bg-blue-100 text-blue-800':'bg-yellow-100 text-yellow-800'}>{allConf?<Lock size={7} className="mr-0.5"/>:'🎾'}{realM.length}</CalBadge>}
      </div>
    );
  };

  if(loading) return <div className="min-h-screen bg-stone-50 flex items-center justify-center"><div className="text-stone-400 tracking-widest text-sm">LOADING...</div></div>;

  return(
    <div className="min-h-screen bg-stone-50">
      <header className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(255,255,255,0.05) 20px,rgba(255,255,255,0.05) 40px)'}}></div>
        <div className="max-w-6xl mx-auto px-6 py-8 relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-yellow-300 flex items-center justify-center shadow-lg"><span className="text-2xl">🎾</span></div>
            <div className="text-yellow-200 text-xs tracking-[0.3em] font-medium">SOSO TENNIS CLUB</div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">소소테니스클럽</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-emerald-100 text-sm font-light">{currentYear}년 · 총 {matches.filter(m=>!m.isScheduled).length}경기 · 멤버 {members.length}명</p>
            {getCurrentOfficer(currentYear,currentQuarter)&&<span className="flex items-center gap-1 bg-yellow-300/20 text-yellow-200 text-xs px-2 py-1 rounded-full"><Crown size={11}/> {currentQuarter}분기 회장: {getCurrentOfficer(currentYear,currentQuarter)?.name}</span>}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-stone-200 overflow-x-auto">
          {[{id:'calendar',label:'캘린더',icon:Calendar},{id:'ranking',label:'랭킹',icon:Trophy},{id:'analysis',label:'분석',icon:BarChart2},{id:'matches',label:'경기',icon:Trophy},{id:'members',label:'멤버',icon:Users}].map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-1 px-2 py-2.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${activeTab===tab.id?'bg-emerald-800 text-white':'text-stone-600 hover:bg-stone-100'}`}>
              <tab.icon size={13}/>{tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-32">

        {activeTab==='calendar'&&(
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={()=>{if(!checkPassword())return;setShowImportModal(true);}} className="flex-1 py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-sm">
                📋 대진표 붙여넣기
              </button>
              <button onClick={()=>{if(!checkPassword())return;setAutoDate(selectedDate||new Date().toISOString().split('T')[0]);setAutoPreview(null);setShowAutoModal(true);}} className="flex-1 py-3 bg-gradient-to-r from-blue-700 to-blue-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-sm">
                🎲 자동 대진 생성
              </button>
            </div>

            <div className="bg-white rounded-lg border border-stone-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-yellow-500"/>
                <div>
                  <div className="text-sm font-bold text-stone-800">{calYear}년 {calQuarter}분기 회장</div>
                  {calOfficer?<div className="flex items-center gap-2"><span className="text-sm text-emerald-700 font-semibold">{calOfficer.name}</span><button onClick={()=>deleteOfficer(calOfficer.id)} className="text-xs text-stone-400">해제</button></div>:<div className="text-xs text-stone-400">미설정</div>}
                </div>
              </div>
              <button onClick={()=>{setOfficerYear(calYear);setOfficerQuarter(calQuarter);setOfficerMemberId(calOfficer?.member_id||'');setShowOfficerModal(true);}} className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                <Crown size={11}/> {calOfficer?'변경':'설정'}
              </button>
            </div>

            <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
              <button onClick={()=>setCalendarMode('week')} className={`flex-1 py-2 rounded-md text-sm font-medium ${calendarMode==='week'?'bg-white text-stone-800 shadow-sm':'text-stone-500'}`}>주간</button>
              <button onClick={()=>setCalendarMode('month')} className={`flex-1 py-2 rounded-md text-sm font-medium ${calendarMode==='month'?'bg-white text-stone-800 shadow-sm':'text-stone-500'}`}>월간</button>
            </div>

            {calendarMode==='week'&&(
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
                  <button onClick={()=>changeWeek(-1)} className="p-2 hover:bg-stone-100 rounded-full"><ChevronLeft size={18}/></button>
                  <div className="text-sm font-bold text-stone-800">{weekDates[0].month}월 {weekDates[0].day}일 - {weekDates[6].month}월 {weekDates[6].day}일</div>
                  <button onClick={()=>changeWeek(1)} className="p-2 hover:bg-stone-100 rounded-full"><ChevronRight size={18}/></button>
                </div>
                <div className="grid grid-cols-7 border-b border-stone-100">
                  {['일','월','화','수','목','금','토'].map((d,i)=><div key={d} className={`text-center text-xs font-semibold py-2 ${i===0?'text-red-500':i===6?'text-blue-500':'text-stone-500'}`}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 border-t border-stone-100">
                  {weekDates.map(d=>{
                    const isToday=d.dateStr===today, isSel=selectedDate===d.dateStr;
                    return(
                      <button key={d.dateStr} onClick={()=>setSelectedDate(d.dateStr)} className={`p-1.5 text-left relative hover:bg-emerald-50 border-r border-stone-50 min-h-20 flex flex-col ${isSel?'bg-emerald-100 ring-2 ring-emerald-600 ring-inset':''}`}>
                        <div className={`text-sm font-medium mb-1 flex-shrink-0 ${isToday?'bg-emerald-800 text-white w-6 h-6 rounded-full flex items-center justify-center':d.weekday===0?'text-red-500':d.weekday===6?'text-blue-500':'text-stone-700'}`}>{d.day}</div>
                        {renderCalBadges(d.dateStr)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {calendarMode==='month'&&(
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
                  <button onClick={()=>changeMonth(-1)} className="p-2 hover:bg-stone-100 rounded-full"><ChevronLeft size={18}/></button>
                  <div className="text-center"><h2 className="text-lg font-bold text-stone-800">{calendarMonth.getFullYear()}년 {calendarMonth.getMonth()+1}월</h2><div className="text-xs text-stone-400">{calQuarter}분기</div></div>
                  <button onClick={()=>changeMonth(1)} className="p-2 hover:bg-stone-100 rounded-full"><ChevronRight size={18}/></button>
                </div>
                <div className="grid grid-cols-7 border-b border-stone-100">
                  {['일','월','화','수','목','금','토'].map((d,i)=><div key={d} className={`text-center text-xs font-semibold py-2 ${i===0?'text-red-500':i===6?'text-blue-500':'text-stone-500'}`}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7">
                  {getDaysInMonth(calendarMonth).map((d,idx)=>{
                    if(!d)return<div key={idx} className="aspect-square border-b border-r border-stone-50"></div>;
                    const isToday=d.dateStr===today, isSel=selectedDate===d.dateStr;
                    return(
                      <button key={idx} onClick={()=>setSelectedDate(d.dateStr)} className={`aspect-square border-b border-r border-stone-50 p-1 text-left relative hover:bg-emerald-50 ${isSel?'bg-emerald-100 ring-2 ring-emerald-600 ring-inset':''}`}>
                        <div className={`text-sm font-medium ${isToday?'bg-emerald-800 text-white w-6 h-6 rounded-full flex items-center justify-center':d.weekday===0?'text-red-500':d.weekday===6?'text-blue-500':'text-stone-700'}`}>{d.day}</div>
                        {renderCalBadges(d.dateStr,true)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedDate&&(
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                  <h3 className="font-bold text-stone-800 flex items-center gap-2">
                    {selectedDate.replace(/-/g,'.')}
                    {isDateConfirmed&&<span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Lock size={10}/>경기확정</span>}
                  </h3>
                  <button onClick={()=>setSelectedDate(null)}><X size={16} className="text-stone-400"/></button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="border border-stone-200 rounded-lg overflow-hidden">
                    <button onClick={()=>setAttendanceOpen(!attendanceOpen)} className="w-full flex items-center justify-between px-3 py-2.5 bg-stone-50 text-sm font-semibold text-stone-700">
                      <div className="flex items-center gap-1.5">
                        <Users size={14}/>참석자 ({currentAttendees.length}명)
                        {attendanceConfirmed[selectedDate]&&<span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Lock size={9}/>확정</span>}
                        {attendanceDirty&&<span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">미저장</span>}
                      </div>
                      {attendanceOpen?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
                    </button>
                    {attendanceOpen&&(
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          {members.map(m=>{
                            const attended=currentAttendees.includes(m.id), isConf=attendanceConfirmed[selectedDate];
                            return(
                              <button key={m.id} onClick={()=>{if(isConf){if(!checkPassword())return;} toggleLocalAttendance(m.id);}}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${attended?`${getGenderBg(m.gender)} font-medium`:'bg-white border-stone-200 text-stone-600'} ${isConf?'opacity-70':''}`}>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${attended?'bg-emerald-600 border-emerald-600':'border-stone-300'}`}>{attended&&<Check size={12} className="text-white"/>}</div>
                                <span className={`truncate ${attended?getGenderColor(m.gender):''}`}>{m.name}</span>
                                {(() => {
                                  const dayStat = getDayStats(selectedDate).find(s => s.id === m.id);
                                  // 예정 경기 수 (점수 없는 대진)
                                  const scheduledCount = selectedDateMatches.filter(match =>
                                    match.isScheduled && [match.teamA1,match.teamA2,match.teamB1,match.teamB2].includes(m.id)
                                  ).length;
                                  if (!dayStat || dayStat.total === 0) {
                                    return (
                                      <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
                                        {scheduledCount > 0 && <span className="text-xs bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-bold">{scheduledCount}경기</span>}
                                        {scheduledCount === 0 && <span className={`text-xs px-1 rounded ${getGenderBadge(m.gender)}`}>{m.gender==='M'?'남':'여'}</span>}
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
                                      {scheduledCount > 0 && <span className="text-xs bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-bold">+{scheduledCount}</span>}
                                      {dayStat.wins > 0 && <span className="text-xs bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-bold">{dayStat.wins}승</span>}
                                      {dayStat.draws > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded font-bold">{dayStat.draws}무</span>}
                                      {dayStat.losses > 0 && <span className="text-xs bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">{dayStat.losses}패</span>}
                                    </div>
                                  );
                                })()}
                              </button>
                            );
                          })}
                        </div>
                        {attendanceDirty&&<button onClick={saveAttendance} className="w-full py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"><Save size={14}/> 참석자 저장</button>}

                        <div className="border-t border-stone-100 pt-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-stone-600">게스트 ({selectedDateGuests.length}명)</span>
                            <div className="flex gap-1.5">
                              <button onClick={()=>addDateGuest(selectedDate,'M')} className="flex items-center gap-0.5 text-xs bg-blue-100 text-blue-700 px-2 py-1.5 rounded-lg font-medium"><Plus size={10}/> ♂남</button>
                              <button onClick={()=>addDateGuest(selectedDate,'F')} className="flex items-center gap-0.5 text-xs bg-pink-100 text-pink-700 px-2 py-1.5 rounded-lg font-medium"><Plus size={10}/> ♀여</button>
                            </div>
                          </div>
                          {selectedDateGuests.length>0?(
                            <div className="grid grid-cols-2 gap-2">
                              {selectedDateGuests.map(g=>(
                                <div key={g.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${getGenderBg(g.gender)}`}>
                                  <span className={`flex-1 truncate font-medium text-xs ${getGenderColor(g.gender)}`}>{g.name}</span>
                                  <button onClick={()=>removeDateGuest(selectedDate,g.id)} className="text-stone-400 hover:text-red-500 flex-shrink-0"><X size={12}/></button>
                                </div>
                              ))}
                            </div>
                          ):<div className="text-xs text-stone-400 text-center py-1">버튼을 눌러 게스트를 추가하세요</div>}
                        </div>

                        <div className="text-xs text-stone-400 px-1 border-t border-stone-100 pt-2">총 {currentAttendees.length+selectedDateGuests.length}명 참석</div>
                        {attendanceConfirmed[selectedDate]?
                          <button onClick={()=>unconfirmAttendance(selectedDate)} className="w-full py-2 bg-stone-100 border border-stone-300 rounded-lg text-xs text-stone-600 flex items-center justify-center gap-1.5"><Lock size={12}/> 참석 확정 해제 (비번 필요)</button>:
                          <button onClick={()=>confirmAttendance(selectedDate)} className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"><Lock size={12}/> 참석자 확정하기</button>}
                      </div>
                    )}
                  </div>

                  {selectedDateMatches.length>0&&(
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-stone-700">🎾 경기 ({selectedDateMatches.length})</div>
                        <div className="flex gap-1.5">
                          {!editOrderMode && !selectMode && !swapMode && (
                            <>
                              <button onClick={()=>{setEditOrderMode(true);setLocalMatchOrder([...selectedDateMatches]);}} className="text-xs px-2 py-1 rounded-lg font-medium bg-blue-100 text-blue-600">순서편집</button>
                              <button onClick={()=>{setSwapMode(true);setSwapTarget(null);}} className="text-xs px-2 py-1 rounded-lg font-medium bg-purple-100 text-purple-600">선수교체</button>
                              <button onClick={()=>setSelectMode(true)} className="text-xs px-2 py-1 rounded-lg font-medium bg-stone-100 text-stone-600">선택삭제</button>
                              <button onClick={()=>deleteAllDateMatches(selectedDate)} className="text-xs px-2 py-1 rounded-lg font-medium bg-red-100 text-red-600">전체삭제</button>
                            </>
                          )}
                          {editOrderMode && (
                            <>
                              <button onClick={()=>{setEditOrderMode(false);setLocalMatchOrder([]);}} className="text-xs px-2 py-1 rounded-lg font-medium bg-stone-100 text-stone-600">취소</button>
                              <button onClick={saveMatchOrder} className="text-xs px-2 py-1 rounded-lg font-medium bg-blue-600 text-white">저장</button>
                            </>
                          )}
                          {swapMode && (
                            <>
                              {swapTarget && <span className="text-xs text-purple-600 font-medium">{swapTarget.player.name} 선택됨</span>}
                              <button onClick={()=>{setSwapMode(false);setSwapTarget(null);}} className="text-xs px-2 py-1 rounded-lg font-medium bg-stone-100 text-stone-600">완료</button>
                            </>
                          )}
                          {selectMode && (
                            <>
                              <button onClick={()=>{setSelectMode(false);setSelectedMatchIds([]);}} className="text-xs px-2 py-1 rounded-lg font-medium bg-stone-100 text-stone-600">취소</button>
                            </>
                          )}
                        </div>
                      </div>
                      {selectMode&&selectedMatchIds.length>0&&(
                        <button onClick={deleteSelectedMatches} className="w-full py-2 mb-2 bg-red-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5">
                          <Trash2 size={14}/> 선택한 {selectedMatchIds.length}개 삭제
                        </button>
                      )}
                      {swapMode && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 mb-2 text-xs text-purple-700">
                          {swapTarget ? '교체할 두 번째 선수를 탭하세요' : '교체할 첫 번째 선수를 탭하세요'}
                        </div>
                      )}
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={(editOrderMode?localMatchOrder:selectedDateMatches).map(m=>m.id)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2">
                            {(editOrderMode?localMatchOrder:selectedDateMatches).map((match,idx)=>(
                              <SortableMatch
                                key={match.id}
                                match={match}
                                idx={idx}
                                selectMode={selectMode}
                                editOrderMode={editOrderMode}
                                swapMode={swapMode}
                                swapTarget={swapTarget}
                                selectedMatchIds={selectedMatchIds}
                                toggleSelectMatch={toggleSelectMatch}
                                openScoreModal={openScoreModal}
                                openEditMatch={openEditMatch}
                                deleteMatch={deleteMatch}
                                getMemberName={getMemberName}
                                getMatchTypeLabel={getMatchTypeLabel}
                                swapPoBack={swapPoBack}
                                handleSwapPlayer={handleSwapPlayer}
                                dateGuests={dateGuests}
                                Lock={Lock}
                                Check={Check}
                                Pencil={Pencil}
                                Trash2={Trash2}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {members.length>=2&&<button onClick={()=>openAddMatch(selectedDate,false)} className="flex-1 py-2.5 border border-dashed border-stone-300 rounded-lg text-sm text-stone-600 flex items-center justify-center gap-1.5"><Plus size={14}/> 경기 기록</button>}
                      {members.length>=2&&<button onClick={()=>openAddMatch(selectedDate,true)} className="flex-1 py-2.5 border border-dashed border-orange-300 rounded-lg text-sm text-orange-600 flex items-center justify-center gap-1.5"><Plus size={14}/> 대진 등록</button>}
                    </div>
                    {selectedDateMatches.filter(m=>!m.isScheduled).length>0&&(
                      isDateConfirmed?
                        <button onClick={()=>unconfirmDateMatches(selectedDate)} className="w-full py-2.5 bg-stone-100 border border-stone-300 rounded-lg text-sm text-stone-600 flex items-center justify-center gap-1.5"><Lock size={14}/> 경기 확정 해제 (비번 필요)</button>:
                        hasUnconfirmed?<button onClick={()=>confirmDateMatches(selectedDate)} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"><Lock size={14}/> 경기 확정하기</button>:null
                    )}
                    {matches.filter(m=>m.date===selectedDate&&!m.isScheduled&&m.scoreA!==null).length>0&&(
                      <button onClick={()=>{setDayResultDate(selectedDate);setShowDayResultModal(true);}}
                        className="w-full py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                        🏆 오늘의 결과 보기
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab==='ranking'&&(
          <div className="space-y-4">
            {/* 기간 선택 */}
            <div className="bg-white rounded-lg border border-stone-200 p-3 space-y-3">
              <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
                {[['quarter','분기'],['month','월별'],['year','연도'],['all','전체']].map(([v,l])=>(
                  <button key={v} onClick={()=>setRankingPeriod(v)} className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${rankingPeriod===v?'bg-white text-stone-800 shadow-sm':'text-stone-500'}`}>{l}</button>
                ))}
              </div>
              {rankingPeriod==='quarter'&&(
                <div className="flex gap-2 items-center">
                  <input type="number" value={rankingYear} onChange={e=>setRankingYear(parseInt(e.target.value))} className="w-20 px-2 py-1.5 border border-stone-300 rounded-lg text-center text-sm"/>
                  <span className="text-sm text-stone-500">년</span>
                  <div className="flex gap-1 flex-1">
                    {[1,2,3,4].map(q=>(
                      <button key={q} onClick={()=>setRankingQuarter(q)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${rankingQuarter===q?'bg-emerald-800 text-white border-emerald-800':'bg-white text-stone-600 border-stone-200'}`}>{q}분기</button>
                    ))}
                  </div>
                </div>
              )}
              {rankingPeriod==='month'&&(
                <div className="flex gap-2 items-center">
                  <input type="number" value={rankingYear} onChange={e=>setRankingYear(parseInt(e.target.value))} className="w-20 px-2 py-1.5 border border-stone-300 rounded-lg text-center text-sm"/>
                  <span className="text-sm text-stone-500">년</span>
                  <div className="flex gap-1 flex-1 flex-wrap">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m=>(
                      <button key={m} onClick={()=>setRankingMonth(m)} className={`w-8 py-1.5 rounded-lg text-xs font-medium border ${rankingMonth===m?'bg-emerald-800 text-white border-emerald-800':'bg-white text-stone-600 border-stone-200'}`}>{m}</button>
                    ))}
                  </div>
                </div>
              )}
              {rankingPeriod==='year'&&(
                <div className="flex gap-2 items-center">
                  <input type="number" value={rankingYear} onChange={e=>setRankingYear(parseInt(e.target.value))} className="w-20 px-2 py-1.5 border border-stone-300 rounded-lg text-center text-sm"/>
                  <span className="text-sm text-stone-500">년 전체</span>
                </div>
              )}
              <div className="text-xs text-stone-400">
                {rankingPeriod==='quarter'&&`${rankingYear}년 ${rankingQuarter}분기 · `}
                {rankingPeriod==='month'&&`${rankingYear}년 ${rankingMonth}월 · `}
                {rankingPeriod==='year'&&`${rankingYear}년 전체 · `}
                {rankingPeriod==='all'&&'전체 기간 · '}
                {stats.filter(s=>s.rankedTotal>0).length}명 집계 · {getRankingFilteredMatches().filter(m=>isRanked(m.matchType)).length}경기
              </div>
            </div>

            {stats.length===0?<EmptyState icon={Trophy} title="아직 멤버가 없습니다" desc="멤버를 추가하고 경기를 기록해보세요"/>:(
              <>
                {stats.filter(s=>s.rankedTotal>0).length>=3&&(
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[1,0,2].map((idx,pos)=>{
                      const player=stats.filter(s=>s.rankedTotal>0)[idx];
                      if(!player)return<div key={idx}></div>;
                      const colors=[{bg:'bg-gradient-to-br from-yellow-400 to-yellow-600',text:'text-yellow-900',medal:'🥇',label:'1위'},{bg:'bg-gradient-to-br from-stone-300 to-stone-400',text:'text-stone-800',medal:'🥈',label:'2위'},{bg:'bg-gradient-to-br from-amber-600 to-amber-800',text:'text-amber-50',medal:'🥉',label:'3위'}];
                      const c=colors[idx]; const heights=['h-32','h-40','h-28'];
                      return(
                        <div key={player.id} className="flex flex-col items-center">
                          <div className="text-3xl mb-1">{c.medal}</div>
                          <div className="flex items-center gap-1 mb-1">{player.isPresident&&<Crown size={12} className="text-yellow-500"/>}<div className={`text-xs font-bold truncate px-1 ${getGenderColor(player.gender)}`}>{player.name}</div></div>
                          <div className={`${c.bg} ${c.text} ${heights[pos]} w-full rounded-t-lg flex flex-col items-center justify-center shadow-md`}>
                            <div className="text-xs font-bold opacity-80">{c.label}</div>
                            <div className="text-2xl font-bold">{player.winRate.toFixed(0)}%</div>
                            <div className="text-xs opacity-90">{player.rankedWins}승{player.rankedDraws>0?` ${player.rankedDraws}무`:''} {player.rankedLosses}패</div>
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
                    {stats.map((player,idx)=>{
                      // 동점 체크: 앞 사람과 winRate, rankedWins, gamesWon-gamesLost, attendanceCount 모두 같으면 동점
                      const prev = stats[idx-1];
                      const isTie = prev && prev.rankedTotal > 0 && player.rankedTotal > 0
                        && prev.winRate.toFixed(1) === player.winRate.toFixed(1)
                        && prev.rankedWins === player.rankedWins
                        && (prev.gamesWon-prev.gamesLost) === (player.gamesWon-player.gamesLost)
                        && prev.attendanceCount === player.attendanceCount;
                      const rank = isTie ? (stats.slice(0,idx).findIndex((_,i)=>{
                        const p=stats[i]; return !(p.winRate.toFixed(1)===player.winRate.toFixed(1)&&p.rankedWins===player.rankedWins&&(p.gamesWon-p.gamesLost)===(player.gamesWon-player.gamesLost)&&p.attendanceCount===player.attendanceCount);
                      }) === -1 ? stats.findIndex(s=>s.winRate.toFixed(1)===player.winRate.toFixed(1)&&s.rankedWins===player.rankedWins&&(s.gamesWon-s.gamesLost)===(player.gamesWon-player.gamesLost)&&s.attendanceCount===player.attendanceCount)+1 : idx) : idx+1;
                      const displayRank = isTie ? `${rank}=` : `${idx+1}`;
                      return(
                      <div key={player.id} className="px-4 py-3 flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx===0?'bg-yellow-100 text-yellow-700':idx===1?'bg-stone-100 text-stone-700':idx===2?'bg-amber-100 text-amber-700':'bg-stone-50 text-stone-500'}`}>{displayRank}</div>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${player.gender==='M'?'bg-blue-100 text-blue-700':'bg-pink-100 text-pink-600'}`}>{player.gender==='M'?'♂':'♀'}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">{player.isPresident&&<Crown size={13} className="text-yellow-500"/>}<span className={`font-semibold truncate ${getGenderColor(player.gender)}`}>{player.name}</span><span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${player.member_type==='regular'?'bg-emerald-100 text-emerald-700':'bg-stone-100 text-stone-500'}`}>{player.member_type==='regular'?'정':'준'}</span></div>
                          <div className="text-xs text-stone-500 mt-0.5">{player.rankedTotal===0?`랭킹경기 없음 · 출석 ${player.attendanceCount}회`:`${player.rankedWins}승${player.rankedDraws>0?` ${player.rankedDraws}무`:''} ${player.rankedLosses}패 · 출석 ${player.attendanceCount}회`}</div>
                        </div>
                        <div className="text-right"><div className="text-xl font-bold text-emerald-700">{player.rankedTotal===0?'-':`${player.winRate.toFixed(1)}%`}</div><div className="text-xs text-stone-400">승률</div></div>
                      </div>
                      );
                    })}
                  </div>
                </div>
                {stats.some(s=>s.rankedTotal>0||s.attendanceCount>0)&&(
                  <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4"><Award className="text-yellow-300" size={20}/><h3 className="text-lg font-bold">{currentYear} 연말 시상</h3></div>
                    <div className="grid grid-cols-2 gap-3">
                      <AwardCard label="MVP · 최고 승률" winner={stats.filter(s=>s.rankedTotal>0)[0]?.name} value={stats.filter(s=>s.rankedTotal>0)[0]?`${stats.filter(s=>s.rankedTotal>0)[0].winRate.toFixed(1)}%`:'-'}/>
                      <AwardCard label="다승왕" winner={[...stats].sort((a,b)=>b.rankedWins-a.rankedWins)[0]?.name} value={`${[...stats].sort((a,b)=>b.rankedWins-a.rankedWins)[0]?.rankedWins||0}승`}/>
                      <AwardCard label="개근상" winner={[...stats].sort((a,b)=>b.attendanceCount-a.attendanceCount)[0]?.name} value={`${[...stats].sort((a,b)=>b.attendanceCount-a.attendanceCount)[0]?.attendanceCount||0}회`}/>
                      <AwardCard label="베스트 파트너" winner={bestCombos[0]?`${bestCombos[0].name1} · ${bestCombos[0].name2}`:'-'} value={bestCombos[0]?`${bestCombos[0].winRate.toFixed(0)}%`:'-'}/>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab==='analysis'&&(
          <div className="space-y-4">
            <div className="flex gap-2">
              {[['all','전체'],['year',`${currentYear}년`],['quarter','분기']].map(([v,l])=>(
                <button key={v} onClick={()=>setAnalysisPeriod(v)} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${analysisPeriod===v?'bg-emerald-800 text-white border-emerald-800':'bg-white text-stone-600 border-stone-200'}`}>{l}</button>
              ))}
            </div>
            {analysisPeriod==='quarter'&&(
              <div className="flex gap-1">
                {[1,2,3,4].map(q=>(
                  <button key={q} onClick={()=>setAnalysisQuarter(q)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${analysisQuarter===q?'bg-emerald-800 text-white border-emerald-800':'bg-white text-stone-600 border-stone-200'}`}>{q}분기</button>
                ))}
              </div>
            )}
            <div className="text-xs text-stone-400 px-1">※ 남복·여복·혼복 기준 · {filteredMatches.length}경기{analysisPeriod==='quarter'?` (${currentYear}년 ${analysisQuarter}분기)`:''}</div>
            <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
              {[{id:'partner',label:'🤝 파트너'},{id:'matchup',label:'⚔️ 매치업'},{id:'synergy',label:'✨ 시너지'},{id:'position',label:'🎾 포/백'}].map(s=>(
                <button key={s.id} onClick={()=>setAnalysisSection(s.id)} className={`flex-1 py-2 rounded-md text-xs font-medium ${analysisSection===s.id?'bg-white text-stone-800 shadow-sm':'text-stone-500'}`}>{s.label}</button>
              ))}
            </div>
            {analysisSection==='partner'&&(
              <div className="space-y-4">
                {filteredMatches.length===0?<EmptyState icon={BarChart2} title="데이터가 없습니다" desc="경기를 기록하면 분석이 시작돼요"/>:(
                  <>
                    {bestCombos.length>0&&<ComboCard title="🔥 베스트 조합 (2경기 이상)" combos={bestCombos} emoji={['🥇','🥈','🥉']} valueColor="text-emerald-700"/>}
                    {worstCombos.length>0&&<ComboCard title="⚠️ 워스트 조합 (2경기 이상)" combos={worstCombos} emoji={['💀','💀','💀']} valueColor="text-red-500" bgColor="bg-red-50" titleColor="text-red-700"/>}
                    {hiddenCombos.length>0&&<ComboCard title="📈 숨은 꿀조합" combos={hiddenCombos} emoji={['💎','💎','💎']} valueColor="text-yellow-600" bgColor="bg-yellow-50" titleColor="text-yellow-700"/>}
                    <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-stone-100"><h3 className="font-bold text-stone-800 text-sm">📊 전체 조합 순위</h3></div>
                      <div className="divide-y divide-stone-100">
                        {partnerStats.map((c,i)=>(
                          <div key={i} className="px-4 py-3 flex items-center gap-3">
                            <div className="text-xs text-stone-400 w-5">{i+1}</div>
                            <div className="flex-1 min-w-0"><div className="text-sm font-medium text-stone-800">{c.name1} · {c.name2}</div><div className="text-xs text-stone-400">{c.total}경기 · {c.wins}승{c.draws>0?` ${c.draws}무`:''} {c.losses}패</div></div>
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
            {analysisSection==='matchup'&&(
              <div className="space-y-3">
                {matchupStats.length===0?<EmptyState icon={BarChart2} title="2경기 이상 맞붙은 조합이 없어요" desc="같은 조합으로 더 많이 경기하면 보여요"/>:(
                  <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-stone-100"><h3 className="font-bold text-stone-800 text-sm">⚔️ 매치업 전적</h3></div>
                    <div className="divide-y divide-stone-100">
                      {matchupStats.map((m,i)=>(
                        <div key={i} className="px-4 py-4 flex items-center gap-2">
                          <div className={`flex-1 text-sm min-w-0 ${m.aWins>m.bWins?'font-bold text-emerald-800':'text-stone-500'}`}><div className="truncate">{m.teamAName}</div></div>
                          <div className="flex-shrink-0 text-center"><div className="font-mono font-bold text-stone-800 bg-stone-100 px-3 py-1 rounded text-sm">{m.aWins}{m.draws>0?`·${m.draws}무·`:':'}{m.bWins}</div><div className="text-xs text-stone-400 mt-0.5">{m.total}경기</div></div>
                          <div className={`flex-1 text-sm text-right min-w-0 ${m.bWins>m.aWins?'font-bold text-emerald-800':'text-stone-500'}`}><div className="truncate">{m.teamBName}</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {analysisSection==='synergy'&&(
              <div className="space-y-3">
                {synergyStats.length===0?<EmptyState icon={BarChart2} title="데이터가 없습니다" desc="경기를 기록하면 분석이 시작돼요"/>:(
                  synergyStats.map(member=>(
                    <div key={member.id} className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                      <div className={`px-4 py-3 border-b border-stone-100 ${getGenderBg(member.gender)}`}>
                        <h3 className={`font-bold text-sm flex items-center gap-2 ${getGenderColor(member.gender)}`}>{member.gender==='M'?'♂':'♀'} {member.name}<span className="text-xs font-normal text-stone-500">누구랑 잘 맞나요?</span></h3>
                      </div>
                      <div className="divide-y divide-stone-100">
                        {member.partners.map((p,i)=>(
                          <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                            <div className="flex-1 text-sm text-stone-700">{p.name}</div>
                            <div className="text-xs text-stone-400">{p.total}경기 · {p.wins}승{p.draws>0?` ${p.draws}무`:''} {p.losses}패</div>
                            <div className={`text-base font-bold w-14 text-right ${p.winRate>=60?'text-emerald-600':p.winRate>=40?'text-stone-600':'text-red-500'}`}>{p.winRate.toFixed(0)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {analysisSection==='position'&&(
              <div className="space-y-3">
                {filteredMatches.length===0?<EmptyState icon={BarChart2} title="데이터가 없습니다" desc="경기를 기록하면 분석이 시작돼요"/>:(
                  <>
                    <div className="text-xs text-stone-400 bg-stone-50 rounded-lg p-3">🎾 왼쪽 = <strong>포(앞)</strong>, 오른쪽 = <strong>백(뒤)</strong></div>
                    {allStats.filter(m=>m.foTotal>0||m.baekTotal>0).sort((a,b)=>(b.foWinRate||0)+(b.baekWinRate||0)-(a.foWinRate||0)-(a.baekWinRate||0)).map(member=>(
                      <div key={member.id} className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                        <div className={`px-4 py-3 border-b border-stone-100 flex items-center gap-2 ${getGenderBg(member.gender)}`}>
                          {member.isPresident&&<Crown size={13} className="text-yellow-500"/>}
                          <span className={`font-bold text-sm ${getGenderColor(member.gender)}`}>{member.name}</span>
                          {member.foWinRate!==null&&member.baekWinRate!==null&&(
                            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${member.foWinRate>member.baekWinRate?'bg-blue-100 text-blue-700':member.baekWinRate>member.foWinRate?'bg-orange-100 text-orange-700':'bg-stone-100 text-stone-600'}`}>
                              {member.foWinRate>member.baekWinRate?'포 특화':member.baekWinRate>member.foWinRate?'백 특화':'균형형'}
                            </span>
                          )}
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3">
                          <div className="bg-blue-50 rounded-lg p-3 text-center"><div className="text-xs font-bold text-blue-700 mb-1">포 (앞)</div><div className="text-2xl font-bold text-blue-800">{member.foWinRate!==null?`${member.foWinRate.toFixed(0)}%`:'-'}</div><div className="text-xs text-blue-600 mt-1">{member.foWins}승{member.foDraws>0?` ${member.foDraws}무`:''} {member.foLosses}패</div></div>
                          <div className="bg-orange-50 rounded-lg p-3 text-center"><div className="text-xs font-bold text-orange-700 mb-1">백 (뒤)</div><div className="text-2xl font-bold text-orange-800">{member.baekWinRate!==null?`${member.baekWinRate.toFixed(0)}%`:'-'}</div><div className="text-xs text-orange-600 mt-1">{member.baekWins}승{member.baekDraws>0?` ${member.baekDraws}무`:''} {member.baekLosses}패</div></div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab==='matches'&&(
          <div>
            {matches.length===0?<EmptyState icon={Calendar} title="경기 기록이 없습니다" desc="캘린더에서 날짜를 선택해 경기를 추가하세요"/>:(
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-stone-200 bg-stone-50"><h2 className="text-lg font-bold text-stone-800">경기 기록 ({matches.filter(m=>!m.isScheduled).length}) · 대진 ({matches.filter(m=>m.isScheduled).length})</h2></div>
                <div className="divide-y divide-stone-100">
                  {[...matches].sort((a,b)=>{if(a.date!==b.date)return b.date.localeCompare(a.date);return(a.matchOrder||0)-(b.matchOrder||0);}).map(match=>{
                    const typeInfo=getMatchTypeLabel(match.matchType);
                    const draw=match.isDraw||(!match.isScheduled&&match.scoreA===match.scoreB);
                    const idx=matches.filter(m=>m.date===match.date).sort((a,b)=>(a.matchOrder||0)-(b.matchOrder||0)).findIndex(m=>m.id===match.id);
                    return(
                      <div key={match.id} className={`px-4 py-3 ${match.isScheduled?'bg-orange-50':''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-stone-400 font-mono">{match.date.slice(5)}</span>
                          <span className="text-xs text-stone-400">{idx+1}경기</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                          {match.isScheduled?<span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">대진</span>:draw?<span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">무</span>:match.confirmed?<span className="text-xs text-blue-500 flex items-center gap-0.5"><Lock size={9}/>확정</span>:<span className="text-xs text-stone-300">미확정</span>}
                          <div className="flex-1"></div>
                          {!match.confirmed&&<button onClick={()=>openEditMatch(match)} className="text-stone-300 p-1"><Pencil size={13}/></button>}
                          <button onClick={()=>deleteMatch(match)} className="text-stone-300 p-1"><Trash2 size={13}/></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`flex-1 text-sm min-w-0 ${!match.isScheduled&&!draw&&match.scoreA>match.scoreB?'font-bold text-emerald-800':draw?'text-stone-600':'text-stone-500'}`}>
                            <div className="truncate"><span className="text-xs text-stone-400 mr-1">포</span>{getMemberName(match.teamA1,match.date)}</div>
                            <div className="truncate"><span className="text-xs text-stone-400 mr-1">백</span>{getMemberName(match.teamA2,match.date)}</div>
                          </div>
                          {match.isScheduled?<div className="font-mono text-stone-400 bg-stone-100 px-3 py-1.5 rounded text-sm flex-shrink-0">vs</div>:<div className={`font-mono font-bold px-3 py-1.5 rounded text-sm flex-shrink-0 ${draw?'bg-yellow-50 text-yellow-700':'bg-stone-100 text-stone-700'}`}>{match.scoreA} - {match.scoreB}</div>}
                          <div className={`flex-1 text-sm text-right min-w-0 ${!match.isScheduled&&!draw&&match.scoreB>match.scoreA?'font-bold text-emerald-800':draw?'text-stone-600':'text-stone-500'}`}>
                            <div className="truncate"><span className="text-xs text-stone-400 mr-1">포</span>{getMemberName(match.teamB1,match.date)}</div>
                            <div className="truncate"><span className="text-xs text-stone-400 mr-1">백</span>{getMemberName(match.teamB2,match.date)}</div>
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

        {activeTab==='members'&&(
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <button onClick={()=>setShowSortFilter(!showSortFilter)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-stone-700">
                <div className="flex items-center gap-2"><Filter size={15}/>정렬 / 필터<span className="text-xs text-stone-400 font-normal">{memberFilter==='all'?'전체':memberFilter==='regular'?'정회원':'준회원'} · {memberSort==='name'?'이름순':memberSort==='winRate'?'승률순':memberSort==='attendance'?'참석순':'등급순'}</span></div>
                {showSortFilter?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
              </button>
              {showSortFilter&&(
                <div className="px-4 pb-4 border-t border-stone-100 pt-3 space-y-3">
                  <div><div className="text-xs font-medium text-stone-500 mb-2">필터</div>
                    <div className="flex gap-2">{[['all','전체'],['regular','정회원'],['associate','준회원']].map(([v,l])=><button key={v} onClick={()=>setMemberFilter(v)} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${memberFilter===v?'bg-emerald-800 text-white border-emerald-800':'bg-white text-stone-600 border-stone-200'}`}>{l}</button>)}</div>
                  </div>
                  <div><div className="text-xs font-medium text-stone-500 mb-2">정렬</div>
                    <div className="grid grid-cols-2 gap-2">{[['name','이름순'],['winRate','승률순'],['attendance','참석순'],['type','등급순']].map(([v,l])=><button key={v} onClick={()=>setMemberSort(v)} className={`py-2 rounded-lg text-sm font-medium border ${memberSort===v?'bg-emerald-800 text-white border-emerald-800':'bg-white text-stone-600 border-stone-200'}`}>{l}</button>)}</div>
                  </div>
                </div>
              )}
            </div>
            {officers.length>0&&(
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2"><Crown size={15} className="text-yellow-500"/><h3 className="text-sm font-bold text-stone-800">역대 회장</h3></div>
                <div className="divide-y divide-stone-100">
                  {[...officers].sort((a,b)=>b.year-a.year||b.quarter-a.quarter).map(o=>{
                    const mName=members.find(m=>m.id===o.member_id)?.name||'?';
                    const isCurrent=o.year===currentYear&&o.quarter===currentQuarter;
                    return(<div key={o.id} className="px-4 py-3 flex items-center gap-3"><Crown size={14} className={isCurrent?'text-yellow-500':'text-stone-300'}/><div className="flex-1"><span className="font-semibold text-stone-800 text-sm">{mName}</span>{isCurrent&&<span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">현재</span>}</div><span className="text-xs text-stone-500">{o.year}년 {o.quarter}분기</span></div>);
                  })}
                </div>
              </div>
            )}
            {getSortedFilteredStats().length===0?<EmptyState icon={Users} title="멤버가 없습니다" desc="아래 + 버튼으로 멤버를 추가하세요"/>:(
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getSortedFilteredStats().map(member=>(
                  <div key={member.id} className={`bg-white rounded-lg border p-4 flex items-center gap-3 ${getGenderBg(member.gender)}`}>
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${member.gender==='M'?'bg-blue-100 text-blue-700':'bg-pink-100 text-pink-600'}`}>{member.name.charAt(0)}</div>
                      {member.isPresident&&<div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center"><Crown size={10} className="text-white"/></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap"><span className={`font-semibold truncate ${getGenderColor(member.gender)}`}>{member.name}</span><span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${getGenderBadge(member.gender)}`}>{member.gender==='M'?'남':'여'}</span><span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${member.member_type==='regular'?'bg-emerald-100 text-emerald-700':'bg-stone-100 text-stone-500'}`}>{member.member_type==='regular'?'정회원':'준회원'}</span></div>
                      <div className="text-xs text-stone-500 mt-0.5">{member.rankedTotal===0?`출석 ${member.attendanceCount}회`:`${member.rankedWins}승${member.rankedDraws>0?` ${member.rankedDraws}무`:''} ${member.rankedLosses}패 · 출석 ${member.attendanceCount}회`}</div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={()=>{setEditingMember(member);setEditMemberName(member.name);setEditMemberGender(member.gender);setEditMemberType(member.member_type||'regular');}} className="text-stone-400 p-2"><Pencil size={15}/></button>
                      <button onClick={()=>deleteMember(member.id)} className="text-stone-300 p-2"><Trash2 size={15}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-20">
        {activeTab==='members'&&<button onClick={()=>setShowAddMember(true)} className="bg-emerald-800 text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-2"><Plus size={18}/><span className="font-medium text-sm">멤버 추가</span></button>}
        {(activeTab==='matches'||activeTab==='ranking')&&members.length>=2&&<button onClick={()=>openAddMatch()} className="bg-emerald-800 text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-2"><Plus size={18}/><span className="font-medium text-sm">경기 기록</span></button>}
      </div>

      {showImportModal&&(
        <Modal onClose={()=>{setShowImportModal(false);setImportText('');setImportPreview(null);}} title="대진표 붙여넣기">
          <div className="space-y-3">
            {!importPreview?(
              <>
                <div><label className="block text-xs font-medium text-stone-600 mb-1.5">날짜 선택</label><input type="date" value={importDate} onChange={e=>setImportDate(e.target.value)} className="w-full px-3 py-2.5 border border-stone-300 rounded-lg"/></div>
                <div><label className="block text-xs font-medium text-stone-600 mb-1.5">대진표 붙여넣기</label><textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder="대진표 텍스트를 붙여넣으세요..." className="w-full px-3 py-2.5 border border-stone-300 rounded-lg text-sm h-48 resize-none"/></div>
                <div className="flex gap-2">
                  <button onClick={()=>setShowImportModal(false)} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
                  <button onClick={handleImportPreview} disabled={!importText.trim()} className="flex-1 px-4 py-2.5 bg-emerald-800 text-white rounded-lg font-medium disabled:bg-stone-300">파싱하기</button>
                </div>
              </>
            ):(
              <>
                {importPreview.hasDuplicate&&<div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">⚠️ 이 날짜에 이미 대진 {importPreview.existingCount}개가 있어요. 추가로 등록됩니다.</div>}
                <div className="bg-stone-50 rounded-lg p-3 space-y-2 text-sm max-h-64 overflow-y-auto">
                  <div className="font-bold text-stone-700">📅 {importDate}</div>
                  {importPreview.matched?.length>0&&<div><span className="text-xs font-semibold text-emerald-600">✅ 정확 매칭 ({importPreview.matched.length})</span><div className="flex flex-wrap gap-1 mt-1">{importPreview.matched.map((x,i)=><span key={i} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{x.input}</span>)}</div></div>}
                  {importPreview.fuzzyMatched?.length>0&&<div><span className="text-xs font-semibold text-yellow-600">🔍 유사 매칭 ({importPreview.fuzzyMatched.length}) - 확인 필요</span><div className="flex flex-wrap gap-1 mt-1">{importPreview.fuzzyMatched.map((x,i)=><span key={i} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{x.input} → {x.member.name}</span>)}</div></div>}
                  {importPreview.unmatched?.length>0&&<div><span className="text-xs font-semibold text-red-500">❌ 못 찾은 멤버 - 스킵 ({importPreview.unmatched.length})</span><div className="flex flex-wrap gap-1 mt-1">{importPreview.unmatched.map((n,i)=><span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{n}</span>)}</div></div>}
                  {importPreview.unknownInMatches?.length>0&&<div><span className="text-xs font-semibold text-orange-500">⚠️ 경기에 있는데 참석자 미등록: {importPreview.unknownInMatches.join(', ')}</span></div>}
                  {importPreview.guestNames?.length>0&&<div><span className="text-xs font-semibold text-blue-500">👤 게스트 ({importPreview.guestNames.length})</span><div className="flex flex-wrap gap-1 mt-1">{importPreview.guestNames.map((n,i)=><span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{n}</span>)}</div></div>}
                  <div><span className="text-xs font-semibold text-stone-500">🎾 대진 ({importPreview.matchList.length}경기)</span><div className="space-y-1 mt-1">{importPreview.matchList.map((m,i)=><div key={i} className="text-xs bg-white border border-stone-200 rounded px-2 py-1"><span className="text-stone-400 mr-1">{i+1}경기</span>{m.teamA.join('·')} vs {m.teamB.join('·')}</div>)}</div></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>setImportPreview(null)} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">← 다시</button>
                  <button onClick={()=>applyImport(importDate,importPreview)} className="flex-1 px-4 py-2.5 bg-emerald-800 text-white rounded-lg font-semibold">등록하기 🎾</button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {showDayResultModal && dayResultDate && (() => {
        const dayStats = getDayStats(dayResultDate);
        const dayPartners = getDayPartnerStats(dayResultDate);
        const best = dayPartners.filter(c=>c.total>=2).sort((a,b)=>b.winRate-a.winRate||b.wins-a.wins)[0];
        const worst = dayPartners.filter(c=>c.total>=2).sort((a,b)=>a.winRate-b.winRate||a.wins-b.wins)[0];
        const top3 = dayStats.slice(0,3);
        const medals = ['🥇','🥈','🥉'];
        const podiumColors = [
          'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900',
          'bg-gradient-to-br from-stone-300 to-stone-400 text-stone-800',
          'bg-gradient-to-br from-amber-600 to-amber-800 text-amber-50'
        ];
        const podiumHeights = ['h-28','h-36','h-20'];
        const podiumOrder = [1,0,2]; // 2위, 1위, 3위 순서로 표시
        return (
          <Modal onClose={()=>setShowDayResultModal(false)} title={`🏆 ${dayResultDate.replace(/-/g,'.')} 결과`}>
            <div className="space-y-5">
              {/* 시상대 */}
              {top3.length >= 2 && (
                <div className="grid grid-cols-3 gap-2">
                  {podiumOrder.map((idx) => {
                    const player = top3[idx];
                    if (!player) return <div key={idx}></div>;
                    return (
                      <div key={player.id} className="flex flex-col items-center">
                        <div className="text-2xl mb-1">{medals[idx]}</div>
                        <div className={`text-xs font-bold truncate w-full text-center px-1 ${player.gender==='M'?'text-blue-600':'text-pink-500'}`}>{player.name}</div>
                        <div className={`${podiumColors[idx]} ${podiumHeights[podiumOrder.indexOf(idx)]} w-full rounded-t-lg flex flex-col items-center justify-center mt-1`}>
                          <div className="text-xs font-bold opacity-80">{idx+1}위</div>
                          <div className="text-lg font-bold">{player.winRate.toFixed(0)}%</div>
                          <div className="text-xs opacity-90">{player.wins}승{player.draws>0?` ${player.draws}무`:''} {player.losses}패</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 전체 순위 */}
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-100 text-sm font-bold text-stone-700">📊 오늘의 순위</div>
                <div className="divide-y divide-stone-100">
                  {dayStats.map((p, i) => (
                    <div key={p.id} className="px-4 py-2.5 flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i===0?'bg-yellow-100 text-yellow-700':i===1?'bg-stone-100 text-stone-600':i===2?'bg-amber-100 text-amber-700':'bg-stone-50 text-stone-400'}`}>{i+1}</div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${p.gender==='M'?'bg-blue-100 text-blue-700':'bg-pink-100 text-pink-600'}`}>{p.gender==='M'?'♂':'♀'}</div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold text-sm truncate ${p.gender==='M'?'text-blue-600':'text-pink-500'}`}>{p.name}</div>
                        <div className="text-xs text-stone-400">{p.wins}승{p.draws>0?` ${p.draws}무`:''} {p.losses}패 · {p.gamesWon}게임</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-base font-bold ${p.winRate>=60?'text-emerald-600':p.winRate>=40?'text-stone-600':'text-red-500'}`}>{p.winRate.toFixed(0)}%</div>
                      </div>
                    </div>
                  ))}
                  {dayStats.length===0&&<div className="px-4 py-6 text-center text-sm text-stone-400">경기 결과가 없어요</div>}
                </div>
              </div>

              {/* 베스트/워스트 조합 */}
              {(best || worst) && (
                <div className="grid grid-cols-2 gap-3">
                  {best && (
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                      <div className="text-xs font-bold text-emerald-700 mb-1.5">🔥 베스트 조합</div>
                      <div className="text-sm font-bold text-stone-800 truncate">{best.name1} · {best.name2}</div>
                      <div className="text-xs text-stone-500 mt-0.5">{best.wins}승{best.draws>0?` ${best.draws}무`:''} {best.losses}패</div>
                      <div className="text-lg font-bold text-emerald-600 mt-1">{best.winRate.toFixed(0)}%</div>
                    </div>
                  )}
                  {worst && worst !== best && (
                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                      <div className="text-xs font-bold text-red-600 mb-1.5">💀 워스트 조합</div>
                      <div className="text-sm font-bold text-stone-800 truncate">{worst.name1} · {worst.name2}</div>
                      <div className="text-xs text-stone-500 mt-0.5">{worst.wins}승{worst.draws>0?` ${worst.draws}무`:''} {worst.losses}패</div>
                      <div className="text-lg font-bold text-red-500 mt-1">{worst.winRate.toFixed(0)}%</div>
                    </div>
                  )}
                </div>
              )}

              {/* 전체 파트너 */}
              {dayPartners.length > 0 && (
                <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-100 text-sm font-bold text-stone-700">🤝 오늘의 파트너 조합</div>
                  <div className="divide-y divide-stone-100">
                    {dayPartners.map((c,i)=>(
                      <div key={i} className="px-4 py-2.5 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-stone-800">{c.name1} · {c.name2}</div>
                          <div className="text-xs text-stone-400">{c.total}경기 · {c.wins}승{c.draws>0?` ${c.draws}무`:''} {c.losses}패</div>
                        </div>
                        <div className={`text-base font-bold ${c.winRate>=60?'text-emerald-600':c.winRate>=40?'text-stone-600':'text-red-500'}`}>{c.winRate.toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={()=>setShowDayResultModal(false)} className="w-full py-2.5 border border-stone-200 text-stone-500 rounded-lg text-sm">닫기</button>
            </div>
          </Modal>
        );
      })()}

      {showAutoModal&&(
        <Modal onClose={()=>{setShowAutoModal(false);setAutoPreview(null);}} title="🎲 자동 대진 생성">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">날짜</label>
              <input type="date" value={autoDate} onChange={e=>{setAutoDate(e.target.value);setAutoPreview(null);}} className="w-full px-3 py-2.5 border border-stone-300 rounded-lg"/>
            </div>
            <div className="bg-stone-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-stone-600 mb-2">참석자: {getAvailablePlayers(autoDate).length}명 (남 {getAvailablePlayers(autoDate).filter(p=>p.gender==='M').length} / 여 {getAvailablePlayers(autoDate).filter(p=>p.gender==='F').length})</div>
              <div className="text-xs text-stone-400">※ 참석자 체크 후 사용하세요</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-stone-600 mb-2">경기 비율 (총 8경기)</div>
              <div className="space-y-2">
                {[['남복 🎾', autoRatioMB, setAutoRatioMB, 'blue'], ['혼복 🎾', autoRatioMX, setAutoRatioMX, 'purple'], ['여복 🎾', autoRatioFB, setAutoRatioFB, 'pink']].map(([label, val, setter, color])=>(
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-sm w-12 flex-shrink-0">{label}</span>
                    <input type="range" min="0" max="8" value={val} onChange={e=>{setter(parseInt(e.target.value));setAutoPreview(null);}} className="flex-1"/>
                    <span className={`text-sm font-bold w-6 text-center text-${color}-600`}>{val}</span>
                  </div>
                ))}
                <div className="text-xs text-stone-400 text-right">합계: {autoRatioMB+autoRatioMX+autoRatioFB}경기 {autoRatioMB+autoRatioMX+autoRatioFB!==8&&<span className="text-orange-500">(8경기 권장)</span>}</div>
              </div>
            </div>
            {!autoPreview?(
              <button onClick={()=>{setSwapSelected([]);generateAutoSchedule();}} className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2">🎲 대진 생성하기</button>
            ):(
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-stone-600">생성된 대진 ({autoPreview.length}경기)</div>
                  <div className="text-xs text-stone-400">선수 탭 → 2명 선택 → 교체</div>
                </div>
                {swapSelected.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div className="text-xs text-blue-700 font-medium">
                      {swapSelected.length===1 ? `${swapSelected[0].name} 선택됨 → 교체할 선수 선택` : `${swapSelected[0].name} ↔ ${swapSelected[1].name}`}
                    </div>
                    {swapSelected.length===2 && (
                      <button onClick={()=>{
                        const [s1, s2] = swapSelected;
                        setAutoPreview(prev => prev.map(g => {
                          const slots = ['a1','a2','b1','b2'];
                          const newG = {...g};
                          const pos1 = slots.find(k => newG[k].id === s1.id);
                          const pos2 = slots.find(k => newG[k].id === s2.id);
                          if (pos1 && pos2) { [newG[pos1], newG[pos2]] = [newG[pos2], newG[pos1]]; }
                          else if (pos1) { newG[pos1] = s2; }
                          else if (pos2) { newG[pos2] = s1; }
                          return newG;
                        }));
                        setSwapSelected([]);
                      }} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg font-medium">교체</button>
                    )}
                    <button onClick={()=>setSwapSelected([])} className="text-xs text-stone-400 ml-2">✕</button>
                  </div>
                )}
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {autoPreview.map((g,i)=>{
                    const typeInfo = getMatchTypeLabel(g.type);
                    return (
                      <div key={i} className={`rounded-lg border p-2.5 ${typeInfo.color.replace('bg-','border-').replace('100','200')} bg-white`}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-xs font-bold text-stone-500">{i+1}경기</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                          {/* 포/백 교체 버튼 */}
                          <div className="flex gap-1 ml-auto">
                            <button onClick={()=>setAutoPreview(prev=>prev.map((pg,pi)=>pi===i?{...pg,a1:pg.a2,a2:pg.a1}:pg))}
                              className="text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-medium">A↔</button>
                            <button onClick={()=>setAutoPreview(prev=>prev.map((pg,pi)=>pi===i?{...pg,b1:pg.b2,b2:pg.b1}:pg))}
                              className="text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-medium">B↔</button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 space-y-1">
                            {[['a1','포'],['a2','백']].map(([k,pos])=>{
                              const p = g[k];
                              const isSel = swapSelected.some(s=>s.id===p.id);
                              return (
                                <button key={k} onClick={()=>{
                                  if(swapSelected.some(s=>s.id===p.id)){setSwapSelected(prev=>prev.filter(s=>s.id!==p.id));return;}
                                  if(swapSelected.length<2) setSwapSelected(prev=>[...prev,{...p,gameIdx:i,slot:k}]);
                                }} className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all ${isSel?'bg-blue-500 text-white':'bg-stone-50 hover:bg-stone-100 text-stone-700'}`}>
                                  <span className="text-stone-400 flex-shrink-0">{pos}</span>
                                  <span className={`font-medium ${p.gender==='M'?'text-blue-600':'text-pink-500'} ${isSel?'text-white':''}`}>{p.name}</span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="text-stone-300 font-bold text-sm">vs</div>
                          <div className="flex-1 space-y-1">
                            {[['b1','포'],['b2','백']].map(([k,pos])=>{
                              const p = g[k];
                              const isSel = swapSelected.some(s=>s.id===p.id);
                              return (
                                <button key={k} onClick={()=>{
                                  if(swapSelected.some(s=>s.id===p.id)){setSwapSelected(prev=>prev.filter(s=>s.id!==p.id));return;}
                                  if(swapSelected.length<2) setSwapSelected(prev=>[...prev,{...p,gameIdx:i,slot:k}]);
                                }} className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all ${isSel?'bg-blue-500 text-white':'bg-stone-50 hover:bg-stone-100 text-stone-700'}`}>
                                  <span className="text-stone-400 flex-shrink-0">{pos}</span>
                                  <span className={`font-medium ${p.gender==='M'?'text-blue-600':'text-pink-500'} ${isSel?'text-white':''}`}>{p.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>{setAutoPreview(null);setSwapSelected([]);}} className="flex-1 py-2.5 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium">다시 생성</button>
                  <button onClick={applyAutoSchedule} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold">등록하기 ✅</button>
                </div>
              </div>
            )}
            <button onClick={()=>{setShowAutoModal(false);setAutoPreview(null);}} className="w-full py-2.5 border border-stone-200 text-stone-500 rounded-lg text-sm">취소</button>
          </div>
        </Modal>
      )}

      {showOfficerModal&&(
        <Modal onClose={()=>setShowOfficerModal(false)} title="분기 회장 설정">
          <div className="space-y-3 mb-4">
            <div className="flex gap-2">
              <div className="flex-1"><label className="block text-xs font-medium text-stone-600 mb-1.5">연도</label><input type="number" value={officerYear} onChange={e=>setOfficerYear(parseInt(e.target.value))} className="w-full px-3 py-2.5 border border-stone-300 rounded-lg text-center"/></div>
              <div className="flex-1"><label className="block text-xs font-medium text-stone-600 mb-1.5">분기</label><div className="flex rounded-lg border border-stone-300 overflow-hidden">{QUARTERS.map(q=><button key={q.value} onClick={()=>setOfficerQuarter(q.value)} className={`flex-1 py-2.5 text-sm font-medium ${officerQuarter===q.value?'bg-emerald-700 text-white':'bg-white text-stone-600'}`}>{q.value}</button>)}</div></div>
            </div>
            <div><label className="block text-xs font-medium text-stone-600 mb-1.5">{officerYear}년 {officerQuarter}분기 회장</label><select value={officerMemberId} onChange={e=>setOfficerMemberId(e.target.value)} className="w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white"><option value="">선택</option>{members.map(m=><option key={m.id} value={m.id}>{m.name} ({m.gender==='M'?'남':'여'})</option>)}</select></div>
            <div className="text-xs text-stone-400">* 비밀번호가 필요합니다</div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setShowOfficerModal(false)} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
            <button onClick={saveOfficer} className="flex-1 px-4 py-2.5 bg-yellow-500 text-white rounded-lg font-medium flex items-center justify-center gap-2"><Crown size={16}/> 설정</button>
          </div>
        </Modal>
      )}

      {showScoreModal&&(
        <Modal onClose={()=>{setShowScoreModal(false);setScoringMatch(null);}} title="점수 입력">
          {scoringMatch&&(
            <div className="space-y-4">
              <div className="bg-stone-50 rounded-lg p-3 text-sm text-center">
                <div className="font-medium text-stone-800 mb-2">{scoringMatch.date.slice(5)} · {getMatchTypeLabel(scoringMatch.matchType).label}</div>
                <div className="flex items-center justify-between">
                  <div className="text-left text-xs"><div><span className="text-stone-400 mr-1">포</span>{getMemberName(scoringMatch.teamA1,scoringMatch.date)}</div><div><span className="text-stone-400 mr-1">백</span>{getMemberName(scoringMatch.teamA2,scoringMatch.date)}</div></div>
                  <div className="text-stone-400 font-bold px-2">vs</div>
                  <div className="text-right text-xs"><div><span className="text-stone-400 mr-1">포</span>{getMemberName(scoringMatch.teamB1,scoringMatch.date)}</div><div><span className="text-stone-400 mr-1">백</span>{getMemberName(scoringMatch.teamB2,scoringMatch.date)}</div></div>
                </div>
              </div>
              <div className="flex gap-3 items-center justify-center">
                <input type="number" min="0" value={inputScoreA} onChange={e=>setInputScoreA(e.target.value)} placeholder="0" disabled={inputIsDraw} className="w-24 px-3 py-3 border border-stone-300 rounded-lg text-center font-mono text-2xl disabled:bg-stone-100"/>
                <div className="text-stone-400 font-bold text-xl">-</div>
                <input type="number" min="0" value={inputScoreB} onChange={e=>setInputScoreB(e.target.value)} placeholder="0" disabled={inputIsDraw} className="w-24 px-3 py-3 border border-stone-300 rounded-lg text-center font-mono text-2xl disabled:bg-stone-100"/>
              </div>
              <button onClick={()=>setInputIsDraw(!inputIsDraw)} className={`w-full py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 ${inputIsDraw?'bg-yellow-100 border-yellow-400 text-yellow-800':'bg-white border-stone-300 text-stone-600'}`}>🤝 {inputIsDraw?'무승부로 기록':'무승부인 경우 체크'}</button>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={()=>{setShowScoreModal(false);setScoringMatch(null);}} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
            <button onClick={saveScore} disabled={!inputIsDraw&&(inputScoreA===''||inputScoreB==='')} className="flex-1 px-4 py-2.5 bg-emerald-800 text-white rounded-lg font-medium disabled:bg-stone-300">저장</button>
          </div>
        </Modal>
      )}

      {showAddMember&&(
        <Modal onClose={()=>setShowAddMember(false)} title="멤버 추가">
          <div className="space-y-3 mb-4">
            <input type="text" value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addMember()} placeholder="이름" autoFocus className="w-full px-4 py-3 border border-stone-300 rounded-lg"/>
            <div><label className="block text-xs font-medium text-stone-600 mb-1.5">성별</label><div className="flex rounded-lg border border-stone-300 overflow-hidden"><button onClick={()=>setNewMemberGender('M')} className={`flex-1 py-2.5 text-sm font-medium ${newMemberGender==='M'?'bg-blue-500 text-white':'bg-white text-stone-600'}`}>♂ 남자</button><button onClick={()=>setNewMemberGender('F')} className={`flex-1 py-2.5 text-sm font-medium ${newMemberGender==='F'?'bg-pink-500 text-white':'bg-white text-stone-600'}`}>♀ 여자</button></div></div>
            <div><label className="block text-xs font-medium text-stone-600 mb-1.5">회원 등급</label><div className="flex rounded-lg border border-stone-300 overflow-hidden"><button onClick={()=>setNewMemberType('regular')} className={`flex-1 py-2.5 text-sm font-medium ${newMemberType==='regular'?'bg-emerald-600 text-white':'bg-white text-stone-600'}`}>정회원</button><button onClick={()=>setNewMemberType('associate')} className={`flex-1 py-2.5 text-sm font-medium ${newMemberType==='associate'?'bg-stone-500 text-white':'bg-white text-stone-600'}`}>준회원</button></div></div>
          </div>
          <div className="text-xs text-stone-400 mb-3">* 비밀번호가 필요합니다</div>
          <div className="flex gap-2">
            <button onClick={()=>setShowAddMember(false)} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
            <button onClick={addMember} className="flex-1 px-4 py-2.5 bg-emerald-800 text-white rounded-lg font-medium">추가</button>
          </div>
        </Modal>
      )}

      {editingMember&&(
        <Modal onClose={()=>setEditingMember(null)} title="멤버 수정">
          <div className="space-y-3 mb-4">
            <input type="text" value={editMemberName} onChange={e=>setEditMemberName(e.target.value)} autoFocus className="w-full px-4 py-3 border border-stone-300 rounded-lg"/>
            <div><label className="block text-xs font-medium text-stone-600 mb-1.5">성별</label><div className="flex rounded-lg border border-stone-300 overflow-hidden"><button onClick={()=>setEditMemberGender('M')} className={`flex-1 py-2.5 text-sm font-medium ${editMemberGender==='M'?'bg-blue-500 text-white':'bg-white text-stone-600'}`}>♂ 남자</button><button onClick={()=>setEditMemberGender('F')} className={`flex-1 py-2.5 text-sm font-medium ${editMemberGender==='F'?'bg-pink-500 text-white':'bg-white text-stone-600'}`}>♀ 여자</button></div></div>
            <div><label className="block text-xs font-medium text-stone-600 mb-1.5">회원 등급</label><div className="flex rounded-lg border border-stone-300 overflow-hidden"><button onClick={()=>setEditMemberType('regular')} className={`flex-1 py-2.5 text-sm font-medium ${editMemberType==='regular'?'bg-emerald-600 text-white':'bg-white text-stone-600'}`}>정회원</button><button onClick={()=>setEditMemberType('associate')} className={`flex-1 py-2.5 text-sm font-medium ${editMemberType==='associate'?'bg-stone-500 text-white':'bg-white text-stone-600'}`}>준회원</button></div></div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setEditingMember(null)} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
            <button onClick={saveMember} className="flex-1 px-4 py-2.5 bg-emerald-800 text-white rounded-lg font-medium">저장</button>
          </div>
        </Modal>
      )}

      {showAddMatch&&(
        <Modal onClose={()=>{setShowAddMatch(false);setEditingMatch(null);}} title={editingMatch?'경기 수정':isScheduledMode?'대진 등록':'경기 기록'}>
          <div className="space-y-3">
            {!editingMatch&&(
              <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
                <button onClick={()=>setIsScheduledMode(false)} className={`flex-1 py-2 rounded-md text-sm font-medium ${!isScheduledMode?'bg-white text-stone-800 shadow-sm':'text-stone-500'}`}>🎾 경기 결과</button>
                <button onClick={()=>setIsScheduledMode(true)} className={`flex-1 py-2 rounded-md text-sm font-medium ${isScheduledMode?'bg-white text-stone-800 shadow-sm':'text-stone-500'}`}>📋 대진 등록</button>
              </div>
            )}
            <div><label className="block text-xs font-medium text-stone-600 mb-1.5">경기일</label><input type="date" value={matchDate} onChange={e=>setMatchDate(e.target.value)} className="w-full px-3 py-2.5 border border-stone-300 rounded-lg"/></div>
            {currentMatchType&&<div className={`text-center text-sm font-bold py-2 rounded-lg ${getMatchTypeLabel(currentMatchType).color}`}>{getMatchTypeLabel(currentMatchType).label}{!isRanked(currentMatchType)&&' · 랭킹 미반영'}</div>}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-emerald-800">🏆 팀 A</label>
                <button onClick={()=>{const t=teamA1;setTeamA1(teamA2);setTeamA2(t);}} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">포↔백</button>
              </div>
              <div className="flex gap-2 mb-2">
                <MemberSelect value={teamA1} onChange={setTeamA1} label="선택" posLabel="포 🟦" exclude={[teamA2,teamB1,teamB2].filter(Boolean)}/>
                <MemberSelect value={teamA2} onChange={setTeamA2} label="선택" posLabel="백 🟧" exclude={[teamA1,teamB1,teamB2].filter(Boolean)}/>
              </div>
              {!isScheduledMode&&<input type="number" min="0" value={scoreA} onChange={e=>setScoreA(e.target.value)} placeholder="팀 A 점수" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center font-mono text-lg"/>}
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-stone-600">팀 B</label>
                <button onClick={()=>{const t=teamB1;setTeamB1(teamB2);setTeamB2(t);}} className="text-xs bg-stone-200 text-stone-600 px-2 py-1 rounded font-medium">포↔백</button>
              </div>
              <div className="flex gap-2 mb-2">
                <MemberSelect value={teamB1} onChange={setTeamB1} label="선택" posLabel="포 🟦" exclude={[teamA1,teamA2,teamB2].filter(Boolean)}/>
                <MemberSelect value={teamB2} onChange={setTeamB2} label="선택" posLabel="백 🟧" exclude={[teamA1,teamA2,teamB1].filter(Boolean)}/>
              </div>
              {!isScheduledMode&&<input type="number" min="0" value={scoreB} onChange={e=>setScoreB(e.target.value)} placeholder="팀 B 점수" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center font-mono text-lg"/>}
            </div>
            {!isScheduledMode&&<button onClick={()=>setIsDraw(!isDraw)} className={`w-full py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 ${isDraw?'bg-yellow-100 border-yellow-400 text-yellow-800':'bg-white border-stone-300 text-stone-600'}`}>🤝 {isDraw?'무승부로 기록':'무승부인 경우 체크'}</button>}
            {availablePlayers.length<4&&<div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠️ 참석자가 부족해요.</div>}
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={()=>{setShowAddMatch(false);setEditingMatch(null);}} className="flex-1 px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg font-medium">취소</button>
            <button onClick={saveMatch} disabled={!isValidMatch||(isScheduledMode?false:!isValidScore)} className="flex-1 px-4 py-2.5 bg-emerald-800 text-white rounded-lg font-medium disabled:bg-stone-300">{editingMatch?'수정 완료':isScheduledMode?'대진 등록':'저장'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ComboCard({title,combos,emoji,valueColor,bgColor='bg-emerald-50',titleColor='text-emerald-800'}) {
  return(
    <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
      <div className={`px-4 py-3 border-b border-stone-100 ${bgColor}`}><h3 className={`font-bold text-sm ${titleColor}`}>{title}</h3></div>
      <div className="divide-y divide-stone-100">
        {combos.map((c,i)=>(
          <div key={i} className="px-4 py-3 flex items-center gap-3">
            <div className="text-lg">{emoji[i]||emoji[0]}</div>
            <div className="flex-1 min-w-0"><div className="font-semibold text-stone-800 text-sm">{c.name1} · {c.name2}</div><div className="text-xs text-stone-500">{c.wins}승{c.draws>0?` ${c.draws}무`:''} {c.losses}패{c.avgScore?' · 평균 '+c.avgScore+'점':''}</div></div>
            <div className={`text-xl font-bold ${valueColor}`}>{c.winRate.toFixed(0)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AwardCard({label,winner,value}) {
  return(
    <div className="bg-white/10 rounded-lg p-3 border border-white/20">
      <div className="text-xs text-yellow-200 tracking-wider mb-1">{label}</div>
      <div className="text-base font-bold truncate">{winner||'-'}</div>
      <div className="text-xs text-stone-300 mt-0.5">{value}</div>
    </div>
  );
}

function EmptyState({icon:Icon,title,desc}) {
  return(
    <div className="bg-white rounded-lg border border-dashed border-stone-300 py-16 px-6 text-center">
      <Icon className="mx-auto text-stone-300 mb-3" size={40}/>
      <div className="font-semibold text-stone-700 mb-1">{title}</div>
      <div className="text-sm text-stone-500">{desc}</div>
    </div>
  );
}

// 드래그 가능한 경기 카드
function SortableMatch({ match, idx, selectMode, editOrderMode, swapMode, swapTarget, selectedMatchIds, toggleSelectMatch, openScoreModal, openEditMatch, deleteMatch, getMemberName, getMatchTypeLabel, swapPoBack, handleSwapPlayer, dateGuests, Lock, Check, Pencil, Trash2 }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: match.id, disabled: !editOrderMode });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 999 : 'auto' };
  const typeInfo = getMatchTypeLabel(match.matchType);
  const draw = match.isDraw || (match.scoreA === match.scoreB && !match.isScheduled);
  const isSel = selectedMatchIds.includes(match.id);

  const players = [
    { id: match.teamA1, slot: 'a1', team: 'A', pos: '포' },
    { id: match.teamA2, slot: 'a2', team: 'A', pos: '백' },
    { id: match.teamB1, slot: 'b1', team: 'B', pos: '포' },
    { id: match.teamB2, slot: 'b2', team: 'B', pos: '백' },
  ];

  const PlayerChip = ({ id, slot, pos }) => {
    const name = getMemberName(id, match.date);
    const allP = [...(dateGuests?.[match.date]||[])];
    const gender = id?.startsWith('guest_') ? (id.includes('_M_')?'M':'F') : null;
    const isSwapSel = swapTarget?.player?.id === id;
    if (swapMode) {
      return (
        <button onClick={()=>handleSwapPlayer({id, name, gender}, slot, match.id)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs w-full text-left transition-all ${isSwapSel?'bg-purple-500 text-white':'bg-purple-50 hover:bg-purple-100 text-stone-700 border border-purple-200'}`}>
          <span className="text-stone-400 flex-shrink-0">{pos}</span>
          <span className={`font-medium truncate`}>{name}</span>
        </button>
      );
    }
    return (
      <div className="flex items-center gap-1 text-sm truncate">
        <span className="text-xs text-stone-400 flex-shrink-0">{pos}</span>
        <span className="truncate">{name}</span>
      </div>
    );
  };

  return (
    <div ref={setNodeRef} style={style}
      className={`p-3 rounded-lg border ${isSel?'bg-red-50 border-red-300':match.isScheduled?'bg-orange-50 border-orange-200':match.confirmed?'bg-blue-50 border-blue-200':'bg-stone-50 border-stone-200'} ${selectMode?'cursor-pointer':''}`}
      onClick={() => selectMode && toggleSelectMatch(match.id)}>
      <div className="flex items-center gap-2 mb-2">
        {editOrderMode && (
          <div {...attributes} {...listeners} className="flex flex-col gap-0.5 p-1.5 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none">
            <div className="w-4 h-0.5 bg-stone-400 rounded"></div>
            <div className="w-4 h-0.5 bg-stone-400 rounded"></div>
            <div className="w-4 h-0.5 bg-stone-400 rounded"></div>
          </div>
        )}
        {selectMode && <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSel?'bg-red-500 border-red-500':'border-stone-300'}`}>{isSel&&<Check size={10} className="text-white"/>}</div>}
        <span className="text-xs font-bold text-stone-500">{idx+1}경기</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
        {match.isScheduled?<span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">대진예정</span>
          :draw?<span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">무승부</span>
          :match.confirmed?<span className="text-xs text-blue-600 flex items-center gap-0.5"><Lock size={10}/>확정</span>
          :<span className="text-xs text-stone-400">미확정</span>}
        <div className="flex-1"></div>
        {!selectMode&&!editOrderMode&&!swapMode&&match.isScheduled&&<button onClick={e=>{e.stopPropagation();openScoreModal(match);}} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">점수입력</button>}
        {!selectMode&&!editOrderMode&&!swapMode&&!match.confirmed&&<button onClick={e=>{e.stopPropagation();openEditMatch(match);}} className="text-stone-400 p-1"><Pencil size={13}/></button>}
        {!selectMode&&!editOrderMode&&!swapMode&&<button onClick={e=>{e.stopPropagation();deleteMatch(match);}} className="text-stone-300 p-1"><Trash2 size={13}/></button>}
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 min-w-0 space-y-1 ${!match.isScheduled&&!draw&&match.scoreA>match.scoreB?'font-bold text-emerald-800':draw?'text-stone-600':'text-stone-500'}`}>
          {swapMode ? (
            <>
              <PlayerChip id={match.teamA1} slot="a1" pos="포"/>
              <PlayerChip id={match.teamA2} slot="a2" pos="백"/>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 text-sm truncate"><span className="text-xs text-stone-400">포</span><span className="truncate">{getMemberName(match.teamA1,match.date)}</span></div>
              <div className="flex items-center gap-1 text-sm truncate"><span className="text-xs text-stone-400">백</span><span className="truncate">{getMemberName(match.teamA2,match.date)}</span></div>
            </>
          )}
          {swapMode && <button onClick={e=>{e.stopPropagation();swapPoBack(match,'A');}} className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded mt-0.5">A 포↔백</button>}
        </div>
        {match.isScheduled?<div className="font-mono text-stone-400 bg-stone-100 px-2 py-1 rounded text-sm flex-shrink-0">vs</div>:
          <div className={`font-mono font-bold px-2 py-1 rounded border text-sm flex-shrink-0 ${draw?'bg-yellow-50 border-yellow-200 text-yellow-700':'bg-white border-stone-200 text-stone-700'}`}>{match.scoreA}-{match.scoreB}</div>}
        <div className={`flex-1 min-w-0 space-y-1 text-right ${!match.isScheduled&&!draw&&match.scoreB>match.scoreA?'font-bold text-emerald-800':draw?'text-stone-600':'text-stone-500'}`}>
          {swapMode ? (
            <>
              <PlayerChip id={match.teamB1} slot="b1" pos="포"/>
              <PlayerChip id={match.teamB2} slot="b2" pos="백"/>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 text-sm truncate justify-end"><span className="truncate">{getMemberName(match.teamB1,match.date)}</span><span className="text-xs text-stone-400">포</span></div>
              <div className="flex items-center gap-1 text-sm truncate justify-end"><span className="truncate">{getMemberName(match.teamB2,match.date)}</span><span className="text-xs text-stone-400">백</span></div>
            </>
          )}
          {swapMode && <button onClick={e=>{e.stopPropagation();swapPoBack(match,'B');}} className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded mt-0.5">B 포↔백</button>}
        </div>
      </div>
    </div>
  );
}

function Modal({children,onClose,title}) {
  return(
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold text-stone-800">{title}</h3><button onClick={onClose} className="text-stone-400 p-1"><X size={20}/></button></div>
        {children}
      </div>
    </div>
  );
}
