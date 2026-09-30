export function isSamModeUser(currentUser, activeProfile) {
  if (
    currentUser?.id === 'sam_ludwig' ||
    activeProfile?.id === 'sam_ludwig' ||
    currentUser?.name?.toLowerCase().includes('sam ludwig') ||
    activeProfile?.name?.toLowerCase().includes('sam ludwig')
  ) {
    return true;
  }
  const email = (
    currentUser?.email ||
    activeProfile?.email ||
    (typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : '') ||
    ''
  ).toLowerCase().trim();
  return email === 'sam.ludwig@gmail.com' || email.includes('sam.ludwig');
}
