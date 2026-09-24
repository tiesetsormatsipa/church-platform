// apps/web/src/components/layout/Footer.tsx
import Link from 'next/link';
import { MapPin, Mail, Globe } from 'lucide-react';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy border-t border-gold/10">
      {/* Gold accent line */}
      <div className="h-0.5 bg-gold-gradient" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-gold-gradient flex items-center justify-center">
                <span className="text-navy font-heading font-bold text-sm">✝</span>
              </div>
              <span className="font-heading font-bold text-white text-xl">Church Platform</span>
            </div>
            <p className="font-body text-white/50 text-sm leading-relaxed max-w-sm">
              A community of believers growing together across South Africa and beyond.
              Built on faith, truth, and love.
            </p>
            <div className="flex items-center gap-1.5 mt-4 text-white/40 text-xs font-body">
              <MapPin className="w-3 h-3" />
              <span>South Africa · Expanding Globally</span>
            </div>
          </div>

          {/* Platform */}
          <div>
            <p className="font-body font-semibold text-white/80 text-sm mb-4 uppercase tracking-wider">
              Platform
            </p>
            <ul className="space-y-2.5">
              {[
                { href: '/',           label: 'Home' },
                { href: '/branches',   label: 'Branches' },
                { href: '/regions',    label: 'Global Map' },
                { href: '/sermons',    label: 'Sermons' },
                { href: '/songs',      label: 'Praise Songs' },
                { href: '/marketplace', label: 'Marketplace' },
                { href: '/jobs',       label: 'Jobs' },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-white/50 hover:text-gold text-sm font-body transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="font-body font-semibold text-white/80 text-sm mb-4 uppercase tracking-wider">
              Legal & Privacy
            </p>
            <ul className="space-y-2.5">
              {[
                { href: '/privacy',   label: 'Privacy Policy' },
                { href: '/terms',     label: 'Terms of Use' },
                { href: '/popia',     label: 'POPIA Notice' },
                { href: '/contact',   label: 'Contact Us' },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-white/50 hover:text-gold text-sm font-body transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-5 pt-5 border-t border-white/10">
              <a
                href="mailto:privacy@church.org"
                className="flex items-center gap-1.5 text-white/40 hover:text-gold transition-colors text-xs font-body"
              >
                <Mail className="w-3 h-3" />
                privacy@church.org
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/30 text-xs font-body">
            © {year} Church Platform. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-white/30 text-xs font-body">
              Built for South Africa · Ready for the World
            </span>
            <Globe className="w-3.5 h-3.5 text-gold/40" />
          </div>
        </div>
      </div>
    </footer>
  );
}
