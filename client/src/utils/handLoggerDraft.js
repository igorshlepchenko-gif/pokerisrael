export const HAND_LOGGER_DRAFT_KEY = 'handlogger_draft_v1';

export function clearHandLoggerDraft() {
  localStorage.removeItem(HAND_LOGGER_DRAFT_KEY);
}
