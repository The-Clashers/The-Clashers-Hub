// Chat language options for the search filter row.
//
// Search items carry a chatLanguage object ({ id, name, languageCode }); the
// filter matches on the code because the code is what the payload reports
// and what a one-line table edit can true against a live capture. English's
// code is verified live (docs/api-local-tests.md section 3.1); the rest are
// the game's language-setting codes. The failure mode of a wrong code is
// visible, never silent: a clan whose code the table spells wrong simply
// never matches, the meta line reads "0 shown of N loaded", and the fix is a
// one-line edit here. The mock upstream carries EN/ES/PT so the filter is
// exercisable locally end to end.

export interface ChatLanguageOption {
  readonly code: string;
  readonly name: string;
}

export const CHAT_LANGUAGE_FILTERS: readonly ChatLanguageOption[] = [
  { code: 'EN', name: 'English' },
  { code: 'ES', name: 'Spanish' },
  { code: 'PT', name: 'Portuguese' },
  { code: 'FR', name: 'French' },
  { code: 'DE', name: 'German' },
  { code: 'IT', name: 'Italian' },
  { code: 'TR', name: 'Turkish' },
  { code: 'RU', name: 'Russian' },
  { code: 'JA', name: 'Japanese' },
  { code: 'KO', name: 'Korean' },
  { code: 'HI', name: 'Hindi' },
  { code: 'ID', name: 'Indonesian' },
  { code: 'TH', name: 'Thai' },
  { code: 'VI', name: 'Vietnamese' },
];
