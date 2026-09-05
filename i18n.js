// UI copy lives here so application logic stays independent from language.
const translations = {
  en: {
    app: {
      title: "Puyo Chain Simulator",
      description: "A touch-friendly Puyo Puyo chain simulator",
      controls: "Controls",
      board: "Puyo Puyo board",
      language: "Language",
      english: "English",
      japanese: "Japanese",
      chains: "chains",
      points: "points",
      next: "Next",
      nextNext: "Next Next",
      reset: "Reset",
      openTokopuyo: "Open Tokopuyo mode",
      returnDrawing: "Return to Drawing mode",
      help: "How to use",
      closeHelp: "Close help",
      undo: "Undo",
      redo: "Redo",
      simulate: "Simulate chains",
      suggest: "Suggest chain extensions",
      suggestTokopuyo: "Suggest a resilient long-chain construction move",
      attackSuggest: "Suggest strongest visible attack",
      reviewLastMove: "Review last move",
      stepModeOn: "Enable Tokopuyo chain step mode",
      stepModeOff: "Disable Tokopuyo chain step mode",
      palette: "Change four-color palette",
      paletteFive: "Five-color palette",
      garbage: "Garbage puyo mode",
      pairControls: "Tokopuyo pair controls",
      movePair: "Move pair",
      rotateDrop: "Rotate or drop pair",
      moveLeft: "Move pair left",
      moveRight: "Move pair right",
      rotateLeft: "Rotate pair counterclockwise",
      rotateRight: "Rotate pair clockwise",
      drop: "Drop pair",
      stepControls: "Tokopuyo chain step controls",
      previousStep: "Previous chain step",
      nextStep: "Next chain step",
      playSteps: "Play chain steps automatically",
      stopSteps: "Stop automatic chain playback",
      calculating: "Calculating suggestions",
      flickMenu: "Flick to select an option",
      drawingHelpIntro: "Hold a cell, then flick toward an option to place it.",
      drawingGestureHelp: "Flick toward a colored circle to place that color. Flick toward the gray circle to place garbage. Release without flicking to delete the cell.",
      drawingControlsTitle: "Drawing mode controls",
      tokopuyoHelpIntro: "Use the buttons below to operate Tokopuyo.",
      tokopuyoSidebarTitle: "Sidebar controls",
      tokopuyoTsumoTitle: "Tsumo controls",
      tokopuyoStepsTitle: "Chain step controls",
      shortcuts: { undo: " (Shortcut: U)", redo: " (Shortcut: R)", simulate: " (Shortcut: Space)", suggest: " (Shortcut: S)", palette: " (Shortcuts: 1–6)", garbage: " (Shortcut: O)", reset: " (Shortcut: Delete)", attack: " (Shortcut: A)", review: " (Shortcut: I)", stepMode: " (Shortcut: P)", left: " (Shortcut: Left Arrow)", right: " (Shortcut: Right Arrow)", drop: " (Shortcut: Down Arrow)", rotateLeft: " (Shortcut: Z)", rotateRight: " (Shortcut: X)", previous: " (Shortcut: Left Arrow)", next: " (Shortcut: Right Arrow)", play: " (Shortcut: Space)", stop: " (Shortcut: Space)" },
      controlHelp: {
        drawing: { reset: "Clear the board and reset the score.", mode: "Switch to Tokopuyo practice mode.", help: "Open this help.", chain: "Show the current score and chain count.", undo: "Undo the latest board change.", redo: "Restore an undone board change.", simulate: "Run the current board's chain reaction.", suggest: "Show dotted puyos for a chain extension.", palette: "Cycle the available four- and five-color palettes.", garbage: "Add garbage puyos to the flick menu." },
        tokopuyo: { reset: "Start a new random pattern.", mode: "Return to Drawing mode.", help: "Open this help.", undo: "Undo one complete placed pair.", redo: "Restore one undone placed pair.", suggest: "Suggest a resilient long-chain construction move.", attack: "Find the highest-scoring safe attack in the visible pairs.", review: "Compare the last placed pair with Pressureless Ama's analysis.", stepMode: "Enable or disable chain step mode." },
        tsumo: { left: "Move the active pair left.", right: "Move the active pair right.", rotateLeft: "Rotate the active pair counterclockwise.", drop: "Hard-drop the active pair.", rotateRight: "Rotate the active pair clockwise." },
        steps: { previous: "Show the previous completed chain round.", next: "Advance to the next chain round.", play: "Play the remaining chain rounds automatically.", stop: "Pause automatic chain playback." },
      },
    },
    message: {
      noChain: "No group of four or more can be cleared",
      undo: "Undo applied", redo: "Redo applied", cleared: "Board cleared", reset: "Board reset",
      garbageMode: (enabled) => `Garbage mode ${enabled ? "on" : "off"}`,
      palette: (index, total) => index === total ? "Five-color palette" : `Four-color palette ${index + 1} of ${total}`,
      chain: (count, puyos, score, cumulative) => `Chain ${count}: +${formatNumber(score)} points (${formatNumber(cumulative)} total), ${puyos} puyos clearing`,
      complete: (count, puyos) => `${count} chain${count === 1 ? "" : "s"}! ${puyos} puyos cleared`,
      scoreSummary: (score, chains) => `${formatNumber(score)} points / ${chains} chain${chains === 1 ? "" : "s"}`,
      suggestionSearching: "Finding chain extensions…", suggestionNone: "No chain extension found", suggestionError: "Could not calculate suggestions",
      suggestion: (index, total, chains, additions, gain) => `Suggestion ${index}/${total}: potential ${chains} chain${chains === 1 ? "" : "s"} (+${gain}) with ${additions} added puyo${additions === 1 ? "" : "s"}`,
      pressurelessAmaSuggestion: (index, total, score, branches, elapsed) => `Pressureless Ama ${index}/${total}: ${formatNumber(score)}-point average across ${branches} sampled futures (${formatNumber(elapsed)} ms)`,
      suggestionAlreadyFiring: "Suggestions are unavailable because the board can already fire", suggestionFloating: "Land all puyos before calculating suggestions",
      tokopuyoReset: (number) => `Started new pattern No.${number}`, tokopuyoGameOver: "Game over — reset or undo to continue",
      tokopuyoSuggestionSearching: "Searching for a resilient long-chain build…", tokopuyoSuggestionNone: "No safe construction move was found",
      tokopuyoSuggestion: (index, total, potential, efficiency, ignition, emergency) => `${emergency ? "Emergency clear · " : ""}Plan ${index}/${total}: ${potential ? `${potential}-chain main potential` : "building a main-chain base"} · ${efficiency}% resource connection · ${ignition}`,
      tokopuyoAttackSearching: "Finding the strongest visible attacks…", tokopuyoAttackNone: "No safe attack was found within the visible pairs",
      tokopuyoAttack: (index, total, score, chains, timing) => `Attack ${index}/${total}: ${formatNumber(score)} points · ${chains} chain${chains === 1 ? "" : "s"} · fires on ${timing}`,
      flickChoose: "Flick to choose an option, then release to place it", optionSelected: "Option selected. Tap a board cell to place it", deleteWithoutFlicking: "Delete without flicking", erased: "Erased puyo", placed: (color) => `Placed ${color} puyo`,
      activePuyo: (role, color) => `${role} ${color} puyo`,
      cell: (hidden, row, column, color, choke) => `${hidden ? "Hidden area " : ""}${row} row ${column} column ${color}${choke ? " choke point" : ""}`,
    },
    color: { red: "red", green: "green", blue: "blue", yellow: "yellow", purple: "purple", garbage: "garbage", empty: "empty", axis: "Axis", child: "Child" },
  },
  ja: {
    app: {
      title: "ぷよ連鎖シミュレーター", description: "タッチ操作に対応したぷよぷよ連鎖シミュレーター", controls: "操作", board: "ぷよぷよ盤面", language: "言語", english: "English", japanese: "日本語", chains: "連鎖", points: "点", next: "NEXT", nextNext: "NEXT NEXT",
      reset: "リセット", openTokopuyo: "とこぷよモードを開く", returnDrawing: "描画モードに戻る", help: "使い方", closeHelp: "ヘルプを閉じる", undo: "元に戻す", redo: "やり直す", simulate: "連鎖をシミュレート", suggest: "連鎖の伸ばし方を提案", suggestTokopuyo: "長連鎖の構築手を提案", attackSuggest: "最大攻撃を提案", reviewLastMove: "直前の手をレビュー", stepModeOn: "とこぷよ連鎖ステップモードを有効化", stepModeOff: "とこぷよ連鎖ステップモードを無効化", palette: "4色パレットを変更", paletteFive: "5色パレット", garbage: "おじゃまぷよモード", pairControls: "とこぷよ操作", movePair: "組ぷよを移動", rotateDrop: "回転または落下", moveLeft: "組ぷよを左へ移動", moveRight: "組ぷよを右へ移動", rotateLeft: "組ぷよを左回転", rotateRight: "組ぷよを右回転", drop: "組ぷよを落とす", stepControls: "連鎖ステップ操作", previousStep: "前の連鎖ステップ", nextStep: "次の連鎖ステップ", playSteps: "連鎖ステップを自動再生", stopSteps: "連鎖ステップの自動再生を停止", calculating: "提案を計算中", flickMenu: "フリックして選択",
      drawingHelpIntro: "マスを長押しして、置きたい方向へフリックします。", drawingGestureHelp: "色付きの丸へフリックするとその色を置き、灰色の丸へフリックするとおじゃまぷよを置きます。フリックせずに離すとマスを削除します。", drawingControlsTitle: "描画モードのボタン", tokopuyoHelpIntro: "とこぷよの操作は、以下のボタンで行います。", tokopuyoSidebarTitle: "サイドバーのボタン", tokopuyoTsumoTitle: "ツモ操作のボタン", tokopuyoStepsTitle: "連鎖ステップのボタン",
      shortcuts: { undo: "（ショートカット: U）", redo: "（ショートカット: R）", simulate: "（ショートカット: Space）", suggest: "（ショートカット: S）", palette: "（ショートカット: 1〜6）", garbage: "（ショートカット: O）", reset: "（ショートカット: Delete）", attack: "（ショートカット: A）", review: "（ショートカット: I）", stepMode: "（ショートカット: P）", left: "（ショートカット: ←）", right: "（ショートカット: →）", drop: "（ショートカット: ↓）", rotateLeft: "（ショートカット: Z）", rotateRight: "（ショートカット: X）", previous: "（ショートカット: ←）", next: "（ショートカット: →）", play: "（ショートカット: Space）", stop: "（ショートカット: Space）" },
      controlHelp: {
        drawing: { reset: "盤面を空にして、得点をリセットします。", mode: "とこぷよの練習モードに切り替えます。", help: "この操作説明を開きます。", chain: "現在の得点と連鎖数を表示します。", undo: "直前の盤面変更を元に戻します。", redo: "元に戻した盤面変更をやり直します。", simulate: "現在の盤面で連鎖を実行します。", suggest: "連鎖を伸ばすための点線ぷよを表示します。", palette: "使用できる4色・5色パレットを切り替えます。", garbage: "フリックメニューにおじゃまぷよを追加します。" },
        tokopuyo: { reset: "新しいランダムパターンで最初から始めます。", mode: "描画モードに戻ります。", help: "この操作説明を開きます。", undo: "配置済みの組ぷよ1手分を元に戻します。", redo: "元に戻した組ぷよ1手分をやり直します。", suggest: "長連鎖を構築するための手を提案します。", attack: "見えているツモ内で最大得点の安全な攻撃を探します。", review: "直前の配置をPressureless Amaの分析と比較します。", stepMode: "連鎖ステップモードをオン・オフします。" },
        tsumo: { left: "組ぷよを左へ移動します。", right: "組ぷよを右へ移動します。", rotateLeft: "組ぷよを左回転します。", drop: "組ぷよを一気に落とします。", rotateRight: "組ぷよを右回転します。" },
        steps: { previous: "1つ前の連鎖段を表示します。", next: "次の連鎖段へ進みます。", play: "残りの連鎖段を自動再生します。", stop: "連鎖の自動再生を一時停止します。" },
      },
    },
    message: {
      erased: "ぷよを削除しました",
      placed: (color) => `${color}ぷよを置きました`,
      noChain: "4個以上つながったぷよがありません", undo: "元に戻しました", redo: "やり直しました", cleared: "盤面をクリアしました", reset: "盤面をリセットしました", garbageMode: (enabled) => `おじゃまありを${enabled ? "オン" : "オフ"}にしました`, palette: (index, total) => index === total ? "5色パレット" : `4色パレット ${index + 1}/${total}`, chain: (count, puyos, score, cumulative) => `${count}連鎖目：${puyos}個消去、+${formatNumber(score)}点（累積${formatNumber(cumulative)}点）`, complete: (count, puyos) => `${count}連鎖！ ${puyos}個のぷよが消えました`, scoreSummary: (score, chains) => `${formatNumber(score)}点 / ${chains}連鎖`, suggestionSearching: "連鎖の伸ばし方を探索中…", suggestionNone: "連鎖を伸ばす候補が見つかりませんでした", suggestionError: "提案を計算できませんでした", suggestion: (index, total, chains, additions, gain) => `提案 ${index}/${total}：${additions}個追加で${chains}連鎖候補（+${gain}連鎖）`, pressurelessAmaSuggestion: (index, total, score, branches, elapsed) => `Pressureless Ama ${index}/${total}：${branches}未来列の平均 ${formatNumber(score)}点（${formatNumber(elapsed)}ms）`, suggestionAlreadyFiring: "すでに発火可能な盤面のため、提案を計算できません", suggestionFloating: "すべてのぷよを着地させてから提案を計算してください", tokopuyoReset: (number) => `新しいパターン No.${number} を開始しました`, tokopuyoGameOver: "ゲームオーバー：リセットまたはUndoで続けられます", tokopuyoSuggestionSearching: "長連鎖へ育つ積み方を探索中…", tokopuyoSuggestionNone: "安全な構築手が見つかりませんでした", tokopuyoSuggestion: (index, total, potential, efficiency, ignition, emergency) => `${emergency ? "緊急消去 · " : ""}構築案 ${index}/${total}：${potential ? `本線候補${potential}連鎖` : "本線土台を構築中"} · 連結効率${efficiency}% · ${ignition}`, tokopuyoAttackSearching: "見えているツモから最大攻撃を探索中…", tokopuyoAttackNone: "見えているツモ内に安全な発火手順がありません", tokopuyoAttack: (index, total, score, chains, timing) => `攻撃候補 ${index}/${total}：${formatNumber(score)}点・${chains}連鎖・${timing}で発火`, flickChoose: "フリックして選択し、離して配置します", optionSelected: "選択しました。盤面のマスをタップして配置できます", deleteWithoutFlicking: "フリックせずに削除", activePuyo: (role, color) => `${role}の${color}ぷよ`, cell: (hidden, row, column, color, choke) => `${hidden ? "隠し領域、" : ""}${row}段目、${column}列目、${color}${choke ? "、ちぎり判定位置" : ""}`,
    },
    color: { red: "赤", green: "緑", blue: "青", yellow: "黄", purple: "紫", garbage: "おじゃま", empty: "空", axis: "軸", child: "子" },
  },
};

const reviewTranslations = {
  en: {
    ama: "Ama",
    axisColumn: (col) => `Col. ${col}`,
    placementSeparator: " · ",
    explainRanking: "Rank and score both use the average across all six tested futures.",
    explainFuture: "Potential is the average maximum score Ama found. Stability is the variation across six fixed test continuations; lower variation is more consistent.",
    explainEvaluation: "These weighted features decide which fields remain in Ama's beam search. They do not directly decide the final move ranking.",
    title: "Last move review", unavailable: "Review unavailable", you: "You", yourMove: "Your move", amaChoice: "Ama's choice", rank: "Rank", candidateMove: "Candidate move", score: "Score", preview: "Preview", candidatePreview: "Candidate preview", ranking: "Ranking", future: "Future potential and stability", sixFutures: "Six tested futures", replay: "Best future replay", evaluation: "How Ama reads these fields", allFeatures: "All feature values", start: "↺ Start", next: "Next ›", play: "▶ Play", pause: "❚❚ Pause", close: "Close review", closePreview: "Close candidate preview", closeReplay: "Close replay", placement: (col, direction) => `Column ${col}, child ${direction}`, directions: ["up", "right", "down", "left"], summary: { "top-choice": "Ama's first choice matches your move.", "tied-choice": "Your move tied Ama's first choice.", "different-choice": "Ama preferred a different placement.", "game-over": "Ama excluded your move because it ended at the choke point.", "no-surviving-choice": "Ama found no placement that survived this position.", unavailable: "Ama could not match this move to a scored placement." }, withinTen: "The aggregate scores are within 10%.", yourRank: "YOUR RANK", yourScore: "YOUR SCORE", foundRange: "YOUR FOUND RANGE", amaRange: "AMA FOUND RANGE", resolvedEvidence: "Resolved field · evidence", replayComplete: "Replay complete", replayPair: (axis, child) => `${axis} and ${child} replay pair`, replayResult: (chains, score) => `${chains}-chain · ${formatNumber(score)} points`, replayHand: (current, total) => `Hand ${current} of ${total}`, replayPlaced: (hand) => `Hand ${hand} · placed`, replayChain: (hand, chains) => `Hand ${hand} · ${chains}-chain`, yourSource: "YOUR MOVE", amaSource: "AMA'S CHOICE", tracing: "Tracing Ama's best future…", wait: "Please wait", replayUnavailable: "Replay unavailable", replayInvalid: "Ama's traced path did not pass validation.", bestOf: "Best of 6 futures", bestIn: (count) => `Best in ${count} of 6 futures`, potentialUnavailable: "Future potential is unavailable for the excluded move.", potentialTied: "Potential tied", potentialYou: "You: higher potential", potentialAma: "Ama: higher potential", stabilitySimilar: "similar consistency", stabilityYou: "you: steadier", stabilityAma: "Ama: steadier", stabilityUnavailable: "consistency unavailable", potential: "Potential", variation: "Variation", immediatePriority: "Immediate priority", excluded: "One field was excluded.", feature: "Feature", evidence: "Show on boards", largestGaps: "Largest evaluation gaps", probeTitle: "Best trigger probe", probeNone: "no multi-chain trigger within three added puyos", probe: (chains, required, color, col) => `${chains}-chain with ${required} added ${color} puyo${required === 1 ? "" : "s"} in column ${col}`, probeComparison: (user, ama) => `You: ${user}. Ama: ${ama}.`,
    signal: { potentialChain: ["Probe chain", "Chain steps found by Ama's best trigger probe."], triggerHeight: ["Trigger height", "Height of the selected hypothetical trigger column."], requiredPuyos: ["Puyos to trigger", "Same-color puyos added by the selected probe; fewer is rewarded."], extensionSpace: ["Extension space", "Horizontal room Ama detects around the selected trigger."], quietLink2: ["Probe residue pairs", "Two-connection markers left after the hypothetical trigger."], quietLink3: ["Probe residue triples", "Three-connection markers left after the hypothetical trigger."], formMatch: ["Form match", "Best relative-color match among Ama's GTR, FRON, and SGTR templates."], shapeDeviation: ["Shape deviation", "Distance from Ama's preferred relative column-height profile; lower is rewarded."], wells: ["Well depth", "Total depth of columns below their neighbors; lower is rewarded."], bumps: ["Bump height", "Total height of interior columns above both neighbors; lower is rewarded."], boardLink2: ["Board pairs", "Cells classified by Ama as two-connection markers."], boardLink3: ["Board triples", "Cells classified by Ama as three-connection markers."], row14Blockage: ["Row 14 blockage", "Special-row occupancy that reduces reachable horizontal space."], sideBias: ["Side bias", "Left/right height relative to the center; its current weight is zero."], garbageCount: ["Garbage", "Garbage puyos on the evaluated field."], pairSplit: ["Pair split", "Whether a horizontal Current pair separated across unequal heights."], immediateClear: ["Immediate clear", "Chain steps fired by Current; Ama applies an action cost."] },
  },
  ja: {
    ama: "Ama",
    axisColumn: (col) => `${col}列目`,
    placementSeparator: "、",
    explainRanking: "順位は6通りのテスト未来における合計スコアで決まります。最大得点は、そのうち1つの未来で見つかった最高得点です。",
    explainFuture: "将来性はAmaが見つけた最大得点の平均です。安定性は6通りの固定テスト未来におけるばらつきで、小さいほど一貫しています。",
    explainEvaluation: "これらの重み付き特徴量は、Amaのビーム探索に残す盤面を決めます。最終的な手の順位を直接決めるものではありません。",
    title: "直前の手をレビュー", unavailable: "レビューを表示できません", you: "あなた", yourMove: "あなたの手", amaChoice: "Amaの選択", rank: "順位", candidateMove: "候補手", maxScore: "最大得点", preview: "プレビュー", candidatePreview: "候補手のプレビュー", ranking: "順位", future: "将来性と安定性", sixFutures: "6通りのテスト未来", replay: "最良未来の再生", evaluation: "Amaによる盤面評価", allFeatures: "全特徴量", start: "↺ 最初から", next: "次へ ›", play: "▶ 再生", pause: "❚❚ 一時停止", close: "レビューを閉じる", closePreview: "候補手のプレビューを閉じる", closeReplay: "再生を閉じる", placement: (col, direction) => `${col}列目・子ぷよは${direction}`, directions: ["上", "右", "下", "左"], summary: { "top-choice": "Amaの最善手はあなたの手と一致しています。", "tied-choice": "あなたの手はAmaの最善手と同順位です。", "different-choice": "Amaは別の置き方を優先しました。", "game-over": "Amaはちぎり判定位置で終了する手として除外しました。", "no-surviving-choice": "Amaはこの局面で生き残る置き方を見つけられませんでした。", unavailable: "Amaはこの手に対応する評価済み候補を見つけられませんでした。" }, withinTen: "合計スコアの差は10%以内です。", yourRank: "あなたの順位", yourMaxScore: "あなたの最大得点", foundRange: "あなたの発見スコア範囲", amaRange: "Amaの発見スコア範囲", resolvedEvidence: "解決後の盤面・評価根拠", replayComplete: "再生完了", replayPair: (axis, child) => `${axis}・${child}の再生組ぷよ`, replayResult: (chains, score) => `${chains}連鎖・${formatNumber(score)}点`, replayHand: (current, total) => `${current}/${total}手目`, replayPlaced: (hand) => `${hand}手目・配置済み`, replayChain: (hand, chains) => `${hand}手目・${chains}連鎖`, yourSource: "あなたの手", amaSource: "AMAの選択", tracing: "Amaの最良未来を追跡中…", wait: "お待ちください", replayUnavailable: "再生を利用できません", replayInvalid: "Amaの追跡経路は検証を通過しませんでした。", bestOf: "6通りの未来で最良", bestIn: (count) => `6通り中${count}通りで最良`, potentialUnavailable: "除外された手では将来性を比較できません。", potentialTied: "将来性は同等", potentialYou: "あなた：将来性が高い", potentialAma: "Ama：将来性が高い", stabilitySimilar: "安定性はほぼ同等", stabilityYou: "あなた：より安定", stabilityAma: "Ama：より安定", stabilityUnavailable: "安定性は算出不可", potential: "将来性", variation: "ばらつき", immediatePriority: "即時評価", excluded: "一方の盤面は除外されました。", feature: "特徴量", evidence: "盤面で見る", largestGaps: "評価差が大きい項目", probeTitle: "最良の発火プローブ", probeNone: "3個以内の追加では複数連鎖の発火が見つかりません", probe: (chains, required, color, col) => `${col}列目に${color}ぷよを${required}個追加する${chains}連鎖`, probeComparison: (user, ama) => `あなた：${user}。Ama：${ama}。`,
    signal: { potentialChain: ["プローブ連鎖", "Amaの最良発火プローブで見つかった連鎖段数。"], triggerHeight: ["発火高さ", "選択した仮想発火列の高さ。"], requiredPuyos: ["発火に必要なぷよ", "選択したプローブで追加する同色ぷよの数。少ないほど評価されます。"], extensionSpace: ["拡張余地", "選択した発火点の周辺でAmaが検出した横方向の余地。"], quietLink2: ["プローブ後の2連結", "仮想発火後に残る2連結の目印。"], quietLink3: ["プローブ後の3連結", "仮想発火後に残る3連結の目印。"], formMatch: ["形の一致度", "AmaのGTR・FRON・SGTRテンプレートへの相対色一致度。"], shapeDeviation: ["形のずれ", "Amaが好む相対列高プロファイルとの差。小さいほど評価されます。"], wells: ["谷の深さ", "隣より低い列の合計深さ。小さいほど評価されます。"], bumps: ["山の高さ", "両隣より高い内側列の合計高さ。小さいほど評価されます。"], boardLink2: ["盤面の2連結", "Amaが2連結の目印として分類したマス。"], boardLink3: ["盤面の3連結", "Amaが3連結の目印として分類したマス。"], row14Blockage: ["14段目の占有", "横方向の到達可能な空間を減らす特殊段の占有。"], sideBias: ["左右の偏り", "中央に対する左右の高さ。現在の重みは0です。"], garbageCount: ["おじゃまぷよ", "評価対象の盤面にあるおじゃまぷよ。"], pairSplit: ["組ぷよの分離", "横向きのCurrentが高さの違いで分かれたか。"], immediateClear: ["即時消去", "Currentで発火した連鎖段数。Amaは手数コストを加えます。"] },
  },
};

Object.assign(reviewTranslations.ja, {
  explainRanking: "順位と得点は、どちらも6通りの未来テストにおける平均値です。",
  explainFuture: "将来性はAmaが見つけた最大得点の平均です。安定性は6通りの固定未来テストにおけるばらつきで、小さいほど一貫しています。",
  sixFutures: "6通りの未来テスト",
  score: "得点",
  yourScore: "あなたの得点",
});

let locale = navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";

function resolve(key) {
  const source = key.startsWith("review.") ? reviewTranslations[locale] : translations[locale];
  const parts = key.startsWith("review.") ? key.slice(7).split(".") : key.split(".");
  return parts.reduce((value, part) => value?.[part], source);
}

export function t(key, ...args) {
  const value = resolve(key);
  return typeof value === "function" ? value(...args) : value ?? key;
}

export function formatNumber(value) {
  return Number(value).toLocaleString(locale === "ja" ? "ja-JP" : "en-US");
}

export function getLocale() { return locale; }
export function setLocale(nextLocale) {
  locale = nextLocale === "ja" ? "ja" : "en";
  document.documentElement.lang = locale;
  document.title = t("app.title");
}

export function localizeDocument() {
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => { element.ariaLabel = t(element.dataset.i18nAriaLabel); });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => { element.title = t(element.dataset.i18nTitle); });
  const labels = {
    "#reset": "app.reset", "#help": "app.help", "#undo": "app.undo", "#redo": "app.redo",
    "#simulate": "app.simulate", "#suggest": "app.suggest", "#attackSuggest": "app.attackSuggest",
    "#reviewLastMove": "app.reviewLastMove", "#cyclePalette": "app.palette", "#toggleGarbage": "app.garbage",
    "#movePairLeft": "app.moveLeft", "#movePairRight": "app.moveRight", "#rotatePairLeft": "app.rotateLeft",
    "#rotatePairRight": "app.rotateRight", "#dropPair": "app.drop", "#stepChainBack": "app.previousStep",
    "#stepChainForward": "app.nextStep", "#playChainSteps": "app.playSteps", "#stopChainSteps": "app.stopSteps",
    "#closeHelp": "app.closeHelp", ".left-sidebar": "app.controls", ".toolbar": "app.controls",
    ".board-card": "app.board", "#tokopuyoControls": "app.pairControls", "#tokopuyoStepControls": "app.stepControls",
    ".pair-movement-controls": "app.movePair", ".pair-action-controls": "app.rotateDrop", "#suggestionLoading": "app.calculating",
    "#flickMenu": "app.flickMenu",
  };
  Object.entries(labels).forEach(([selector, key]) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.ariaLabel = t(key);
      if (element.matches("button")) element.title = t(key);
    });
  });
  document.querySelector("#chainBadge small").textContent = t("app.chains");
  document.querySelector("#helpTitle").textContent = t("app.help");
  document.querySelector(".language-picker span").textContent = t("app.language");
  document.querySelector("#tokopuyoChainPointsLabel").textContent = t("app.points");
  document.querySelector("#tokopuyoChainChainsLabel").textContent = t("app.chains");
  document.querySelector("#tokopuyoPreview small").textContent = t("app.next");
  document.querySelector(".next-next small").textContent = t("app.nextNext");
  document.querySelectorAll("[data-help-text]").forEach((element) => {
    element.textContent = t(`app.controlHelp.${element.dataset.helpText}`);
  });
  document.querySelectorAll("[data-help-shortcut]").forEach((element) => {
    element.textContent = t(`app.shortcuts.${element.dataset.helpShortcut}`);
  });
  const reviewText = {
    "#reviewTitle": "review.title",
    ".review-comparison section:nth-child(1) h3": "review.yourMove",
    ".review-comparison section:nth-child(2) h3": "review.amaChoice",
    "#reviewRankingSection h3": "review.ranking",
    ".review-ranking-chart figcaption": "review.score",
    ".review-ranking-table th:nth-child(1)": "review.rank",
    ".review-ranking-table th:nth-child(2)": "review.candidateMove",
    ".review-ranking-table th:nth-child(3)": "review.score",
    "#reviewRankingPreview h3": "review.candidatePreview",
    "#reviewBranchSection h3": "review.future",
    ".review-future-details > summary": "review.sixFutures",
    "#reviewReplayPanel h3": "review.replay",
    "#resetReviewReplay": "review.start",
    "#nextReviewReplay": "review.next",
    "#playReviewReplay": "review.play",
    "#reviewEvaluationSection h3": "review.evaluation",
    ".review-signal-details > summary": "review.allFeatures",
    "#reviewUserReplay": "review.replay",
    "#reviewAmaReplay": "review.replay",
  };
  Object.entries(reviewText).forEach(([selector, key]) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = t(key);
  });
  const reviewDescriptions = {
    "#reviewRankingSection .review-help p": "review.explainRanking",
    "#reviewBranchSection .review-help p": "review.explainFuture",
    "#reviewEvaluationSection .review-help p": "review.explainEvaluation",
  };
  Object.entries(reviewDescriptions).forEach(([selector, key]) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = t(key);
  });
  const reviewLabels = {
    "#closeReview": "review.close", "#closeReviewRankingPreview": "review.closePreview",
    "#closeReviewReplay": "review.closeReplay", "#reviewUserBoard": "review.yourMove",
    "#reviewAmaBoard": "review.amaChoice", "#reviewRankingPreviewBoard": "review.candidatePreview",
    "#reviewReplayPair": "review.replay", "#reviewReplayBoard": "review.replay",
  };
  Object.entries(reviewLabels).forEach(([selector, key]) => {
    const element = document.querySelector(selector);
    if (!element) return;
    element.ariaLabel = t(key);
    if (element.matches("button")) element.title = t(key);
  });
}

export function localizedColors() { return translations[locale].color; }
