import { useState, useEffect } from 'react';

export interface ClockState {
  time: string;           // e.g. "15:24"
  hours: string;          // e.g. "15"
  minutes: string;        // e.g. "24"
  seconds: string;        // e.g. "12"
  fullTime: string;       // e.g. "15:24:12"
  date: string;           // e.g. "Kam, 24 Okt"
  dayName: string;        // e.g. "Kamis"
  dayWithComma: string;   // e.g. "Kamis,"
  dateShort: string;      // e.g. "24 Okt"
  timezone: string;       // e.g. "WIB"
}

function getTimezoneName(): string {
  try {
    const tz = Intl.DateTimeFormat('id-ID', { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value;
    if (tz) return tz;
  } catch {}
  return 'WIB';
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
  const dayWithComma = `${dayName},`;

  const dayNum = now.getDate();
  const monthShortRaw = now.toLocaleDateString('id-ID', { month: 'short' });
  const monthShort = monthShortRaw.charAt(0).toUpperCase() + monthShortRaw.slice(1);
  const dateShort = `${dayNum} ${monthShort}`;

  const timezone = getTimezoneName();

  return {
    time: `${hours}:${minutes}`,
    hours,
    minutes,
    seconds,
    fullTime: `${hours}:${minutes}:${seconds}`,
    date,
    dayName,
    dayWithComma,
    dateShort,
    timezone,
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
