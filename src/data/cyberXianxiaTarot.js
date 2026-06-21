export const tarotArtDirection = {
  title: "乙女修仙塔罗",
  style:
    "Japanese otome fantasy tarot card style, dreamy shoujo-inspired illustration, elegant female xianxia cultivators, soft Taoist magic, floating talismans, moonlit immortal gardens, delicate ancient Chinese fantasy architecture, celestial flowers, luminous ribbons, refined romantic fantasy, cinematic soft lighting",
  figureRule:
    "All human figures must be elegant ethereal female xianxia cultivators with flowing robes, subtle immortal aura, original hair ornaments, soft otome fantasy beauty, and no male-presenting characters.",
  colorSystem:
    "pearl ivory, sakura pink, lavender mist, moonlight blue, jade green, champagne gold, soft cyan, warm blush, subtle ink gray",
  cardSize: "2:3 vertical tarot illustration, recommended 70mm x 120mm for print",
  negativePrompt:
    "no text, no title, no border, no number, no watermark, no logo, no copied Rider-Waite-Smith composition, no copied Thoth, Modern Witch, Wild Unknown or Light Seer's imagery, no low resolution, no blurry face, no extra fingers, no western medieval costume, no random typography, no harsh cyberpunk, no gritty sci-fi machinery, no dark dystopian armor"
};

const majorArcana = [
  ["major-00", "The Fool", "愚者", "新旅程、天真、信任未知", "鲁莽、迷失、轻率开始", "年轻修士站在悬浮山门边缘，脚下是发光云海，身旁漂浮一枚未激活的玉符"],
  ["major-01", "The Magician", "魔术师", "意志、显化、资源整合", "操控、虚张声势、能量失衡", "术士在霓虹法坛前将符箓、剑、杯、币四种法器连入星图阵列"],
  ["major-02", "The High Priestess", "女祭司", "直觉、隐秘知识、内在智慧", "秘密遮蔽、直觉失准、沉默压抑", "银发女祭司坐在量子藏经阁门前，身后两根黑白数据玉柱缓慢发光"],
  ["major-03", "The Empress", "女皇", "滋养、创造、丰盛", "过度依附、创造停滞、消耗", "仙庭女主在机械灵田中抚育发光灵植，远处古楼与生态舱交错"],
  ["major-04", "The Emperor", "皇帝", "秩序、结构、责任", "僵化、控制欲、权威滥用", "玄甲帝君坐在悬浮龙椅上，背后是环形星城和律令符文"],
  ["major-05", "The Hierophant", "教皇", "传承、仪式、群体信念", "教条、盲从、旧规束缚", "宗门导师在全息道观内授箓，弟子们围绕光阵静坐"],
  ["major-06", "The Lovers", "恋人", "选择、联结、价值一致", "犹豫、失衡关系、诱惑", "两位修行者在双生飞桥上交换发光心印，天际有阴阳星核"],
  ["major-07", "The Chariot", "战车", "推进、胜利、自律", "失控、急躁、方向冲突", "修士驾驶青铜机甲战车穿过霓虹云路，两侧灵兽无人机拉开阵势"],
  ["major-08", "Strength", "力量", "温柔的勇气、耐心、驯服本能", "压抑、胆怯、失去自控", "女武修以手心金光安抚机械白虎，背景是静默雷池"],
  ["major-09", "The Hermit", "隐者", "独处、寻找真理、内省", "孤立、逃避、迷惘", "老修士提着量子灵灯行走在雪山天梯，脚下电路像星河"],
  ["major-10", "Wheel of Fortune", "命运之轮", "周期、转机、因果", "停滞、抗拒变化、反复", "巨大的因果齿轮悬在云端，符箓和星轨绕轮旋转"],
  ["major-11", "Justice", "正义", "平衡、公正、因果清算", "偏见、不诚实、失衡裁决", "执法仙官手持光剑与玉衡，脚下是镜面审判法阵"],
  ["major-12", "The Hanged Man", "倒吊人", "暂停、换位视角、献身", "拖延、僵持、无谓牺牲", "修士倒悬于反重力桃树下，眉心亮起新的星图视角"],
  ["major-13", "Death", "死神", "结束、转化、重生", "抗拒结束、迟滞蜕变、恐惧改变", "黑袍灵械使穿过废弃仙城，枯木枝头长出霓虹新芽"],
  ["major-14", "Temperance", "节制", "调和、疗愈、流动", "过度、失衡、急于求成", "炼丹师在两只悬浮玉盏间调和金蓝灵液，身后水火双阵相融"],
  ["major-15", "The Devil", "恶魔", "执念、诱惑、束缚", "看见枷锁、解除依赖、自我释放", "霓虹魔市里巨大的欲望算法化作妖影，两名修士被发光契约线牵住"],
  ["major-16", "The Tower", "高塔", "突变、崩解、真相击穿", "延迟崩塌、害怕破局、余震", "通天数据塔被雷符击裂，瓦片与服务器碎片在空中飞散"],
  ["major-17", "The Star", "星星", "希望、灵感、宇宙祝福", "失望、信念低落、灵感干涸", "少女在天河观星台倾倒星砂，远处机械莲花盛开"],
  ["major-18", "The Moon", "月亮", "梦境、潜意识、迷雾", "幻象消散、恐惧浮现、误判", "两座月门倒映在灵潮中，机械狐影和纸鹤穿过雾色光路"],
  ["major-19", "The Sun", "太阳", "喜悦、清晰、生命力", "过度自信、短暂阴影、能量耗竭", "金色日轮照耀云上仙城，孩童修士骑着光翼麒麟掠过庭院"],
  ["major-20", "Judgement", "审判", "觉醒、召唤、更新", "逃避召唤、自责、未完成的清算", "天穹传来星舰法螺声，沉睡修士从莲形休眠舱中醒来"],
  ["major-21", "The World", "世界", "完成、整合、圆满", "未竟之事、缺口、循环未闭", "修士立于环形宇宙法阵中央，四象机械神兽环绕守护"]
].map(([id, englishName, chineseName, uprightMeaning, reversedMeaning, scene]) => ({
  id,
  englishName,
  chineseName,
  type: "Major Arcana",
  suit: "",
  uprightMeaning,
  reversedMeaning,
  visualSymbols: ["neon talismans", "ancient Chinese architecture", "cosmic machinery", "spiritual cultivation aura"],
  composition: scene,
  colorSuggestion: "ink black, talisman gold, jade green, electric cyan, controlled magenta highlights",
  imagePrompt: makePrompt(englishName, chineseName, "Major Arcana", "", scene),
  negativePrompt: tarotArtDirection.negativePrompt
}));

const suitSettings = {
  Wands: {
    zh: "符杖",
    symbol: "glowing wooden staff, thunder talismans, ember qi",
    theme: "action, willpower, ignition, cultivation breakthrough",
    colors: "ember orange, talisman gold, dark cedar, electric red"
  },
  Cups: {
    zh: "灵杯",
    symbol: "jade cup, liquid moonlight, healing water arrays",
    theme: "emotion, intuition, healing, relationship and inner flow",
    colors: "moon silver, deep teal, jade green, soft cyan"
  },
  Swords: {
    zh: "飞剑",
    symbol: "flying sword, cold blue blade, data wind, clear judgment",
    theme: "thought, conflict, clarity, discipline and truth",
    colors: "steel blue, pale cyan, ink black, sharp white"
  },
  Pentacles: {
    zh: "灵币",
    symbol: "jade coin, circuit sigil, earth altar, material cultivation",
    theme: "body, work, resources, craft and stability",
    colors: "jade green, bronze gold, earth umber, rice-paper ivory"
  }
};

const rankSettings = [
  ["ace", "Ace", "一", "seed, pure potential, first spark", "single sacred object floating above an altar, vast negative space"],
  ["two", "Two", "二", "choice, balance, first coordination", "two mirrored objects held in tension by a young cultivator"],
  ["three", "Three", "三", "growth, collaboration, first result", "three objects forming a triangular spell array with distant allies"],
  ["four", "Four", "四", "structure, pause, stable container", "four objects anchoring a calm square courtyard ritual"],
  ["five", "Five", "五", "friction, challenge, disruption", "five objects scattered through a tense neon training ground"],
  ["six", "Six", "六", "return, harmony, earned support", "six objects guiding travelers through a restored old gate"],
  ["seven", "Seven", "七", "test, strategy, guarded progress", "seven objects arranged as defensive layers around a lone figure"],
  ["eight", "Eight", "八", "momentum, practice, acceleration", "eight objects moving in synchronized luminous trails"],
  ["nine", "Nine", "九", "threshold, endurance, inner reserve", "nine objects circling a tired but standing cultivator"],
  ["ten", "Ten", "十", "completion, load, culmination", "ten objects forming a heavy luminous mandala over a city roof"],
  ["page", "Page", "侍者", "curiosity, message, apprentice mind", "young apprentice discovering the suit object in a quiet workshop"],
  ["knight", "Knight", "骑士", "pursuit, movement, charged intent", "mounted cultivator rushing through a neon cloud road with the suit object"],
  ["queen", "Queen", "王后", "mastery through receptivity, care, subtle command", "regal cultivator seated in a refined chamber, suit object orbiting gently"],
  ["king", "King", "国王", "mature authority, discipline, outer command", "sovereign cultivator standing before a cosmic city map, suit object blazing steadily"]
];

const minorMeanings = {
  ace: ["new potential", "blocked beginning"],
  two: ["balance and choice", "indecision or imbalance"],
  three: ["collaboration and expansion", "scattered effort"],
  four: ["stability and pause", "stagnation or restlessness"],
  five: ["conflict and adjustment", "recovery after friction"],
  six: ["support and return", "nostalgia or dependence"],
  seven: ["strategy and defense", "doubt or poor planning"],
  eight: ["momentum and practice", "delay or rushed mistakes"],
  nine: ["resilience and threshold", "fatigue or guarded fear"],
  ten: ["completion and burden", "release or overload"],
  page: ["study and first message", "immaturity or distraction"],
  knight: ["movement and pursuit", "recklessness or hesitation"],
  queen: ["inner mastery and care", "smothering or withdrawal"],
  king: ["outer mastery and responsibility", "rigidity or misuse of power"]
};

const minorArcana = Object.entries(suitSettings).flatMap(([suit, suitInfo]) =>
  rankSettings.map(([rankId, rankEnglish, rankChinese, rankIdea, compositionSeed]) => {
    const englishName = `${rankEnglish} of ${suit}`;
    const chineseName = `${suitInfo.zh}${rankChinese}`;
    const composition = `${compositionSeed}; focus on ${suitInfo.symbol}; express ${rankIdea} through ${suitInfo.theme}`;

    return {
      id: `${suit.toLowerCase()}-${rankId}`,
      englishName,
      chineseName,
      type: "Minor Arcana",
      suit,
      uprightMeaning: minorMeanings[rankId][0],
      reversedMeaning: minorMeanings[rankId][1],
      visualSymbols: [suitInfo.symbol, "floating talismans", "cultivation aura", "cybernetic feng shui patterns"],
      composition,
      colorSuggestion: suitInfo.colors,
      imagePrompt: makePrompt(englishName, chineseName, "Minor Arcana", suit, composition, suitInfo.colors),
      negativePrompt: tarotArtDirection.negativePrompt
    };
  })
);

export const cyberXianxiaTarotDeck = [...majorArcana, ...minorArcana];

function makePrompt(englishName, chineseName, type, suit, composition, colors = tarotArtDirection.colorSystem) {
  return [
    `Create an original commercial tarot card illustration for "${englishName}" (${chineseName}).`,
    `Theme: ${tarotArtDirection.style}.`,
    `Character rule: ${tarotArtDirection.figureRule}`,
    `Structure: ${type}${suit ? `, suit ${suit}` : ""}, inspired only by abstract tarot meanings, never by existing deck compositions.`,
    `Composition: ${composition}.`,
    `Palette: ${colors}.`,
    "Vertical 2:3 print-ready illustration, elegant fantasy concept art, cinematic lighting, crisp readable silhouette, rich symbolic details.",
    "No text, no title, no border, no number; layout elements will be added later by the app."
  ].join(" ");
}
