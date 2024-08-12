export function useUser() {
  const match = document.cookie.match(/userId=(?<id>[^;]+);?$/);
  if (!match) {
    return null; 
  }

  return { id: match.groups.id };
}
