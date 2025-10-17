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
        authority: 50,
        order: 50,
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
        dailyActions: { patrolled: false, decreeIssued: false, talkedTo: [], minigamePlayed: false },
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

function loadGameState() {
    const savedState = localStorage.getItem('entjEmpireGame');
    const today = new Date().toISOString().slice(0, 10);
    if (savedState) {
        let loaded = JSON.parse(savedState);
        if (!loaded.dailyBonus) loaded.dailyBonus = { collectionSuccess: 0 };
        if (loaded.authority === undefined) loaded.authority = 50;
        if (loaded.order === undefined) loaded.order = 50;
        Object.assign(gameState, loaded);
        currentRandFn = mulberry32(getDailySeed() + gameState.day);
        if (gameState.lastPlayedDate !== today) {
            gameState.day += 1;
            gameState.lastPlayedDate = today;
            gameState.manualDayAdvances = 0;
            gameState.dailyEventTriggered = false;
            processDailyEvents();
        }
    } else {
        resetGameState();
        processDailyEvents();
    }
    renderAll();
}

function updateState(changes, displayMessage = null) {
    Object.keys(changes).forEach(key => {
        if (typeof changes[key] === 'object' && changes[key] !== null && !Array.isArray(changes[key])) {
            gameState[key] = { ...gameState[key], ...changes[key] };
        } else {
            gameState[key] = changes[key];
        }
    });
    saveGameState();
    renderAll(displayMessage);
}

// --- UI Rendering ---
function updateGameDisplay(text) {
    const gameArea = document.getElementById('gameArea');
    if(gameArea && text) gameArea.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
}

function renderStats() {
    const statsDiv = document.getElementById('gameStats');
    if (!statsDiv) return;
    const subordinateListHtml = gameState.subordinates.map(s => `<li>${s.name} (${s.skill}) - 충성도: ${s.loyalty}</li>`).join('');
    statsDiv.innerHTML = `
        <p><b>통치:</b> ${gameState.day}일차</p>
        <p><b>행동력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>전략:</b> ${gameState.strategy} | <b>성장:</b> ${gameState.growth} | <b>영향력:</b> ${gameState.influence} | <b>권위:</b> ${gameState.authority} | <b>질서:</b> ${gameState.order}</p>
        <p><b>자원:</b> 금 ${gameState.resources.gold}, 인력 ${gameState.resources.manpower}, 자재 ${gameState.resources.materials}, 고대 유물 ${gameState.resources.ancient_relic || 0}</p>
        <p><b>제국 레벨:</b> ${gameState.empireLevel}</p>
        <p><b>휘하 참모 (${gameState.subordinates.length}/${gameState.maxSubordinates}):</b></p>
        <ul>${subordinateListHtml}</ul>
        <p><b>건설된 건물:</b></p>
        <ul>${Object.values(gameState.empireBuildings).filter(b => b.built).map(b => `<li>${b.name} (내구성: ${b.durability}) - ${b.effect_description}</li>`).join('') || '없음'}</ul>
    `;
    const manualDayCounter = document.getElementById('manualDayCounter');
    if(manualDayCounter) manualDayCounter.innerText = gameState.manualDayAdvances;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) return;
    choicesDiv.innerHTML = choices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}'>${choice.text}</button>`).join('');
    choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            if (gameActions[action]) {
                gameActions[action](JSON.parse(button.dataset.params || '{}'));
            }
        });
    });
}

function renderAll(customDisplayMessage = null) {
    const desc = document.getElementById('gameDescription');
    if (desc) desc.style.display = 'none';
    renderStats();
    if (!gameState.currentScenarioId.startsWith('minigame_')) {
        const scenario = gameScenarios[gameState.currentScenarioId] || gameScenarios.intro;
        updateGameDisplay(customDisplayMessage || scenario.text);
        renderChoices(scenario.choices || []);
    }
}

// --- Game Data (ENTJ Themed) ---
const gameScenarios = {
    "intro": { text: "제국을 위해 무엇을 하시겠습니까?", choices: [
        { text: "영토 순찰", action: "patrol" },
        { text: "참모 면담", action: "meet_subordinates" },
        { text: "칙령 반포", action: "issue_decree" },
        { text: "오늘의 결단", action: "play_minigame" }
    ]},
    "game_over_strategy": { text: "잘못된 전략으로 제국이 위기에 빠졌습니다. 당신의 통치는 끝났습니다.", choices: [], final: true },
    // ... other scenarios
};

const patrolOutcomes = [
    { weight: 30, effect: (gs) => ({ changes: { order: gs.order + getRandomValue(5, 2) }, message: "영토 순찰을 통해 질서가 확립되었습니다." }) },
    { weight: 20, effect: (gs) => ({ changes: { influence: gs.influence + getRandomValue(5, 2) }, message: "백성들의 지지를 확인하여 영향력이 상승했습니다." }) },
];
const meetOutcomes = [
    { weight: 40, effect: (gs, sub) => { const loyaltyGain = getRandomValue(10, 5); const updated = gs.subordinates.map(s => s.id === sub.id ? { ...s, loyalty: Math.min(100, s.loyalty + loyaltyGain) } : s); return { changes: { subordinates: updated }, message: `${sub.name}와(과)의 면담으로 충성도가 상승했습니다.` }; } },
];
const decreeOutcomes = [
    { weight: 30, effect: (gs) => ({ changes: { growth: gs.growth + getRandomValue(10, 3) }, message: "성장 중심의 칙령으로 제국이 발전합니다." }) },
];

const minigames = [
    {
        name: "전략적 의사결정",
        description: "제국의 중대사안에 대해 최적의 결정을 내리세요.",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { stage: 1, score: 0, problems: [ { q: "가뭄으로 식량난이 우려됩니다. 최선의 해결책은?", a: ["세금을 감면하여 민심을 얻는다", "비축된 군량미를 푼다", "인접국에 원조를 요청한다"], correct: 1 }, { q: "국경에서 소규모 분쟁이 발생했습니다. 어떻게 대처하시겠습니까?", a: ["즉시 군대를 파견하여 섬멸한다", "외교관을 보내 협상을 시도한다", "상황을 주시하며 방어 태세를 강화한다"], correct: 2 } ].sort(() => currentRandFn() - 0.5) };
            minigames[0].render(gameArea, choicesDiv);
        },
        render: (gameArea, choicesDiv) => {
            const state = gameState.minigameState;
            if (state.stage > state.problems.length) { minigames[0].end(); return; }
            const problem = state.problems[state.stage - 1];
            gameArea.innerHTML = `<p><b>상황 ${state.stage}:</b> ${problem.q}</p>`;
            choicesDiv.innerHTML = problem.a.map((ans, i) => `<button class="choice-btn" data-index="${i}">${ans}</button>`).join('');
            choicesDiv.querySelectorAll('.choice-btn').forEach(button => button.addEventListener('click', () => minigames[0].processAction('select_option', parseInt(button.dataset.index))));
        },
        processAction: (actionType, value) => {
            const state = gameState.minigameState;
            const problem = state.problems[state.stage - 1];
            if (value === problem.correct) { state.score += 50; updateGameDisplay("현명한 결정입니다!"); } else { updateGameDisplay("결정이 아쉬움을 남깁니다."); }
            state.stage++;
            setTimeout(() => minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices')), 1500);
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({ strategy: gameState.strategy + rewards.strategy, influence: gameState.influence + rewards.influence, currentScenarioId: 'intro' }, rewards.message);
        }
    },
];

function calculateMinigameReward(minigameName, score) {
    let rewards = { strategy: 0, influence: 0, message: "" };
    if (score >= 100) { rewards.strategy = 15; rewards.influence = 10; rewards.message = `완벽한 결단력이었습니다! (+15 전략, +10 영향력)`; }
    else if (score >= 50) { rewards.strategy = 10; rewards.influence = 5; rewards.message = `훌륭한 결정이었습니다. (+10 전략, +5 영향력)`; }
    else { rewards.strategy = 5; rewards.message = `결정을 내렸습니다. (+5 전략)`; }
    return rewards;
}

function spendActionPoint() {
    if (gameState.actionPoints <= 0) { updateGameDisplay("행동력이 부족합니다."); return false; }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    patrol: () => {
        if (!spendActionPoint()) return;
        const result = patrolOutcomes[0].effect(gameState);
        updateState(result.changes, result.message);
    },
    meet_subordinates: () => {
        if (!spendActionPoint()) return;
        const subordinate = gameState.subordinates[Math.floor(currentRandFn() * gameState.subordinates.length)];
        const result = meetOutcomes[0].effect(gameState, subordinate);
        updateState(result.changes, result.message);
    },
    issue_decree: () => {
        if (!spendActionPoint()) return;
        const result = decreeOutcomes[0].effect(gameState);
        updateState(result.changes, result.message);
    },
    play_minigame: () => {
        if (!spendActionPoint()) return;
        const minigame = minigames[0];
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } });
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
};

function applyStatEffects() {
    let message = "";
    if (gameState.strategy >= 70) { message += "뛰어난 전략으로 제국이 안정됩니다. "; }
    if (gameState.growth >= 70) { message += "제국의 성장이 가속화됩니다. "; }
    if (gameState.influence >= 70) { message += "당신의 영향력이 하늘을 찌릅니다. "; }
    if (gameState.authority < 30) { message += "권위가 하락하여 명령이 잘 전달되지 않습니다. "; }
    if (gameState.order < 30) { message += "질서가 무너져 제국이 혼란에 빠집니다. "; }
    return message;
}

const weightedDailyEvents = [
    { id: "rebellion", weight: 10, condition: () => gameState.order < 40, onTrigger: () => updateState({ order: gameState.order - 10 }, "반란 조짐이 보입니다. 질서가 하락합니다.") },
    { id: "plague", weight: 5, condition: () => true, onTrigger: () => updateState({ manpower: gameState.manpower - 10 }, "역병이 돌아 인력이 감소했습니다.") },
];

function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
    updateState({ actionPoints: 10, dailyEventTriggered: true });
    const statEffectMessage = applyStatEffects();
    let dailyMessage = "새로운 날이 밝았습니다. " + statEffectMessage;
    if (gameState.strategy <= 0) { gameState.currentScenarioId = "game_over_strategy"; }
    let eventId = "intro";
    const possibleEvents = weightedDailyEvents.filter(event => !event.condition || event.condition());
    if (possibleEvents.length > 0) {
        const totalWeight = possibleEvents.reduce((sum, event) => sum + event.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenEvent = possibleEvents.find(event => (cumulativeWeight += event.weight) >= rand);
        if (chosenEvent) {
            eventId = chosenEvent.id;
            if (chosenEvent.onTrigger) chosenEvent.onTrigger();
        }
    }
    gameState.currentScenarioId = eventId;
    updateGameDisplay(dailyMessage + (gameScenarios[eventId]?.text || ''));
    renderChoices(gameScenarios[eventId]?.choices || []);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 제국을 포기하시겠습니까? 모든 영광이 사라집니다.")) {
        localStorage.removeItem('entjEmpireGame');
        resetGameState();
        saveGameState();
        location.reload();
    }
}

window.onload = function() {
    try {
        initDailyGame();
        document.getElementById('resetGameBtn').addEventListener('click', resetGame);
        document.getElementById('nextDayBtn').addEventListener('click', () => {
            if (gameState.manualDayAdvances >= 5) {
                updateGameDisplay("오늘은 더 이상 시간을 흐르게 할 수 없습니다.");
                return;
            }
            updateState({
                manualDayAdvances: gameState.manualDayAdvances + 1,
                day: gameState.day + 1,
                dailyEventTriggered: false
            });
            processDailyEvents();
        });
    } catch (e) {
        console.error("게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};