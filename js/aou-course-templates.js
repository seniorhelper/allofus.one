/* allofus.one · course templates (Oct 11 2026)
   Each template becomes a real course in the member's account (courses + lessons tables) that they can edit,
   check off and share. Links are plain outbound links to free public sites; allofus.one is not connected to them.
   Lesson shape: [title, notes, link?, homework?]  (title <= 120, notes <= 8000, homework <= 500 chars) */
const yt = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);

export const COURSE_TEMPLATES = [
  {
    id: 'spanish30', icon: 'languages', color: '#f97316', title: 'Learn Spanish basics in 30 days',
    pace: '30 lessons · about 15 minutes a day', keys: ['spanish', 'español', 'espanol', 'language', 'learn a language'],
    about: 'A beginner plan for your first month of Spanish: greetings, numbers, everyday verbs and simple conversations. About 15 minutes a day. Pair it with a free app or video for listening practice. Check a day off when you finish it.',
    lessons: [
      ['Day 1 · Say hello', 'Learn: hola, buenos días, buenas tardes, buenas noches, adiós, hasta luego. Say each one out loud five times.', 'https://www.duolingo.com/course/es/en/Learn-Spanish', 'Greet three people (or your mirror) in Spanish today.'],
      ['Day 2 · Introduce yourself', 'Me llamo… (my name is), soy de… (I am from), mucho gusto (nice to meet you), ¿y tú? (and you?).', yt('Spanish for beginners introduce yourself'), 'Write and say a three-line introduction about you.'],
      ['Day 3 · The alphabet and sounds', 'Spanish is spelled the way it sounds. Practise the vowels a, e, i, o, u and the letters ñ, ll, rr, j and h (silent).', yt('Spanish alphabet pronunciation for beginners'), ''],
      ['Day 4 · Numbers 0 to 20', 'cero, uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez … veinte. Count objects around you.', yt('Spanish numbers 1 to 20'), 'Say your phone number in Spanish.'],
      ['Day 5 · Polite words', 'por favor, gracias, de nada, perdón, lo siento, con permiso. These go a long way.', '', ''],
      ['Day 6 · How are you?', '¿Cómo estás? Estoy bien / mal / cansado / feliz. ¿Qué tal? Más o menos.', '', 'Answer "¿Cómo estás?" three different ways.'],
      ['Day 7 · Review week 1', 'Go back over days 1 to 6. Note the words that did not stick and repeat them.', 'https://www.spanishdict.com/', 'Have a 1-minute "conversation" with yourself out loud.'],
      ['Day 8 · Ser (to be): who and what', 'yo soy, tú eres, él/ella es, nosotros somos, ellos son. Use ser for who you are, where you are from, what something is.', yt('Spanish verb ser for beginners'), ''],
      ['Day 9 · Estar (to be): how and where', 'yo estoy, tú estás, él/ella está, nosotros estamos, ellos están. Use estar for feelings and locations.', yt('ser vs estar explained simply'), 'Write five sentences: three with ser, two with estar.'],
      ['Day 10 · Family', 'madre, padre, hermano, hermana, hijo, hija, abuelo, abuela, esposo, esposa, amigo.', '', 'Describe your family in four short sentences.'],
      ['Day 11 · Colors and adjectives', 'rojo, azul, verde, amarillo, negro, blanco. Adjectives usually come after the noun: la casa blanca.', '', ''],
      ['Day 12 · Days and months', 'lunes, martes, miércoles, jueves, viernes, sábado, domingo. enero … diciembre. Hoy es… (today is).', '', 'Say today\'s date in Spanish.'],
      ['Day 13 · Telling time', '¿Qué hora es? Es la una. Son las dos. Y media (half past), y cuarto (quarter past).', yt('telling time in Spanish'), ''],
      ['Day 14 · Review week 2', 'Mix ser, estar, family, colors, days and time into ten sentences.', '', 'Record yourself reading them and listen back.'],
      ['Day 15 · Regular -ar verbs', 'hablar (to speak): hablo, hablas, habla, hablamos, hablan. Same pattern: trabajar, estudiar, caminar.', yt('Spanish present tense ar verbs'), ''],
      ['Day 16 · Regular -er and -ir verbs', 'comer: como, comes, come, comemos, comen. vivir: vivo, vives, vive, vivimos, viven.', '', 'Write what you eat and where you live, in Spanish.'],
      ['Day 17 · Tener (to have)', 'tengo, tienes, tiene, tenemos, tienen. Also: tengo hambre (I am hungry), tengo 30 años (I am 30).', '', ''],
      ['Day 18 · Ir (to go) + plans', 'voy, vas, va, vamos, van. Voy a + verb = I am going to: Voy a estudiar.', '', 'Say three things you are going to do this week.'],
      ['Day 19 · Food and ordering', 'el agua, el café, la comida, la cuenta (the bill). Quisiera… (I would like…). ¿Cuánto cuesta?', yt('ordering food in Spanish restaurant phrases'), ''],
      ['Day 20 · Shopping', '¿Cuánto cuesta? Es muy caro / barato. Busco… (I am looking for). ¿Tiene…?', '', ''],
      ['Day 21 · Review week 3', 'Role-play ordering a meal and buying something at a store.', '', 'Write a short dialogue between you and a waiter.'],
      ['Day 22 · Asking questions', '¿Qué? ¿Quién? ¿Dónde? ¿Cuándo? ¿Por qué? ¿Cómo? ¿Cuánto?', '', 'Write one question with each word.'],
      ['Day 23 · Directions', 'a la derecha, a la izquierda, todo recto, cerca, lejos. ¿Dónde está el baño?', '', ''],
      ['Day 24 · Weather', '¿Qué tiempo hace? Hace calor / frío / sol / viento. Llueve. Nieva.', '', 'Describe today\'s weather.'],
      ['Day 25 · Likes and dislikes', 'Me gusta el café. Me gustan los perros. No me gusta… ¿Te gusta…?', '', 'List five things you like and two you do not.'],
      ['Day 26 · Your daily routine', 'Me levanto, desayuno, trabajo, como, descanso, me acuesto.', yt('daily routine in Spanish beginner'), 'Describe your day from morning to night.'],
      ['Day 27 · Listening day', 'Watch a short beginner video or show with Spanish subtitles. Write down five new words.', yt('easy Spanish street interviews beginner'), ''],
      ['Day 28 · Review week 4', 'Questions, directions, weather, likes, routine: say a sentence for each.', '', ''],
      ['Day 29 · Your first conversation', 'Put it together: greet, introduce yourself, ask how they are, talk about your day, say goodbye.', '', 'Have a 3-minute chat with a Spanish speaker, a friend learning too, or out loud.'],
      ['Day 30 · Celebrate and plan next', 'Look back at day 1. Pick what comes next: past tense, a weekly conversation group, or a daily app streak.', '', 'Share your progress with a friend on allofus.one.']
    ]
  },
  {
    id: 'morning30', icon: 'sun', color: '#f59e0b', title: '30 days to a steady morning',
    pace: '30 days · 10 to 30 minutes each morning', keys: ['morning', 'routine', 'habit', 'wake up', 'sleep'],
    about: 'Build a calm, repeatable morning one small habit at a time. Each week adds one piece, so by day 30 you have a routine that sticks without willpower.',
    lessons: [
      ['Day 1 · Pick a wake-up time', 'Choose one wake-up time you can keep every day, weekends included. Set one alarm, across the room.', '', 'Write your wake-up time on your LIFEboard.'],
      ['Day 2 · Water first', 'Drink a full glass of water before coffee or your phone.', '', ''],
      ['Day 3 · Phone stays down', 'No phone for the first 15 minutes. Leave it charging outside the bedroom if you can.', '', ''],
      ['Day 4 · Open the curtains', 'Get daylight in your eyes within 30 minutes of waking: a window or a step outside.', '', ''],
      ['Day 5 · Make the bed', 'A 60-second win that starts the day finished, not behind.', '', ''],
      ['Day 6 · Notice how you feel', 'Rate your energy 1 to 10 this morning. No judging, just noticing.', '', 'Log it in your LIFEboard mood check.'],
      ['Day 7 · Week 1 review', 'Which of the five habits felt easy? Keep those. Which felt hard? Make it smaller.', '', ''],
      ['Day 8 · Move for 5 minutes', 'Stretch, walk around the block or do a few squats. Just 5 minutes.', yt('5 minute morning stretch routine'), ''],
      ['Day 9 · Move for 5 minutes again', 'Same as yesterday. Repetition is the point.', '', ''],
      ['Day 10 · Breathe', 'Two minutes of slow breathing: in for 4, hold 4, out for 6.', yt('box breathing 2 minutes'), ''],
      ['Day 11 · Plan your top 3', 'Write the three things that would make today a good day.', '', 'Use Today\'s top 3 on your LIFEboard.'],
      ['Day 12 · Prep the night before', 'Tonight, set out clothes and anything you need for the morning.', '', ''],
      ['Day 13 · Simple breakfast', 'Pick one easy breakfast you can repeat: eggs, oats, yogurt and fruit.', '', ''],
      ['Day 14 · Week 2 review', 'Is movement + breathing + top 3 fitting in? Write your routine as a short checklist.', '', ''],
      ['Day 15 · Gratitude', 'Write one thing you are grateful for.', '', ''],
      ['Day 16 · Read 5 pages', 'Five pages of a book, before any feed.', '', ''],
      ['Day 17 · Consistent bedtime', 'Mornings start the night before. Set a bedtime 8 hours before your wake-up time.', '', ''],
      ['Day 18 · Screen curfew', 'Screens off 30 minutes before bed tonight.', '', ''],
      ['Day 19 · A longer walk', 'Turn 5 minutes of movement into 15 if you can.', '', ''],
      ['Day 20 · Check in with someone', 'Send one kind message to a friend or family member.', '', ''],
      ['Day 21 · Week 3 review', 'Three weeks in: what is automatic now?', '', ''],
      ['Day 22 · Time your routine', 'How long does your morning take start to finish? Adjust your alarm if needed.', '', ''],
      ['Day 23 · Remove one friction', 'Find one thing that slows you down (lost keys, no coffee ready) and fix it.', '', ''],
      ['Day 24 · Weekend test', 'Keep the routine on a day off. Same wake-up time.', '', ''],
      ['Day 25 · Learn something small', 'Spend 10 minutes on a skill: a language, an instrument, a course here.', '', ''],
      ['Day 26 · Tidy for 5 minutes', 'Reset one surface: the counter, your desk.', '', ''],
      ['Day 27 · Reflect in writing', 'Write three sentences: how are your mornings different from day 1?', '', ''],
      ['Day 28 · Plan for bad days', 'Decide your 5-minute "minimum routine" for days that go sideways.', '', ''],
      ['Day 29 · Share it', 'Tell a friend what your routine is. Saying it makes it stick.', '', ''],
      ['Day 30 · Keep going', 'You did 30 days. Keep the checklist on your LIFEboard and start the next course.', '', 'Share this course with someone who wants better mornings.']
    ]
  },
  {
    id: 'guitar', icon: 'music', color: '#8b5cf6', title: 'Learn guitar chords',
    pace: '12 lessons · 20 minutes a session', keys: ['guitar', 'chords', 'music', 'instrument', 'ukulele'],
    about: 'From holding the guitar to playing your first full song. Twelve short lessons covering the open chords most songs use, strumming and smooth changes.',
    lessons: [
      ['Holding the guitar and tuning', 'Sit up straight, guitar body on your leg, thumb behind the neck. Tune with a free tuner app: E A D G B E, thick string to thin.', yt('how to tune a guitar for beginners'), ''],
      ['Your first chord: E minor', 'Two fingers on the 2nd fret of the A and D strings. Strum all six strings. Let each string ring.', yt('E minor chord beginner guitar'), 'Play Em ten times, lifting your hand off between each.'],
      ['A minor and C major', 'Am and C share two finger positions. Move only your ring finger to switch.', yt('A minor to C chord change beginner'), ''],
      ['G major and D major', 'Two of the most common chords in popular music.', yt('G and D chord beginner guitar lesson'), ''],
      ['Changing chords smoothly', 'Use the "one-minute change": count how many switches between two chords you can do in 60 seconds. Beat your score daily.', yt('one minute chord changes'), 'Record your best score for G to D.'],
      ['Basic strumming', 'Down, down-up, up-down-up. Keep your wrist loose and your hand moving even when you miss strings.', yt('basic strumming pattern beginner guitar'), ''],
      ['E major and A major', 'Round out the open chords. E major is E minor plus one finger.', '', ''],
      ['Your first song: four chords', 'G, D, Em, C plays hundreds of songs. Loop them slowly with the strumming pattern.', yt('G D Em C songs beginner guitar'), 'Play the loop for two minutes without stopping.'],
      ['Rhythm and keeping time', 'Play along with a metronome at 60 beats per minute, then 70, then 80.', '', ''],
      ['F major (the easy version)', 'Skip the full barre for now: play the small four-string F.', yt('easy F chord beginner guitar'), ''],
      ['Learn a song you love', 'Search the song name plus "chords". Pick one using chords you know.', 'https://www.justinguitar.com/', ''],
      ['Play it for someone', 'Play your song start to finish for a friend, or record it.', '', 'Post a clip or a note about it on your feed.']
    ]
  },
  {
    id: 'business', icon: 'briefcase', color: '#0ea5e9', title: 'Start a small business',
    pace: '12 steps · one step a week', keys: ['business', 'start a business', 'side hustle', 'company', 'llc', 'entrepreneur', 'shop', 'store'],
    about: 'A practical path from idea to first paying customer. Each step ends with something concrete you can check off. General information only, not legal or tax advice.',
    lessons: [
      ['Pick the problem you solve', 'Write one sentence: "I help [who] with [problem] so they can [result]."', '', 'Write your one sentence.'],
      ['Talk to 10 possible customers', 'Ask about the problem, not your idea. What do they do today? What does it cost them?', '', 'Talk to 10 people and note what they said.'],
      ['Check the competition', 'Find 5 businesses already solving it. Note their prices and what customers complain about in reviews.', '', ''],
      ['Price your offer', 'Start from what customers already pay for alternatives. Pick one simple offer and one price.', 'https://www.khanacademy.org/search?page_search_query=entrepreneurship', ''],
      ['Write a one-page plan', 'Customer, offer, price, how people find you, costs, and what success looks like in 90 days.', 'https://www.sba.gov/business-guide/plan-your-business/write-your-business-plan', ''],
      ['Choose a name and check it', 'Check that the name and a matching domain are free.', '', ''],
      ['Register and get your licences', 'Look up the business structure and licences for your city and state.', 'https://www.sba.gov/business-guide/launch-your-business/register-your-business', 'List the registrations you need.'],
      ['Open a separate bank account', 'Keep business money apart from personal money from day one.', '', ''],
      ['Set up a simple web presence', 'A one-page site or a free Brand page here on allofus.one with what you do, prices and how to reach you.', '', 'Create your Brand page.'],
      ['Get your first customer', 'Go back to the 10 people from step 2. Offer them an early-customer price.', '', ''],
      ['Track money in and out', 'A simple spreadsheet is enough: date, what, amount in, amount out.', 'https://www.khanacademy.org/college-careers-more/personal-finance', ''],
      ['Ask for reviews and referrals', 'Happy customers bring the next ones. Ask each one for a review and a name.', '', 'Ask your first three customers for a review.']
    ]
  },
  {
    id: 'c25k', icon: 'activity', color: '#22c55e', title: 'Couch to 5K',
    pace: '27 runs · 3 a week for 9 weeks', keys: ['run', 'running', '5k', 'couch', 'fitness', 'exercise', 'jog'],
    about: 'The classic beginner running plan: three runs a week for nine weeks, building from short run-walk intervals to running 30 minutes. Start every run with a brisk 5-minute walk. If you have a health condition, check with your doctor before you start.',
    lessons: [
      ['Week 1 · Run 1', 'Brisk 5-minute walk. Then alternate 60 seconds of running and 90 seconds of walking for 20 minutes.', 'https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/', ''],
      ['Week 1 · Run 2', 'Same as run 1: 60 seconds running, 90 seconds walking, for 20 minutes.', '', ''],
      ['Week 1 · Run 3', 'Same again. Take a rest day between runs.', '', ''],
      ['Week 2 · Run 1', 'Alternate 90 seconds running and 2 minutes walking for 20 minutes.', '', ''],
      ['Week 2 · Run 2', 'Same as run 1.', '', ''],
      ['Week 2 · Run 3', 'Same as run 1.', '', ''],
      ['Week 3 · Run 1', 'Two repeats of: 90 seconds running, 90 seconds walking, 3 minutes running, 3 minutes walking.', '', ''],
      ['Week 3 · Run 2', 'Same as run 1.', '', ''],
      ['Week 3 · Run 3', 'Same as run 1.', '', ''],
      ['Week 4 · Run 1', '3 min run, 90 s walk, 5 min run, 2½ min walk, 3 min run, 90 s walk, 5 min run.', '', ''],
      ['Week 4 · Run 2', 'Same as run 1.', '', ''],
      ['Week 4 · Run 3', 'Same as run 1.', '', ''],
      ['Week 5 · Run 1', '5 min run, 3 min walk, 5 min run, 3 min walk, 5 min run.', '', ''],
      ['Week 5 · Run 2', '8 min run, 5 min walk, 8 min run.', '', ''],
      ['Week 5 · Run 3', '20 minutes of running, no walking. Go slow: slow is fine.', '', 'Celebrate this one. It is a big step.'],
      ['Week 6 · Run 1', '5 min run, 3 min walk, 8 min run, 3 min walk, 5 min run.', '', ''],
      ['Week 6 · Run 2', '10 min run, 3 min walk, 10 min run.', '', ''],
      ['Week 6 · Run 3', '25 minutes of running.', '', ''],
      ['Week 7 · Run 1', '25 minutes of running.', '', ''],
      ['Week 7 · Run 2', '25 minutes of running.', '', ''],
      ['Week 7 · Run 3', '25 minutes of running.', '', ''],
      ['Week 8 · Run 1', '28 minutes of running.', '', ''],
      ['Week 8 · Run 2', '28 minutes of running.', '', ''],
      ['Week 8 · Run 3', '28 minutes of running.', '', ''],
      ['Week 9 · Run 1', '30 minutes of running.', '', ''],
      ['Week 9 · Run 2', '30 minutes of running.', '', ''],
      ['Week 9 · Run 3', '30 minutes of running. You did it.', '', 'Find a local 5K and sign up, or run one with a friend.']
    ]
  },
  {
    id: 'cook10', icon: 'utensils', color: '#ef4444', title: 'Learn to cook 10 meals',
    pace: '12 lessons · one meal a week or faster', keys: ['cook', 'cooking', 'meal', 'recipe', 'food', 'kitchen', 'bake'],
    about: 'Ten simple, everyday meals that teach the core skills: chopping, sautéing, roasting, boiling and seasoning. Each lesson links to free video walkthroughs.',
    lessons: [
      ['Kitchen basics', 'Knife grip, a stable cutting board, and how to chop an onion. Wash hands and keep raw meat separate.', yt('basic knife skills for beginners'), ''],
      ['Meal 1 · Scrambled eggs and toast', 'Low heat, keep stirring, take them off while still a little soft.', yt('how to make perfect scrambled eggs'), ''],
      ['Meal 2 · A big salad with homemade dressing', 'Dressing: 3 parts oil, 1 part vinegar or lemon, a pinch of salt, a little mustard. Shake in a jar.', yt('simple vinaigrette salad dressing'), ''],
      ['Meal 3 · Pasta with tomato sauce', 'Salt the water well. Simmer canned tomatoes with garlic and olive oil for 15 minutes.', yt('easy tomato sauce pasta from scratch'), ''],
      ['Meal 4 · Sheet-pan chicken and vegetables', 'Everything on one tray at 425°F (220°C). Cook chicken until it reaches 165°F (74°C) inside.', yt('sheet pan chicken and vegetables easy'), ''],
      ['Meal 5 · Vegetable stir-fry with rice', 'Hot pan, small batches, sauce at the end. Cook rice: 1 cup rice to about 1½–2 cups water.', yt('easy vegetable stir fry for beginners'), ''],
      ['Meal 6 · A pot of chili', 'Brown, add beans and tomatoes, simmer. It tastes better the next day.', yt('easy beginner chili recipe'), ''],
      ['Meal 7 · A filling omelette', 'Beat eggs, medium heat, fill, fold.', yt('how to make an omelette beginner'), ''],
      ['Meal 8 · Homemade soup', 'Onion, carrot, celery, broth, then anything you like. Blend or leave chunky.', yt('easy homemade vegetable soup'), ''],
      ['Meal 9 · Tacos', 'Season the filling well, warm the tortillas, set out toppings.', yt('easy homemade tacos'), ''],
      ['Meal 10 · Roast salmon or tofu with greens', 'High heat, short time. Finish with lemon.', yt('easy roasted salmon and vegetables'), ''],
      ['Cook for someone', 'Pick your favorite of the ten and make it for a friend or family.', '', 'Post a photo of your meal on your feed.']
    ]
  },
  {
    id: 'money', icon: 'wallet', color: '#14b8a6', title: 'Get your money in order',
    pace: '8 steps · one a week', keys: ['money', 'budget', 'finance', 'save', 'saving', 'debt', 'invest'],
    about: 'Eight steps to know where your money goes, build a small cushion and make a plan for debt and saving. Uses the free calculators in your LIFEboard Money tools. General education, not financial advice.',
    lessons: [
      ['See where your money goes', 'List your income and every regular bill. Check the last 30 days of spending.', 'https://www.khanacademy.org/college-careers-more/personal-finance', 'Write your monthly income and total bills.'],
      ['Make a simple budget', 'Needs, wants, savings. Many people start with 50 / 30 / 20 and adjust.', '', 'Use the budget calculator in LIFEboard → Money tools.'],
      ['Start a starter emergency fund', 'Aim for a first small cushion, then one month of expenses.', '', ''],
      ['List your debts', 'Balance, interest rate and minimum payment for each.', '', ''],
      ['Pick a payoff method', 'Smallest balance first (snowball) or highest interest first (avalanche). Pick one and stick with it.', '', ''],
      ['Cut one cost', 'Call one provider (phone, insurance, internet) and ask for a better rate, or cancel one subscription.', '', ''],
      ['Automate saving', 'Set an automatic transfer to savings the day you get paid.', '', ''],
      ['Review monthly', 'Put a monthly 20-minute money check-in on your calendar.', '', 'Add a monthly reminder in LIFEboard → Reminders.']
    ]
  }
];

/* best template for a typed title ("how do i use this tool? i want to learn spanish" → spanish30) */
export function matchTemplate(text) {
  const t = String(text || '').toLowerCase(); if (t.length < 3) return null; let best = null, score = 0;
  for (const tp of COURSE_TEMPLATES) { let s = 0; for (const k of tp.keys) if (t.includes(k)) s += k.length; if (s > score) { score = s; best = tp; } }
  return best;
}
