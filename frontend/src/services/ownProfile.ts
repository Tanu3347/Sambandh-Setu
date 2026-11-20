// src/services/ownProfile.ts
// Builds the signed-in user's own profile from what they entered:
//   - the sign-in user (name)                      -> useAuth()
//   - onboarding data saved by OnboardingSuccess   -> AsyncStorage 'setu_profile'
//   - profile builder answers                      -> AsyncStorage 'setu_builder_answers'
// No mock names. Anything the user has not given is left empty.

import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getMyProfile } from './myProfile';
import type { Profile, Section } from './profileData';

export const PROFILE_KEY = 'setu_profile';
export const BUILDER_ANSWERS_KEY = 'setu_builder_answers';

export type OwnProfile = Profile & { photoUri?: string };
type Bag = Record<string, any>;

function ageFrom(dob?: string): number | null {
  if (!dob) return null;
  let d: Date | null = null;
  const m = String(dob).match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); // DD/MM/YYYY
  if (m) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  else if (!isNaN(Date.parse(dob))) d = new Date(dob);
  if (!d || isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

const asText = (v: unknown) => (Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : '');
// "Other" answers keep their typed text under `${id}_other`
const pick = (a: Bag, id: string) => (a[id] === 'Other' ? asText(a[`${id}_other`]) : asText(a[id]));

export function buildOwnProfile(name: string, saved: Bag, a: Bag): OwnProfile {
  const dob = saved.dob ?? saved.dateOfBirth ?? saved.birthDate; // adjust if your Basics screen uses another key
  const languages = asText(saved.languages);
  const rows = (items: [string, string, string][]) =>
    items.filter(([, , v]) => !!v).map(([icon, label, value]) => ({ icon, label, value }));
  const section = (title: string, items: [string, string, string][]): Section[] => {
    const r = rows(items);
    return r.length ? [{ title, rows: r }] : [];
  };

  return {
    name,
    age: ageFrom(dob) ?? 0,
    gender: asText(saved.gender),
    height: asText(saved.height),
    education: asText(saved.education),
    profession: asText(saved.profession),
    location: asText(saved.location),
    // Edit Profile wins; otherwise use the last builder step ("Tell people a little about yourself")
    bio: typeof saved.bio === 'string' ? saved.bio : asText(a.about),
    photoUri: saved.photoUri || undefined,
    about: [
      ...section('Personal Details', [
        ['person-outline', 'Name', name],
        ['location-outline', 'City', asText(saved.location)],
        ['resize-outline', 'Height', asText(saved.height)],
        ['language-outline', 'Languages', languages],
      ]),
      ...section('Education & Career', [
        ['school-outline', 'Education', asText(saved.education)],
        ['briefcase-outline', 'Profession', asText(saved.profession)],
      ]),
    ],
    lifestyle: section('Lifestyle & Interests', [
      ['heart-outline', 'Interests', asText(a.interests)],
      ['cafe-outline', 'Lifestyle', pick(a, 'lifestyle')],
      ['sparkles-outline', 'Values in a relationship', asText(a.values)],
      ['people-outline', 'Partnership', pick(a, 'partnership')],
      ['location-outline', 'Where to live', asText(a.livingPref)],
      ['trending-up-outline', 'Career growth', asText(a.careerGrowth)],
    ]),
    family: [],
  };
}

// Reloads every time the screen is focused, so it picks up newly saved answers.
export function useOwnProfile(): OwnProfile {
  const { user } = useAuth();
  const [profile, setProfile] = useState<OwnProfile>(() => buildOwnProfile(user?.name ?? '', {}, {}));

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const my = await getMyProfile().catch(() => null);
          const [p, a] = await Promise.all([
            AsyncStorage.getItem(PROFILE_KEY),
            AsyncStorage.getItem(BUILDER_ANSWERS_KEY),
          ]);
          const localSaved: Bag = p ? JSON.parse(p) : {};
          const localAnswers: Bag = a ? JSON.parse(a) : {};
          const remoteBag: Bag = my ? {
            name: my.name,
            gender: my.gender,
            bio: my.bio,
            education: my.education,
            profession: my.profession,
            location: my.location,
            height: my.height,
            photoUri: my.photoUri,
            languages: my.languages,
            age: my.age,
          } : {};
          const saved: Bag = { ...localSaved, ...remoteBag };
          const resolvedName = my?.name || user?.name || saved.name || '';
          if (alive) setProfile(buildOwnProfile(resolvedName, saved, localAnswers));
        } catch {
          /* keep current profile */
        }
      })();
      return () => { alive = false; };
    }, [user?.name]),
  );

  return profile;
}