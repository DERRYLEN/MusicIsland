import { useState, useEffect } from 'react';

export interface ClockState {
  time: string;       // e.g. "07:08"
  seconds: string;    // e.g. "12"
  fullTime: string;   // e.g. "07:08:12"
  date: string;       // e.g. "Sen, 19 Okt"
  dayName: string;    // e.g. "Selasa"
}

function getSystemClock(): ClockState {
  const now = new Date();

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  };
  const date = now.toLocaleDateString('id-ID', dateOptions);

  const rawDay = now.toLocaleDateString('id-ID', { weekday: 'long' });
  const dayName = rawDay.charAt(0).toUpperCase() + rawDay.slice(1);

  return {
    time: `${hours}:${minutes}`,
    seconds,
    fullTime: `${hours}:${minutes}:${seconds}`,
    date,
    dayName,
  };
}

export function useClock(): ClockState {
  const [clock, setClock] = useState<ClockState>(getSystemClock);

  useEffect(() => {
    // Update every second to maintain exact match with Windows taskbar clock
    const timer = setInterval(() => {
      setClock(getSystemClock());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return clock;
}
