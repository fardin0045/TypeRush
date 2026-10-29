const key = 'typerush.v1';
export function load() {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return {
      ...data,
      difficulty: ['Easy', 'Normal', 'Hard', 'Expert'].includes(data.difficulty)
        ? data.difficulty
        : 'Normal',
      history: Array.isArray(data.history)
        ? data.history.filter((x) => x && typeof x.net === 'number').slice(0, 30)
        : [],
    };
  } catch {
    return {};
  }
}
export function save(value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
