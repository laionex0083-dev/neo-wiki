import { useState, useEffect, useCallback } from 'react';
import { Shield, Sword, Zap, Eye, RotateCcw, Target, ShieldCheck, Info } from 'lucide-react';

/**
 * Obsidian Protocol Combat Simulator (Widget Version)
 * 통합 가이드:
 * 1. 이 파일을 컴포넌트 폴더에 저장 (예: components/DiceSimulator.jsx)
 * 2. 원하는 페이지에서 <DiceSimulator /> 로 불러와서 사용
 * 3. 부모 요소의 너비에 맞춰 자동으로 크기가 조절됩니다.
 */

// --- 주사위 정의 ---
const DICE_FACES = {
    YELLOW: ['light', 'light', '2light', '2light', 'blank_light', 'zap', 'eye', 'none'],
    RED: ['strong', 'strong', 'strong', 'strong', 'blank_strong', 'blank_light', 'zap', 'eye'],
    WHITE: ['def', 'eva', 'blank_2def', 'blank_2def', 'zap', 'zap', 'eye', 'none'],
    BLUE: ['eva', 'eva', 'eye', 'eye', 'zap', 'none', 'none', 'none'],
};

const DiceSimulator = () => {
    // --- 상태 관리 ---
    const [yellowCount, setYellowCount] = useState(0);
    const [redCount, setRedCount] = useState(0);
    const [whiteCount, setWhiteCount] = useState(0);
    const [blueCount, setBlueCount] = useState(0);

    const [options, setOptions] = useState({
        attackStance: false,
        pulseIon: false,
        avalancheShirak: false,
        hammerhead: false,
        attackReroll: false,
        defenseStance: false,
        kcArmor: false,
        lowVis: false,
        defenseReroll: false,
    });

    const [winProbability, setWinProbability] = useState(0);
    const [isCalculating, setIsCalculating] = useState(false);

    // --- 주사위 판정 로직 ---
    const processDice = useCallback((type, face, isAttack, currentOptions) => {
        let results = { light: 0, strong: 0, def: 0, eva: 0, isScored: false };

        if (isAttack) {
            // 공격 주사위 처리
            switch (face) {
                case 'light': results.light = 1; break;
                case '2light': results.light = 2; break;
                case 'strong': results.strong = 1; break;
                case 'blank_light': if (currentOptions.attackStance) results.light = 1; break;
                case 'blank_strong': if (currentOptions.attackStance) results.strong = 1; break;
                case 'zap': if (currentOptions.pulseIon) results.strong = 1; break;
                case 'eye':
                    if (currentOptions.avalancheShirak) results.strong = 1;
                    else if (currentOptions.hammerhead && currentOptions.attackStance) results.light = 1;
                    break;
                default: break;
            }
            if (results.light > 0 || results.strong > 0) results.isScored = true;
        } else {
            // 방어 주사위 처리
            switch (face) {
                case 'def': results.def = 1; break;
                case 'eva': results.eva = 1; break;
                case 'blank_2def': if (currentOptions.defenseStance) results.def = 2; break;
                case 'zap': if (currentOptions.kcArmor) results.def = 1; break;
                case 'eye': if (currentOptions.lowVis) results.eva = 1; break;
                default: break;
            }
            if (results.def > 0 || results.eva > 0) results.isScored = true;
        }
        return results;
    }, []);

    const runSimulation = useCallback(() => {
        setIsCalculating(true);
        // 성능 최적화: 위젯 형태이므로 20만 번은 유지하되, 필요시 10만 번으로 줄여도 무방함
        const ITERATIONS = 200000;
        let wins = 0;

        for (let i = 0; i < ITERATIONS; i++) {
            let atkLight = 0;
            let atkStrong = 0;
            let defShield = 0;
            let defEva = 0;

            // 1. 공격 주사위 굴리기 (리롤 포함)
            const rollAtk = (type, count) => {
                for (let j = 0; j < count; j++) {
                    let face = DICE_FACES[type][Math.floor(Math.random() * 8)];
                    let res = processDice(type, face, true, options);

                    if (!res.isScored && options.attackReroll) {
                        face = DICE_FACES[type][Math.floor(Math.random() * 8)];
                        res = processDice(type, face, true, options);
                    }
                    atkLight += res.light;
                    atkStrong += res.strong;
                }
            };
            rollAtk('YELLOW', yellowCount);
            rollAtk('RED', redCount);

            // 2. 방어 주사위 굴리기 (리롤 포함)
            const rollDef = (type, count) => {
                for (let j = 0; j < count; j++) {
                    let face = DICE_FACES[type][Math.floor(Math.random() * 8)];
                    let res = processDice(type, face, false, options);

                    if (!res.isScored && options.defenseReroll) {
                        face = DICE_FACES[type][Math.floor(Math.random() * 8)];
                        res = processDice(type, face, false, options);
                    }
                    defShield += res.def;
                    defEva += res.eva;
                }
            };
            rollDef('WHITE', whiteCount);
            rollDef('BLUE', blueCount);

            // 3. 상쇄 로직
            // 강공격은 회피로만 상쇄 가능
            let remainingStrong = Math.max(0, atkStrong - defEva);
            let remainingEva = Math.max(0, defEva - atkStrong);

            // 약공격은 남은 회피와 방어로 모두 상쇄 가능
            let totalDefForLight = remainingEva + defShield;
            let remainingLight = Math.max(0, atkLight - totalDefForLight);

            // 최종 공격 성공 여부
            if (remainingStrong + remainingLight > 0) {
                wins++;
            }
        }

        setWinProbability((wins / ITERATIONS) * 100);
        setIsCalculating(false);
    }, [yellowCount, redCount, whiteCount, blueCount, options, processDice]);

    useEffect(() => {
        const timer = setTimeout(runSimulation, 200);
        return () => clearTimeout(timer);
    }, [runSimulation]);

    const toggleOption = (key) => setOptions(prev => ({ ...prev, [key]: !prev[key] }));

    // --- UI 컴포넌트 ---
    const ControlGroup = ({ title, count, setCount, color, max = 12 }) => (
        <div className="dice-control-group">
            <span className="dice-control-label">
                <div className="dice-color-dot" style={{ background: color }} />
                {title}
            </span>
            <div className="dice-control-buttons">
                <button
                    onClick={() => setCount(Math.max(0, count - 1))}
                    className="dice-btn"
                >-</button>
                <span className="dice-count">{count}</span>
                <button
                    onClick={() => setCount(Math.min(max, count + 1))}
                    className="dice-btn"
                >+</button>
            </div>
        </div>
    );

    const CheckOption = ({ label, icon: Icon, active, onClick, colorClass }) => (
        <button
            onClick={onClick}
            className={`dice-option-btn ${active ? `active ${colorClass}` : ''}`}
        >
            <Icon size={14} strokeWidth={2.5} />
            {label}
        </button>
    );

    return (
        <div className="dice-simulator">
            {/* 반응형 레이아웃: 모바일(세로), 데스크탑(가로) */}
            <div className="dice-layout">

                {/* 왼쪽 패널: 결과 표시 */}
                <div className="dice-result-panel">
                    <div className="dice-result-header">Simulation Result</div>

                    <div className="dice-result-display">
                        <div className={`dice-result-value ${isCalculating ? 'calculating' : ''}`}>
                            {winProbability.toFixed(1)}
                            <span className="dice-result-percent">%</span>
                        </div>
                        <div className="dice-result-label">
                            Penetration<br />Probability
                        </div>
                    </div>

                    <div className="dice-reroll-status">
                        {options.attackReroll && <span className="atk-reroll">● ATK Reroll Active</span>}
                        {options.defenseReroll && <span className="def-reroll">● DEF Reroll Active</span>}
                    </div>
                </div>

                {/* 오른쪽 패널: 조작부 */}
                <div className="dice-control-panel">

                    {/* Header */}
                    <div className="dice-header">
                        <h1 className="dice-title">Obsidian Protocol</h1>
                        <span className="dice-version">v1.0 Simulator</span>
                    </div>

                    {/* 공격 섹션 */}
                    <section className="dice-section">
                        <div className="dice-section-header attack">
                            <Sword size={14} strokeWidth={3} /> Attack Unit
                        </div>
                        <div className="dice-controls-grid">
                            <ControlGroup title="Light" count={yellowCount} setCount={setYellowCount} color="#facc15" />
                            <ControlGroup title="Strong" count={redCount} setCount={setRedCount} color="#ef4444" />
                        </div>

                        <div className="dice-options">
                            <CheckOption label="공격 스탠스" icon={Target} active={options.attackStance} onClick={() => toggleOption('attackStance')} colorClass="red" />
                            <CheckOption label="리롤" icon={RotateCcw} active={options.attackReroll} onClick={() => toggleOption('attackReroll')} colorClass="red" />
                            <CheckOption label="펄스/이온" icon={Zap} active={options.pulseIon} onClick={() => toggleOption('pulseIon')} colorClass="orange" />
                            <CheckOption label="시락/아발란체" icon={Eye} active={options.avalancheShirak} onClick={() => toggleOption('avalancheShirak')} colorClass="orange" />
                            <CheckOption label="해머헤드" icon={Sword} active={options.hammerhead} onClick={() => toggleOption('hammerhead')} colorClass="orange" />
                        </div>
                    </section>

                    <div className="dice-divider" />

                    {/* 방어 섹션 */}
                    <section className="dice-section">
                        <div className="dice-section-header defense">
                            <Shield size={14} strokeWidth={3} /> Defense Unit
                        </div>
                        <div className="dice-controls-grid">
                            <ControlGroup title="Defense" count={whiteCount} setCount={setWhiteCount} color="#f3f4f6" />
                            <ControlGroup title="Evasion" count={blueCount} setCount={setBlueCount} color="#3b82f6" />
                        </div>

                        <div className="dice-options">
                            <CheckOption label="방어 스탠스" icon={ShieldCheck} active={options.defenseStance} onClick={() => toggleOption('defenseStance')} colorClass="blue" />
                            <CheckOption label="리롤" icon={RotateCcw} active={options.defenseReroll} onClick={() => toggleOption('defenseReroll')} colorClass="blue" />
                            <CheckOption label="KC 아머" icon={Zap} active={options.kcArmor} onClick={() => toggleOption('kcArmor')} colorClass="cyan" />
                            <CheckOption label="저피탐" icon={Eye} active={options.lowVis} onClick={() => toggleOption('lowVis')} colorClass="cyan" />
                        </div>
                    </section>

                </div>
            </div>

            {/* 푸터 / 도움말 */}
            <div className="dice-footer">
                <Info size={16} className="dice-footer-icon" />
                <p className="dice-footer-text">
                    <strong>규칙 요약:</strong> 강공격은 회피로만, 약공격은 방어/회피로 상쇄됩니다. 리롤은 득점 실패 주사위만 1회 다시 굴립니다. (200,000회 시뮬레이션 기반)
                </p>
            </div>
        </div>
    );
};

export default DiceSimulator;
