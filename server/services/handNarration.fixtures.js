/**
 * Hand Logger narration parser — test fixtures.
 *
 * Written the way players actually type: Hebrew, slang, shorthand, typos,
 * missing information, contradictions. Each fixture asserts only the fields
 * that the narration genuinely determines — anything the player never said is
 * left unasserted, because "didn't invent it" is the correct behaviour there.
 *
 * Assertion semantics (see scripts/testHandNarration.js):
 *   - `expect` is compared leaf-by-leaf against the parser's `extracted`.
 *   - `null` as an expected value means "must be absent or null" (i.e. the
 *     model must NOT hallucinate this field).
 *   - hero_cards / flop board are compared order-insensitively.
 *   - `expectContradiction: true` means the parser must flag a contradiction
 *     rather than silently picking one reading.
 *   - `expectMissing: [...]` lists field ids that must appear in missing_required.
 */

module.exports = [
  // ── 1. The bare minimum a lazy player types. Tests: does it extract the
  //       little that IS there, and correctly report everything else missing?
  {
    id: 'minimal-lazy',
    why: 'הקלט הכי טיפוסי — משפט אחד, כמעט בלי מידע. רוב המשתמשים יכתבו ככה.',
    input: 'הייתי בבאטן עם אס מלך, עליתי והוא קיפל',
    expect: {
      hero_position: 'BTN',
      hero_cards: [{ rank: 'A' }, { rank: 'K' }],
      // No format stated and no currency, so it settles as a tournament rather
      // than asking — see DEFAULT_GAME_TYPE in narrationGaps.js.
      game_type: 'tournament',
    },
    expectMissing: ['blinds'],
  },

  // ── 2. The raise→bet/three-bet inference. This is the single hardest
  //       non-trivial thing in the prompt: natural-language "3בט" must land on
  //       the app's encoding, and the opener must become "bet", not "raise".
  {
    id: 'threebet-encoding',
    why: 'המבחן המרכזי של ההיסק bet→three-bet. "פתח" = bet, "3בטתי" = three-bet.',
    input:
      'טורניר לייב, בליינדים 100/200. ישבתי ב-CO עם QQ. היו 6 בשולחן. ' +
      'UTG פתח ל-500, אני 3בטתי ל-1500, הוא קרא. פלופ בא 7 2 9 ריינבו, ' +
      'הוא צ׳ק, אני הימרתי 1800, הוא קיפל.',
    expect: {
      game_type: 'tournament',
      blind_sb: 100,
      blind_bb: 200,
      hero_position: 'CO',
      hero_cards: [{ rank: 'Q' }, { rank: 'Q' }],
      streets: {
        preflop: {
          actions: [
            { action: 'bet', amount: 500 },
            { actor: 'hero', action: 'three-bet', amount: 1500 },
            { action: 'call' },
          ],
        },
        flop: {
          actions: [
            { action: 'check' },
            { actor: 'hero', action: 'bet', amount: 1800 },
            { action: 'fold' },
          ],
        },
      },
    },
  },

  // ── 3. Ten as "T", never "10". Documented as load-bearing for CardPicker.
  {
    id: 'ten-encoding',
    why: '"10" חייב להתקדד כ-T. הכשל הזה שובר את ה-CardPicker בשקט.',
    input: 'קאש 1/2. הייתי ב-SB עם 10 לב ו-10 תלתן, הימרתי 15 וכולם קיפלו.',
    expect: {
      game_type: 'cash',
      cash_stakes: '1/2',
      hero_position: 'SB',
      hero_cards: [{ rank: 'T', suit: 'h' }, { rank: 'T', suit: 'c' }],
    },
  },

  // ── 4. Explicit decision point → result must be "unknown", and the parser
  //       must NOT invent an outcome or demand one.
  {
    id: 'decision-point',
    why: 'מצב "מה הייתם עושים" — result=unknown הוא תשובה שלמה, אסור להמציא תוצאה.',
    input:
      'טורניר, 500/1000. אני ב-BB עם AK עלה. הצ׳יפליידר מהבאטן דחף אול אין 40k, ' +
      'יש לי 38k. מה הייתם עושים? לא מספר מה עשיתי.',
    expect: {
      game_type: 'tournament',
      blind_sb: 500,
      blind_bb: 1000,
      hero_position: 'BB',
      result: 'unknown',
    },
  },

  // ── 5. Hand ends preflop — flop/turn/river must stay empty, not be invented.
  {
    id: 'ends-preflop',
    why: 'היד נגמרה פרה-פלופ. אסור להמציא בורד.',
    input: 'קאש 2/5, ישבתי ב-UTG עם 72 offsuit, קיפלתי מיד. סתם בודק.',
    expect: {
      game_type: 'cash',
      hero_position: 'UTG',
      streets: { flop: { board: null }, turn: { board: null }, river: { board: null } },
    },
  },

  // ── 6. Real contradiction: heads-up cannot contain a CO seat.
  {
    id: 'contradiction-heads-up-co',
    why: 'הד-אפ = 2 שחקנים = רק BTN/SB. אזכור CO הוא סתירה — לשאול, לא לנחש.',
    input: 'שיחקנו הד-אפ, אני ישבתי ב-CO עם AJ ועליתי.',
    expectContradiction: true,
  },

  // ── 7. Contradiction: fold with no bet to face.
  {
    id: 'contradiction-fold-no-bet',
    why: 'אי אפשר לקפל כשאין הימור פתוח — סתירה לוגית לפי חוקי NLH.',
    input:
      'קאש 1/2, אני ב-BTN עם KK. פלופ בא A K 5. אני צ׳ק, היריב צ׳ק, ואז אני קיפלתי.',
    expectContradiction: true,
  },

  // ── 8. Four-bet + all-in. Tests the third aggression level and that all-in
  //       is stored as its own action, not as another raise.
  {
    id: 'fourbet-allin',
    why: 'רמת אגרסיה שלישית = four-bet, ואול-אין הוא ערך נפרד ולא raise.',
    input:
      'טורניר 200/400. 8 בשולחן. ישבתי ב-HJ עם AA. UTG פתח ל-1000, ' +
      'MP עשה רי-רייז ל-3000, אני 4בטתי ל-8000, ו-UTG דחף אול אין על 45000. ' +
      'קראתי, MP קיפל. הבורד רץ ריק ולקחתי.',
    expect: {
      game_type: 'tournament',
      blind_sb: 200,
      blind_bb: 400,
      hero_position: 'HJ',
      hero_cards: [{ rank: 'A' }, { rank: 'A' }],
      result: 'won',
      streets: {
        preflop: {
          actions: [
            { action: 'bet', amount: 1000 },
            { action: 'three-bet', amount: 3000 },
            { actor: 'hero', action: 'four-bet', amount: 8000 },
            { action: 'allin', amount: 45000 },
            { actor: 'hero', action: 'call' },
            { action: 'fold' },
          ],
        },
      },
    },
  },

  // ── 9. Percent-of-pot sizing — the app already supports "NN%" amounts.
  {
    id: 'percent-pot',
    why: 'amount יכול להיות מחרוזת אחוזים. שחקנים מדברים ככה כל הזמן.',
    input:
      'קאש 1/3. ב-BTN עם 88. פלופ 8 4 2, הוא צ׳ק, הימרתי חצי קופה, הוא קרא. ' +
      'טרן 9, הוא צ׳ק, הימרתי 75 אחוז מהקופה והוא קיפל.',
    expect: {
      hero_position: 'BTN',
      hero_cards: [{ rank: '8' }, { rank: '8' }],
      streets: {
        turn: { board: [{ rank: '9' }] },
      },
    },
  },

  // ── 10. Slang / shorthand only, no full words. Tests robustness of the
  //        rank+suit parser against how people actually abbreviate.
  {
    id: 'slang-shorthand',
    why: 'קלט מקוצר לגמרי — AKs, btn, utg. שכיח מאוד בקבוצות וואטסאפ.',
    input: 'tourney 50/100, btn, AKs, utg opened 250, i called, flop Ks 7h 2d, he cbet 300, i raised 900, he folded',
    expect: {
      game_type: 'tournament',
      blind_sb: 50,
      blind_bb: 100,
      hero_position: 'BTN',
      streets: {
        flop: { board: [{ rank: 'K', suit: 's' }, { rank: '7', suit: 'h' }, { rank: '2', suit: 'd' }] },
      },
    },
  },

  // ── 11. Full street runout to showdown, with opponent cards revealed.
  {
    id: 'full-showdown',
    why: 'יד מלאה עד שואודאון — ארבעת הרחובות + קלפי יריב.',
    input:
      'טורניר לייב 300/600 אנטה 600. 9 בשולחן, אני ב-MP עם JJ. ' +
      'קו פתח ל-1500, קראתי. פלופ J 8 3 שונים, הוא הימר 2000 וקראתי. ' +
      'טרן 4, הוא הימר 5000, קראתי. ריבר 2, הוא דחף אול אין 12000, קראתי. ' +
      'הוא הראה AK עלה ולקחתי את הקופה עם סט.',
    expect: {
      game_type: 'tournament',
      blind_sb: 300,
      blind_bb: 600,
      ante: 600,
      hero_position: 'MP',
      hero_cards: [{ rank: 'J' }, { rank: 'J' }],
      result: 'won',
      streets: {
        turn: { board: [{ rank: '4' }] },
        river: { board: [{ rank: '2' }] },
      },
    },
  },

  // ── 12. Transcription-style corruption — the phase-2 (voice) readiness test.
  //        "ילד יהלום" is a plausible mis-hearing of "ג'ק יהלום".
  {
    id: 'transcription-noise',
    why: 'מוכנות לשלב ההקלטה: תמלול עברי משבש מילים. J צריך לצוץ מ"ילד יהלום".',
    input: 'הייתי בקאט אוף עם ילד יהלום ותשע יהלום, עליתי לשלוש מאות',
    expect: {
      hero_position: 'CO',
      hero_cards: [{ rank: 'J', suit: 'd' }, { rank: '9', suit: 'd' }],
    },
  },

  // ── 13. Online cash + loss. Tests the two online game_types and result=lost.
  {
    id: 'online-cash-loss',
    why: 'game_type אונליין + הפסד. ארבעת סוגי המשחק חייבים להיות מובחנים.',
    input:
      'שיחקתי קאש אונליין 0.5/1. ב-BB עם KQ לב. הבאטן פתח ל-3, קראתי. ' +
      'פלופ Q 9 4, צ׳ק צ׳ק. טרן K, הימרתי 5 והוא העלה ל-18, קראתי. ' +
      'ריבר 2, הימרתי 30 והוא דחף, קראתי והוא הראה סט תשיעיות. הפסדתי.',
    expect: {
      game_type: 'cash_online',
      cash_stakes: '0.5/1',
      hero_position: 'BB',
      hero_cards: [{ rank: 'K', suit: 'h' }, { rank: 'Q', suit: 'h' }],
      result: 'lost',
    },
  },

  // ── 14. Multiway pot with named opponents — tests that labels survive and
  //        that players_count is consistent with the opponents listed.
  {
    id: 'multiway-named',
    why: 'יריבים בשמות + קופה רב-משתתפים. הליבלים חייבים לשרוד לכל אורך הפעולות.',
    input:
      'טורניר 100/200. אני ב-UTG עם AQ. פתחתי ל-500. יוסי מהבאטן קרא, ' +
      'ודני מה-BB קרא גם. פלופ A 7 2, דני צ׳ק, אני הימרתי 900, יוסי קיפל, דני קרא. ' +
      'טרן 8, דני צ׳ק, צ׳קתי גם. ריבר 3, דני הימר 2500 וקיפלתי.',
    expect: {
      game_type: 'tournament',
      hero_position: 'UTG',
      hero_cards: [{ rank: 'A' }, { rank: 'Q' }],
      result: 'lost',
    },
  },

  // ── 16-18. Who can open preflop. The blinds act last, so an "open" almost
  //          never comes from them — the model used to seat openers in SB/BB
  //          whenever a seat happened to be free.
  {
    id: 'opener-not-a-blind',
    why: 'פתיחה בלי עמדה מפורשת — אסור לשבץ לבליינד, עדיף להשאיר ריק ולשאול.',
    input: 'טורניר 100/200, היה לי AQ, פתחתי ל-600 וכולם קיפלו',
    expect: { game_type: 'tournament', hero_position: null },
    expectMissing: ['hero_position'],
  },

  {
    id: 'opener-sb-steal',
    why: 'כולם קיפלו לסמול — זו הדרך היחידה שבליינד פותח, ואסור לסמן סתירה.',
    input: 'קאש 1/2. כולם קיפלו אליי בסמול בליינד עם K9, העליתי ל-6 וה-BB קיפל.',
    expect: { hero_position: 'SB' },
    expectNoContradiction: true,
  },

  {
    id: 'opener-blind-over-limpers',
    why: 'אחרי לימפים בליינד כן יכול להעלות ראשון — אסור לסמן סתירה.',
    input: 'קאש 1/2. שני שחקנים עשו לימפ, אני בביג בליינד עם AA העליתי ל-15, שניהם קראו.',
    expect: { hero_position: 'BB' },
    expectNoContradiction: true,
  },

  // ── 19. REAL user data — a note the site owner actually wrote on his phone,
  //        supplied 2026-09-03. Denser than anything invented: sizes in
  //        thousands, "שילמתי" for call, "פיק" for spades, "אויר" for a busted
  //        hand, and a winner that is only knowable from that last word.
  {
    id: 'real-note-house-game',
    why: 'קלט אמיתי מהמשתמש. הכי צפוף שיש — סלנג, סכומים באלפים, ותוצאה שתלויה במילה אחת.',
    input:
      'האוס 200k בלינדים 500-1000. שילמתי 2.5 עם 46פיק, עוד 3 שילמו, אני בכפתור, ' +
      'פלופ A78 שני פיקים. צקים אלי אני 5, מקבל שולם משלושה שחקנים. ' +
      'טרן k פיק, אגרסור ליד 20, אני שולם. ריבר 2 לב, הוא 65, שולם היה QJ אויר',
    expect: {
      // Deliberately does NOT assert game_type: "האוס 200k" is a live club game and
      // reading it as cash or as a tournament are both defensible. What must not
      // happen is losing the chip scale — an early version normalised these to
      // 0.5/1, which silently broke the bet-size rescaling downstream.
      blind_sb: 500,
      blind_bb: 1000,
      hero_position: 'BTN',
      hero_cards: [{ rank: '4', suit: 's' }, { rank: '6', suit: 's' }],
      // 4♠6♠ made a flush on the K♠ turn and the opponent showed QJ with air.
      // Returning "lost" here — which it did before the fix — is the worst
      // possible failure: a wrong result saved onto the player's own hand.
      result: 'won',
      streets: {
        turn: { board: [{ rank: 'K', suit: 's' }] },
        river: { board: [{ rank: '2', suit: 'h' }] },
      },
    },
    // Sizes here ("שילמתי 2.5", "אני 5") sit far below the big blind, so the
    // hand was written in some other unit. The owner later said the real level
    // was 1000/2000, not what the note appears to say — which is exactly why
    // this is asked rather than assumed.
    expectMissing: ['amount_scale'],
  },

  // ── 20. A 7XL / GGPoker hand-history screenshot, transcribed the way the
  //        vision step describes a visual table. Supplied by the site owner
  //        2026-09-03 (hand #TM6362116611). Everything here is explicit — the
  //        opposite end of the range from the handwritten note — so the sizes
  //        are real chip counts and must NOT trigger the scale question.
  {
    id: 'seven-xl-hand-history',
    why: 'צילום היסטוריית יד מ-7XL: סכומים מלאים, אנטה, שואודאון. אסור שתישאל שאלת קנה מידה.',
    input:
      'טורניר אונליין WSOP, בליינדים 3500/7000 עם אנטה 8000. אני YPP86 עם K לב ו-10 יהלום. ' +
      'פרה-פלופ: MikeBillions מ-UTG קיפל, אני העליתי ל-14,000, timoisablue מ-MP קיפל, ' +
      'pokerarena קיפל, EpicStation מ-CO קיפל, Charles מהבאטן קרא 14,000, ' +
      'tomBBaa מה-SB קיפל ו-Rosco780 מה-BB קיפל. ' +
      'פלופ 4 תלתן 9 יהלום Q עלה: הימרתי 15,345 ו-Charles קרא. ' +
      'טרן J עלה: צ׳קתי, Charles הימר 58,665, אני העליתי ל-155,925 והוא קרא 97,260. ' +
      'ריבר Q יהלום: צ׳קתי, Charles דחף אול אין 331,443, קראתי אול אין 247,514. ' +
      'הוא הראה K עלה Q עלה ואני לקחתי את הקופה 884,068 עם רצף.',
    expect: {
      blind_sb: 3500,
      blind_bb: 7000,
      ante: 8000,
      // "10 יהלום" must encode as T, exactly as CardPicker needs.
      hero_cards: [{ rank: 'K', suit: 'h' }, { rank: 'T', suit: 'd' }],
      result: 'won',
      streets: {
        turn: { board: [{ rank: 'J', suit: 's' }] },
        river: { board: [{ rank: 'Q', suit: 'd' }] },
      },
    },
    // The screenshot labels every other seat but not the hero's own. Either
    // answer is fine — ask for it, or derive one that fits — so this asserts
    // the requirement that actually matters: whatever seat comes out must not
    // clash with a named opponent or with the table size. checkSeatCollisions
    // and checkSeatsFitTable enforce that, and a contradiction here would mean
    // one of them fired.
    expectNoContradiction: true,
  },

  // ── 21-22. Table size decides which seats exist (owner's spec, 2026-09-06).
  {
    id: 'lojack-seat',
    why: 'LJ היא עמדה אמיתית שלא הייתה קיימת באפליקציה בכלל — מ-7 שחקנים ומעלה.',
    input: 'טורניר 500/1000, 8 בשולחן. ישבתי בלוג׳ק עם AK ופתחתי ל-2500, כולם קיפלו.',
    expect: { hero_position: 'LJ' },
    expectNoContradiction: true,
  },

  {
    id: 'seat-impossible-at-table-size',
    why: 'UTG+1 לא קיים בשולחן של 6 — סתירה, לא עמדה תקינה. זה בדיוק הבאג הישן.',
    input: 'קאש 1/2, 6 שחקנים בשולחן. ישבתי ב-UTG+1 עם QQ והעליתי ל-8.',
    expectContradiction: true,
  },

  // ── 23-24. The tournament default and the one signal that overrides it.
  {
    id: 'defaults-to-tournament',
    why: 'בלי "קאש" ובלי מטבע — טורניר, בלי לשאול. זו רוב מוחלט של הידיים שנרשמות.',
    input: 'בליינדים 200/400, ישבתי ב-CO עם AQ ופתחתי ל-1000, כולם קיפלו.',
    expect: { game_type: 'tournament', blind_sb: 200, blind_bb: 400 },
  },

  {
    id: 'currency-means-cash',
    why: 'סטייקים במטבע אמיתי (₪) הם הסימן שכן מבדיל קאש מטורניר.',
    input: 'שיחקתי 5/10 ש״ח, ישבתי ב-BTN עם KK והעליתי ל-40, ה-BB קרא.',
    expect: { game_type: 'cash' },
  },

  // ── 15. Follow-up turn: the player answers a question we asked. Tests that
  //        prior state is merged, not discarded — the core of the loop.
  {
    id: 'merge-followup',
    why: 'מיזוג תשובה לשאלה קודמת. אסור לאבד את מה שכבר אושר בסבב הקודם.',
    priorState: {
      game_type: 'tournament',
      blind_sb: 100,
      blind_bb: 200,
      hero_position: 'BTN',
      opponents: [{ label: 'יריב 1', position: 'UTG', stack: 20000 }],
    },
    history: [{ question: 'אילו קלפים היו לך?', answer: '' }],
    input: 'היו לי אס עלה ומלכה עלה',
    expect: {
      game_type: 'tournament',
      blind_sb: 100,
      blind_bb: 200,
      hero_position: 'BTN',
      hero_cards: [{ rank: 'A', suit: 's' }, { rank: 'Q', suit: 's' }],
    },
  },
];
