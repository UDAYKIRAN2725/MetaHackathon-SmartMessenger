// Sample data taken from smart-messenger-prototype-v2.html.
// Replace with API calls once the backend exists.

export const CLOCK = '10:45'; // demo "now": Tue 27 Oct, 10:45 AM
export const ALARM = '⏰\uFE0E';

export const CATS = [
  { id: 'all', label: 'All' },
  { id: 'fr', label: 'Friends' },
  { id: 'pro', label: 'Professional' },
  { id: 'fam', label: 'Family' },
  { id: 'rel', label: 'Relatives' },
  { id: 'ext', label: 'External' },
];
export const CAT_LABEL = { fr: 'Friends', pro: 'Professional', fam: 'Family', rel: 'Relatives', ext: 'External' };

// s = smart order, r = recent order, open = chat view id (null = not openable in the prototype)
export const CHATS = [
  { id: 'priya', av: 'PS', name: 'Priya Sharma', time: '10:42', last: 'Can you send the report by 4 PM?', unread: 2, cat: 'pro', why: 'reads in 2 min · 20 min/day', score: '87', s: 1, r: 3, open: 'priya' },
  { id: 'mom', av: 'MO', name: 'Mom', time: '08:30', last: 'Call me when you’re free ♡', unread: 1, cat: 'fam', why: 'reads in 4 min · 22 min/day', score: '86', s: 2, r: 6, open: 'mom' },
  { id: 'pt', av: 'PT', name: 'Product Team', time: '09:15', last: 'Ravi: Meeting tomorrow 11 AM', unread: 5, cat: 'pro', why: 'group · reads in 9 min · 14 min/day', score: '59', s: 3, r: 5 },
  { id: 'kiran', av: 'KR', name: 'Kiran (Brother)', time: '08:02', last: 'Did you book the train tickets?', unread: 1, cat: 'fam', why: 'reads in 12 min · 9 min/day', score: '43', s: 4, r: 7 },
  { id: 'arjun', av: 'AK', name: 'Arjun', time: 'Yesterday', last: 'Are we meeting this weekend?', unread: 1, cat: 'fr', why: 'reads in 40 min · 6 min/day', score: '24', s: 5, r: 10, open: 'arjun' },
  { id: 'lakshmi', av: 'LA', name: 'Lakshmi Aunty', time: 'Yesterday', last: 'Forwarded: Diwali greetings 🪔', unread: 3, cat: 'rel', why: 'reads in 3 h · 2 min/day', score: '07', s: 6, r: 9 },
  { id: 'ext', av: '?', q: true, name: '+91 98765 43210', time: '11:20', last: 'Hi, is this Uday? Calling about plots…', unread: 1, cat: 'ext', why: 'not in contacts · no history yet', score: '—', s: 7, r: 1, open: 'ext' },
  { id: 'dad', av: 'DA', name: 'Dad', time: 'Yesterday', last: 'Ok 👍', unread: 0, cat: 'fam', why: 'reads in 6 min · 11 min/day', score: '56', s: 11, r: 8 },
  { id: 'ravi', av: 'RV', name: 'Ravi Kumar', time: '10:10', last: 'You: Will share the deck by EOD', unread: 0, cat: 'pro', why: 'reads in 8 min · 10 min/day', score: '51', s: 12, r: 4 },
  { id: 'sneha', av: 'SN', name: 'Sneha', time: 'Mon', last: 'Haha see you at the gym', unread: 0, cat: 'fr', why: 'reads in 1 h · 4 min/day', score: '16', s: 13, r: 11 },
  { id: 'raju', av: 'RU', name: 'Raju Uncle', time: 'Sun', last: 'God bless 🙏', unread: 0, cat: 'rel', why: 'reads in 5 h · 1 min/day', score: '04', s: 14, r: 12 },
  { id: 'shop', av: 'SD', name: 'ShopDeals', time: '11:05', last: 'Get 50% off today only!', unread: 0, cat: 'ext', why: 'reads in 9 h · 0 min/day', score: '01', s: 15, r: 2, dim: true },
];

export const RANKING = [
  ['1', 'Priya Sharma', '2 min', '20 min', '87', true],
  ['2', 'Mom', '4 min', '22 min', '86', true],
  ['3', 'Product Team', '9 min', '14 min', '59'],
  ['4', 'Dad', '6 min', '11 min', '56'],
  ['5', 'Ravi Kumar', '8 min', '10 min', '51'],
  ['6', 'Kiran (Brother)', '12 min', '9 min', '43'],
  ['7', 'Arjun', '40 min', '6 min', '24'],
];

export const CHAT_INFO = {
  priya: { av: 'PS', name: 'Priya Sharma', cat: 'Professional', role: 'Project Manager' },
  mom: { av: 'MO', name: 'Mom', cat: 'Family', stats: 'Score 86 · reads in 4 min · 22 min/day' },
  arjun: { av: 'AK', name: 'Arjun', cat: 'Friends', stats: 'Score 24 · reads in 40 min · 6 min/day' },
  ext: { av: '?', q: true, name: '+91 98765 43210', cat: 'External', noAi: true },
};

export const MESSAGES = {
  priya: [
    { day: 'Today' },
    { text: 'Morning! How’s the Q3 report coming along?', time: '10:38' },
    { out: true, text: 'Almost done, just reviewing the numbers.', time: '10:40 ✓✓' },
    { text: 'Great. Can you send the report by 4 PM? Leadership review is at 5.', time: '10:42' },
  ],
  mom: [
    { day: 'Today' },
    { out: true, text: 'Good morning Amma ☀️', time: '07:00 ✓✓ · ◷ scheduled' },
    { text: 'Good morning kanna. Did you eat?', time: '07:20' },
    { text: 'Call me when you’re free ♡', time: '08:30' },
  ],
  arjun: [
    { day: 'Saturday' },
    { out: true, text: 'That movie was too good 😂', time: '23:10 ✓✓' },
    { day: 'Yesterday' },
    { text: 'Bro, are we meeting this weekend?', time: '21:14' },
  ],
  ext: [
    { day: 'Today' },
    { text: 'Hi, is this Uday? I’m calling from XYZ Realty about plots near the airport. Very good offer.', time: '11:20' },
  ],
};

const r3 = (a, b, c) => [
  { label: 'Short', text: a },
  { label: 'Detailed', text: b },
  { label: 'Friendly', text: c },
];

// AI assist content per chat. Goals without `replies` are shown but not selectable (as in the prototype).
export const ASSIST = {
  priya: {
    name: 'Priya',
    step2: 'Pick a reply · it goes into the message box, you still press send',
    note: 'The AI also uses Priya’s memory, your rules and a short chat summary. Your context is used for this reply only and is not saved.',
    goals: [
      {
        chip: '✓ Confirm 4 PM',
        context: 'The numbers are final, I’m just formatting the slides.',
        summary: 'Confirm 4 PM · “numbers are final, formatting slides”',
        ctx: 'Confirm 4 PM. Numbers final, formatting slides.',
        replies: r3(
          'Sure Priya, I’ll send the Q3 report by 4 PM today.',
          'Hi Priya, the numbers are final and I’m just formatting the slides. I’ll share the Q3 report before 4 PM, ahead of the 5 PM leadership review.',
          'On it, Priya! You’ll have the report before 4 PM.',
        ),
      },
      {
        chip: '⏱ Ask for more time',
        context: 'Regional figures need one more check. Ask if 4:30 PM is OK.',
        summary: 'Ask for more time · “regional figures need a check, 4:30 PM?”',
        ctx: 'Ask for 4:30 PM. Regional figures need a check.',
        replies: r3(
          'Hi Priya, could I send it by 4:30 PM? I’m still checking a few numbers.',
          'Hi Priya, the regional figures need one more check. Could I send the report by 4:30 PM? That still leaves 30 minutes before the 5 PM review.',
          'Almost there, Priya! Could I have until 4:30 to double-check the numbers?',
        ),
      },
      {
        chip: '✎ Something else…',
        context: 'Say I’ll send it on time and I’m also adding a regional breakdown slide.',
        summary: '“Send on time, also adding a regional breakdown slide”',
        ctx: 'On time, plus a regional breakdown slide.',
        replies: r3(
          'Sure, I’ll send it by 4 PM with a regional breakdown slide added.',
          'Hi Priya, I’ll share the Q3 report by 4 PM. I’ve also added a regional breakdown slide in case leadership asks about it at 5.',
          'Will do! By 4 PM, plus a regional breakdown slide.',
        ),
      },
    ],
    context: [
      { t: 'Memory · Priya', v: 'Project Manager. Prefers short, clear updates. Leadership review Tuesdays 5 PM.' },
      { t: 'Memory · My rules', v: 'Professional tone with Professional contacts. No emojis with managers.' },
      { t: 'Chat summary (auto)', v: 'Priya is waiting on the Q3 report. Uday said it’s almost done. She needs it by 4 PM today.' },
    ],
  },
  mom: {
    name: 'Mom',
    note: 'Uses your rule “Reply in Telugu-English with family”.',
    revoke: true,
    goals: [
      {
        chip: '☎ Say I’ll call tonight',
        context: 'I ate breakfast. Busy at office, will call at 8 PM.',
        summary: '“Ate breakfast, busy at office, call at 8 PM”',
        replies: r3(
          'Tinna Amma. Tonight 8 ki call chesta 🙂',
          'Breakfast ayindi Amma. Office lo busy ga undi, 8 PM ki call chesta.',
          'Ha Amma, tinna! Evening 8 ki pakka call chesta ❤️',
        ),
      },
      { chip: '🍽 Tell her I ate' },
      { chip: '✎ Something else…' },
    ],
  },
  arjun: {
    name: 'Arjun',
    note: 'Also uses memory: “Arjun · college friend · plays cricket Sundays”.',
    goals: [
      {
        chip: '✓ Yes, let’s meet',
        context: 'Yes, Saturday evening. Ask if the usual café at 6 works.',
        summary: '“Yes, Saturday evening, usual café at 6?”',
        replies: r3(
          'Yes! Saturday 6 at the usual café?',
          'Yes bro, Saturday evening works. Sunday you have cricket right? Same café at 6?',
          'Obviously 😎 Saturday, same place, 6 PM?',
        ),
      },
      { chip: '✕ Can’t this weekend' },
      { chip: '? Suggest a plan' },
      { chip: '✎ Something else…' },
    ],
  },
};

export const AI_ALLOWED = { priya: true, pt: true, ravi: true, arjun: true, mom: false, dad: false };

// bucket: today | up | past. order sorts within a bucket.
export const TASKS = [
  { id: 'meds', title: 'Pick up medicines for Dad', time: '6:30 PM', tag: 'Voice', who: 'Apollo Pharmacy', bucket: 'today', order: 1 },
  { id: 'timesheet', title: 'Submit timesheet', time: '7:00 PM', tag: 'Manual', who: '↻ every Tuesday', bucket: 'today', order: 2 },
  { id: 'gym', title: 'Renew gym membership', time: 'Anytime', tag: 'Manual', who: 'no date', bucket: 'today', order: 3 },
  { id: 'launch', title: 'Bring launch copy to meeting', time: 'Wed 11 AM', tag: 'From chat', who: 'Product Team', bucket: 'up', order: 1 },
  { id: 'final', title: 'Submit final report', time: 'Fri 6 PM', tag: 'From chat', who: 'Ravi Kumar', bucket: 'up', order: 4 },
  { id: 'gift', title: 'Arjun’s birthday gift', time: 'Mar 11', tag: 'Manual', who: 'linked to Arjun', bucket: 'up', order: 5 },
  { id: 'standup', title: 'Team standup', time: '9:00 AM', tag: 'Manual', who: '↻ weekdays', bucket: 'past', order: 1, done: true },
  { id: 'mockups', title: 'Share mockups with Neha', time: 'Mon', tag: 'From chat', who: 'Product Team', bucket: 'past', order: 2, done: true },
];

export const Q3_TASK = { id: 'q3', title: 'Send Q3 report to Priya', time: '4:00 PM', timeU: true, tag: 'From chat', who: 'Priya Sharma', bucket: 'today', order: 0 };

export const REMIND_OPTS = ['At due time', '10 min before', '30 min before', '1 hour before', '1 day before'];
export const ALERT_OPTS = ['Notification', 'Notification + sound', 'Alarm until dismissed'];
export const REMIND_MIN = { 'At due time': 0, '10 min before': 10, '30 min before': 30, '1 hour before': 60, '1 day before': 0 };

export const REM_GROUPS = ['Today · Tue 27 Oct', 'Tomorrow · Wed 28 Oct', 'This week', 'Later'];

const ACT_DEFAULT = [
  { label: '✓ Mark done', kind: 'pri', act: 'done' },
  { label: 'Snooze ▾', kind: '' },
  { label: 'Delete', kind: 'ghost', act: 'delete' },
];

export const Q3_REMINDER = {
  id: 'q3', group: 0, order: 1, status: 'up', icon: ALARM, now: true, title: 'Send Q3 report to Priya',
  time: '3:30 PM', timeU: true, sub: 'Due 4:00 PM · 30 min before', tag: 'From chat', who: 'Priya Sharma',
  detail: {
    source: 'Suggested from Priya’s chat · approved by you at 10:45 AM',
    quote: { text: '“Great. Can you send the report by 4 PM? Leadership review is at 5.”', by: '· Priya, 10:42' },
    dueDate: 'Today, Tue 27 Oct', dueTime: '4:00 PM',
    remind: { options: REMIND_OPTS.slice(0, 4), on: 2 },
    actions: [ACT_DEFAULT[0], ACT_DEFAULT[1], { label: 'Open chat', kind: '', act: 'chat:priya' }, ACT_DEFAULT[2]],
    preview: { at: '3:30 PM', sub: 'Due 4:00 PM · from her chat', chat: 'priya' },
  },
};

export const REMINDERS = [
  {
    id: 'meds', group: 0, order: 2, status: 'up', icon: ALARM, title: 'Pick up medicines for Dad', time: '6:00 PM', timeU: true,
    sub: 'Due 6:30 PM · 30 min before', tag: 'Voice', who: 'Apollo Pharmacy',
    detail: {
      source: 'Added by voice today, 10:15 AM: “Remind me to pick up Dad’s medicines at 6:30 from Apollo”',
      dueDate: 'Today, Tue 27 Oct', dueTime: '6:30 PM',
      remind: { options: REMIND_OPTS, on: 2 },
      alert: { options: ALERT_OPTS, on: 0 },
      repeat: 'Does not repeat', location: 'Apollo Pharmacy',
      actions: ACT_DEFAULT,
      preview: { at: '6:00 PM', sub: 'Due 6:30 PM · Apollo Pharmacy' },
      snoozeOptions: ['15 min', '1 hour', 'Tonight 8 PM', 'Tomorrow 9 AM'],
    },
  },
  {
    id: 'timesheet', group: 0, order: 3, status: 'up', icon: '↻', title: 'Submit timesheet', time: '6:30 PM', timeU: true,
    sub: 'Due 7:00 PM · every Tuesday', tag: 'Manual', who: 'repeats weekly',
    detail: {
      source: 'Typed by you · 6 Oct',
      dueLabel: 'Due', dueDate: 'Every Tuesday', dueDateFixed: true, dueTime: '7:00 PM',
      repeatChips: { options: ['Daily', 'Weekly · Tue', 'Monthly', 'Custom'], on: 1 },
      remind: { options: REMIND_OPTS.slice(0, 4), on: 2 },
      nextAlerts: 'Tue 27 Oct 6:30 PM · Tue 3 Nov 6:30 PM · Tue 10 Nov 6:30 PM',
      actions: [
        { label: '✓ Done for this week', kind: 'pri', act: 'done' },
        { label: 'Skip this week', kind: '' },
        { label: 'Stop repeating', kind: 'ghost' },
      ],
      history: [['20 Oct', 'Done at 6:41 PM'], ['13 Oct', 'Done at 7:20 PM · snoozed once'], ['6 Oct', 'Done at 6:35 PM']],
    },
  },
  { id: 'launch', group: 1, order: 1, status: 'up', icon: ALARM, title: 'Bring launch copy to meeting', time: '10:30 AM', sub: 'Due 11:00 AM', tag: 'From chat', who: 'Product Team' },
  { id: 'final', group: 2, order: 2, status: 'up', icon: ALARM, title: 'Submit final report', time: 'Fri 5:00', sub: 'Due Fri 6:00 PM · 1 hour before', tag: 'From chat', who: 'Ravi Kumar' },
  { id: 'gift', group: 3, order: 1, status: 'up', icon: ALARM, title: 'Arjun’s birthday gift', time: 'Mar 10', sub: 'Due Mar 11 · 1 day before', tag: 'Manual', who: 'linked to Arjun' },
  {
    id: 'mom', status: 'sn', icon: 'z', title: 'Call Mom back', time: '1:00 PM', timeU: true,
    sub: 'Snoozed 2× · was due 9:00 AM', tag: 'From chat', who: 'Mom · “Call me when you’re free”',
    detail: {
      label: 'Snoozed reminder',
      source: 'Suggested from Mom’s chat: “Call me when you’re free ♡” · approved 8:35 AM',
      snoozedUntil: 'Today, 1:00 PM',
      snoozeHistory: '9:00 AM → snoozed 1 hour · 10:00 AM → snoozed until 1:00 PM',
      actions: [
        { label: '✓ Mark done', kind: 'pri', act: 'done' },
        { label: 'Snooze again ▾', kind: '' },
        { label: 'Open chat', kind: '', act: 'chat:mom' },
      ],
      tip: ['Lunch 1 PM', 'After work 8 PM'],
    },
  },
  { id: 'standup', status: 'done', icon: '✓', read: true, title: 'Team standup', time: '8:55 AM', sub: 'Marked done 9:02 AM', tag: 'Manual', who: '↻ weekdays' },
  { id: 'mockups', status: 'done', icon: '✓', read: true, title: 'Share mockups with Neha', time: 'Mon', sub: 'Marked done Mon 4:10 PM', tag: 'From chat', who: 'Product Team' },
  { id: 'bill', status: 'done', icon: '!', dim: true, missed: true, title: 'Pay electricity bill', time: 'Sun', sub: 'Missed · alert dismissed, not done' },
];

export const SCHEDULED = [
  { id: 'mom', av: 'MO', name: 'Mom', time: '7:00 AM', text: 'Good morning Amma ☀️', tag: '↻ Daily', why: 'Next: Tomorrow 7:00 AM', kind: 'rec', order: 1, pausable: true },
  { id: 'pt', av: 'PT', name: 'Product Team', time: '5:00 PM', text: 'Weekly status: all tasks on track…', tag: '↻ Fri', why: 'Next: Fri 30 Oct', kind: 'rec', order: 2 },
  { id: 'dad', av: 'DA', name: 'Dad', time: '6:00 PM', text: 'How was your week, Nanna?', tag: 'Paused', solid: true, why: '↻ Sundays', kind: 'rec', order: 4, dim: true },
  { id: 'arjun', av: 'AK', name: 'Arjun', time: '12:00 AM', text: 'Happy birthday bro! 🎉 Have a great year', tag: 'Once', why: 'Thu 12 Mar 2027', kind: 'once', order: 1 },
];

export const SENT_HISTORY = [
  { av: 'MO', name: 'Mom', time: 'Today 7:00', text: 'Good morning Amma ☀️', tag: '✓ Read 7:12' },
  { av: 'MO', name: 'Mom', time: 'Mon 7:00', text: 'Good morning Amma ☀️', tag: '✓ Read 7:05' },
  { av: 'PT', name: 'Product Team', time: 'Fri 5:00', text: 'Weekly status: all tasks on track…', tag: '✓ Delivered' },
  { av: 'MO', name: 'Mom', time: 'Sun 7:00', text: 'Good morning Amma ☀️', tag: 'Skipped by you', dim: true },
];

export const MEMORY = {
  priya: {
    av: 'PS', name: 'Priya Sharma', cat: 'Professional', chat: 'priya', manage: true,
    notes: [
      { id: 1, tag: 'Role', text: 'Project Manager', src: 'Added by you · 12 Oct' },
      { id: 2, tag: 'Preference', text: 'Prefers short, clear updates', src: 'Suggested from chat · approved 15 Oct' },
      { id: 3, tag: 'Fact', text: 'Working on the Q3 report with me', src: 'Suggested from chat · approved 20 Oct' },
    ],
    suggested: { tag: 'Fact', text: 'Leadership review is on Tuesdays at 5 PM.', src: 'From Priya’s message today, 10:42' },
  },
  mom: {
    av: 'MO', name: 'Mom', cat: 'Family', aiKey: 'mom',
    notes: [
      { id: 1, tag: 'Preference', text: 'Prefers calls over long texts' },
      { id: 2, tag: 'Language', text: 'Talks in Telugu, calls me “kanna”' },
      { id: 3, tag: 'Date', text: 'Birthday: 14 January' },
    ],
  },
  ravi: {
    av: 'RV', name: 'Ravi Kumar', cat: 'Professional',
    notes: [
      { id: 1, tag: 'Role', text: 'Project lead for the product launch' },
      { id: 2, tag: 'Preference', text: 'Prefers formal replies' },
    ],
  },
  arjun: {
    av: 'AK', name: 'Arjun', cat: 'Friends', listOnly: true,
    notes: [
      { id: 1, tag: 'Fact', text: 'College friend' },
      { id: 2, tag: 'Fact', text: 'Plays cricket Sundays' },
    ],
  },
};

export const RULE_TYPES = ['Tone', 'Language', 'Avoid', 'Culture & occasions'];
export const RULE_TARGETS = ['Everyone', 'Friends', 'Professional', 'Family', 'Relatives'];
export const RULES = [
  { id: 1, type: 'Tone', text: 'Professional tone with Professional contacts', applies: ['Professional'] },
  { id: 2, type: 'Tone', text: 'Keep replies short', applies: ['Everyone'] },
  { id: 3, type: 'Language', text: 'Reply in Telugu-English with family', applies: ['Family', 'Relatives'] },
  { id: 4, type: 'Avoid', text: 'No emojis with managers', applies: ['Professional'] },
  { id: 5, type: 'Avoid', text: 'Never discuss salary in chat', applies: ['Everyone'] },
  { id: 6, type: 'Culture & occasions', text: 'Greet elders with respect (“Namaste Uncle”)', applies: ['Relatives'] },
];

export const SETTINGS_AI = [
  { id: 'priya', name: 'Priya Sharma', sub: 'Professional' },
  { id: 'pt', name: 'Product Team', sub: 'Professional · group' },
  { id: 'ravi', name: 'Ravi Kumar', sub: 'Professional' },
  { id: 'arjun', name: 'Arjun', sub: 'Friends' },
  { id: 'mom', name: 'Mom', sub: 'Family' },
  { id: 'dad', name: 'Dad', sub: 'Family' },
];
