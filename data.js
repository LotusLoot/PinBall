// 「튕겨라, 용사」 게임 데이터. 숫자 조정은 이 파일에서만 하면 된다.
window.G = window.G || {};

G.CFG = {
  W: 540, H: 960,
  stageBottom: 300,            // 전투 띠 아래 끝 = 보드 위 끝
  boardTop: 300, boardLeft: 16, boardRight: 524, boardBottom: 960,
  launchX: 270, launchY: 334,
  gravity: 1150, launchSpeed: 820,
  ballR: 9, pegR: 8,
  restPeg: 0.72, restWall: 0.84,
  basketY: 918, basketW: 92, basketSpeed: 105,
  heroX: 92, footY: 290, slotX: [0, 196, 288, 380, 470],
  critMult: 0.5, basketMult: 1.5,
  maxShotTime: 22,
  // 손맛 연출 수치
  fx: {
    hitstopCrit: 0.06, hitstopBig: 0.12,
    shakeCrit: 5, shakeBomb: 10, shakeBig: 14, shakeHurt: 8,
    flashEnemy: 0.08, slowmoBig: 0.3, slowmoBasket: 0.18,
    particlesPeg: 6, particlesCap: 420, particlesCapLow: 140,
    popScale: 1.35, rollupTime: 0.55,
  },
};

G.RARITY = {
  basic: { name: '기본', color: '#b9b2c9' },
  common: { name: '일반', color: '#e8e4f2' },
  uncommon: { name: '고급', color: '#62b6ff' },
  rare: { name: '전설', color: '#ffc94a' },
};

// 구슬: dmg = 핀 피해(1레벨). 강화 레벨마다 +1.
G.ORBS = {
  stone:        { name: '돌멩이', rarity: 'basic', dmg: 2, desc: l => '효과 없음. 꾸준히 잘 맞힌다.' },
  fire_orb:     { name: '불꽃 구슬', rarity: 'common', dmg: 1, desc: l => `핀 ${[4,3,2][l-1]}개마다 맨 앞 적에게 화상 1` },
  ice_orb:      { name: '얼음 구슬', rarity: 'common', dmg: 1, desc: l => `크리 핀을 맞히면 맨 앞 적 ${l>=3?2:1}턴 빙결` },
  rubber_orb:   { name: '고무 구슬', rarity: 'common', dmg: 2, desc: l => `벽에 튕길 때도 점수 +${l+1}` },
  gold_orb:     { name: '황금 구슬', rarity: 'common', dmg: 1, desc: l => `핀 ${[5,4,3][l-1]}개마다 골드 +1` },
  bomb_orb:     { name: '폭탄 구슬', rarity: 'uncommon', dmg: 2, desc: l => `바닥에 닿으면 폭발, 아래쪽 핀 ${[6,8,10][l-1]}개 추가 타격` },
  split_orb:    { name: '분열 구슬', rarity: 'uncommon', dmg: 2, desc: l => `첫 핀에서 ${l>=3?3:2}개로 갈라짐, 점수는 합산` },
  pierce_orb:   { name: '관통 구슬', rarity: 'uncommon', dmg: 3, desc: l => `처음 ${[5,7,9][l-1]}개 핀은 튕기지 않고 뚫고 내려감` },
  lightning_orb:{ name: '번개 구슬', rarity: 'uncommon', dmg: 2, desc: l => `크리 핀을 맞히면 가까운 핀 ${[4,5,6][l-1]}개로 전기가 튐` },
  poison_orb:   { name: '독 구슬', rarity: 'uncommon', dmg: 1, desc: l => `적 전체에 독 (맞힌 핀 수 ÷ ${[5,4,3][l-1]})` },
  vampire_orb:  { name: '흡혈 구슬', rarity: 'uncommon', dmg: 2, desc: l => `준 피해의 ${[10,15,20][l-1]}% 회복` },
  iron_orb:     { name: '쇠구슬', rarity: 'uncommon', dmg: 5, desc: l => '무거워서 빨리 떨어짐. 크리 배율을 받지 않음' },
  giant_orb:    { name: '거인 구슬', rarity: 'rare', dmg: 2, desc: l => '크기 2배, 한 번에 여러 핀을 맞힘' },
  ghost_orb:    { name: '유령 구슬', rarity: 'rare', dmg: 2, desc: l => '양쪽 벽이 이어져 반대편으로 나옴' },
  lucky_orb:    { name: '행운 구슬', rarity: 'rare', dmg: 2, desc: l => `발사할 때 무작위 핀 ${[3,4,5][l-1]}개를 크리 핀으로 바꿈` },
  clone_orb:    { name: '복제 구슬', rarity: 'rare', dmg: 1, desc: l => '바구니에 들어가면 다음 발에 한 번 더 쏨' },
};

G.RELICS = {
  dull_blade:     { name: '무딘 칼날', rarity: 'common', desc: '모든 구슬의 핀 피해 +1' },
  crit_lens:      { name: '크리 확대경', rarity: 'common', desc: '보드마다 크리 핀 +1' },
  lucky_coin:     { name: '행운의 동전', rarity: 'common', desc: '전투 후 골드 +5' },
  bandage:        { name: '붕대', rarity: 'common', desc: '전투 후 체력 3 회복' },
  bouncy_boots:   { name: '탄력 신발', rarity: 'common', desc: '벽 반사 점수 +1' },
  burning_gloves: { name: '불붙은 장갑', rarity: 'common', desc: '화상 피해 2배' },
  frost_ring:     { name: '서리 반지', rarity: 'common', desc: '빙결된 적은 받는 피해 +50%' },
  poison_jar:     { name: '독 항아리', rarity: 'common', desc: '전투 시작 시 적 전체 독 2' },
  bomb_pouch:     { name: '폭탄 주머니', rarity: 'uncommon', desc: '폭탄 핀 1개 → 3개, 한 번만 맞아도 폭발' },
  chain_reaction: { name: '연쇄 반응', rarity: 'uncommon', desc: '한 발에 핀 10개마다 배율 +0.5' },
  lightning_rod:  { name: '피뢰침', rarity: 'uncommon', desc: '모든 구슬이 크리 핀을 맞히면 번개 1회' },
  piggy_bank:     { name: '돼지 저금통', rarity: 'uncommon', desc: '가진 골드 10당 전투 후 이자 +1' },
  clockwork:      { name: '시계태엽', rarity: 'uncommon', desc: '보너스 바구니 속도 절반, 폭 +30%' },
  second_chance:  { name: '두 번째 기회', rarity: 'uncommon', desc: '전투당 1번, 바닥에 떨어진 구슬을 위로 다시 튕김' },
  mirror_shield:  { name: '거울 방패', rarity: 'uncommon', desc: '전투마다 적의 첫 공격을 반사' },
  refill_bell:    { name: '리필 종', rarity: 'uncommon', desc: '리필 핀 1개 → 2개' },
  first_strike:   { name: '첫 발의 기세', rarity: 'uncommon', desc: '전투 첫 발 피해 ×2' },
  cursed_crown:   { name: '저주받은 왕관', rarity: 'rare', desc: '모든 피해 ×1.5, 대신 최대 체력 -25' },
  infinite_pouch: { name: '무한 주머니', rarity: 'rare', desc: '다음 구슬 5개가 보이고, 전투당 1번 순서를 바꿀 수 있음' },
  golden_pin:     { name: '황금 핀', rarity: 'rare', desc: '골드 핀이 크리 핀 역할도 함' },
  shooting_star:  { name: '별똥별', rarity: 'rare', desc: '크리 핀 배율이 +0.5에서 +1로' },
  dragon_heart:   { name: '용의 심장', rarity: 'rare', desc: '체력 0이 되면 한 번 50%로 부활' },
  chaos_dice:     { name: '혼돈의 주사위', rarity: 'rare', desc: '매 발마다 핀 하나가 무작위 특수 핀으로 바뀜' },
  resonance_stone:{ name: '공명석', rarity: 'rare', desc: '같은 구슬을 연달아 쏘면 두 번째부터 배율 +1' },
};

// tier: normal / elite / boss.  range: 공격 사거리(칸).  move: 한 턴 이동 칸 수.
G.MONSTERS = {
  slime:            { name: '슬라임', act: 1, tier: 'normal', hp: 22, atk: 4, range: 1, move: 1, h: 64 },
  mushroom_soldier: { name: '버섯 병정', act: 1, tier: 'normal', hp: 30, atk: 5, range: 1, move: 1, h: 86, note: '2턴마다 독 포자' },
  wolf:             { name: '늑대', act: 1, tier: 'normal', hp: 34, atk: 6, range: 1, move: 2, h: 76, note: '한 번에 2칸 이동' },
  bat:              { name: '박쥐', act: 1, tier: 'normal', hp: 16, atk: 3, range: 4, move: 1, h: 60, fly: true, note: '뒷줄에서도 공격' },
  treant:           { name: '트렌트', act: 1, tier: 'elite', hp: 110, atk: 8, range: 1, move: 1, h: 128, note: '뿌리로 핀 3개를 덮어 막음' },
  slime_king:       { name: '슬라임 왕', act: 1, tier: 'boss', hp: 260, atk: 7, range: 4, move: 0, h: 150, note: '체력 50%가 되면 꼬마 슬라임 2마리 분열, 3턴마다 방어막 20' },
  goblin_archer:    { name: '고블린 궁수', act: 2, tier: 'normal', hp: 35, atk: 6, range: 3, move: 1, h: 86, note: '원거리 공격' },
  rock_golem:       { name: '바위 골렘', act: 2, tier: 'normal', hp: 60, atk: 8, range: 1, move: 1, h: 104, note: '매 턴 방어막 15' },
  cave_spider:      { name: '동굴 거미', act: 2, tier: 'normal', hp: 40, atk: 5, range: 1, move: 1, h: 70, note: '가시 핀 2개 설치' },
  skeleton:         { name: '해골 병사', act: 2, tier: 'normal', hp: 30, atk: 8, range: 1, move: 1, h: 90, note: '죽으면 1번 부활 (체력 10)' },
  minotaur:         { name: '미노타우르스', act: 2, tier: 'elite', hp: 200, atk: 9, range: 1, move: 1, h: 130, note: '3턴마다 돌진 20' },
  cave_dragon:      { name: '동굴 용', act: 2, tier: 'boss', hp: 520, atk: 8, range: 4, move: 0, h: 160, note: '숨 들이쉬기 뒤 브레스 18, 핀을 불태움' },
  black_knight:     { name: '흑기사', act: 3, tier: 'normal', hp: 90, atk: 12, range: 1, move: 1, h: 104, note: '크리 핀 없이 맞히면 피해 절반' },
  dark_mage:        { name: '어둠 마법사', act: 3, tier: 'normal', hp: 55, atk: 9, range: 3, move: 1, h: 100, note: '매 턴 핀 배치를 흔듦' },
  gargoyle:         { name: '가고일', act: 3, tier: 'normal', hp: 70, atk: 10, range: 1, move: 1, h: 92, note: '2턴마다 석화 (피해 면역)' },
  mimic:            { name: '미믹', act: 3, tier: 'normal', hp: 80, atk: 14, range: 1, move: 1, h: 84, note: '처치하면 골드 60' },
  reaper:           { name: '사신', act: 3, tier: 'elite', hp: 360, atk: 12, range: 2, move: 1, h: 140, note: '체력 낮은 아군부터 공격력 흡수' },
  demon_lord:       { name: '마왕', act: 3, tier: 'boss', hp: 900, atk: 12, range: 4, move: 0, h: 170, note: '3턴마다 가시 핀 3개. 2단계 보드 회전, 3단계 바구니 제거' },
};

G.ENCOUNTERS = {
  1: { first: [['slime', 'slime']], normal: [['slime', 'slime', 'bat'], ['mushroom_soldier', 'slime'], ['wolf', 'slime'], ['bat', 'bat', 'slime'], ['mushroom_soldier', 'wolf'], ['wolf', 'bat']], elite: [['treant']], boss: [['slime_king']] },
  2: { first: [['goblin_archer', 'skeleton']], normal: [['rock_golem', 'goblin_archer'], ['cave_spider', 'skeleton'], ['skeleton', 'skeleton', 'goblin_archer'], ['cave_spider', 'rock_golem'], ['goblin_archer', 'cave_spider', 'bat']], elite: [['minotaur']], boss: [['cave_dragon']] },
  3: { first: [['dark_mage', 'skeleton']], normal: [['black_knight', 'dark_mage'], ['gargoyle', 'goblin_archer'], ['mimic', 'dark_mage'], ['black_knight', 'gargoyle'], ['gargoyle', 'dark_mage', 'bat']], elite: [['skeleton', 'reaper', 'skeleton']], boss: [['demon_lord']] },
};
G.ACTS = {
  1: { name: '초록 숲', bg: 'forest', tint: ['#1d2b2a', '#14201f'], peg: '#5fb8ff' },
  2: { name: '수정 동굴', bg: 'cave', tint: ['#1c2140', '#121530'], peg: '#8fa8ff' },
  3: { name: '마왕성', bg: 'castle', tint: ['#2a1730', '#1a0e20'], peg: '#c08cff' },
};

G.CHARS = {
  apprentice:     { name: '견습 용사', hp: 80, bag: ['stone','stone','stone','stone','rubber_orb'], passive: '특별한 능력은 없지만 균형이 좋다', unlock: null },
  fire_mage:      { name: '화염 마법사', hp: 72, bag: ['stone','stone','stone','fire_orb','fire_orb'], passive: '화상이 턴마다 줄지 않고 계속 쌓인다', unlock: { key: 'boss1', text: '1막 보스 처치' } },
  goblin_gambler: { name: '도박꾼 고블린', hp: 60, bag: ['stone','stone','stone','gold_orb','lucky_orb'], passive: '크리 핀 +2, 대신 체력이 낮다', unlock: { key: 'gold300', text: '한 판에 골드 300 모으기' } },
  dwarf_smith:    { name: '대장장이 드워프', hp: 86, bag: ['iron_orb','iron_orb','stone','stone'], passive: '모든 핀이 2번 맞아야 꺼진다 (점수도 2번)', unlock: { key: 'boss2', text: '2막 보스 처치' } },
};

// 처음부터 보상 풀에 있는 구슬·유물. 나머지는 정수로 해금.
G.START_POOL = {
  orbs: ['fire_orb','ice_orb','rubber_orb','gold_orb','bomb_orb','split_orb','pierce_orb','poison_orb'],
  relics: ['dull_blade','crit_lens','lucky_coin','bandage','bouncy_boots','burning_gloves','frost_ring','poison_jar','bomb_pouch','chain_reaction','piggy_bank','clockwork','first_strike','mirror_shield'],
};
G.UNLOCKS = [
  { type: 'orb', id: 'lightning_orb', cost: 25 }, { type: 'orb', id: 'vampire_orb', cost: 30 }, { type: 'orb', id: 'iron_orb', cost: 30 },
  { type: 'orb', id: 'giant_orb', cost: 50 }, { type: 'orb', id: 'ghost_orb', cost: 50 }, { type: 'orb', id: 'lucky_orb', cost: 60 }, { type: 'orb', id: 'clone_orb', cost: 70 },
  { type: 'relic', id: 'lightning_rod', cost: 25 }, { type: 'relic', id: 'second_chance', cost: 30 }, { type: 'relic', id: 'refill_bell', cost: 30 },
  { type: 'relic', id: 'cursed_crown', cost: 50 }, { type: 'relic', id: 'infinite_pouch', cost: 50 }, { type: 'relic', id: 'golden_pin', cost: 50 },
  { type: 'relic', id: 'shooting_star', cost: 70 }, { type: 'relic', id: 'dragon_heart', cost: 70 }, { type: 'relic', id: 'chaos_dice', cost: 70 }, { type: 'relic', id: 'resonance_stone', cost: 80 },
  { type: 'perma', id: 'hp', name: '시작 체력 +5', cost: 30 }, { type: 'perma', id: 'gold', name: '시작 골드 +20', cost: 30 }, { type: 'perma', id: 'reroll', name: '보상 다시 뽑기 1회', cost: 60 },
];

G.ASCENSION = [
  null,
  '적 체력 +10%', '엘리트가 더 자주 나온다', '휴식 회복이 20%로 줄어든다', '시작 골드 0', '적 공격력 +15%',
  '상점 가격 +25%', '보스 체력 +20%', '시작 체력 -10', '보상 선택지가 2개로 줄어든다', '적 체력이 추가로 +25%',
];

G.ACHIEVEMENTS = [
  { id: 'first_win', name: '첫 승리', desc: '전투에서 처음으로 이기기' },
  { id: 'hit1000', name: '천 단위 한 방', desc: '한 발에 1000 피해' },
  { id: 'pegs50', name: '핀 청소부', desc: '한 발에 핀 50개 맞히기' },
  { id: 'crit5', name: '크리 폭풍', desc: '한 발에 크리 핀 5개 맞히기' },
  { id: 'boss1', name: '숲의 왕 퇴치', desc: '1막 보스 처치' },
  { id: 'clear', name: '용사의 귀환', desc: '3막 마왕 처치' },
  { id: 'lean', name: '가벼운 주머니', desc: '구슬 3개 이하로 클리어' },
  { id: 'rich', name: '부자 용사', desc: '한 판에 골드 500 보유' },
  { id: 'legend3', name: '전설 수집가', desc: '한 판에 전설 유물 3개' },
  { id: 'asc5', name: '높은 하늘', desc: '승천 5단계 클리어' },
];

G.MAP_WEIGHTS = { battle: 45, rest: 15, event: 15, elite: 10, shop: 10, treasure: 5 };
G.NODE_INFO = {
  battle: { name: '전투', icon: 'map/battle' }, elite: { name: '엘리트', icon: 'map/elite' }, shop: { name: '상점', icon: 'map/shop' },
  rest: { name: '휴식', icon: 'map/rest' }, treasure: { name: '보물', icon: 'map/treasure' }, event: { name: '이벤트', icon: 'map/event' },
  boss: { name: '보스', icon: 'map/elite' },
};

G.PRICES = { orb: { common: 45, uncommon: 80, rare: 120 }, relic: { common: 100, uncommon: 160, rare: 250 }, remove: 50 };
