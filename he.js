"use strict";
/* Hebrew (RTL) layer. Translates rendered text/attributes in place, so app.js stays language-agnostic. */
(function () {
  let lang = "en";
  try { lang = localStorage.getItem("lift.lang") || "en"; } catch (_) {}

  const EX = {
    "Bench Press (Barbell)": "לחיצת חזה (מוט)", "Incline Bench Press (Dumbbell)": "לחיצת חזה בשיפוע (משקולות)", "Chest Fly (Cable)": "פרפר (כבל)",
    "Push Up": "שכיבות סמיכה", "Dip": "מקבילים", "Squat (Barbell)": "סקוואט (מוט)", "Front Squat": "סקוואט קדמי", "Leg Press": "מכבש רגליים",
    "Leg Extension": "יישור ברכיים", "Lunge (Dumbbell)": "מכרעים (משקולות)", "Deadlift (Barbell)": "דדליפט (מוט)", "Romanian Deadlift": "דדליפט רומני",
    "Leg Curl": "כיפוף ברכיים", "Hip Thrust (Barbell)": "היפ תראסט (מוט)", "Pull Up": "מתח", "Lat Pulldown (Cable)": "משיכת פולי עליון (כבל)",
    "Bent Over Row (Barbell)": "חתירה בהטיה (מוט)", "Seated Row (Cable)": "חתירה בישיבה (כבל)", "One Arm Row (Dumbbell)": "חתירה ביד אחת (משקולת)",
    "Face Pull": "פייס פול", "Overhead Press (Barbell)": "לחיצת כתפיים (מוט)", "Shoulder Press (Dumbbell)": "לחיצת כתפיים (משקולות)",
    "Lateral Raise (Dumbbell)": "הרמות צד (משקולות)", "Rear Delt Fly": "פרפר אחורי", "Shrug (Dumbbell)": "משיכות כתפיים (משקולות)",
    "Bicep Curl (Dumbbell)": "סיבוב ביצפס (משקולות)", "Barbell Curl": "סיבוב מוט", "Hammer Curl": "סיבוב פטיש", "Tricep Pushdown (Cable)": "פשיטת מרפקים (כבל)",
    "Skull Crusher": "סקול קראשר", "Calf Raise (Machine)": "תאומים (מכונה)", "Plank": "פלאנק", "Hanging Leg Raise": "הרמות רגליים בתלייה",
    "Cable Crunch": "כפיפות בטן (כבל)", "Running (Outdoor)": "ריצה (בחוץ)", "Treadmill": "הליכון", "Cycling": "רכיבה", "Rowing Machine": "מכונת חתירה",
  };
  const MG = { Chest: "חזה", Back: "גב", Shoulders: "כתפיים", Biceps: "יד קדמית", Triceps: "יד אחורית", Quads: "ארבע ראשי", Hamstrings: "דו־ראשי", Glutes: "ישבן", Calves: "תאומים", Core: "ליבה", Cardio: "אירובי", Traps: "טרפז" };
  const EQ = { barbell: "מוט", dumbbell: "משקולות", machine: "מכונה", cable: "כבל", bodyweight: "משקל גוף", other: "אחר", none: "ללא" };

  const D = Object.assign({}, EX, MG, EQ, {
    "Train. Track. Break records.": "תתאמנו. תתעדו. תשברו שיאים.", "Name": "שם", "Email": "אימייל", "Password": "סיסמה", "Create account": "יצירת חשבון",
    "Sign in": "התחברות", "Already training with us?": "כבר מתאמנים איתנו?", "New here?": "חדשים כאן?", "Create an account": "פתיחת חשבון", "Your name": "השם שלך",
    "Home": "בית", "Train": "אימון", "Fuel": "תזונה", "Progress": "התקדמות", "Me": "אני",
    "Steps today": "צעדים היום", "Update": "עדכון", "Goal smashed. 🔥": "היעד הושג. 🔥", "Calories": "קלוריות", "Protein": "חלבון", "Body weight": "משקל גוף",
    "Tap to log": "לחצו לתיעוד", "This week": "השבוע", "workout done": "אימון הושלם", "workouts done": "אימונים הושלמו", "Start workout": "התחלת אימון",
    "Recent records": "שיאים אחרונים", "No records yet": "אין שיאים עדיין", "Beat a previous best and it will show up here.": "שברו שיא קודם והוא יופיע כאן.",
    "Body weight milestone": "אבן דרך במשקל הגוף", "Lift": "תרגיל", "Heaviest weight": "המשקל הכבד ביותר", "Est. 1RM": "1RM משוער", "Milestone": "אבן דרך",
    "Start empty workout": "אימון ריק חדש", "Routines": "תוכניות", "+ New": "+ חדש", "No routines yet": "אין תוכניות עדיין",
    "Save your go-to sessions and start them in one tap.": "שמרו את האימונים הקבועים שלכם והתחילו אותם בלחיצה.", "No exercises": "אין תרגילים", "Start": "התחלה",
    "History": "היסטוריה", "Nothing logged yet": "עוד לא תועד כלום", "Your finished workouts appear here.": "האימונים שסיימתם יופיעו כאן.",
    "Duration": "משך", "Volume": "נפח", "Sets": "סטים", "Finish": "סיום", "+ Add exercise": "+ הוספת תרגיל", "Discard workout": "ביטול האימון", "Set": "סט",
    "Prev": "קודם", "Reps": "חזרות", "Sec": "שנ׳", "+ Add set": "+ הוספת סט", "🏆 New personal record": "🏆 שיא אישי חדש",
    "Today": "היום", "Carbs": "פחמימות", "Fat": "שומן", "+ Log a meal": "+ תיעוד ארוחה", "breakfast": "ארוחת בוקר", "lunch": "ארוחת צהריים", "dinner": "ארוחת ערב", "snack": "חטיף",
    "Breakfast": "ארוחת בוקר", "Lunch": "ארוחת צהריים", "Dinner": "ארוחת ערב", "Snack": "חטיף", "Nothing logged": "לא תועד כלום",
    "Log meals to see calories and macros against your goals.": "תעדו ארוחות כדי לראות קלוריות ומקרו מול היעדים.", "kcal": "קק״ל",
    "Lifts": "תרגילים", "Body": "גוף", "Records": "שיאים", "No lifts yet": "עוד אין תרגילים", "Finish a workout and your strength trends show up here.": "סיימו אימון וגרפי הכוח שלכם יופיעו כאן.",
    "+ Log": "+ תיעוד", "Log": "יומן", "No entries": "אין רישומים", "Log your weight to track milestones.": "תעדו את המשקל כדי לעקוב אחרי אבני דרך.",
    "Hit a new best on any lift or cross a body-weight milestone.": "שברו שיא בתרגיל כלשהו או חצו אבן דרך במשקל הגוף.", "Heaviest": "הכבד ביותר", "Estimated 1RM": "1RM משוער",
    "Session volume": "נפח אימון", "Log at least two sessions to see a trend.": "תעדו לפחות שני אימונים כדי לראות מגמה.",
    "Profile": "פרופיל", "Units": "יחידות", "Kilograms": "קילוגרמים", "Pounds": "פאונד", "Weight goal": "יעד משקל", "Lose weight": "ירידה במשקל", "Gain weight": "עלייה במשקל",
    "Maintain": "שמירה", "Daily steps": "צעדים ביום", "Protein (g)": "חלבון (ג׳)", "Carbs (g)": "פחמימות (ג׳)", "Fat (g)": "שומן (ג׳)", "Save changes": "שמירת שינויים",
    "Record alerts": "התראות שיא", "Phone alerts": "התראות בטלפון", "Allowed on this device": "מאושר במכשיר הזה", "Blocked in browser settings": "חסום בהגדרות הדפדפן",
    "Not supported in this browser": "לא נתמך בדפדפן הזה", "Permission needed": "נדרשת הרשאה", "Allow notifications on this device": "אישור התראות במכשיר הזה",
    "Notification history": "היסטוריית התראות", "Data": "נתונים", "Export workouts (CSV)": "ייצוא אימונים (CSV)", "Sign out": "התנתקות", "Language": "שפה",
    "Get notified the moment you set a new personal best on a lift, or pass a body-weight milestone (every 5 kg toward your goal).": "קבלו התראה ברגע שאתם שוברים שיא אישי בתרגיל, או חוצים אבן דרך במשקל הגוף (כל 5 ק״ג לכיוון היעד).",
    "Steps": "צעדים", "Set today's total": "עדכון סך הצעדים להיום", "Date": "תאריך", "Save": "שמירה",
    "Browsers can't read your phone's pedometer, so enter steps from your phone or watch. Automatic sync arrives with the native app.": "דפדפן לא יכול לקרוא את מד הצעדים של הטלפון, אז הזינו צעדים מהטלפון או מהשעון. סנכרון אוטומטי יגיע עם האפליקציה המקורית.",
    "Log body weight": "תיעוד משקל גוף", "Notifications": "התראות", "Mark all as read": "סימון הכול כנקרא", "All quiet": "שקט כאן",
    "Personal records and milestones will show up here.": "שיאים אישיים ואבני דרך יופיעו כאן.", "New routine": "תוכנית חדשה", "Pick exercises": "בחרו תרגילים", "Save routine": "שמירת התוכנית",
    "Custom exercise": "תרגיל מותאם אישית", "Muscle group": "קבוצת שרירים", "Equipment": "ציוד", "Create": "יצירה", "+ Create custom exercise": "+ יצירת תרגיל מותאם",
    "Add exercise": "הוספת תרגיל", "Add selected": "הוספת הנבחרים", "Search exercises": "חיפוש תרגילים", "All": "הכול", "Workout complete 💪": "האימון הושלם 💪", "Time": "זמן",
    "Done": "אישור", "Delete workout": "מחיקת האימון", "Warm-up": "חימום", "Workout": "אימון", "Quick add": "הוספה מהירה", "Meal name": "שם הארוחה", "Type": "סוג",
    "Add meal": "הוספת ארוחה", "Log a meal": "תיעוד ארוחה", "e.g. Chicken & rice": "לדוגמה: עוף ואורז", "e.g. Push day": "לדוגמה: אימון דחיפה", "e.g. 8,500": "לדוגמה: 8,500",
    "Close": "סגירה", "Weight": "משקל", "Workout name": "שם האימון", "Complete set": "סימון סט כהושלם", "Set type": "סוג סט", "Remove exercise": "הסרת תרגיל", "Delete routine": "מחיקת תוכנית",
    "Previous day": "היום הקודם", "Next day": "היום הבא", "Delete meal": "מחיקת ארוחה", "Delete entry": "מחיקת רישום", "Main": "ראשי", "Skip": "דילוג",
    "Enter the reps first": "הזינו חזרות קודם", "Finish your current workout first": "סיימו קודם את האימון הנוכחי", "Rest over — next set": "המנוחה הסתיימה — הסט הבא",
    "Steps saved": "הצעדים נשמרו", "Saved": "נשמר", "Exercise created": "התרגיל נוצר", "Alerts enabled": "ההתראות הופעלו", "Pick at least one exercise": "בחרו לפחות תרגיל אחד",
    "New personal record 🏆": "שיא אישי חדש 🏆", "Body weight milestone 🎯": "אבן דרך במשקל הגוף 🎯",
    "Delete this routine?": "למחוק את התוכנית?", "Delete this workout and its records?": "למחוק את האימון והשיאים שלו?",
    "Remove this exercise and its logged sets?": "להסיר את התרגיל והסטים שתועדו?", "No sets were completed. Finish anyway?": "לא הושלמו סטים. לסיים בכל זאת?",
    "Discard this workout? Logged sets will be deleted.": "לבטל את האימון? הסטים שתועדו יימחקו.",
    "Plates": "פלטות", "Plate calculator": "מחשבון פלטות", "Target weight": "משקל יעד", "Bar weight": "משקל המוט", "Plates per side": "פלטות לכל צד", "Bar only": "מוט בלבד",
    "Enter a target weight.": "הזינו משקל יעד.", "Below bar weight": "פחות ממשקל המוט", "Apply": "החלה",
    "You hit 10+ reps on every set — go heavier.": "ביצעתם 10+ חזרות בכל הסטים — הגיע הזמן להכביד.", "Same weight, aim for one more rep.": "אותו משקל, נסו חזרה אחת יותר.",
    "Scan barcode": "סריקת ברקוד", "Barcode number": "מספר ברקוד", "Look up": "חיפוש",
    "Camera scanning isn't supported in this browser — enter the barcode number instead.": "סריקה במצלמה לא נתמכת בדפדפן הזה — הזינו את מספר הברקוד.",
    "Looking up product…": "מחפש מוצר…", "Product not found. Enter it manually.": "המוצר לא נמצא. הזינו ידנית.", "Couldn't reach the food database.": "אין חיבור למאגר המזון.",
    "Camera unavailable — enter the barcode number.": "המצלמה לא זמינה — הזינו את מספר הברקוד.", "Point the camera at a barcode": "כוונו את המצלמה לברקוד",
    "Amount (g)": "כמות (ג׳)", "Values are per amount entered (source: Open Food Facts).": "הערכים לפי הכמות שהוזנה (מקור: Open Food Facts).",
  });

  const MONTHS = null; // dates are formatted with the he-IL locale in app.js
  const RX = [
    [/^Good (morning|afternoon|evening)(?:, (.*))?$/, (_, p, n) => ({ morning: "בוקר טוב", afternoon: "צהריים טובים", evening: "ערב טוב" }[p]) + (n ? `, ${n}` : "")],
    [/^of ([\d,.]+)( kcal| g)?$/, (_, n, u) => `מתוך ${n}${u ? (u.trim() === "kcal" ? " קק״ל" : " ג׳") : ""}`],
    [/^([\d,]+) to go$/, (_, n) => `${n} לסיום`],
    [/^([\d,]+) kcal left$/, (_, n) => `נותרו ${n} קק״ל`],
    [/^([\d,]+) kcal over$/, (_, n) => `חריגה של ${n} קק״ל`],
    [/^([\d,]+) kcal$/, (_, n) => `${n} קק״ל`],
    [/^([▲▼•]) (.+) since last$/, (_, a, v) => `${a} ${v} מאז הפעם הקודמת`],
    [/^(.*) in progress$/, (_, n) => `${trCore(n)} מתבצע`],
    [/^(\d+)s rest$/, (_, n) => `מנוחה ${n} שנ׳`],
    [/^(\d+) sets$/, (_, n) => `${n} סטים`],
    [/^Set (\d+)$/, (_, n) => `סט ${n}`],
    [/^(\d+) new$/, (_, n) => `${n} חדשות`],
    [/^(Weight|Goal weight) \((kg|lb)\)$/, (_, w, u) => `${w === "Weight" ? "משקל" : "משקל יעד"} (${u})`],
    [/^P (\d+) · C (\d+) · F (\d+)$/, (_, p, c, f) => `ח׳ ${p} · פ׳ ${c} · ש׳ ${f}`],
    [/^Added (.*)$/, (_, n) => `נוסף: ${n}`],
    [/^Closest achievable: (.+)$/, (_, v) => `הקרוב ביותר שאפשר: ${v}`],
    [/^💡 Try (.+) × (\d+)$/, (_, w, r) => `💡 מומלץ: ${w} × ${r}`],
    [/^([\d.]+) kg × (\d+) on (.+) \(previous best ([\d.]+) kg\)$/, (_, w, r, n, p) => `${w} ק״ג × ${r} ב${trCore(n)} (שיא קודם ${p} ק״ג)`],
    [/^New estimated 1RM on (.+): ([\d.]+) kg$/, (_, n, v) => `1RM משוער חדש ב${trCore(n)}: ${v} ק״ג`],
    [/^You passed (\d+) kg \(now ([\d.]+) kg\)$/, (_, m, v) => `עברתם את ${m} ק״ג (כעת ${v} ק״ג)`],
  ];

  function trCore(c) {
    if (D[c] !== undefined) return D[c];
    if (c.includes(" · ")) return c.split(" · ").map(trCore).join(" · ");
    for (const [rx, rep] of RX) if (rx.test(c)) return c.replace(rx, rep);
    return c;
  }
  function tr(s) {
    const m = String(s).match(/^(\s*)([\s\S]*?)(\s*)$/);
    return m[2] ? m[1] + trCore(m[2]) + m[3] : s;
  }

  const ATTRS = ["placeholder", "aria-label", "title"];
  function fixText(n) { const v = n.nodeValue, t = tr(v); if (t !== v) n.nodeValue = t; }
  function fixAttrs(el) { for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } } }
  function apply(root) {
    if (!root) return;
    if (root.nodeType === 3) return fixText(root);
    if (root.nodeType !== 1) return;
    fixAttrs(root);
    root.querySelectorAll("[placeholder],[aria-label],[title]").forEach(fixAttrs);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName) ? 2 : 1) });
    let n; while ((n = w.nextNode())) fixText(n);
  }

  function start() {
    if (lang !== "he") return;
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    document.title = "LIFT — תתאמנו. תתעדו. תשברו שיאים.";
    apply(document.body);
    new MutationObserver((recs) => {
      for (const r of recs) {
        if (r.type === "childList") r.addedNodes.forEach(apply);
        else if (r.type === "characterData") fixText(r.target);
        else if (r.type === "attributes") fixAttrs(r.target);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  window.I18N = {
    lang,
    loc: lang === "he" ? "he-IL" : undefined,
    tr: lang === "he" ? tr : (s) => s,
    setLang(l) { try { localStorage.setItem("lift.lang", l); } catch (_) {} location.reload(); },
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
