// apps/web/src/app/profile/page.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User, CheckCircle2, Clock, AlertCircle, Camera,
  MapPin, Calendar, Church, Shield, Edit3, Save, X,
  FileText, ChevronRight, BadgeCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const profileSchema = z.object({
  firstName:    z.string().min(1, 'Required'),
  surname:      z.string().min(1, 'Required'),
  dateOfBirth:  z.string().optional(),
  phone:        z.string().optional(),
  cityTown:     z.string().optional(),
  baptismDate:  z.string().optional(),
  baptismPlace: z.string().optional(),
  bio:          z.string().max(300).optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

function VerificationBadge({ status }: { status: string }) {
  const config = {
    VERIFIED:             { label: 'Verified Member',          icon: BadgeCheck,  cls: 'bg-green-50 text-green-700 border-green-200' },
    PENDING:              { label: 'Verification Pending',      icon: Clock,       cls: 'bg-blue-50 text-blue-700 border-blue-200'  },
    UNVERIFIED:           { label: 'Unverified',               icon: AlertCircle, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    REJECTED:             { label: 'Verification Rejected',    icon: X,           cls: 'bg-red-50 text-church-red border-red-200'  },
  };
  const c = config[status as keyof typeof config] || config.UNVERIFIED;
  const Icon = c.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-body font-medium px-3 py-1.5 rounded-full border', c.cls)}>
      <Icon className="w-4 h-4" />
      {c.label}
    </span>
  );
}

function ProfileCompletionBar({ profile }: { profile: any }) {
  const fields = [
    { key: 'firstName',    label: 'First Name' },
    { key: 'surname',      label: 'Surname' },
    { key: 'dateOfBirth',  label: 'Date of Birth' },
    { key: 'profilePictureUrl', label: 'Profile Photo' },
    { key: 'countryId',    label: 'Country' },
    { key: 'cityTown',     label: 'City/Town' },
    { key: 'baptismDate',  label: 'Baptism Date' },
    { key: 'baptismPlace', label: 'Baptism Place' },
  ];

  const completed = fields.filter((f) => !!profile?.[f.key]).length;
  const pct = Math.round((completed / fields.length) * 100);
  const missing = fields.filter((f) => !profile?.[f.key]).map((f) => f.label);

  return (
    <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-body font-semibold text-navy text-sm">Profile Completion</h3>
        <span className={cn(
          'font-heading font-bold text-lg',
          pct === 100 ? 'text-green-600' : pct >= 50 ? 'text-gold-700' : 'text-amber-600',
        )}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-charcoal-100 rounded-full overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full',
            pct === 100 ? 'bg-green-500' : 'bg-gold',
          )}
        />
      </div>

      {missing.length > 0 && (
        <p className="text-xs text-charcoal-400 font-body">
          Missing: {missing.join(', ')}
        </p>
      )}
      {pct === 100 && (
        <p className="text-xs text-green-600 font-body flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Profile complete!
        </p>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/api/v1/users/me/profile').then((r) => r.data),
  });

  const {
    register, handleSubmit, reset, formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName:    profile?.firstName    || '',
      surname:      profile?.surname      || '',
      dateOfBirth:  profile?.dateOfBirth  ? format(new Date(profile.dateOfBirth), 'yyyy-MM-dd') : '',
      phone:        profile?.phone        || '',
      cityTown:     profile?.cityTown     || '',
      baptismDate:  profile?.baptismDate  ? format(new Date(profile.baptismDate), 'yyyy-MM-dd') : '',
      baptismPlace: profile?.baptismPlace || '',
      bio:          profile?.bio          || '',
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: ProfileForm) => api.patch('/api/v1/users/me/profile', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      qc.invalidateQueries({ queryKey: ['auth-profile'] });
      setEditing(false);
    },
  });

  const submitVerificationMutation = useMutation({
    mutationFn: () => api.post('/api/v1/users/me/verification').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth-profile'] }),
  });

  if (isLoading) return (
    <div className="pt-16 min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const verificationStatus = user?.verificationStatus || 'UNVERIFIED';
  const canSubmitVerification = verificationStatus === 'UNVERIFIED' || verificationStatus === 'REJECTED';

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy-gradient py-12 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 church-pattern opacity-10" />
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold-gradient" />
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-end gap-5"
          >
            {/* Avatar */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-gold/20 border-2 border-gold/40 overflow-hidden">
                {profile?.profilePictureUrl ? (
                  <img src={profile.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-heading font-bold text-gold text-3xl">
                      {profile?.firstName?.[0] || 'U'}
                    </span>
                  </div>
                )}
              </div>
              <button className="absolute inset-0 flex items-center justify-center bg-navy/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                <Camera className="w-6 h-6 text-white" />
              </button>
            </div>

            <div>
              <h1 className="font-heading font-bold text-white text-3xl sm:text-4xl mb-1">
                {profile?.firstName} {profile?.surname}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <VerificationBadge status={verificationStatus} />
                {user?.roles?.slice(0, 2).map((r: any) => (
                  <span key={r.role?.id} className="text-xs text-white/50 font-body capitalize">
                    {r.role?.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Edit button */}
            <button
              onClick={() => { setEditing(!editing); if (editing) reset(); }}
              className={cn(
                'sm:ml-auto flex items-center gap-2 px-4 py-2 rounded-xl font-body text-sm font-medium transition-all',
                editing
                  ? 'bg-charcoal-600 text-white hover:bg-charcoal-700'
                  : 'bg-gold text-navy hover:bg-gold-600 shadow-gold',
              )}
            >
              {editing ? <><X className="w-4 h-4" /> Cancel</> : <><Edit3 className="w-4 h-4" /> Edit Profile</>}
            </button>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left sidebar */}
          <div className="space-y-4">
            <ProfileCompletionBar profile={profile} />

            {/* Branch / Location */}
            <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-5 space-y-3">
              <h3 className="font-body font-semibold text-navy text-sm">Membership Details</h3>

              {profile?.branch && (
                <div className="flex items-start gap-2.5">
                  <Church className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-charcoal-400 font-body">Branch</p>
                    <p className="text-sm font-body text-navy font-medium">{profile.branch.name}</p>
                  </div>
                </div>
              )}

              {profile?.country && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-charcoal-400 font-body">Location</p>
                    <p className="text-sm font-body text-navy font-medium">
                      {[profile.cityTown, profile.province?.name, profile.country.name].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {profile?.baptismDate && (
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-charcoal-400 font-body">Baptised</p>
                    <p className="text-sm font-body text-navy font-medium">
                      {format(new Date(profile.baptismDate), 'dd MMMM yyyy')}
                      {profile.baptismPlace && ` · ${profile.baptismPlace}`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Verification CTA */}
            {canSubmitVerification && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-start gap-3 mb-4">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-body font-semibold text-amber-800 text-sm">
                      Get Verified
                    </p>
                    <p className="font-body text-amber-700 text-xs mt-0.5 leading-relaxed">
                      Submit your profile for verification to access all platform features. An admin will review your information.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => submitVerificationMutation.mutate()}
                  disabled={submitVerificationMutation.isPending || !profile?.isProfileComplete}
                  className="w-full bg-amber-600 text-white font-body text-sm font-semibold py-2.5 rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitVerificationMutation.isPending ? 'Submitting...' : 'Submit for Verification'}
                </button>
                {!profile?.isProfileComplete && (
                  <p className="text-xs text-amber-600 mt-2 text-center font-body">
                    Complete your profile first
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Main form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
              <div className="bg-white rounded-2xl border border-charcoal-100 shadow-card p-6">
                <h2 className="font-heading font-bold text-navy text-xl mb-5">
                  Personal Information
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* First name */}
                  <div>
                    <label className="block text-xs font-body font-medium text-charcoal-500 mb-1.5 uppercase tracking-wide">
                      First Name *
                    </label>
                    <input
                      {...register('firstName')}
                      disabled={!editing}
                      className={cn(
                        'w-full px-3.5 py-2.5 border rounded-xl text-sm font-body transition-all',
                        'focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50',
                        editing ? 'border-charcoal-200 bg-white' : 'border-transparent bg-charcoal-50 text-charcoal-600',
                        errors.firstName && 'border-red-300',
                      )}
                    />
                    {errors.firstName && <p className="text-xs text-church-red mt-1">{errors.firstName.message}</p>}
                  </div>

                  {/* Surname */}
                  <div>
                    <label className="block text-xs font-body font-medium text-charcoal-500 mb-1.5 uppercase tracking-wide">
                      Surname *
                    </label>
                    <input
                      {...register('surname')}
                      disabled={!editing}
                      className={cn(
                        'w-full px-3.5 py-2.5 border rounded-xl text-sm font-body transition-all',
                        'focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50',
                        editing ? 'border-charcoal-200 bg-white' : 'border-transparent bg-charcoal-50 text-charcoal-600',
                      )}
                    />
                  </div>

                  {/* Date of birth */}
                  <div>
                    <label className="block text-xs font-body font-medium text-charcoal-500 mb-1.5 uppercase tracking-wide">
                      Date of Birth
                    </label>
                    <input
                      {...register('dateOfBirth')}
                      type="date"
                      disabled={!editing}
                      className={cn(
                        'w-full px-3.5 py-2.5 border rounded-xl text-sm font-body transition-all',
                        'focus:outline-none focus:ring-2 focus:ring-gold/30',
                        editing ? 'border-charcoal-200 bg-white' : 'border-transparent bg-charcoal-50 text-charcoal-600',
                      )}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-body font-medium text-charcoal-500 mb-1.5 uppercase tracking-wide">
                      Phone Number
                    </label>
                    <input
                      {...register('phone')}
                      disabled={!editing}
                      placeholder="+27 ..."
                      className={cn(
                        'w-full px-3.5 py-2.5 border rounded-xl text-sm font-body transition-all',
                        'focus:outline-none focus:ring-2 focus:ring-gold/30',
                        editing ? 'border-charcoal-200 bg-white' : 'border-transparent bg-charcoal-50 text-charcoal-600',
                      )}
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-body font-medium text-charcoal-500 mb-1.5 uppercase tracking-wide">
                      City / Town
                    </label>
                    <input
                      {...register('cityTown')}
                      disabled={!editing}
                      className={cn(
                        'w-full px-3.5 py-2.5 border rounded-xl text-sm font-body transition-all',
                        'focus:outline-none focus:ring-2 focus:ring-gold/30',
                        editing ? 'border-charcoal-200 bg-white' : 'border-transparent bg-charcoal-50 text-charcoal-600',
                      )}
                    />
                  </div>

                  {/* Baptism date */}
                  <div>
                    <label className="block text-xs font-body font-medium text-charcoal-500 mb-1.5 uppercase tracking-wide">
                      Baptism Date
                    </label>
                    <input
                      {...register('baptismDate')}
                      type="date"
                      disabled={!editing}
                      className={cn(
                        'w-full px-3.5 py-2.5 border rounded-xl text-sm font-body transition-all',
                        'focus:outline-none focus:ring-2 focus:ring-gold/30',
                        editing ? 'border-charcoal-200 bg-white' : 'border-transparent bg-charcoal-50 text-charcoal-600',
                      )}
                    />
                  </div>

                  {/* Baptism place */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-body font-medium text-charcoal-500 mb-1.5 uppercase tracking-wide">
                      Baptism Place
                    </label>
                    <input
                      {...register('baptismPlace')}
                      disabled={!editing}
                      className={cn(
                        'w-full px-3.5 py-2.5 border rounded-xl text-sm font-body transition-all',
                        'focus:outline-none focus:ring-2 focus:ring-gold/30',
                        editing ? 'border-charcoal-200 bg-white' : 'border-transparent bg-charcoal-50 text-charcoal-600',
                      )}
                    />
                  </div>

                  {/* Bio */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-body font-medium text-charcoal-500 mb-1.5 uppercase tracking-wide">
                      Bio
                    </label>
                    <textarea
                      {...register('bio')}
                      disabled={!editing}
                      rows={3}
                      maxLength={300}
                      className={cn(
                        'w-full px-3.5 py-2.5 border rounded-xl text-sm font-body transition-all resize-none',
                        'focus:outline-none focus:ring-2 focus:ring-gold/30',
                        editing ? 'border-charcoal-200 bg-white' : 'border-transparent bg-charcoal-50 text-charcoal-600',
                      )}
                    />
                  </div>
                </div>

                {editing && (
                  <div className="flex gap-3 mt-6 pt-5 border-t border-charcoal-50">
                    <button
                      type="submit"
                      disabled={saveMutation.isPending || !isDirty}
                      className="flex items-center gap-2 bg-navy text-white font-body font-semibold text-sm px-6 py-2.5 rounded-xl hover:bg-navy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { reset(); setEditing(false); }}
                      className="px-4 py-2.5 border border-charcoal-200 rounded-xl text-charcoal-600 font-body text-sm hover:bg-charcoal-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
