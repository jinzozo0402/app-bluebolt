import { daysOfWeek } from "./models";

export const dateAsYmd = (date: Date = new Date()) => {
  const currentDay = String(date.getDate()).padStart(2, '0');

  const currentMonth = String(date.getMonth()+1).padStart(2,"0");

  const currentYear = date.getFullYear();

  return `${currentYear}-${currentMonth}-${currentDay}`;
}

export const dateMonth = (date: Date) => new Intl.DateTimeFormat('en', { month: 'long' }).format(date); 

export const truncateToDateOnly = (date: Date) => new Date(date.toDateString());

export const addDays = (date: Date, days: number) => {
  const newDate = new Date(date);
  newDate.setDate(date.getDate() + days);
  return newDate;
}

export const isDateBetween = (testDate: Date, startDate: Date, endDate: Date) => startDate < testDate && testDate < endDate;

export const toTimezone = (date: Date = new Date(), timezone: string = 'America/New_York') => new Date(date.toLocaleString('en-US', { timeZone: timezone }));

// the weekday from a specific day
export const weekdayFrom = (date: Date) => daysOfWeek[date.getDay()];