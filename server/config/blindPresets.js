/**
 * מבני בליינדים מוגדרים מראש
 * משותף ל-bulkCreate וליצירת תבנית Excel
 */
const BLIND_PRESETS = {
  hyper: {
    label: 'Hyper',
    defaultDuration: 5,
    levels: [
      { level: 1,  small_blind: 25,   big_blind: 50,   ante: 0   },
      { level: 2,  small_blind: 50,   big_blind: 100,  ante: 0   },
      { level: 3,  small_blind: 75,   big_blind: 150,  ante: 0   },
      { level: 4,  small_blind: 100,  big_blind: 200,  ante: 25  },
      { level: 5,  small_blind: 150,  big_blind: 300,  ante: 25  },
      { level: 6,  small_blind: 200,  big_blind: 400,  ante: 50  },
      { level: 7,  small_blind: 300,  big_blind: 600,  ante: 75  },
      { level: 8,  small_blind: 400,  big_blind: 800,  ante: 100 },
      { level: 9,  small_blind: 600,  big_blind: 1200, ante: 150 },
      { level: 10, small_blind: 800,  big_blind: 1600, ante: 200 },
      { level: 11, small_blind: 1000, big_blind: 2000, ante: 300 },
      { level: 12, small_blind: 1500, big_blind: 3000, ante: 400 },
    ],
  },
  turbo: {
    label: 'Turbo',
    defaultDuration: 10,
    levels: [
      { level: 1,  small_blind: 25,   big_blind: 50,   ante: 0   },
      { level: 2,  small_blind: 50,   big_blind: 100,  ante: 0   },
      { level: 3,  small_blind: 100,  big_blind: 200,  ante: 25  },
      { level: 4,  small_blind: 150,  big_blind: 300,  ante: 25  },
      { level: 5,  small_blind: 200,  big_blind: 400,  ante: 50  },
      { level: 6,  small_blind: 300,  big_blind: 600,  ante: 75  },
      { level: 7,  small_blind: 400,  big_blind: 800,  ante: 100 },
      { level: 8,  small_blind: 600,  big_blind: 1200, ante: 150 },
      { level: 9,  small_blind: 800,  big_blind: 1600, ante: 200 },
      { level: 10, small_blind: 1000, big_blind: 2000, ante: 300 },
      { level: 11, small_blind: 1500, big_blind: 3000, ante: 400 },
      { level: 12, small_blind: 2000, big_blind: 4000, ante: 500 },
    ],
  },
  regular: {
    label: 'Regular',
    defaultDuration: 20,
    levels: [
      { level: 1,  small_blind: 25,   big_blind: 50,   ante: 0   },
      { level: 2,  small_blind: 50,   big_blind: 100,  ante: 0   },
      { level: 3,  small_blind: 75,   big_blind: 150,  ante: 0   },
      { level: 4,  small_blind: 100,  big_blind: 200,  ante: 25  },
      { level: 5,  small_blind: 150,  big_blind: 300,  ante: 25  },
      { level: 6,  small_blind: 200,  big_blind: 400,  ante: 50  },
      { level: 7,  small_blind: 300,  big_blind: 600,  ante: 75  },
      { level: 8,  small_blind: 400,  big_blind: 800,  ante: 100 },
      { level: 9,  small_blind: 500,  big_blind: 1000, ante: 100 },
      { level: 10, small_blind: 600,  big_blind: 1200, ante: 150 },
      { level: 11, small_blind: 800,  big_blind: 1600, ante: 200 },
      { level: 12, small_blind: 1000, big_blind: 2000, ante: 250 },
      { level: 13, small_blind: 1500, big_blind: 3000, ante: 300 },
      { level: 14, small_blind: 2000, big_blind: 4000, ante: 500 },
      { level: 15, small_blind: 3000, big_blind: 6000, ante: 600 },
    ],
  },
};

/** המרת preset לשורות stages עם duration */
function presetToStages(key, overrideDuration) {
  const preset = BLIND_PRESETS[key];
  if (!preset) return null;
  const dur = overrideDuration || preset.defaultDuration;
  return preset.levels.map(r => ({ type: 'level', ...r, duration: dur }));
}

module.exports = { BLIND_PRESETS, presetToStages };
