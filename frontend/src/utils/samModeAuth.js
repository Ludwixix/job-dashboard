export function isSamModeUser(currentUser, activeProfile) {
  const email = (
    currentUser?.email ||
    activeProfile?.email ||
    (typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null) ||
    ''
  ).toLowerCase().trim();
  return email === 'sam.ludwig@gmail.com';
}
