export const toMinutes = (time: string) => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; };
export const isWithinAvailability = (availableStart: string, availableEnd: string, start: Date, end: Date) => {
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  return startMinutes >= toMinutes(availableStart) && endMinutes <= toMinutes(availableEnd) && end > start;
};
export const intervalsOverlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && aEnd > bStart;
