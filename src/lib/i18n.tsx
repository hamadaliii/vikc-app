'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Lang = 'sv' | 'en'

const translations = {
  sv: {
    // Nav
    home: 'Hem', events: 'Aktiviteter', ranks: 'Ranking',
    rewards: 'Belöningar', profile: 'Profil', admin: 'Admin',
    // Home
    greeting: 'Assalamu Alaikum 👋',
    upcomingEvents: 'Kommande aktiviteter',
    noEvents: 'Inga kommande aktiviteter',
    // Events
    eventsTitle: 'Aktiviteter',
    eventsSubtitle: 'Kommande aktiviteter & samlingar',
    pastEvents: 'Tidigare aktiviteter',
    allFilter: 'Alla',
    registered: 'registrerade',
    joined: '✓ Anmäld',
    register: 'Anmäl dig',
    ended: 'Avslutad',
    // Profile
    points: 'Poäng',
    level: 'Nivå',
    streak: 'Svit',
    history: '📅 Historik',
    badges: '🏅 Märken',
    pointsTab: '💰 Poäng',
    noBadges: 'Inga märken ännu — delta på aktiviteter för att tjäna dem!',
    noHistory: 'Ingen historik ännu — gå med på en aktivitet!',
    noPoints: 'Inga transaktioner ännu',
    settings: '⚙️ Inställningar',
    logOut: '🚪 Logga ut',
    changeAvatar: 'Ändra avatar',
    changeCover: 'Ändra omslagsbild',
    myBadges: '🏅 Mina märken',
    // Settings
    settingsTitle: 'Inställningar',
    profile_section: 'Profil',
    displayName: 'Visningsnamn',
    bio: 'Bio',
    saveChanges: 'Spara ändringar',
    saving: 'Sparar...',
    appearance: 'Utseende',
    theme: 'Tema',
    themeLight: 'Ljust — krämigt & guld',
    themeDark: 'Mörkt — navy & guld',
    language: 'Språk',
    languageSub: 'Välj appens språk',
    notifications_section: 'Notifikationer',
    eventReminders: 'Aktivitetspåminnelser',
    eventRemindersSub: 'Bli påmind innan aktiviteter',
    pointsUpdates: 'Poänguppdateringar',
    pointsUpdatesSub: 'När du tjänar eller spenderar poäng',
    streakReminders: 'Svitpåminnelser',
    streakRemindersSub: 'Daglig incheckningspåminnelse',
    privacy: 'Integritet & Säkerhet',
    changePassword: 'Ändra lösenord',
    locationPerms: 'Platsbehörigheter',
    locationPermsSub: 'Krävs för incheckning',
    privacyPolicy: 'Integritetspolicy',
    about: 'Om',
    version: 'Version 1.0.0 · Youth Community Platform',
    // Auth
    welcomeBack: 'Välkommen tillbaka 👋',
    loginSub: 'Logga in på ditt konto',
    email: 'E-post',
    password: 'Lösenord',
    forgotPassword: 'Glömt lösenord?',
    login: 'Logga in',
    loggingIn: 'Loggar in...',
    noAccount: 'Inget konto?',
    signUp: 'Registrera dig',
    // Misc
    noEventsFound: 'Inga aktiviteter hittades',
    preferenceSaved: 'Inställning sparad',
  },
  en: {
    home: 'Home', events: 'Events', ranks: 'Ranks',
    rewards: 'Rewards', profile: 'Profile', admin: 'Admin',
    greeting: 'Assalamu Alaikum 👋',
    upcomingEvents: 'Upcoming Events',
    noEvents: 'No upcoming events',
    eventsTitle: 'Events',
    eventsSubtitle: 'Upcoming activities & gatherings',
    pastEvents: 'Past Events',
    allFilter: 'All',
    registered: 'registered',
    joined: '✓ Joined',
    register: 'Register',
    ended: 'Ended',
    points: 'Points',
    level: 'Level',
    streak: 'Streak',
    history: '📅 History',
    badges: '🏅 Badges',
    pointsTab: '💰 Points',
    noBadges: 'No badges yet — attend events to earn them!',
    noHistory: 'No attendance yet — join an event!',
    noPoints: 'No transactions yet',
    settings: '⚙️ Settings',
    logOut: '🚪 Log Out',
    changeAvatar: 'Change avatar',
    changeCover: 'Change cover',
    myBadges: '🏅 My Badges',
    settingsTitle: 'Settings',
    profile_section: 'Profile',
    displayName: 'Display Name',
    bio: 'Bio',
    saveChanges: 'Save Changes',
    saving: 'Saving...',
    appearance: 'Appearance',
    theme: 'Theme',
    themeLight: 'Light — cream & gold',
    themeDark: 'Dark — navy & gold',
    language: 'Language',
    languageSub: 'Choose app language',
    notifications_section: 'Notifications',
    eventReminders: 'Event Reminders',
    eventRemindersSub: 'Get reminded before events',
    pointsUpdates: 'Points Updates',
    pointsUpdatesSub: 'When you earn or spend points',
    streakReminders: 'Streak Reminders',
    streakRemindersSub: 'Daily streak check-in reminder',
    privacy: 'Privacy & Security',
    changePassword: 'Change Password',
    locationPerms: 'Location Permissions',
    locationPermsSub: 'Required for check-in',
    privacyPolicy: 'Privacy Policy',
    about: 'About',
    version: 'Version 1.0.0 · Youth Community Platform',
    welcomeBack: 'Welcome back 👋',
    loginSub: 'Log in to your community account',
    email: 'Email',
    password: 'Password',
    forgotPassword: 'Forgot password?',
    login: 'Log In',
    loggingIn: 'Logging in...',
    noAccount: "Don't have an account?",
    signUp: 'Sign up',
    noEventsFound: 'No events found',
    preferenceSaved: 'Preference saved',
  },
} as const

type TKey = keyof typeof translations.sv

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TKey) => string
}

const LangContext = createContext<LangCtx>({
  lang: 'sv', setLang: () => {}, t: k => translations.sv[k],
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('sv')

  useEffect(() => {
    const saved = (localStorage.getItem('vikc-lang') as Lang) || 'sv'
    setLangState(saved)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('vikc-lang', l)
  }

  const t = (key: TKey): string => translations[lang][key] ?? translations.sv[key]

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export function useLang() {
  return useContext(LangContext)
}
