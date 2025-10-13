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

function getEulReParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "와";
    return (uni - 0xAC00) % 28 > 0 ? "과" : "와";
}

function showFeedback(isSuccess, message) {
    const feedbackMessage = document.getElementById('feedbackMessage');
    if (feedbackMessage) {
        feedbackMessage.innerText = message;
        feedbackMessage.className = `feedback-message ${isSuccess ? 'correct' : 'incorrect'}`;
    }
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
            treasury: { built: false, durability: 100 },
            barracks: { built: false, durability: 100 },
            palace: { built: false, durability: 100 },
            academy: { built: false, durability: 100 },
            siegeWorkshop: { built: false, durability: 100 }
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
        if (!loaded.subordinates || loaded.subordinates.length === 0) {
            loaded.subordinates = [
                { id: "machiavelli", name: "마키아벨리", personality: "전략적", skill: "외교", loyalty: 70 },
                { id: "caesar", name: "카이사르", personality: "대담한", skill: "전술", loyalty: 60 }
            ];
        }
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
        <p><b>통치:</b> ${gameState.day}일</p>
        <p><b>행동력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>전략:</b> ${gameState.strategy} | <b>성장:</b> ${gameState.growth} | <b>영향력:</b> ${gameState.influence}</p>
        <p><b>자원:</b> 금 ${gameState.resources.gold}, 인력 ${gameState.resources.manpower}, 자재 ${gameState.resources.materials}, 고대 유물 ${gameState.resources.ancient_relic || 0}</p>
        <p><b>제국 레벨:</b> ${gameState.empireLevel}</p>
        <p><b>휘하 참모 (${gameState.subordinates.length}/${gameState.maxSubordinates}):</b></p>
        <ul>${subordinateListHtml}</ul>
    `;
    const manualDayCounter = document.getElementById('manualDayCounter');
    if(manualDayCounter) manualDayCounter.innerText = gameState.manualDayAdvances;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) return;
    let dynamicChoices = [];

    if (gameState.currentScenarioId === 'intro') {
        dynamicChoices = gameScenarios.intro.choices;
    } else if (gameState.currentScenarioId === 'action_facility_management') {
        dynamicChoices = gameScenarios.action_facility_management.choices ? [...gameScenarios.action_facility_management.choices] : [];
        if (!gameState.empireBuildings.treasury.built) dynamicChoices.push({ text: "국고 건설 (금 50, 자재 20)", action: "build_treasury" });
        if (!gameState.empireBuildings.barracks.built) dynamicChoices.push({ text: "병영 건설 (인력 30, 자재 30)", action: "build_barracks" });
        if (!gameState.empireBuildings.palace.built) dynamicChoices.push({ text: "궁전 건설 (금 100, 인력 50, 자재 50)", action: "build_palace" });
        if (!gameState.empireBuildings.academy.built) dynamicChoices.push({ text: "학술원 건설 (인력 80, 자재 40)", action: "build_academy" });
        if (gameState.empireBuildings.barracks.built && gameState.empireBuildings.barracks.durability > 0 && !gameState.empireBuildings.siegeWorkshop.built) {
            dynamicChoices.push({ text: "공성 무기 제작소 건설 (인력 50, 자재 100)", action: "build_siege_workshop" });
        }
        Object.keys(gameState.empireBuildings).forEach(key => {
            const facility = gameState.empireBuildings[key];
            if (facility.built && facility.durability < 100) {
                dynamicChoices.push({ text: `${key} 보수 (인력 10, 자재 10)`, action: "maintain_facility", params: { facility: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}''>${choice.text}</button>`).join('');
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
        renderChoices(scenario.choices);
    }
}

// --- Game Data ---
const gameScenarios = {
    "intro": { text: "무엇을 지시하시겠습니까?", choices: [
        { text: "영토 순찰", action: "patrol" },
        { text: "참모와 면담", action: "talk_to_subordinates" },
        { text: "전략 회의 소집", action: "hold_meeting" },
        { text: "자원 징수", action: "show_resource_collection_options" },
        { text: "제국 건물 관리", action: "show_facility_options" },
        { text: "오늘의 미니게임", action: "play_minigame" }
    ]},
    "daily_event_conflict": {
        text: "참모 마키아벨리와 카이사르 사이에 권력 다툼의 조짐이 보입니다. 둘 다 당신의 결정을 주시하고 있습니다.",
        choices: [
            { text: "마키아벨리의 책략을 지지한다.", action: "handle_conflict", params: { first: "machiavelli", second: "caesar" } },
            { text: "카이사르의 군사적 공적을 치하한다.", action: "handle_conflict", params: { first: "caesar", second: "machiavelli" } },
            { text: "둘에게 공동의 적을 상기시켜 단결시킨다.", action: "mediate_conflict" },
            { text: "그들의 경쟁이 제국에 도움이 될 것이라 판단한다.", action: "ignore_event" }
        ]
    },
    "daily_event_rebellion": { text: "지방에서 반란의 조짐이 보입니다. 즉시 진압하여 인력 손실이 발생했습니다. (-10 인력)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_plague": { text: "역병이 돌아 국고를 사용하여 방역했습니다. (-10 금)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_envoy_visit": {
        text: "이웃 제국에서 외교 사절단이 방문했습니다. [금 50]을 선물하여 [고대 유물]의 정보를 얻을 수 있습니다.",
        choices: [
            { text: "선물을 하사한다", action: "accept_deal" },
            { text: "요구에 응하지 않는다", action: "decline_deal" }
        ]
    },
    "daily_event_new_subordinate": {
        choices: [
            { text: "능력을 높이 사 즉시 등용한다.", action: "welcome_new_unique_subordinate" },
            { text: "충성심을 시험해본다.", action: "observe_subordinate" },
            { text: "제국에 어울리지 않는 인재다.", action: "reject_subordinate" }
        ]
    },
    "game_over_strategy": { text: "제국의 전략이 한계에 부딪혔습니다. 더 이상 성장할 수 없습니다.", choices: [], final: true },
    "game_over_growth": { text: "제국의 성장이 멈췄습니다. 민심이 이반하고, 제국은 쇠퇴합니다.", choices: [], final: true },
    "game_over_influence": { text: "제국의 영향력이 무너졌습니다. 주변국들이 당신을 얕보기 시작합니다.", choices: [], final: true },
    "game_over_resources": { text: "제국의 자원이 고갈되어 더 이상 통치할 수 없습니다.", choices: [], final: true },
    "action_resource_collection": {
        text: "어떤 자원을 징수하시겠습니까?",
        choices: [
            { text: "세금 징수 (금)", action: "perform_collect_gold" },
            { text: "징병 (인력)", action: "perform_draft_manpower" },
            { text: "자재 수집 (자재)", "action": "perform_gather_materials" },
            { text: "취소", "action": "return_to_intro" }
        ]
    },
    "action_facility_management": {
        text: "어떤 건물을 관리하시겠습니까?",
        choices: []
    },
    "resource_collection_result": {
        text: "",
        choices: [{ text: "확인", action: "show_resource_collection_options" }]
    },
    "facility_management_result": {
        text: "",
        choices: [{ text: "확인", action: "show_facility_options" }]
    },
    "conflict_resolution_result": {
        text: "",
        choices: [{ text: "확인", action: "return_to_intro" }]
    }
};

function calculateMinigameReward(minigameName, score) {
    let rewards = { strategy: 0, growth: 0, influence: 0, message: "" };

    switch (minigameName) {
        case "기억력 순서 맞추기":
            if (score >= 51) {
                rewards.growth = 15;
                rewards.strategy = 10;
                rewards.influence = 5;
                rewards.message = `완벽한 기억력입니다! 제국의 정보력이 상승합니다. (+15 성장, +10 전략, +5 영향력) તરીકે`;
            } else if (score >= 21) {
                rewards.growth = 10;
                rewards.strategy = 5;
                rewards.message = `훌륭한 기억력입니다. (+10 성장, +5 전략)`;
            } else if (score >= 0) {
                rewards.growth = 5;
                rewards.message = `기억력 훈련을 완료했습니다. (+5 성장)`;
            } else {
                rewards.message = `기억력 훈련을 완료했지만, 아쉽게도 보상은 없습니다.`;
            }
            break;
        case "전략적 의사결정":
            rewards.strategy = 10;
            rewards.message = `현명한 결정을 내렸습니다. (+10 전략)`;
            break;
        case "자원 최적화":
            rewards.growth = 5;
            rewards.strategy = 5;
            rewards.message = `자원을 효율적으로 배분했습니다. (+5 성장, +5 전략)`;
            break;
        case "협상 시뮬레이션":
            rewards.influence = 10;
            rewards.message = `성공적인 협상이었습니다. (+10 영향력)`;
            break;
        case "위기 관리 챌린지":
            rewards.strategy = 10;
            rewards.influence = 5;
            rewards.message = `위기를 성공적으로 관리했습니다. (+10 전략, +5 영향력)`;
            break;
        default:
            rewards.message = `미니게임 ${minigameName}을(를) 완료했습니다.`;
            break;
    }
    return rewards;
}

const minigames = [
    {
        name: "기억력 순서 맞추기",
        description: "화면에 나타나는 암호를 기억하고 정확하게 입력하세요. 단계가 올라갈수록 어려워집니다!",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { currentSequence: [], playerInput: [], stage: 1, score: 0, showingSequence: false };
            minigames[0].render(gameArea, choicesDiv);
            minigames[0].showSequence();
        },
        render: (gameArea, choicesDiv) => {
            gameArea.innerHTML = `
                <p><b>단계:</b> ${gameState.minigameState.stage} | <b>점수:</b> ${gameState.minigameState.score}</p>
                <p id="sequenceDisplay" style="font-size: 2em; font-weight: bold; min-height: 1.5em;"></p>
                <p>암호를 기억하고 입력하세요:</p>
                <div id="playerInputDisplay" style="font-size: 1.5em; min-height: 1.5em;">${gameState.minigameState.playerInput.join(' ')}</div>
            `;
            choicesDiv.innerHTML = `
                <div class="number-pad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `<button class="choice-btn num-btn" data-value="${num}">${num}</button>`).join('')}
                    <button class="choice-btn num-btn" data-value="0">0</button>
                    <button class="choice-btn submit-btn" data-action="submitSequence">입력 완료</button>
                    <button class="choice-btn reset-btn" data-action="resetInput">초기화</button>
                </div>
            `;
            choicesDiv.querySelectorAll('.num-btn').forEach(button => {
                button.addEventListener('click', () => minigames[0].processAction('addInput', button.dataset.value));
            });
            choicesDiv.querySelector('.submit-btn').addEventListener('click', () => minigames[0].processAction('submitSequence'));
            choicesDiv.querySelector('.reset-btn').addEventListener('click', () => minigames[0].processAction('resetInput'));
        },
        showSequence: () => {
            gameState.minigameState.showingSequence = true;
            gameState.minigameState.currentSequence = [];
            const sequenceLength = gameState.minigameState.stage + 2;
            for (let i = 0; i < sequenceLength; i++) {
                gameState.minigameState.currentSequence.push(Math.floor(currentRandFn() * 10));
            }

            const sequenceDisplay = document.getElementById('sequenceDisplay');
            let i = 0;
            const interval = setInterval(() => {
                if (i < gameState.minigameState.currentSequence.length) {
                    sequenceDisplay.innerText = gameState.minigameState.currentSequence[i];
                    i++;
                } else {
                    clearInterval(interval);
                    sequenceDisplay.innerText = "입력하세요!";
                    gameState.minigameState.showingSequence = false;
                }
            }, 800);
        },
        processAction: (actionType, value = null) => {
            if (gameState.minigameState.showingSequence) return;

            if (actionType === 'addInput') {
                gameState.minigameState.playerInput.push(parseInt(value));
                document.getElementById('playerInputDisplay').innerText = gameState.minigameState.playerInput.join(' ');
            } else if (actionType === 'resetInput') {
                gameState.minigameState.playerInput = [];
                document.getElementById('playerInputDisplay').innerText = '';
            } else if (actionType === 'submitSequence') {
                const correct = gameState.minigameState.currentSequence.every((num, i) => num === gameState.minigameState.playerInput[i]);

                if (correct && gameState.minigameState.playerInput.length === gameState.minigameState.currentSequence.length) {
                    gameState.minigameState.score += gameState.minigameState.currentSequence.length * 10;
                    gameState.minigameState.stage++;
                    gameState.minigameState.playerInput = [];
                    updateGameDisplay("정답입니다! 다음 단계로 넘어갑니다.");
                    minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices'));
                    setTimeout(() => minigames[0].showSequence(), 1500);
                } else {
                    updateGameDisplay("오답입니다. 게임 종료.");
                    minigames[0].end();
                }
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({
                strategy: gameState.strategy + rewards.strategy,
                growth: gameState.growth + rewards.growth,
                influence: gameState.influence + rewards.influence,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    { name: "전략적 의사결정", description: "주어진 상황에서 최적의 전략을 선택하세요.", start: (ga, cd) => { ga.innerHTML = "<p>전략적 의사결정 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[1].end()'>종료</button>"; gameState.minigameState = { score: 10 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[1].name, gameState.minigameState.score); updateState({ strategy: gameState.strategy + r.strategy, growth: gameState.growth + r.growth, influence: gameState.influence + r.influence, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "자원 최적화", description: "제한된 자원으로 최대의 성과를 내는 방법을 찾으세요.", start: (ga, cd) => { ga.innerHTML = "<p>자원 최적화 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[2].end()'>종료</button>"; gameState.minigameState = { score: 15 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[2].name, gameState.minigameState.score); updateState({ strategy: gameState.strategy + r.strategy, growth: gameState.growth + r.growth, influence: gameState.influence + r.influence, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "협상 시뮬레이션", description: "상대방을 설득하여 제국에 가장 유리한 협상을 이끌어내세요.", start: (ga, cd) => { ga.innerHTML = "<p>협상 시뮬레이션 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[3].end()'>종료</button>"; gameState.minigameState = { score: 20 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[3].name, gameState.minigameState.score); updateState({ strategy: gameState.strategy + r.strategy, growth: gameState.growth + r.growth, influence: gameState.influence + r.influence, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "위기 관리 챌린지", description: "예상치 못한 위기 상황을 극복하고 피해를 최소화하세요.", start: (ga, cd) => { ga.innerHTML = "<p>위기 관리 챌린지 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[4].end()'>종료</button>"; gameState.minigameState = { score: 25 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[4].name, gameState.minigameState.score); updateState({ strategy: gameState.strategy + r.strategy, growth: gameState.growth + r.growth, influence: gameState.influence + r.influence, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } }
];

// --- Game Actions ---
function spendActionPoint() {
    if (gameState.actionPoints <= 0) {
        updateGameDisplay("행동력이 부족합니다.");
        return false;
    }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    patrol: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.patrolled) { updateState({ dailyActions: { ...gameState.dailyActions, patrolled: true } }, "오늘은 더 이상 순찰할 곳이 없습니다."); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, patrolled: true } };
        let message = "영토를 순찰하니 민심이 안정됩니다.";
        const rand = currentRandFn();
        if (rand < 0.3) { message += " 숨겨진 금광을 발견했습니다. (+2 금)"; changes.gold = gameState.resources.gold + 2; }
        else if (rand < 0.6) { message += " 유능한 인재를 발견했습니다. (+2 인력)"; changes.resources = { ...gameState.resources, manpower: gameState.resources.manpower + 2 }; }
        else { message += " 특별한 것은 발견하지 못했습니다."; }
        
        updateState(changes, message);
    },
    talk_to_subordinates: () => {
        if (!spendActionPoint()) return;
        const subordinate = gameState.subordinates[Math.floor(currentRandFn() * gameState.subordinates.length)];
        if (gameState.dailyActions.talkedTo.includes(subordinate.id)) { updateState({ dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, subordinate.id] } }, `${subordinate.name}${getWaGwaParticle(subordinate.name)} 이미 면담했습니다.`); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, subordinate.id] } };
        let message = `${subordinate.name}${getWaGwaParticle(subordinate.name)} 면담했습니다. `;
        if (subordinate.loyalty > 80) { message += `${subordinate.name}는 당신에게 절대적인 충성을 보이며 제국의 발전을 위한 책략을 진언했습니다. (+5 영향력)`; changes.influence = gameState.influence + 5; }
        else if (subordinate.loyalty < 40) { message += `${subordinate.name}는 당신의 결정에 의문을 품고 있습니다. 그의 충성심이 흔들립니다. (-5 성장)`; changes.growth = gameState.growth - 5; }
        else { message += `그의 보고를 통해 제국의 상황을 파악했습니다. (+2 성장)`; changes.growth = gameState.growth + 2; }
        
        updateState(changes, message);
    },
    hold_meeting: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.meetingHeld) {
            const message = "오늘은 이미 전략 회의를 소집했습니다. 잦은 회의는 참모들을 지치게 합니다. (-5 영향력)";
            gameState.influence -= 5;
            updateState({ influence: gameState.influence }, message);
            return;
        }
        updateState({ dailyActions: { ...gameState.dailyActions, meetingHeld: true } });
        const rand = currentRandFn();
        let message = "전략 회의를 소집했습니다. ";
        if (rand < 0.5) { message += "참모들이 효율적인 전략을 제시하여 제국의 영향력이 증대되었습니다. (+10 영향력, +5 성장)"; updateState({ influence: gameState.influence + 10, growth: gameState.growth + 5 }); }
        else { message += "격렬한 논쟁 끝에 새로운 전략적 합의에 도달했습니다. (+5 전략)"; updateState({ strategy: gameState.strategy + 5 }); }
        updateGameDisplay(message);
    },
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다. 내일 다시 시도해주세요."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            lastPlayedDate: new Date().toISOString().slice(0, 10),
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
    handle_conflict: (params) => {
        if (!spendActionPoint()) return;
        const { first, second } = params;
        let message = "";
        let reward = { strategy: 0, growth: 0, influence: 0 };
        
        const updatedSubordinates = gameState.subordinates.map(s => {
            if (s.id === first) {
                s.loyalty = Math.min(100, s.loyalty + 10);
                message += `${s.name}의 손을 들어주었습니다. 그의 충성도가 상승했습니다. `;
                reward.strategy += 5;
            } else if (s.id === second) {
                s.loyalty = Math.max(0, s.loyalty - 5);
                message += `${second}의 충성도가 약간 하락했습니다. `;
            }
            return s;
        });
        
        updateState({ ...reward, subordinates: updatedSubordinates, currentScenarioId: 'conflict_resolution_result' }, message);
    },
    mediate_conflict: () => {
        if (!spendActionPoint()) return;
        const message = "당신의 카리스마로 둘의 경쟁심을 제국의 발전을 위한 원동력으로 승화시켰습니다! (+10 영향력, +5 성장)";
        updateState({ influence: gameState.influence + 10, growth: gameState.growth + 5, currentScenarioId: 'conflict_resolution_result' }, message);
    },
    ignore_event: () => {
        if (!spendActionPoint()) return;
        const message = "권력 다툼을 방관했습니다. 참모들의 불화가 깊어져 제국의 영향력이 감소합니다. (-10 영향력, -5 전략)";
        const updatedSubordinates = gameState.subordinates.map(s => {
            s.loyalty = Math.max(0, s.loyalty - 5);
            return s;
        });
        updateState({ influence: gameState.influence - 10, strategy: gameState.strategy - 5, subordinates: updatedSubordinates, currentScenarioId: 'conflict_resolution_result' }, message);
    },
    show_resource_collection_options: () => updateState({ currentScenarioId: 'action_resource_collection' }),
    show_facility_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    perform_collect_gold: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.empireLevel * 0.1) + (gameState.dailyBonus.collectionSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "세금 징수에 성공했습니다! (+5 금)";
            changes.resources = { ...gameState.resources, gold: gameState.resources.gold + 5 };
        } else {
            message = "세금 징수에 실패했습니다.";
        }
        updateState(changes, message);
    },
    perform_draft_manpower: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.empireLevel * 0.1) + (gameState.dailyBonus.collectionSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "징병에 성공했습니다! (+5 인력)";
            changes.resources = { ...gameState.resources, manpower: gameState.resources.manpower + 5 };
        } else {
            message = "징병에 실패했습니다.";
        }
        updateState(changes, message);
    },
    perform_gather_materials: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.empireLevel * 0.1) + (gameState.dailyBonus.collectionSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "자재 수집에 성공했습니다! (+5 자재)";
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials + 5 };
        } else {
            message = "자재 수집에 실패했습니다.";
        }
        updateState(changes, message);
    },
    build_treasury: () => {
        if (!spendActionPoint()) return;
        const cost = { gold: 50, materials: 20 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.gold >= cost.gold) {
            gameState.empireBuildings.treasury.built = true;
            message = "국고를 건설했습니다!";
            changes.influence = gameState.influence + 10;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, gold: gameState.resources.gold - cost.gold };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_barracks: () => {
        if (!spendActionPoint()) return;
        const cost = { manpower: 30, materials: 30 };
        let message = "";
        let changes = {};
        if (gameState.resources.manpower >= cost.manpower && gameState.resources.materials >= cost.materials) {
            gameState.empireBuildings.barracks.built = true;
            message = "병영을 건설했습니다!";
            changes.growth = gameState.growth + 10;
            changes.resources = { ...gameState.resources, manpower: gameState.resources.manpower - cost.manpower, materials: gameState.resources.materials - cost.materials };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_palace: () => {
        if (!spendActionPoint()) return;
        const cost = { gold: 100, manpower: 50, materials: 50 };
        let message = "";
        let changes = {};
        if (gameState.resources.manpower >= cost.manpower && gameState.resources.materials >= cost.materials && gameState.resources.gold >= cost.gold) {
            gameState.empireBuildings.palace.built = true;
            message = "궁전을 건설했습니다!";
            changes.influence = gameState.influence + 20;
            changes.growth = gameState.growth + 20;
            changes.resources = { ...gameState.resources, manpower: gameState.resources.manpower - cost.manpower, materials: gameState.resources.materials - cost.materials, gold: gameState.resources.gold - cost.gold };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_academy: () => {
        if (!spendActionPoint()) return;
        const cost = { manpower: 80, materials: 40 };
        let message = "";
        let changes = {};
        if (gameState.resources.manpower >= cost.manpower && gameState.resources.materials >= cost.materials) {
            gameState.empireBuildings.academy.built = true;
            message = "학술원을 건설했습니다!";
            changes.strategy = gameState.strategy + 15;
            changes.influence = gameState.influence + 10;
            changes.resources = { ...gameState.resources, manpower: gameState.resources.manpower - cost.manpower, materials: gameState.resources.materials - cost.materials };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_siege_workshop: () => {
        if (!spendActionPoint()) return;
        const cost = { manpower: 50, materials: 100 };
        let message = "";
        let changes = {};
        if (gameState.resources.manpower >= cost.manpower && gameState.resources.materials >= cost.materials) {
            gameState.empireBuildings.siegeWorkshop.built = true;
            message = "공성 무기 제작소를 건설했습니다!";
            changes.resources = { ...gameState.resources, manpower: gameState.resources.manpower - cost.manpower, materials: gameState.resources.materials - cost.materials };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    maintain_facility: (params) => {
        if (!spendActionPoint()) return;
        const facilityKey = params.facility;
        const cost = { manpower: 10, materials: 10 };
        let message = "";
        let changes = {};
        if (gameState.resources.manpower >= cost.manpower && gameState.resources.materials >= cost.materials) {
            gameState.empireBuildings[facilityKey].durability = 100;
            message = `${facilityKey} 건물의 보수를 완료했습니다. 내구도가 100으로 회복되었습니다.`;
            changes.resources = { ...gameState.resources, manpower: gameState.resources.manpower - cost.manpower, materials: gameState.resources.materials - cost.materials };
        } else {
            message = "보수에 필요한 자원이 부족합니다.";
        }
        updateState(changes, message);
    },
    develop_technology: () => {
        if (!spendActionPoint()) return;
        const cost = 20 * (gameState.empireLevel + 1);
        if (gameState.resources.materials >= cost && gameState.resources.gold >= cost) {
            gameState.empireLevel++;
            updateState({ resources: { ...gameState.resources, materials: gameState.resources.materials - cost, gold: gameState.resources.gold - cost }, empireLevel: gameState.empireLevel });
            updateGameDisplay(`제국 기술 개발에 성공했습니다! 모든 자원 징수 성공률이 10% 증가합니다. (현재 레벨: ${gameState.empireLevel})`);
        } else { updateGameDisplay(`기술 개발에 필요한 자원이 부족합니다. (자재 ${cost}, 금 ${cost} 필요)`); }
        updateState({ currentScenarioId: 'intro' });
    },
    analyze_intelligence: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.3) { updateState({ resources: { ...gameState.resources, manpower: gameState.resources.manpower + 20, materials: gameState.resources.materials + 20 } }); updateGameDisplay("정보 분석 중 새로운 자원 지대를 발견했습니다! (+20 인력, +20 자재)"); }
        else if (rand < 0.5) { updateState({ strategy: gameState.strategy + 10, influence: gameState.influence + 10 }); updateGameDisplay("적국의 약점을 간파했습니다. (+10 전략, +10 영향력)"); }
        else { updateGameDisplay("정보를 분석했지만, 특별한 것은 발견하지 못했습니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    accept_deal: () => {
        if (!spendActionPoint()) return;
        if (gameState.resources.gold >= 50) {
            updateState({ resources: { ...gameState.resources, gold: gameState.resources.gold - 50, ancient_relic: (gameState.resources.ancient_relic || 0) + 1 } });
            updateGameDisplay("거래에 성공하여 고대 유물의 정보를 얻었습니다! 이 정보는 제국의 기술 발전에 큰 도움이 될 것입니다.");
        } else { updateGameDisplay("거래에 필요한 금이 부족합니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    decline_deal: () => {
        if (!spendActionPoint()) return;
        updateGameDisplay("사절단의 제안을 거절했습니다. 그들은 아쉬워하며 떠났습니다.");
        updateState({ currentScenarioId: 'intro' });
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    play_minigame: () => {
        if (gameState.dailyActions.minigamePlayed) { updateGameDisplay("오늘의 미니게임은 이미 플레이했습니다."); return; }
        if (!spendActionPoint()) return;
        
        const minigameIndex = (gameState.day - 1) % minigames.length;
        const minigame = minigames[minigameIndex];
        
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } }); 
        
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    }
};

function applyStatEffects() {
    let message = "";
    if (gameState.strategy >= 70) {
        gameState.dailyBonus.collectionSuccess += 0.1;
        message += "뛰어난 전략 덕분에 자원 징수 성공률이 증가합니다. ";
    }
    if (gameState.strategy < 30) {
        gameState.subordinates.forEach(s => s.loyalty = Math.max(0, s.loyalty - 5));
        message += "잘못된 전략으로 인해 참모들의 충성심이 하락합니다. ";
    }

    if (gameState.growth >= 70) {
        gameState.maxActionPoints += 1;
        gameState.actionPoints = gameState.maxActionPoints;
        message += "제국이 성장하여 활기가 넘쳐 행동력이 증가합니다. ";
    }
    if (gameState.growth < 30) {
        gameState.maxActionPoints = Math.max(5, gameState.maxActionPoints - 1);
        gameState.actionPoints = Math.min(gameState.actionPoints, gameState.maxActionPoints);
        message += "제국이 정체되어 침체기가 찾아와 행동력이 감소합니다. ";
    }

    if (gameState.influence >= 70) {
        Object.keys(gameState.empireBuildings).forEach(key => {
            if (gameState.empireBuildings[key].built) gameState.empireBuildings[key].durability = Math.min(100, gameState.empireBuildings[key].durability + 1);
        });
        message += "강력한 영향력 덕분에 제국 건물의 관리가 더 잘 이루어집니다. ";
    }
    if (gameState.influence < 30) {
        Object.keys(gameState.empireBuildings).forEach(key => {
            if (gameState.empireBuildings[key].built) gameState.empireBuildings[key].durability = Math.max(0, gameState.empireBuildings[key].durability - 2);
        });
        message += "영향력이 약화되어 제국 건물들이 빠르게 노후화됩니다. ";
    }
    return message;
}

function generateRandomSubordinate() {
    const names = ["한니발", "칭기즈칸", "손자", "나폴레옹"];
    const personalities = ["냉철한", "야심있는", "신중한", "과감한"];
    const skills = ["전술", "외교", "내정", "정보"];
    const randomId = Math.random().toString(36).substring(2, 9);

    return {
        id: randomId,
        name: names[Math.floor(currentRandFn() * names.length)],
        personality: personalities[Math.floor(currentRandFn() * personalities.length)],
        skill: skills[Math.floor(currentRandFn() * skills.length)],
        loyalty: 50
    };
}

// --- Daily/Initialization Logic ---
function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);

    updateState({
        actionPoints: 10,
        maxActionPoints: 10,
        dailyActions: { patrolled: false, meetingHeld: false, talkedTo: [], minigamePlayed: false },
        dailyEventTriggered: true,
        dailyBonus: { collectionSuccess: 0 }
    });

    const statEffectMessage = applyStatEffects();

    let skillBonusMessage = "";
    let durabilityMessage = "";

    gameState.subordinates.forEach(s => {
        if (s.skill === '외교') { gameState.resources.gold++; skillBonusMessage += `${s.name}의 외교 활동 덕분에 금을 추가로 얻었습니다. `; }
        else if (s.skill === '내정') { gameState.resources.manpower++; skillBonusMessage += `${s.name}의 내정 관리 덕분에 인력을 추가로 얻었습니다. `; }
        else if (s.skill === '정보') { gameState.resources.materials++; skillBonusMessage += `${s.name}의 정보 활동 덕분에 자재를 추가로 얻었습니다. `; }
    });

    Object.keys(gameState.empireBuildings).forEach(key => {
        const facility = gameState.empireBuildings[key];
        if(facility.built) {
            facility.durability -= 1;
            if(facility.durability <= 0) {
                facility.built = false;
                durabilityMessage += `${key} 건물이 파손되었습니다! 수리가 필요합니다. `; 
            }
        }
    });

    gameState.resources.gold -= gameState.subordinates.length * 2;
    let dailyMessage = "새로운 통치일이 시작되었습니다. ";
    dailyMessage += statEffectMessage + skillBonusMessage + durabilityMessage;
    if (gameState.resources.gold < 0) {
        gameState.growth -= 10;
        dailyMessage += "국고가 비어 제국 성장이 지연됩니다! (-10 성장)";
    }
    
    const rand = currentRandFn();
    let eventId = "intro";
    if (rand < 0.15) { eventId = "daily_event_rebellion"; updateState({resources: {...gameState.resources, manpower: Math.max(0, gameState.resources.manpower - 10)}}); }
    else if (rand < 0.30) { eventId = "daily_event_plague"; updateState({resources: {...gameState.resources, gold: Math.max(0, gameState.resources.gold - 10)}}); }
    else if (rand < 0.5 && gameState.subordinates.length >= 2) { eventId = "daily_event_conflict"; }
    else if (rand < 0.7 && gameState.empireBuildings.palace.built && gameState.subordinates.length < gameState.maxSubordinates) {
        eventId = "daily_event_new_subordinate";
        const newSubordinate = generateRandomSubordinate();
        gameState.pendingNewSubordinate = newSubordinate;
        gameScenarios["daily_event_new_subordinate"].text = `새로운 인재 ${newSubordinate.name}(${newSubordinate.personality}, ${newSubordinate.skill})이(가) 등용을 원합니다. (현재 참모 수: ${gameState.subordinates.length} / ${gameState.maxSubordinates})`;
    }
    else if (rand < 0.85 && gameState.empireBuildings.palace.built) { eventId = "daily_event_envoy_visit"; }
    
    gameState.currentScenarioId = eventId;
    updateGameDisplay(dailyMessage + (gameScenarios[eventId]?.text || ''));
    renderChoices(gameScenarios[eventId].choices);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 제국을 초기화하시겠습니까? 모든 진행 상황이 사라집니다.")) {
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
        document.getElementById('nextDayBtn').addEventListener('click', gameActions.manualNextDay);
    } catch (e) {
        console.error("오늘의 게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};