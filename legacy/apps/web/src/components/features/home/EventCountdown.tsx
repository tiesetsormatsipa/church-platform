// apps/web/src/components/features/home/EventCountdown.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MapPin, ExternalLink, CalendarDays, Ticket } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface TimeLeft {
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(targetDate: Date): TimeLeft {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

  const totalSeconds = Math.floor(diff / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours   = Math.floor(totalMinutes / 60);
  const totalDays    = Math.floor(totalHours / 24);

  const months  = Math.floor(totalDays / 30);
  const days    = totalDays % 30;
  const hours   = totalHours % 24;
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;

  return { months, days, hours, minutes, seconds };
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  const [prev, setPrev] = useState(value);
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    if (value !== prev) {
      setFlip(true);
      const t = setTimeout(() => { setPrev(value); setFlip(false); }, 300);
      return () => clearTimeout(t);
    }
  }, [value, prev]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {/* Card */}
        <div
          className={`
            w-20 sm:w-24 lg:w-28 h-20 sm:h-24 lg:h-28
            bg-navy rounded-2xl border border-gold/20 shadow-navy
            flex items-center justify-center
            transition-transform duration-300
            ${flip ? 'scale-95' : 'scale-100'}
          `}
          style={{ boxShadow: '0 4px 20px rgba(27,43,75,0.4), inset 0 1px 0 rgba(212,175,55,0.1)' }}
        >
          <span className="countdown-digit text-4xl sm:text-5xl lg:text-6xl">
            {String(value).padStart(2, '0')}
          </span>
        </div>
        {/* Divider line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-px h-px bg-gold/10" />
      </div>
      <span className="text-xs sm:text-sm font-body font-medium text-charcoal-500 tracking-wider uppercase">
        {label}
      </span>
    </div>
  );
}

export function EventCountdown() {
  const { data: config } = useQuery({
    queryKey: ['event-countdown'],
    queryFn: () => api.get('/api/v1/home/countdown').then((r) => r.data),
    // Fallback to default event date (6 August)
    placeholderData: {
      title: 'Annual Convention',
      description: 'Join us for our annual gathering of faith, worship, and the Word.',
      eventDate: new Date(new Date().getFullYear(), 7, 6).toISOString(), // August 6
      ctaLabel: 'Book Accommodation',
      bookingUrl: '#',
      mapsUrl: 'https://maps.google.com',
    },
  });

  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    months: 0, days: 0, hours: 0, minutes: 0, seconds: 0,
  });

  useEffect(() => {
    if (!config?.eventDate) return;
    const target = new Date(config.eventDate);

    const tick = () => setTimeLeft(calculateTimeLeft(target));
    tick();

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [config?.eventDate]);

  const isPast = Object.values(timeLeft).every((v) => v === 0);

  return (
    <section id="event-countdown" className="bg-cream py-20 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/25 rounded-full px-4 py-1.5 mb-5">
            <CalendarDays className="w-4 h-4 text-gold" />
            <span className="text-gold-700 text-sm font-body font-medium">
              Upcoming Event
            </span>
          </div>

          <h2 className="font-heading text-4xl sm:text-5xl font-bold text-navy mb-3">
            {config?.title || 'Annual Convention'}
          </h2>
          <p className="font-body text-charcoal-500 text-lg mb-4 max-w-lg mx-auto">
            {config?.description}
          </p>

          {/* Event date display */}
          {config?.eventDate && (
            <p className="font-body text-charcoal-400 text-sm mb-10">
              {new Date(config.eventDate).toLocaleDateString('en-ZA', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          )}
        </motion.div>

        {/* Countdown grid */}
        {!isPast ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-12"
          >
            {timeLeft.months > 0 && (
              <CountdownUnit value={timeLeft.months} label="Months" />
            )}
            <CountdownUnit value={timeLeft.days}    label="Days"    />
            <CountdownUnit value={timeLeft.hours}   label="Hours"   />
            <CountdownUnit value={timeLeft.minutes} label="Minutes" />
            <CountdownUnit value={timeLeft.seconds} label="Seconds" />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-12"
          >
            <p className="font-heading text-2xl text-gold font-bold">
              The event is now live! 🙏
            </p>
          </motion.div>
        )}

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          {config?.bookingUrl && (
            <a
              href={config.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gold text-navy font-body font-semibold px-8 py-3.5 rounded-xl hover:bg-gold-600 transition-all shadow-gold hover:-translate-y-0.5"
            >
              <Ticket className="w-5 h-5" />
              {config.ctaLabel || 'Book Accommodation'}
              <ExternalLink className="w-4 h-4 opacity-60" />
            </a>
          )}
          {config?.mapsUrl && (
            <a
              href={config.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-navy text-white font-body font-semibold px-8 py-3.5 rounded-xl hover:bg-navy-700 transition-all hover:-translate-y-0.5"
            >
              <MapPin className="w-5 h-5" />
              View Location
              <ExternalLink className="w-4 h-4 opacity-60" />
            </a>
          )}
        </motion.div>
      </div>
    </section>
  );
}
