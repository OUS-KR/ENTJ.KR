// today-game.js - 전략적 제국 건설 (Building a Strategic Empire)

// --- Utility Functions ---
function getDailySeed() {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) | 0;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function getRandomValue(base, variance) {
    const min = base - variance;
    const max = base + variance;
    return Math.floor(currentRandFn() * (max - min + 1)) + min;
}

function getEulReParticle(word) {
    if (!word || word.length === 0) return "를";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "와";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "와";
    return (uni - 0xAC00) % 28 > 0 ? "과" : "와";
}

// --- Game State Management ---
let gameState = {};
let currentRandFn = null;

function resetGameState() {
    gameState = {
        day: 1,
        strategy: 50,
        growth: 50,
        influence: 50,
        authority: 50, // 권위
        order: 50, // 질서
        actionPoints: 10,
        maxActionPoints: 10,
        resources: { gold: 10, manpower: 10, materials: 5, ancient_relic: 0 },
        subordinates: [
            { id: "machiavelli", name: "마키아벨리", personality: "전략적", skill: "외교", loyalty: 70 },
            { id: "caesar", name: "카이사르", personality: "대담한", skill: "전술", loyalty: 60 }
        ],
        maxSubordinates: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { collectionSuccess: 0 },
        dailyActions: { patrolled: false, meetingHeld: false, talkedTo: [], minigamePlayed: false },
        empireBuildings: {
            treasury: { built: false, durability: 100, name: "국고", description: "제국의 금을 관리합니다.", effect_description: "금 수입 증가 및 경제 안정에 기여합니다." },
            barracks: { built: false, durability: 100, name: "병영", description: "군사를 훈련하고 유지합니다.", effect_description: "인력 확보 및 군사력 증강에 필수적입니다." },
            palace: { built: false, durability: 100, name: "궁전", description: "통치자의 권위를 상징합니다.", effect_description: "새로운 참모 등용 및 외교 이벤트 활성화." },
            academy: { built: false, durability: 100, name: "학술원", description: "전략과 기술을 연구합니다.", effect_description: "고대 유물 연구를 통한 스탯 및 자원 획득 기회 제공." },
            siegeWorkshop: { built: false, durability: 100, name: "공성 무기 제작소", description: "강력한 공성 무기를 제작합니다.", effect_description: "군사력 증강 및 특수 작전 잠금 해제." }
        },
        empireLevel: 0,
        minigameState: {}
    };
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
}

function saveGameState() {
    localStorage.setItem('entjEmpireGame', JSON.stringify(gameState));
}

// ... (The rest of the code will be a combination of the old ENTJ script and the new ENFJ features, adapted for the ENTJ theme)
// This is a placeholder for the full script that will be generated.
