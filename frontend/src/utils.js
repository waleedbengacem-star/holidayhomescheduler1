export function getDefaultDuration(taskType, bedrooms = 1, numCleaners = 1) {
  const l = (taskType || '').toLowerCase();
  
  let base = 60;
  if (l.includes('deep clean') || l.includes('spring clean')) base = 150;
  else if (l.includes('check out') || l.includes('checkout')) base = 120;
  else if (l.includes('midstay') || l.includes('mid-stay')) base = 90;
  else if (l.includes('touch up')) base = 60;
  else if (l.includes('cleaning') || l.includes('clean')) base = 120;
  else if (l.includes('check-in') || l.includes('check in')) return 30; // PA tasks don't scale by bedroom
  else if (l.includes('viewing')) return 30;
  else if (l.includes('cash collection')) return 30;
  else if (l.includes('inspection')) return 30;
  else return 60;

  // Scale by bedrooms for cleaning tasks
  const bedMultiplier = 1 + ((bedrooms - 1) * 0.3); // +30% time per extra bedroom
  const totalMins = base * bedMultiplier;
  
  // Scale by cleaners
  return Math.ceil(totalMins / numCleaners);
}
